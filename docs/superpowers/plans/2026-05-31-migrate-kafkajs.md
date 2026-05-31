# Migrate kafka-client từ @confluentinc/kafka-javascript sang kafkajs

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Thay thế native addon `@confluentinc/kafka-javascript` (không có prebuilt binary cho Node 24 trên Windows) bằng pure-JS `kafkajs`.

**Architecture:** Chỉ sửa `packages/kafka-client` (factory, producer service, module interface, re-export types) và `apps/notification-service` (consumer service trực tiếp dùng confluent). Các service còn lại (auth, iam, cms, comic, post) chỉ dùng `KafkaClientModule` qua `@package/kafka-client` — không cần sửa.

**Tech Stack:** `kafkajs ^2.2.4`, NestJS, pnpm workspaces.

---

## File Map

| Hành động | File |
|-----------|------|
| Modify | `packages/kafka-client/package.json` |
| Rewrite | `packages/kafka-client/src/kafka-factory.ts` |
| Modify | `packages/kafka-client/src/kafka-client.module.ts` |
| Modify | `packages/kafka-client/src/kafka-producer.service.ts` |
| Modify | `packages/kafka-client/src/index.ts` |
| Modify | `apps/notification-service/src/event/kafka/services/kafka.service.ts` |
| Modify | `apps/notification-service/package.json` |

---

## Task 1: Swap package dependency

**Files:**
- Modify: `packages/kafka-client/package.json`

- [ ] **Step 1: Thay dependency trong package.json**

Trong `packages/kafka-client/package.json`, thay:
```json
"@confluentinc/kafka-javascript": "^1.8.2"
```
thành:
```json
"kafkajs": "^2.2.4"
```

- [ ] **Step 2: Chạy pnpm install**

```bash
pnpm install
```

Expected: install thành công, không còn warning về native binding.

---

## Task 2: Rewrite kafka-factory.ts

**Files:**
- Modify: `packages/kafka-client/src/kafka-factory.ts`

- [ ] **Step 1: Rewrite toàn bộ file**

```typescript
import { Kafka } from 'kafkajs';
import { KafkaSslOptions } from './kafka-client.module';

export interface KafkaInstanceOptions {
  clientId: string;
  brokers: string[];
  ssl?: KafkaSslOptions;
  retry?: { retries?: number; initialRetryTime?: number; maxRetryTime?: number };
}

export function createKafkaInstance(options: KafkaInstanceOptions): Kafka {
  const { clientId, brokers, ssl, retry } = options;
  return new Kafka({
    clientId,
    brokers,
    ...(retry ? { retry } : {}),
    ...(ssl ? {
      ssl: {
        rejectUnauthorized: ssl.rejectUnauthorized,
        ca: [ssl.ca],
        cert: ssl.cert,
        key: ssl.key,
      },
    } : {}),
  });
}
```

Lưu ý: Bỏ `broker.address.family`, `ssl.ca.pem`, `ssl.certificate.pem`, `ssl.key.pem` — đây là confluent-specific, kafkajs dùng SSL format chuẩn.

- [ ] **Step 2: Typecheck**

```bash
pnpm --filter @package/kafka-client typecheck
```

Expected: pass, không lỗi.

---

## Task 3: Update kafka-client.module.ts

**Files:**
- Modify: `packages/kafka-client/src/kafka-client.module.ts`

- [ ] **Step 1: Bỏ lingerMs và batchSize khỏi KafkaClientOptions**

`lingerMs` và `batchSize` là confluent librdkafka-specific config, kafkajs không có equivalent. `compression` giữ lại.

```typescript
import { Module, DynamicModule } from '@nestjs/common';
import { KafkaProducerService } from './kafka-producer.service';

export interface KafkaSslOptions {
  rejectUnauthorized: boolean;
  ca: string;
  cert: string;
  key: string;
}

export interface KafkaClientOptions {
  brokers: string[];
  clientId: string;
  enabled?: boolean;
  ssl?: KafkaSslOptions;
  compression?: 'none' | 'gzip' | 'snappy' | 'lz4' | 'zstd';
}

export interface KafkaClientAsyncOptions {
  imports?: any[];
  useFactory: (...args: any[]) => KafkaClientOptions | Promise<KafkaClientOptions>;
  inject?: any[];
}

@Module({})
export class KafkaClientModule {
  static register(options: KafkaClientOptions): DynamicModule {
    return {
      module: KafkaClientModule,
      providers: [
        {
          provide: 'KAFKA_OPTIONS',
          useValue: options,
        },
        KafkaProducerService,
      ],
      exports: [KafkaProducerService],
      global: true,
    };
  }

  static registerAsync(options: KafkaClientAsyncOptions): DynamicModule {
    return {
      module: KafkaClientModule,
      imports: options.imports || [],
      providers: [
        {
          provide: 'KAFKA_OPTIONS',
          useFactory: options.useFactory,
          inject: options.inject || [],
        },
        KafkaProducerService,
      ],
      exports: [KafkaProducerService],
      global: true,
    };
  }
}
```

- [ ] **Step 2: Typecheck**

```bash
pnpm --filter @package/kafka-client typecheck
```

Expected: pass.

---

## Task 4: Update kafka-producer.service.ts

**Files:**
- Modify: `packages/kafka-client/src/kafka-producer.service.ts`

Thay thế import confluent, cập nhật type declarations, và map compression string sang kafkajs `CompressionTypes`.

- [ ] **Step 1: Rewrite file**

```typescript
import { Injectable, Inject, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { Kafka, Producer, CompressionTypes } from 'kafkajs';
import { KafkaClientOptions } from './kafka-client.module';
import { createKafkaInstance } from './kafka-factory';

const compressionMap: Record<string, CompressionTypes> = {
  none: CompressionTypes.None,
  gzip: CompressionTypes.GZIP,
  snappy: CompressionTypes.Snappy,
  lz4: CompressionTypes.LZ4,
  zstd: CompressionTypes.ZSTD,
};

@Injectable()
export class KafkaProducerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(KafkaProducerService.name);
  private kafka: Kafka;
  private producer: Producer;

  private readonly MAX_RETRIES = 3;
  private readonly RETRY_BASE_MS = 200;

  private readonly enabled: boolean;
  private readonly compression?: string;
  private connected = false;

  constructor(
    @Inject('KAFKA_OPTIONS') options: KafkaClientOptions,
  ) {
    this.enabled = options.enabled ?? true;
    this.compression = options.compression;
    this.kafka = createKafkaInstance(options);
    this.producer = this.kafka.producer();
  }

  async onModuleInit() {
    if (!this.enabled) return;
    const compressionType = this.compression
      ? compressionMap[this.compression]
      : undefined;
    this.producer = this.kafka.producer(
      compressionType !== undefined ? { compression: compressionType } : {},
    );
    await this.producer.connect();
    this.connected = true;
  }

  async onModuleDestroy() {
    if (!this.enabled) return;
    this.connected = false;
    await this.producer.disconnect();
  }

  async emit(topic: string, payload: any, key?: string): Promise<void> {
    let value: string;
    try {
      value = JSON.stringify(payload);
    } catch (err: any) {
      this.logger.error(
        `Failed to serialize payload for topic "${topic}": ${(err as Error).message}`,
      );
      throw err;
    }

    let lastError: Error | undefined;
    for (let attempt = 0; attempt <= this.MAX_RETRIES; attempt++) {
      try {
        await this.producer.send({
          topic,
          messages: [{ key: key || undefined, value }],
        });
        return;
      } catch (err: any) {
        lastError = err as Error;
        if (attempt < this.MAX_RETRIES) {
          const delay = this.RETRY_BASE_MS * Math.pow(2, attempt);
          this.logger.warn(
            `Kafka emit to "${topic}" failed (attempt ${attempt + 1}/${this.MAX_RETRIES + 1}), retrying in ${delay}ms: ${lastError.message}`,
          );
          await this.sleep(delay);
        }
      }
    }

    this.logger.error(
      `Kafka emit to "${topic}" failed after ${this.MAX_RETRIES + 1} attempts: ${lastError?.message}`,
    );
    throw lastError;
  }

  async send(record: { topic: string; messages: Array<{ key?: string; value: string; headers?: Record<string, string> }> }): Promise<void> {
    let lastError: Error | undefined;
    for (let attempt = 0; attempt <= this.MAX_RETRIES; attempt++) {
      try {
        await this.producer.send(record);
        return;
      } catch (err: any) {
        lastError = err as Error;
        if (attempt < this.MAX_RETRIES) {
          const delay = this.RETRY_BASE_MS * Math.pow(2, attempt);
          this.logger.warn(
            `Kafka send to "${record.topic}" failed (attempt ${attempt + 1}/${this.MAX_RETRIES + 1}), retrying in ${delay}ms: ${lastError.message}`,
          );
          await this.sleep(delay);
        }
      }
    }

    this.logger.error(
      `Kafka send to "${record.topic}" failed after ${this.MAX_RETRIES + 1} attempts: ${lastError?.message}`,
    );
    throw lastError;
  }

  async ping(): Promise<void> {
    if (!this.enabled) return;
    if (!this.connected) {
      throw new Error('Kafka producer is not connected');
    }
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
```

- [ ] **Step 2: Typecheck**

```bash
pnpm --filter @package/kafka-client typecheck
```

Expected: pass.

---

## Task 5: Re-export kafkajs types từ index.ts

**Files:**
- Modify: `packages/kafka-client/src/index.ts`

notification-service dùng `Consumer`, `Producer`, `EachMessagePayload` từ confluent. Sau khi bỏ confluent, cần re-export từ kafkajs qua `@package/kafka-client` để notification-service không cần thêm dep trực tiếp vào kafkajs.

- [ ] **Step 1: Thêm type re-exports**

```typescript
export { KafkaClientModule } from './kafka-client.module';
export { KafkaProducerService } from './kafka-producer.service';
export { createKafkaInstance } from './kafka-factory';
export type { KafkaInstanceOptions } from './kafka-factory';
export type { Consumer, Producer, EachMessagePayload } from 'kafkajs';
```

- [ ] **Step 2: Build shared package**

```bash
pnpm build:shared
```

Expected: build thành công, `packages/kafka-client/dist/` được cập nhật.

---

## Task 6: Update notification-service/kafka.service.ts

**Files:**
- Modify: `apps/notification-service/src/event/kafka/services/kafka.service.ts`

Đây là file duy nhất trong các service import trực tiếp `@confluentinc/kafka-javascript`. Cần:
1. Bỏ `import { KafkaJS } from '@confluentinc/kafka-javascript'`
2. Import types từ `@package/kafka-client` thay thế
3. Bỏ `kafkaJS` wrapper trong consumer config (kafkajs dùng flat config)
4. Bỏ `fromBeginning` và `allowAutoTopicCreation` khỏi consumer config (không phải consumer options trong kafkajs)

- [ ] **Step 1: Sửa phần import và type declarations (dòng 1-11)**

Thay:
```typescript
import { Injectable, OnModuleInit, OnApplicationShutdown } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { KafkaJS } from '@confluentinc/kafka-javascript';
import { createKafkaInstance } from '@package/kafka-client';
import { IdempotencyService, LruSet } from '@package/common';
import { FileLogger } from '@package/bootstrap';

type Consumer = KafkaJS.Consumer;
type EachMessagePayload = KafkaJS.EachMessagePayload;
type Producer = KafkaJS.Producer;
```

thành:
```typescript
import { Injectable, OnModuleInit, OnApplicationShutdown } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Consumer, EachMessagePayload, Producer } from '@package/kafka-client';
import { createKafkaInstance } from '@package/kafka-client';
import { IdempotencyService, LruSet } from '@package/common';
import { FileLogger } from '@package/bootstrap';
```

- [ ] **Step 2: Sửa consumer config trong onModuleInit (~dòng 77-86)**

Thay:
```typescript
this.consumer = kafka.consumer({
  kafkaJS: {
    groupId: groupId || 'notification-service',
    sessionTimeout: 30_000,
    heartbeatInterval: 3_000,
    fromBeginning: false,
    allowAutoTopicCreation: true,
  },
});
```

thành:
```typescript
this.consumer = kafka.consumer({
  groupId: groupId || 'notification-service',
  sessionTimeout: 30_000,
  heartbeatInterval: 3_000,
});
```

- [ ] **Step 3: Typecheck notification-service**

```bash
pnpm --filter notification-service typecheck
```

Expected: pass, không còn import từ `@confluentinc/kafka-javascript`.

---

## Task 7: Update notification-service/package.json

**Files:**
- Modify: `apps/notification-service/package.json`

- [ ] **Step 1: Xóa @confluentinc/kafka-javascript khỏi dependencies**

Tìm và xóa dòng:
```json
"@confluentinc/kafka-javascript": "..."
```

trong `apps/notification-service/package.json`.

Không cần thêm `kafkajs` vì types đã được re-export từ `@package/kafka-client`.

- [ ] **Step 2: Xác nhận không còn confluent dep**

```bash
node -e "const p=require('./apps/notification-service/package.json'); const hasCon=!!(p.dependencies?.['@confluentinc/kafka-javascript']||p.devDependencies?.['@confluentinc/kafka-javascript']); console.log('has confluent:', hasCon)"
```

Expected: `has confluent: false`

---

## Task 8: Build và verify toàn bộ

- [ ] **Step 1: Build shared**

```bash
pnpm build:shared
```

Expected: build thành công.

- [ ] **Step 2: Typecheck tất cả service dùng kafka**

```bash
pnpm --filter auth-service typecheck
pnpm --filter notification-service typecheck
pnpm --filter cms-service typecheck
pnpm --filter comic-service typecheck
pnpm --filter iam-service typecheck
pnpm --filter post-service typecheck
```

Expected: tất cả pass.

- [ ] **Step 3: Thử khởi động một service**

```bash
pnpm dev:auth
```

Expected: service start thành công, không còn lỗi `Could not locate the bindings file`.

- [ ] **Step 4: Commit**

```bash
git add packages/kafka-client/ apps/notification-service/package.json apps/notification-service/src/event/kafka/services/kafka.service.ts
git commit -m "feat: replace @confluentinc/kafka-javascript with kafkajs

Native addon had no prebuilt binary for Node 24 (ABI 137) on Windows.
kafkajs is pure JS and works on any Node version.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```
