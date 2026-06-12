import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SystemSetting } from '../../database/entities/system-setting.entity';

const CACHE_TTL_MS = 5 * 60 * 1_000; // 5 min in-memory cache

@Injectable()
export class SystemSettingsService implements OnModuleInit {
  private cache = new Map<string, { value: string | null; expiry: number }>();

  constructor(
    @InjectRepository(SystemSetting)
    private readonly repo: Repository<SystemSetting>,
  ) {}

  async onModuleInit() {
    // Warm cache on start
    await this.loadAll();
  }

  private async loadAll() {
    const rows = await this.repo.find();
    const now = Date.now();
    for (const row of rows) {
      this.cache.set(row.key, { value: row.value, expiry: now + CACHE_TTL_MS });
    }
  }

  async get(key: string): Promise<string | null> {
    const cached = this.cache.get(key);
    if (cached && cached.expiry > Date.now()) {
      return cached.value;
    }
    const row = await this.repo.findOne({ where: { key } });
    const value = row?.value ?? null;
    this.cache.set(key, { value, expiry: Date.now() + CACHE_TTL_MS });
    return value;
  }

  async set(key: string, value: string): Promise<void> {
    await this.repo.save({ key, value: value || null });
    this.cache.set(key, { value: value || null, expiry: Date.now() + CACHE_TTL_MS });
  }

  async getAll(): Promise<Record<string, string | null>> {
    const rows = await this.repo.find();
    return Object.fromEntries(rows.map((r) => [r.key, r.value]));
  }

  /** Invalidate a specific key from cache */
  invalidate(key: string) {
    this.cache.delete(key);
  }
}
