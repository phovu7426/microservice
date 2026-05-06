import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { I18nContext, I18nService } from 'nestjs-i18n';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  GetObjectCommandOutput,
  DeleteObjectCommand,
  HeadObjectCommand,
  HeadObjectCommandOutput,
  ListObjectsV2Command,
} from '@aws-sdk/client-s3';
import { randomUUID } from 'crypto';
import * as path from 'path';
import {
  FileMetadata,
  IUploadStrategy,
  UploadResult,
} from '../interfaces/upload-strategy.interface';

function safeExtension(originalName: string): string {
  const ext = path.extname(originalName || '').toLowerCase();
  return /^\.[a-z0-9]{1,10}$/.test(ext) ? ext : '';
}

@Injectable()
export class S3StorageStrategy implements IUploadStrategy {
  private readonly s3Client: S3Client;
  private readonly bucket: string;
  private readonly baseUrl: string;
  private readonly forcePathStyle: boolean;

  constructor(
    private readonly configService: ConfigService,
    private readonly i18n: I18nService,
  ) {
    const s3Config = this.configService.get('storage.s3');
    const endpoint = (s3Config?.endpoint || '').replace(/\/$/, '');
    this.bucket = s3Config?.bucket;
    this.forcePathStyle = s3Config?.forcePathStyle ?? true;

    this.s3Client = new S3Client({
      region: s3Config?.region,
      endpoint: endpoint || undefined,
      credentials: {
        accessKeyId: s3Config?.accessKeyId,
        secretAccessKey: s3Config?.secretAccessKey,
      },
      forcePathStyle: this.forcePathStyle,
    });

    // Dùng nguyên giá trị baseUrl từ config/env, chỉ bỏ trailing slash nếu có.
    // Người dùng tự cấu hình đúng URL mong muốn (ví dụ: https://minio1.webtui.vn:9000/bucket-s3monmon).
    const rawBaseUrl = s3Config?.baseUrl || '';
    this.baseUrl = rawBaseUrl.replace(/\/$/, '');
  }

  private buildUrl(filename: string): string {
    const baseUrl = this.baseUrl.endsWith('/')
      ? this.baseUrl.slice(0, -1)
      : this.baseUrl;
    return `${baseUrl}/${filename}`;
  }

  private fileNotFound(filename: string): NotFoundException {
    const lang = I18nContext.current()?.lang ?? 'en';
    return new NotFoundException(
      this.i18n.t('storage.FILE_NOT_FOUND', { lang, args: { filename } }),
    );
  }

  async upload(file: any): Promise<UploadResult> {
    if (!this.bucket) {
      const lang = I18nContext.current()?.lang ?? 'en';
      throw new BadRequestException(
        this.i18n.t('storage.BUCKET_NOT_CONFIGURED', { lang }),
      );
    }

    // UUID-based filename — Math.random was enumerable.
    const ext = safeExtension(file.originalname);
    const filename = `${Date.now()}-${randomUUID()}${ext}`;

    // ContentType is forced to octet-stream + Content-Disposition: attachment
    // so any polyglot (HTML/SVG/JS smuggled past validation) cannot be
    // executed when fetched directly from the bucket origin.
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: filename,
      Body: file.buffer,
      ContentType: 'application/octet-stream',
      ContentDisposition: `attachment; filename="${filename}"`,
    });

    try {
      await this.s3Client.send(command);
    } catch (error: any) {
      // Bắt các lỗi cụ thể từ AWS SDK để trả về message dễ hiểu hơn
      if (
        error.name === 'DeserializationError' ||
        error.message?.includes('Deserialization error')
      ) {
        const response = (error as any).$response;
        const details = response ? ` (Status: ${response.statusCode})` : '';
        const lang = I18nContext.current()?.lang ?? 'en';
        throw new BadRequestException(
          this.i18n.t('storage.S3_DESERIALIZATION_ERROR', {
            lang,
            args: { details, message: error.message },
          }),
        );
      }
      throw error;
    }

    // Tạo URL để truy cập file (đảm bảo baseUrl không có trailing slash)
    const url = this.buildUrl(filename);

    return {
      path: filename, // Key trong S3
      url,
      filename,
      size: file.size,
      mimetype: file.mimetype,
    };
  }

  async download(
    filename: string,
  ): Promise<{ stream: NodeJS.ReadableStream; metadata: FileMetadata }> {
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: filename,
    });

    let result: GetObjectCommandOutput;
    try {
      result = await this.s3Client.send(command);
    } catch (error: any) {
      if (error.name === 'NoSuchKey' || error.$metadata?.httpStatusCode === 404) {
        throw this.fileNotFound(filename);
      }
      throw error;
    }

    const metadata: FileMetadata = {
      filename,
      size: result.ContentLength ?? 0,
      mimetype: result.ContentType ?? 'application/octet-stream',
      url: this.buildUrl(filename),
      etag: result.ETag,
      createdAt: result.LastModified,
    };

    return { stream: result.Body as NodeJS.ReadableStream, metadata };
  }

  async delete(filename: string): Promise<void> {
    // Check existence first so we can throw a proper NotFoundException
    const fileExists = await this.exists(filename);
    if (!fileExists) {
      throw this.fileNotFound(filename);
    }

    const command = new DeleteObjectCommand({
      Bucket: this.bucket,
      Key: filename,
    });
    await this.s3Client.send(command);
  }

  async list(prefix?: string, limit = 50): Promise<FileMetadata[]> {
    const command = new ListObjectsV2Command({
      Bucket: this.bucket,
      Prefix: prefix,
      MaxKeys: limit,
    });

    const result = await this.s3Client.send(command);
    const contents = result.Contents ?? [];

    return contents.map((item) => ({
      filename: item.Key ?? '',
      size: item.Size ?? 0,
      mimetype: 'application/octet-stream',
      url: this.buildUrl(item.Key ?? ''),
      createdAt: item.LastModified,
      etag: item.ETag,
    }));
  }

  async exists(filename: string): Promise<boolean> {
    const command = new HeadObjectCommand({
      Bucket: this.bucket,
      Key: filename,
    });
    try {
      await this.s3Client.send(command);
      return true;
    } catch (error: any) {
      if (error.name === 'NoSuchKey' || error.$metadata?.httpStatusCode === 404) {
        return false;
      }
      throw error;
    }
  }

  async getMetadata(filename: string): Promise<FileMetadata> {
    const command = new HeadObjectCommand({
      Bucket: this.bucket,
      Key: filename,
    });
    let result: HeadObjectCommandOutput;
    try {
      result = await this.s3Client.send(command);
    } catch (error: any) {
      if (error.name === 'NoSuchKey' || error.$metadata?.httpStatusCode === 404) {
        throw this.fileNotFound(filename);
      }
      throw error;
    }

    return {
      filename,
      size: result.ContentLength ?? 0,
      mimetype: result.ContentType ?? 'application/octet-stream',
      url: this.buildUrl(filename),
      etag: result.ETag,
      createdAt: result.LastModified,
    };
  }
}
