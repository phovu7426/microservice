export class UploadResponseDto {
  path: string;
  url: string;
  filename: string;
  size: number;
  mimetype: string;
}

export class FileMetadataDto {
  filename: string;
  size: number;
  mimetype: string;
  url: string;
  createdAt?: string;
  etag?: string;
}
