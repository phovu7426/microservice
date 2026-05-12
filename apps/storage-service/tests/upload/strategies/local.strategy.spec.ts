import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { LocalStorageStrategy } from '../../../src/modules/upload/strategies/local.strategy';

function makeStrategy(destination: string) {
  const config = {
    get: jest.fn((key: string) => {
      if (key === 'storage.local') {
        return {
          destination,
          baseUrl: 'http://localhost:3004/uploads',
        };
      }
      return undefined;
    }),
  };
  const i18n = { t: jest.fn((key: string) => key) };
  return new LocalStorageStrategy(config as any, i18n as any);
}

describe('LocalStorageStrategy', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'storage-test-'));
  });

  afterEach(() => {
    // Clean up test files
    try {
      const files = fs.readdirSync(tmpDir);
      for (const f of files) {
        fs.unlinkSync(path.join(tmpDir, f));
      }
      fs.rmdirSync(tmpDir);
    } catch {
      // ignore cleanup errors
    }
  });

  describe('upload — uses stream pipeline', () => {
    it('writes file content correctly using pipeline', async () => {
      const strategy = makeStrategy(tmpDir);
      const content = 'Hello, stream pipeline test!';
      const file = {
        buffer: Buffer.from(content),
        originalname: 'test.txt',
        size: Buffer.byteLength(content),
        mimetype: 'text/plain',
      };

      const result = await strategy.upload(file);

      // Verify file was written to disk
      expect(fs.existsSync(result.path)).toBe(true);

      // Verify content matches
      const written = fs.readFileSync(result.path, 'utf8');
      expect(written).toBe(content);
    });

    it('returns correct upload result metadata', async () => {
      const strategy = makeStrategy(tmpDir);
      const file = {
        buffer: Buffer.from('test data'),
        originalname: 'photo.png',
        size: 9,
        mimetype: 'image/png',
      };

      const result = await strategy.upload(file);

      expect(result.filename).toMatch(/^\d+-[a-f0-9-]+\.png$/);
      expect(result.url).toContain('http://localhost:3004/uploads/');
      expect(result.size).toBe(9);
      expect(result.mimetype).toBe('image/png');
    });

    it('handles large buffers without error', async () => {
      const strategy = makeStrategy(tmpDir);
      // 1MB buffer to verify pipeline handles backpressure
      const largeBuffer = Buffer.alloc(1024 * 1024, 0x42);
      const file = {
        buffer: largeBuffer,
        originalname: 'large.bin',
        size: largeBuffer.length,
        mimetype: 'application/octet-stream',
      };

      const result = await strategy.upload(file);

      const stat = fs.statSync(result.path);
      expect(stat.size).toBe(largeBuffer.length);
    });

    it('generates unique filenames for concurrent uploads', async () => {
      const strategy = makeStrategy(tmpDir);
      const files = Array.from({ length: 5 }, (_, i) => ({
        buffer: Buffer.from(`content-${i}`),
        originalname: 'same.txt',
        size: 10,
        mimetype: 'text/plain',
      }));

      const results = await Promise.all(files.map((f) => strategy.upload(f)));
      const filenames = results.map((r) => r.filename);

      // All filenames should be unique
      expect(new Set(filenames).size).toBe(5);
    });
  });
});
