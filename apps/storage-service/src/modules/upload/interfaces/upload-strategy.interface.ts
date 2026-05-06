/// <reference types="multer" />

export interface UploadResult {
  path: string;
  url: string;
  filename: string;
  size: number;
  mimetype: string;
}

export interface FileMetadata {
  filename: string;
  size: number;
  mimetype: string;
  url: string;
  createdAt?: Date;
  etag?: string;
}

export interface IUploadStrategy {
  upload(file: Express.Multer.File): Promise<UploadResult>;
  download(filename: string): Promise<{ stream: NodeJS.ReadableStream; metadata: FileMetadata }>;
  delete(filename: string): Promise<void>;
  list(prefix?: string, limit?: number): Promise<FileMetadata[]>;
  exists(filename: string): Promise<boolean>;
  getMetadata(filename: string): Promise<FileMetadata>;
}
