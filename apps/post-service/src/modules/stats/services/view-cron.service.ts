import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { RedisService } from '@package/redis';
import { StatsRepository } from '../repositories/stats.repository';

@Injectable()
export class ViewCronService {
  private readonly logger = new Logger(ViewCronService.name);

  constructor(
    private readonly statsRepo: StatsRepository,
    private readonly redis: RedisService,
  ) {}

  @Cron('0 */2 * * * *')
  async flushViewBuffer() {
    if (!this.redis.isEnabled()) return;

    const locked = await this.redis.setnx('post:views:buffer:lock', '1', 60);
    if (!locked) return;

    try {
      // Atomic snapshot-then-clear: rename the live buffer to a temp key
      // FIRST, then read+upsert from the temp key. The previous flow read
      // the live key, upserted, then HDEL each entry — meaning any view
      // increments arriving DURING the flush were silently deleted with the
      // entry, double-counting on a crash and losing counts on a clean run.
      // RENAME is atomic; if the source key didn't exist the call throws,
      // which we swallow because "no buffer" is a normal state.
      const snapshotKey = `post:views:buffer:flush:${Date.now()}`;
      try {
        await this.redis.rename('post:views:buffer', snapshotKey);
      } catch {
        // No buffer to flush.
        return;
      }

      const buffer = await this.redis.hgetall(snapshotKey);
      const entries = Object.entries(buffer);
      if (!entries.length) {
        await this.redis.del(snapshotKey);
        return;
      }

      this.logger.log(`Flushing ${entries.length} post view counts`);

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Pre-validate entries so we can batch cleanly
      const validEntries: Array<{ postIdStr: string; postId: bigint; count: number }> = [];
      for (const [postIdStr, countStr] of entries) {
        let postId: bigint;
        try {
          postId = BigInt(postIdStr);
        } catch {
          this.logger.warn(`Skipping invalid post id in view buffer: ${postIdStr}`);
          continue;
        }
        const count = parseInt(countStr, 10);
        if (isNaN(count) || count <= 0) continue;
        validEntries.push({ postIdStr, postId, count });
      }

      const BATCH_SIZE = 20;
      for (let i = 0; i < validEntries.length; i += BATCH_SIZE) {
        const batch = validEntries.slice(i, i + BATCH_SIZE);
        await Promise.all(
          batch.map(async ({ postIdStr, postId, count }) => {
            try {
              await this.statsRepo.upsertStats(postId, count);
              await this.statsRepo.upsertDailyStats(postId, today, count);
            } catch (err) {
              // On failure, restore unflushed entries to the live buffer so we
              // retry next tick instead of losing the count permanently.
              this.logger.error(`Failed to flush views for post ${postIdStr}`, err);
              await this.redis
                .hincrby('post:views:buffer', postIdStr, count)
                .catch(() => undefined);
            }
          }),
        );
      }

      await this.redis.del(snapshotKey);
    } catch (err) {
      this.logger.error('View buffer flush error', err);
    } finally {
      await this.redis.del('post:views:buffer:lock');
    }
  }
}
