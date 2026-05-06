import { Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { I18nContext, I18nService } from 'nestjs-i18n';
import { randomUUID } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import {
  FileMetadata,
  IUploadStrategy,
  UploadResult,
} from '../interfaces/upload-strategy.interface';

const ALLOWED_FILENAME_RE = /^[A-Za-z0-9._-]+$/;

@Injectable()
export class LocalStorageStrategy implements IUploadStrategy {
  private readonly destination: string;
  private readonly destinationResolved: string;
  private readonly baseUrl: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly i18n: I18nService,
  ) {
    const storageConfig = this.configService.get('storage.local');
    this.destination = storageConfig.destination;
    this.destinationResolved = path.resolve(this.destination);
    this.baseUrl = (storageConfig.baseUrl || '').replace(/\/$/, '');
  }

  private fileNotFound(filename: string): NotFoundException {
    const lang = I18nContext.current()?.lang ?? 'en';
    return new NotFoundException(
      this.i18n.t('storage.FILE_NOT_FOUND', { lang, args: { filename } }),
    );
  }

  private ensureDirectoryExists(): void {
    if (!fs.existsSync(this.destination)) {
      fs.mkdirSync(this.destination, { recursive: true });
    }
  }

  /**
   * Resolve the requested filename inside the destination directory and
   * verify the resolved path doesn't escape it. Defends against `..`,
   * absolute paths, and symlink games even though the controller already
   * pattern-checks the input.
   */
  private safePath(filename: string): string {
    if (!filename || !ALLOWED_FILENAME_RE.test(filename) || filename.includes('..')) {
      throw this.fileNotFound(filename);
    }
    const candidate = path.resolve(this.destinationResolved, filename);
    if (
      candidate !== this.destinationResolved &&
      !candidate.startsWith(this.destinationResolved + path.sep)
    ) {
      throw this.fileNotFound(filename);
    }
    return candidate;
  }

  private buildUrl(filename: string): string {
    return `${this.baseUrl}/${filename}`;
  }

  private safeExtension(originalName: string): string {
    const ext = path.extname(originalName).toLowerCase();
    if (!ext || !/^\.[a-z0-9]{1,10}$/.test(ext)) return '';
    return ext;
  }

  async upload(file: any): Promise<UploadResult> {
    this.ensureDirectoryExists();
    const ext = this.safeExtension(file.originalname || '');
    // UUID-based filename + 'wx' flag: collision-safe write that fails if
    // the path already exists. Math.random was enumerable and 13-char
    // base36 was within bruteforce range when narrowed by timestamp.
    let attempt = 0;
    while (attempt < 3) {
      const filename = `${Date.now()}-${randomUUID()}${ext}`;
      const filePath = this.safePath(filename);
      try {
        await new Promise<void>((resolve, reject) => {
          const stream = fs.createWriteStream(filePath, { flags: 'wx' });
          stream.on('finish', () => resolve());
          stream.on('error', reject);
          stream.write(file.buffer);
          stream.end();
        });
        return {
          path: filePath,
          url: this.buildUrl(filename),
          filename,
          size: file.size,
          mimetype: file.mimetype,
        };
      } catch (err: any) {
        if (err?.code === 'EEXIST') {
          attempt++;
          continue;
        }
        throw err;
      }
    }
    throw new InternalServerErrorException('Could not allocate a unique filename');
  }

  async download(
    filename: string,
  ): Promise<{ stream: NodeJS.ReadableStream; metadata: FileMetadata }> {
    const filePath = this.safePath(filename);
    let stat: fs.Stats;
    try {
      stat = await fs.promises.stat(filePath);
    } catch (err: any) {
      if (err?.code === 'ENOENT') throw this.fileNotFound(filename);
      throw err;
    }
    const metadata: FileMetadata = {
      filename,
      size: stat.size,
      mimetype: 'application/octet-stream',
      url: this.buildUrl(filename),
      createdAt: stat.birthtime,
    };
    const stream = fs.createReadStream(filePath);
    return { stream, metadata };
  }

  async delete(filename: string): Promise<void> {
    const filePath = this.safePath(filename);
    try {
      await fs.promises.unlink(filePath);
    } catch (err: any) {
      if (err?.code === 'ENOENT') throw this.fileNotFound(filename);
      throw err;
    }
  }

  async list(prefix?: string, limit = 50): Promise<FileMetadata[]> {
    this.ensureDirectoryExists();
    const entries = await fs.promises.readdir(this.destination);
    const filtered = prefix
      ? entries.filter((name) => name.startsWith(prefix))
      : entries;

    const metadataList: FileMetadata[] = [];
    for (const name of filtered) {
      // Skip anything that doesn't match our generated naming scheme to
      // avoid leaking system files that happen to live in the directory.
      if (!ALLOWED_FILENAME_RE.test(name)) continue;
      const filePath = path.join(this.destination, name);
      try {
        const stat = await fs.promises.stat(filePath);
        if (stat.isFile()) {
          metadataList.push({
            filename: name,
            size: stat.size,
            mimetype: 'application/octet-stream',
            url: this.buildUrl(name),
            createdAt: stat.birthtime,
          });
        }
      } catch {
        // skip
      }
    }

    metadataList.sort(
      (a, b) => (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0),
    );

    return metadataList.slice(0, limit);
  }

  async exists(filename: string): Promise<boolean> {
    try {
      const filePath = this.safePath(filename);
      await fs.promises.access(filePath, fs.constants.F_OK);
      return true;
    } catch {
      return false;
    }
  }

  async getMetadata(filename: string): Promise<FileMetadata> {
    const filePath = this.safePath(filename);
    let stat: fs.Stats;
    try {
      stat = await fs.promises.stat(filePath);
    } catch (err: any) {
      if (err?.code === 'ENOENT') throw this.fileNotFound(filename);
      throw err;
    }
    return {
      filename,
      size: stat.size,
      mimetype: 'application/octet-stream',
      url: this.buildUrl(filename),
      createdAt: stat.birthtime,
    };
  }
}
