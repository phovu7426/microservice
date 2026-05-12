import { BadRequestException } from '@nestjs/common';
import { UploadService } from '../../../src/modules/upload/services/upload.service';
import { IUploadStrategy, UploadResult } from '../../../src/modules/upload/interfaces/upload-strategy.interface';

function makeUploadResult(index: number): UploadResult {
  return {
    path: `path-${index}`,
    url: `http://example.com/file-${index}.png`,
    filename: `file-${index}.png`,
    size: 1024,
    mimetype: 'image/png',
  };
}

function makeStrategy(overrides?: Partial<IUploadStrategy>): IUploadStrategy {
  return {
    upload: jest.fn(async () => makeUploadResult(0)),
    download: jest.fn(),
    delete: jest.fn(),
    list: jest.fn(),
    exists: jest.fn(),
    getMetadata: jest.fn(),
    ...overrides,
  } as any;
}

function makeService(strategy: IUploadStrategy) {
  const i18n = { t: jest.fn((key: string) => key) };
  return new UploadService(strategy, i18n as any);
}

describe('UploadService', () => {
  describe('uploadFile', () => {
    it('delegates to strategy.upload', async () => {
      const strategy = makeStrategy();
      const svc = makeService(strategy);
      const file = { buffer: Buffer.alloc(10), originalname: 'test.png' };

      const result = await svc.uploadFile(file);

      expect(strategy.upload).toHaveBeenCalledWith(file);
      expect(result).toMatchObject({ filename: 'file-0.png' });
    });

    it('throws BadRequestException when file is null', async () => {
      const svc = makeService(makeStrategy());
      await expect(svc.uploadFile(null)).rejects.toThrow(BadRequestException);
    });
  });

  describe('uploadFiles — concurrency control', () => {
    it('uploads all files successfully', async () => {
      let callIndex = 0;
      const strategy = makeStrategy({
        upload: jest.fn(async () => makeUploadResult(callIndex++)),
      });
      const svc = makeService(strategy);
      const files = Array.from({ length: 5 }, (_, i) => ({
        buffer: Buffer.alloc(10),
        originalname: `file-${i}.png`,
      }));

      const results = await svc.uploadFiles(files);

      expect(results).toHaveLength(5);
      expect(strategy.upload).toHaveBeenCalledTimes(5);
    });

    it('processes files in batches of 3 (not all at once)', async () => {
      let concurrentCount = 0;
      let maxConcurrent = 0;

      const strategy = makeStrategy({
        upload: jest.fn(async (file: any) => {
          concurrentCount++;
          maxConcurrent = Math.max(maxConcurrent, concurrentCount);
          // Simulate async work so concurrent calls overlap
          await new Promise((r) => setTimeout(r, 10));
          concurrentCount--;
          return makeUploadResult(0);
        }),
      });
      const svc = makeService(strategy);
      const files = Array.from({ length: 6 }, (_, i) => ({
        buffer: Buffer.alloc(10),
        originalname: `file-${i}.png`,
      }));

      await svc.uploadFiles(files);

      // With concurrency of 3, max concurrent should be at most 3
      expect(maxConcurrent).toBeLessThanOrEqual(3);
      expect(strategy.upload).toHaveBeenCalledTimes(6);
    });

    it('cleans up successful uploads when any upload fails', async () => {
      let callCount = 0;
      const strategy = makeStrategy({
        upload: jest.fn(async () => {
          callCount++;
          if (callCount === 2) throw new Error('Upload failed');
          return makeUploadResult(callCount);
        }),
        delete: jest.fn(async () => undefined),
      });
      const svc = makeService(strategy);
      const files = [
        { buffer: Buffer.alloc(10), originalname: 'a.png' },
        { buffer: Buffer.alloc(10), originalname: 'b.png' },
        { buffer: Buffer.alloc(10), originalname: 'c.png' },
      ];

      await expect(svc.uploadFiles(files)).rejects.toThrow('Upload failed');
      // The successful uploads should have been cleaned up
      expect(strategy.delete).toHaveBeenCalled();
    });

    it('throws BadRequestException when files array is empty', async () => {
      const svc = makeService(makeStrategy());
      await expect(svc.uploadFiles([])).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when files is null', async () => {
      const svc = makeService(makeStrategy());
      await expect(svc.uploadFiles(null as any)).rejects.toThrow(BadRequestException);
    });
  });
});
