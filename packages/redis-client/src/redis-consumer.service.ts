import Redis from 'ioredis';
import { OnModuleInit, OnApplicationShutdown, Logger } from '@nestjs/common';
import * as os from 'os';
import { RedisClientOptions } from './redis-client.module';

export abstract class RedisConsumerService implements OnModuleInit, OnApplicationShutdown {
  protected readonly logger = new Logger(this.constructor.name);
  private readonly client: Redis;
  private shuttingDown = false;
  private inFlightCount = 0;
  private pollCycle = 0;
  protected readonly groupName: string;
  protected readonly consumerName: string;
  private readonly blockMs: number;
  private readonly minIdleMs = 60_000;

  constructor(options: RedisClientOptions) {
    this.groupName = options.groupName ?? 'default-group';
    this.consumerName = options.consumerName ?? `${os.hostname()}-${process.pid}`;
    this.blockMs = options.blockMs ?? 2_000;
    this.client = new Redis(options.url, {
      lazyConnect: true,
      enableOfflineQueue: true,
      maxRetriesPerRequest: null as any,
      connectTimeout: 10_000,
    });
  }

  abstract getStreams(): string[];
  abstract dispatch(stream: string, fields: Record<string, string>): Promise<void>;

  async onModuleInit(): Promise<void> {
    this.client.on('error', (err) => this.logger.error('Redis consumer error', err));
    await this.client.connect();
    for (const stream of this.getStreams()) {
      await this.createGroup(stream);
    }
    this.pollLoop().catch((err) =>
      this.logger.error('Redis consumer poll loop crashed', err),
    );
  }

  async onApplicationShutdown(): Promise<void> {
    this.shuttingDown = true;
    const deadline = Date.now() + 25_000;
    while (this.inFlightCount > 0 && Date.now() < deadline) {
      await new Promise<void>((resolve) => setTimeout(resolve, 100));
    }
    await this.client.quit().catch((err) =>
      this.logger.warn(`Redis consumer quit error: ${(err as Error).message}`),
    );
  }

  private async pollLoop(): Promise<void> {
    while (!this.shuttingDown) {
      try {
        this.pollCycle++;
        if (this.pollCycle % 50 === 0) {
          await this.reclaimPending();
        }

        const streams = this.getStreams();
        const response = await (this.client as any).xreadgroup(
          'GROUP', this.groupName, this.consumerName,
          'COUNT', '10',
          'BLOCK', String(this.blockMs),
          'STREAMS',
          ...streams,
          ...streams.map(() => '>'),
        ) as Array<[string, Array<[string, string[]]>]> | null;

        if (!response) continue;

        for (const [stream, messages] of response) {
          for (const [messageId, fieldsArray] of messages) {
            const fields: Record<string, string> = {};
            for (let i = 0; i + 1 < fieldsArray.length; i += 2) {
              fields[fieldsArray[i]] = fieldsArray[i + 1];
            }
            this.inFlightCount++;
            try {
              await this.dispatch(stream, fields);
              await (this.client as any).xack(stream, this.groupName, messageId);
            } catch (err: any) {
              this.logger.error(
                `Failed to dispatch message ${messageId} from ${stream}: ${(err as Error).message}`,
              );
            } finally {
              this.inFlightCount--;
            }
          }
        }
      } catch (err: any) {
        if (!this.shuttingDown) {
          this.logger.error('Redis consumer poll error', err);
          await new Promise<void>((resolve) => setTimeout(resolve, 1_000));
        }
      }
    }
  }

  private async createGroup(stream: string): Promise<void> {
    try {
      await (this.client as any).xgroup('CREATE', stream, this.groupName, '$', 'MKSTREAM');
    } catch (err: any) {
      if (!err?.message?.includes('BUSYGROUP')) throw err;
    }
  }

  private async reclaimPending(): Promise<void> {
    for (const stream of this.getStreams()) {
      try {
        const result = await (this.client as any).xautoclaim(
          stream, this.groupName, this.consumerName,
          this.minIdleMs, '0-0', 'COUNT', '100',
        ) as [string, Array<[string, string[]]>] | null;

        if (!result) continue;
        const [, messages] = result;
        if (!messages?.length) continue;

        for (const [messageId, fieldsArray] of messages) {
          const fields: Record<string, string> = {};
          for (let i = 0; i + 1 < fieldsArray.length; i += 2) {
            fields[fieldsArray[i]] = fieldsArray[i + 1];
          }
          this.inFlightCount++;
          try {
            await this.dispatch(stream, fields);
            await (this.client as any).xack(stream, this.groupName, messageId);
          } catch (err: any) {
            this.logger.error(
              `Failed to dispatch reclaimed message ${messageId} from ${stream}: ${(err as Error).message}`,
            );
          } finally {
            this.inFlightCount--;
          }
        }
      } catch (err: any) {
        this.logger.warn(`XAUTOCLAIM failed for stream ${stream}: ${(err as Error).message}`);
      }
    }
  }
}
