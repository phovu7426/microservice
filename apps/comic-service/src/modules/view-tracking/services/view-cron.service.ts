import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { RedisService } from '@package/redis';
import { ViewTrackingRepository } from '../repositories/view-tracking.repository';

@Injectable()
export class ViewCronService {
  private readonly logger = new Logger(ViewCronService.name);

  constructor(
    private readonly viewRepo: ViewTrackingRepository,
    private readonly redis: RedisService,
  ) {}

  @Cron('0 */5 * * * *')
  async flushViewBuffer() {
    if (!this.redis.isEnabled()) return;

    const locked = await this.redis.setnx('comic:views:buffer:lock', '1', 60);
    if (!locked) return;

    try {
      // Atomic snapshot-then-clear: rename the live buffer to a temp key
      // BEFORE reading. The previous flow read the live key, upserted, then
      // HDEL each entry — meaning every increment arriving DURING the
      // flush was silently deleted with the entry, double-counting on a
      // crash and losing counts on a clean run. RENAME is atomic; if the
      // source key didn't exist the call throws, swallowed as "no buffer".
      const snapshotKey = `comic:views:buffer:flush:${Date.now()}`;
      try {
        await this.redis.rename('comic:views:buffer', snapshotKey);
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

      this.logger.log(`Flushing ${entries.length} comic view counts`);

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Pre-validate entries so we can batch cleanly
      const validEntries: Array<{ comicIdStr: string; comicId: bigint; count: number }> = [];
      for (const [comicIdStr, countStr] of entries) {
        let comicId: bigint;
        try {
          comicId = BigInt(comicIdStr);
        } catch {
          this.logger.warn(`Skipping invalid comic id in view buffer: ${comicIdStr}`);
          continue;
        }
        const count = parseInt(countStr, 10);
        if (isNaN(count) || count <= 0) continue;
        validEntries.push({ comicIdStr, comicId, count });
      }

      const BATCH_SIZE = 20;
      for (let i = 0; i < validEntries.length; i += BATCH_SIZE) {
        const batch = validEntries.slice(i, i + BATCH_SIZE);
        await Promise.all(
          batch.map(async ({ comicIdStr, comicId, count }) => {
            try {
              await this.viewRepo.upsertStats(comicId, count);
              await this.viewRepo.upsertDailyStats(comicId, today, count);
            } catch (err: any) {
              // On failure, restore the unflushed entries to the live buffer
              // so the next tick retries instead of losing the count forever.
              this.logger.error(`Failed to flush views for comic ${comicIdStr}`, err);
              await this.redis
                .hincrby('comic:views:buffer', comicIdStr, count)
                .catch(() => undefined);
            }
          }),
        );
      }

      await this.redis.del(snapshotKey);
    } catch (err: any) {
      this.logger.error('View buffer flush error', err);
    } finally {
      await this.redis.del('comic:views:buffer:lock');
    }
  }
}
