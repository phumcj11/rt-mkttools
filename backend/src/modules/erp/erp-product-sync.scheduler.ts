import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ErpSyncService } from './erp-sync.service';

@Injectable()
export class ErpProductSyncScheduler {
  private readonly logger = new Logger(ErpProductSyncScheduler.name);
  private running = false;

  constructor(private readonly sync: ErpSyncService) {}

  @Cron(CronExpression.EVERY_DAY_AT_2AM, { timeZone: 'Asia/Bangkok' })
  async syncDailyProductCatalog() {
    if (this.running) return;
    this.running = true;
    try {
      this.logger.log('Starting scheduled product marketing sync');
      await this.sync.syncProductMarketing('daily');
      this.logger.log('Finished scheduled product marketing sync');
    } catch (err) {
      this.logger.error(`Scheduled product marketing sync failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      this.running = false;
    }
  }
}
