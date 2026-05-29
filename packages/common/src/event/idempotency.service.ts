import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from '@package/redis';

const DEFAULT_TTL_SECONDS = 86_400; // 24h — long enough that an event already
                                    // fully processed cannot be re-claimed by
                                    // a delayed Kafka redelivery.

/**
 * Cross-replica idempotency guard backed by Redis.
 *
 * Use when N consumers in the same group might process a Kafka offset more
 * than once due to rebalances or retries. The in-memory LRU dedup in
 * notification-service KafkaService catches duplicates within a single
 * replica only; this helper extends that to all replicas.
 *
 * Pattern:
 *   if (await idem.claim('chapter.published', evt.id)) {
 *     await handler.handle(evt);  // first replica wins
 *   } // else: someone else already processing/processed it
 *
 * Storage: each key is `idem:<topic>:<eventId>` with a TTL (default 24h).
 * The set-if-not-exists with TTL is a single atomic SET NX EX command.
 *
 * Failure mode: if Redis is unreachable, claim() returns true (fail OPEN) so
 * the service keeps making progress. Handlers should still be idempotent
 * defensively. The downside is potential dup processing during a Redis
 * outage; tradeoff is documented and accepted.
 */
@Injectable()
export class IdempotencyService {
  private readonly logger = new Logger(IdempotencyService.name);

  constructor(private readonly redis: RedisService) {}

  /**
   * Atomically claim ownership of (topic, eventId).
   * @returns true if THIS process should process the event; false if a peer
   *          already claimed it (skip processing).
   */
  async claim(
    topic: string,
    eventId: string,
    ttlSeconds = DEFAULT_TTL_SECONDS,
  ): Promise<boolean> {
    if (!this.redis.isEnabled()) {
      // Redis disabled or down → fail OPEN. See class docstring.
      return true;
    }
    const key = this.keyFor(topic, eventId);
    try {
      return await this.redis.setnx(key, '1', ttlSeconds);
    } catch (err: any) {
      this.logger.warn(
        `idempotency claim failed for ${topic}:${eventId} — processing anyway: ${(err as Error).message}`,
      );
      return true;
    }
  }

  /**
   * Manually release a claim — for tests, or to allow re-processing after a
   * known-recoverable failure. Production handlers normally don't call this.
   */
  async release(topic: string, eventId: string): Promise<void> {
    try {
      await this.redis.del(this.keyFor(topic, eventId));
    } catch {
      // swallow — best-effort cleanup
    }
  }

  /**
   * Try to acquire a short-lived leader lock. Use for periodic jobs that
   * should run on exactly one replica per tick — e.g. outbox relay cron.
   *
   * Difference vs `claim`: lock is RELEASED automatically by TTL (no manual
   * release needed) and the key namespace is `lock:` instead of `idem:`.
   * Pick `ttlSeconds` to be slightly larger than your cron interval so the
   * lock survives the run; if a replica crashes mid-run, the next tick on
   * another replica picks it up.
   *
   * Fails OPEN when Redis is down (returns true) so the job still runs —
   * SKIP LOCKED in the SQL still prevents two replicas from corrupting state.
   */
  async tryLeaderLock(name: string, ttlSeconds: number): Promise<boolean> {
    if (!this.redis.isEnabled()) return true;
    try {
      return await this.redis.setnx(`lock:${name}`, '1', ttlSeconds);
    } catch (err: any) {
      this.logger.warn(
        `leader lock check failed for ${name} — running anyway: ${(err as Error).message}`,
      );
      return true;
    }
  }

  private keyFor(topic: string, eventId: string): string {
    return `idem:${topic}:${eventId}`;
  }
}
