import { Readable } from 'stream';

// Mock the AWS SDK before importing the strategy
const mockSend = jest.fn();
jest.mock('@aws-sdk/client-s3', () => {
  return {
    S3Client: jest.fn().mockImplementation(() => ({ send: mockSend })),
    PutObjectCommand: jest.fn().mockImplementation((input) => ({ input })),
    GetObjectCommand: jest.fn(),
    DeleteObjectCommand: jest.fn(),
    HeadObjectCommand: jest.fn(),
    ListObjectsV2Command: jest.fn(),
  };
});

import { S3StorageStrategy } from '../../../src/modules/upload/strategies/s3.strategy';
import { PutObjectCommand } from '@aws-sdk/client-s3';

function makeStrategy() {
  const config = {
    get: jest.fn((key: string) => {
      if (key === 'storage.s3') {
        return {
          endpoint: 'http://localhost:9000',
          bucket: 'test-bucket',
          region: 'us-east-1',
          accessKeyId: 'test-key',
          secretAccessKey: 'test-secret',
          forcePathStyle: true,
          baseUrl: 'http://localhost:9000/test-bucket',
        };
      }
      return undefined;
    }),
  };
  const i18n = { t: jest.fn((key: string) => key) };
  return new S3StorageStrategy(config as any, i18n as any);
}

describe('S3StorageStrategy', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSend.mockResolvedValue({});
  });

  describe('upload', () => {
    it('sends a Readable stream as Body instead of raw buffer', async () => {
      const strategy = makeStrategy();
      const file = {
        buffer: Buffer.from('test file content'),
        originalname: 'photo.png',
        size: 17,
        mimetype: 'image/png',
      };

      await strategy.upload(file);

      expect(PutObjectCommand).toHaveBeenCalledTimes(1);
      const callArgs = (PutObjectCommand as unknown as jest.Mock).mock.calls[0][0];

      // Verify Body is a Readable stream, not a raw Buffer
      expect(callArgs.Body).toBeInstanceOf(Readable);
      expect(Buffer.isBuffer(callArgs.Body)).toBe(false);
    });

    it('sets ContentType to octet-stream and includes ContentDisposition', async () => {
      const strategy = makeStrategy();
      const file = {
        buffer: Buffer.from('data'),
        originalname: 'doc.pdf',
        size: 4,
        mimetype: 'application/pdf',
      };

      await strategy.upload(file);

      const callArgs = (PutObjectCommand as unknown as jest.Mock).mock.calls[0][0];
      expect(callArgs.ContentType).toBe('application/octet-stream');
      expect(callArgs.ContentDisposition).toContain('attachment');
    });

    it('returns correct upload result with URL', async () => {
      const strategy = makeStrategy();
      const file = {
        buffer: Buffer.from('data'),
        originalname: 'image.jpg',
        size: 4,
        mimetype: 'image/jpeg',
      };

      const result = await strategy.upload(file);

      expect(result.url).toContain('http://localhost:9000/test-bucket/');
      expect(result.filename).toMatch(/^\d+-[a-f0-9-]+\.jpg$/);
      expect(result.size).toBe(4);
      expect(result.mimetype).toBe('image/jpeg');
    });
  });
});
