import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as jose from 'jose';

interface KeyPair {
  privateKey: CryptoKey;
  publicKey: CryptoKey;
  kid: string;
}

/**
 * JWKS / JWT signing service with key rotation support.
 *
 * Current key: JWT_PRIVATE_KEY_PEM + JWT_PUBLIC_KEY_PEM — used to SIGN.
 * Previous key (optional): JWT_PRIVATE_KEY_PEM_PREVIOUS + JWT_PUBLIC_KEY_PEM_PREVIOUS
 *   — kept in JWKS and verify-only during a rotation window so existing
 *   tokens stay valid until they expire.
 *
 * Rotation workflow:
 *   1. Move CURRENT → PREVIOUS, install new CURRENT, redeploy.
 *   2. After max(JWT_EXPIRES_IN, JWT_REFRESH_EXPIRES_IN) has elapsed,
 *      remove the PREVIOUS env vars and redeploy. No user logouts.
 */
@Injectable()
export class JwksService implements OnModuleInit {
  private current: KeyPair | null = null;
  private readonly extra: KeyPair[] = [];

  constructor(private readonly config: ConfigService) {}

  async onModuleInit() {
    const privatePem = this.config.get<string>('jwt.privateKeyPem');
    const publicPem = this.config.get<string>('jwt.publicKeyPem');
    const nodeEnv = this.config.get<string>('app.nodeEnv') || process.env.NODE_ENV;

    if (privatePem && publicPem) {
      this.current = await this.loadKeyPair(privatePem, publicPem);
    } else if (nodeEnv === 'production') {
      throw new Error(
        'JWT_PRIVATE_KEY_PEM and JWT_PUBLIC_KEY_PEM must be configured in production. Refusing to boot with ephemeral keys.',
      );
    } else {
      const { privateKey, publicKey } = await jose.generateKeyPair('RS256');
      const jwk = await jose.exportJWK(publicKey);
      const kid = await jose.calculateJwkThumbprint(jwk);
      this.current = { privateKey, publicKey, kid };
    }

    // Optional previous key kept around during rotation
    const prevPriv = process.env.JWT_PRIVATE_KEY_PEM_PREVIOUS;
    const prevPub = process.env.JWT_PUBLIC_KEY_PEM_PREVIOUS;
    if (prevPriv && prevPub) {
      try {
        this.extra.push(await this.loadKeyPair(prevPriv, prevPub));
      } catch (err: any) {
        // Loud failure: a malformed PREVIOUS key would silently break verify.
        throw new Error(
          `JWT_*_KEY_PEM_PREVIOUS provided but failed to parse: ${(err as Error).message}`,
        );
      }
    }
  }

  private async loadKeyPair(privatePem: string, publicPem: string): Promise<KeyPair> {
    const privateKey = await jose.importPKCS8(privatePem, 'RS256');
    const publicKey = await jose.importSPKI(publicPem, 'RS256');
    const jwk = await jose.exportJWK(publicKey);
    const kid = await jose.calculateJwkThumbprint(jwk);
    return { privateKey, publicKey, kid };
  }

  hasKeys(): boolean {
    return this.current !== null;
  }

  getPrivateKey(): CryptoKey {
    return this.current!.privateKey;
  }

  async getPublicKey(): Promise<CryptoKey> {
    return this.current!.publicKey;
  }

  /** All keys (current + previous), exposed via /.well-known/jwks.json */
  async getJwkSet(): Promise<{ keys: jose.JWK[] }> {
    const all = [this.current!, ...this.extra];
    const keys = await Promise.all(
      all.map(async (k) => ({
        ...(await jose.exportJWK(k.publicKey)),
        kid: k.kid,
        use: 'sig',
        alg: 'RS256',
      })),
    );
    return { keys };
  }

  async signToken(payload: jose.JWTPayload, expiresIn: string): Promise<string> {
    return new jose.SignJWT(payload)
      .setProtectedHeader({ alg: 'RS256', kid: this.current!.kid })
      .setIssuedAt()
      .setIssuer(this.config.get<string>('jwt.issuer')!)
      .setAudience(this.config.get<string>('jwt.audience')!)
      .setExpirationTime(expiresIn)
      .sign(this.current!.privateKey);
  }

  /**
   * Verify a token signed by ANY key we hold (current or previous-during-rotation).
   * jose lets us pass a key-resolver function.
   */
  async verifyToken(token: string): Promise<jose.JWTPayload> {
    const { payload } = await jose.jwtVerify(
      token,
      async (header) => this.resolveKey(header.kid),
      {
        // Lock the signature algorithm to RS256. Without an explicit allowlist
        // jose's defaults could let an attacker downgrade to HS256 and sign
        // with the public key (alg-confusion attack).
        algorithms: ['RS256'],
        issuer: this.config.get<string>('jwt.issuer'),
        audience: this.config.get<string>('jwt.audience'),
      },
    );
    return payload;
  }

  private resolveKey(kid: string | undefined): CryptoKey {
    // Reject tokens without a `kid` header. Every token we sign carries a kid
    // (see signToken). A missing kid is either an attacker-crafted token or a
    // very old legacy token — both should re-authenticate rather than be
    // accepted against an arbitrary key.
    if (!kid) throw new Error('JWT missing kid header');
    if (this.current && this.current.kid === kid) return this.current.publicKey;
    const match = this.extra.find((k) => k.kid === kid);
    if (match) return match.publicKey;
    throw new Error(`Unknown JWT kid: ${kid}`);
  }
}
