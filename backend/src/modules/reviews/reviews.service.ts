import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { getGoogleOAuthRedirectUri } from '../../common/utils/app-urls';
import { NotFoundAppException } from '../../common/exceptions/app.exception';
import { GoogleReview } from '../../database/entities';
import { OpenAiService } from '../ai/openai.service';
import { SystemSettingsService } from '../system-settings/system-settings.service';
import { CreateReviewDto } from './dto/create-review.dto';

const SENTIMENT_PROMPT: Record<string, string> = {
  positive: 'รีวิวเชิงบวก — ตอบขอบคุณอบอุ่นและเชิญมาใช้บริการอีกครั้ง',
  neutral:  'รีวิวกลางๆ — รับทราบและบอกจะปรับปรุง',
  negative: 'รีวิวเชิงลบ — ขอโทษจริงใจ ขอแก้ไขและขอช่องทางติดต่อ',
};

const GBP_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GBP_V4_BASE = 'https://mybusiness.googleapis.com/v4';
const GBP_ACCOUNTS_V1_URL = 'https://mybusinessaccountmanagement.googleapis.com/v1/accounts';

@Injectable()
export class ReviewsService {
  private readonly logger = new Logger(ReviewsService.name);
  private locationsCache: {
    at: number;
    data: Array<{ name: string; title: string; accountName: string }>;
  } | null = null;
  private readonly locationsCacheMs = 5 * 60 * 1000;

  constructor(
    @InjectRepository(GoogleReview) private readonly repo: Repository<GoogleReview>,
    private readonly openai: OpenAiService,
    private readonly settings: SystemSettingsService,
  ) {}

  // ─── CRUD ─────────────────────────────────────────────────────────────────

  findAll(tenantId: number, branchId?: number) {
    return this.repo.find({
      where: { tenantId, ...(branchId ? { branchId } : {}) },
      order: { createdAt: 'DESC' },
      take: 200,
    });
  }

  async findOne(tenantId: number, id: number) {
    const item = await this.repo.findOne({ where: { id, tenantId } });
    if (!item) throw new NotFoundAppException();
    return item;
  }

  async create(tenantId: number, dto: CreateReviewDto) {
    const sentiment = dto.sentiment ?? this.guessSentiment(dto.rating);
    const review = this.repo.create({
      tenantId,
      branchId: dto.branchId ?? null,
      author: dto.author ?? null,
      rating: dto.rating,
      text: dto.text ?? null,
      sentiment,
      reviewDate: dto.reviewDate ? new Date(dto.reviewDate) : null,
    });
    return this.repo.save(review);
  }

  async generateReply(tenantId: number, id: number): Promise<{ aiReply: string }> {
    const review = await this.findOne(tenantId, id);
    const sentiment = review.sentiment ?? 'neutral';
    const hint = SENTIMENT_PROMPT[sentiment] ?? SENTIMENT_PROMPT['neutral'];

    let aiReply = this.defaultReply(sentiment);
    if (this.openai.isConfigured()) {
      try {
        const result = await this.openai.complete(
          `คุณเป็นพนักงานบริการลูกค้าของ "100 Baht Shop Thailand" ตอบรีวิว Google ภาษาไทย สุภาพ กระชับ ไม่เกิน 3 ประโยค ${hint}`,
          `รีวิว ${review.rating} ดาว โดย ${review.author ?? 'ลูกค้า'}: "${review.text ?? '(ไม่มีข้อความ)'}"`,
        );
        aiReply = result.content;
      } catch (err) {
        this.logger.warn('AI reply generation failed', err);
      }
    }

    review.aiReply = aiReply;
    await this.repo.save(review);
    return { aiReply };
  }

  async markReplied(tenantId: number, id: number) {
    const review = await this.findOne(tenantId, id);
    review.repliedAt = new Date();
    return this.repo.save(review);
  }

  async remove(tenantId: number, id: number): Promise<void> {
    const item = await this.findOne(tenantId, id);
    await this.repo.remove(item);
  }

  async getStats(tenantId: number) {
    const all = await this.repo.find({ where: { tenantId } });
    const total = all.length;
    const avg = total ? all.reduce((s, r) => s + r.rating, 0) / total : 0;
    const negative = all.filter((r) => r.sentiment === 'negative').length;
    const unreplied = all.filter((r) => !r.repliedAt && r.sentiment !== 'positive').length;
    return { total, avgRating: Math.round(avg * 10) / 10, negative, unreplied };
  }

  async getStatsByBranch(tenantId: number, from?: string, to?: string) {
    const qb = this.repo
      .createQueryBuilder('r')
      .select('r.branch_id', 'branchId')
      .addSelect('COUNT(*)', 'total')
      .addSelect('AVG(r.rating)', 'avgRating')
      .addSelect(
        "SUM(CASE WHEN r.sentiment = 'negative' THEN 1 ELSE 0 END)",
        'negative',
      )
      .addSelect(
        "SUM(CASE WHEN r.replied_at IS NULL AND (r.sentiment IS NULL OR r.sentiment != 'positive') THEN 1 ELSE 0 END)",
        'unreplied',
      )
      .where('r.tenant_id = :tenantId', { tenantId })
      .groupBy('r.branch_id');

    if (from) qb.andWhere('r.review_date >= :from', { from });
    if (to) qb.andWhere('r.review_date <= :to', { to });

    const rows = await qb.getRawMany<{
      branchId: string | null;
      total: string;
      avgRating: string;
      negative: string;
      unreplied: string;
    }>();

    const branches = rows.map((r) => ({
      branchId: r.branchId ? Number(r.branchId) : null,
      total: Number(r.total),
      avgRating: Math.round(Number(r.avgRating) * 10) / 10,
      negative: Number(r.negative),
      unreplied: Number(r.unreplied),
    }));

    const unassigned = branches.find((b) => b.branchId === null);
    const assigned = branches
      .filter((b) => b.branchId !== null)
      .sort((a, b) => b.total - a.total);

    const totals = {
      total: branches.reduce((s, b) => s + b.total, 0),
      avgRating:
        branches.length > 0
          ? Math.round(
              (branches.reduce((s, b) => s + b.avgRating * b.total, 0) /
                Math.max(1, branches.reduce((s, b) => s + b.total, 0))) *
                10,
            ) / 10
          : 0,
      negative: branches.reduce((s, b) => s + b.negative, 0),
      unreplied: branches.reduce((s, b) => s + b.unreplied, 0),
      unassignedCount: unassigned?.total ?? 0,
    };

    return { period: { from: from ?? null, to: to ?? null }, totals, branches: assigned };
  }

  // ─── Google Business Profile OAuth ────────────────────────────────────────

  /** คืนสถานะการเชื่อมต่อ GBP ปัจจุบัน */
  async getGoogleStatus(): Promise<{
    credentialsConfigured: boolean;
    connected: boolean;
    locationName: string | null;
    locationTitle: string | null;
    tokenExpiresAt: string | null;
  }> {
    const [clientId, accessToken, locationName, locationTitle, tokenExpiry] =
      await Promise.all([
        this.settings.get('google_client_id'),
        this.settings.get('google_access_token'),
        this.settings.get('google_location_name'),
        this.settings.get('google_location_title'),
        this.settings.get('google_token_expiry'),
      ]);
    return {
      credentialsConfigured: !!(clientId && clientId.length > 5),
      connected: !!(accessToken && accessToken.length > 5),
      locationName: locationName || null,
      locationTitle: locationTitle || null,
      tokenExpiresAt: tokenExpiry
        ? new Date(Number(tokenExpiry)).toISOString()
        : null,
    };
  }

  /** สร้าง Google OAuth consent URL */
  async getGoogleAuthUrl(): Promise<{ url: string }> {
    const clientId = await this.settings.get('google_client_id');
    if (!clientId) {
      throw new Error('google_client_id not configured — please set it in Settings first');
    }
    const redirectUri = this.buildRedirectUri();
    const scopes = [
      'https://www.googleapis.com/auth/business.manage',
    ].join(' ');

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: scopes,
      access_type: 'offline',
      prompt: 'consent',
    });
    return { url: `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}` };
  }

  /** แลกเปลี่ยน OAuth code → tokens และบันทึกลง system_settings */
  async handleGoogleCallback(code: string): Promise<void> {
    const [clientId, clientSecret] = await Promise.all([
      this.settings.get('google_client_id'),
      this.settings.get('google_client_secret'),
    ]);
    if (!clientId || !clientSecret) {
      throw new Error('Google credentials not configured');
    }

    const redirectUri = this.buildRedirectUri();
    const res = await fetch(GBP_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }).toString(),
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Token exchange failed: ${res.status} ${body}`);
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data = (await res.json()) as any;
    const expiry = Date.now() + (data.expires_in ?? 3600) * 1000;
    await Promise.all([
      this.settings.set('google_access_token',  data.access_token  ?? ''),
      this.settings.set('google_refresh_token',  data.refresh_token ?? ''),
      this.settings.set('google_token_expiry',   String(expiry)),
    ]);
    this.logger.log('Google OAuth tokens saved successfully');
  }

  /** ต่ออายุ access_token ถ้าใกล้หมดอายุ (buffer 2 นาที) */
  async refreshGoogleTokenIfNeeded(): Promise<void> {
    const [expiry, refreshToken, clientId, clientSecret] = await Promise.all([
      this.settings.get('google_token_expiry'),
      this.settings.get('google_refresh_token'),
      this.settings.get('google_client_id'),
      this.settings.get('google_client_secret'),
    ]);
    if (!refreshToken || !clientId || !clientSecret) return;

    // Still valid (more than 2 min remaining)
    if (expiry && Date.now() < Number(expiry) - 2 * 60 * 1000) return;

    this.logger.log('Refreshing Google access token…');
    const res = await fetch(GBP_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      }).toString(),
    });
    if (!res.ok) {
      this.logger.warn(`Token refresh failed: ${res.status}`);
      return;
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data = (await res.json()) as any;
    const newExpiry = Date.now() + (data.expires_in ?? 3600) * 1000;
    await Promise.all([
      this.settings.set('google_access_token', data.access_token ?? ''),
      this.settings.set('google_token_expiry',  String(newExpiry)),
    ]);
  }

  /** ดึงรายการ GBP accounts และ locations ที่เชื่อมต่ออยู่ */
  async listGoogleLocations(): Promise<
    Array<{ name: string; title: string; accountName: string }>
  > {
    if (
      this.locationsCache &&
      Date.now() - this.locationsCache.at < this.locationsCacheMs
    ) {
      return this.locationsCache.data;
    }

    await this.refreshGoogleTokenIfNeeded();
    const accessToken = await this.settings.get('google_access_token');
    if (!accessToken) throw new Error('Not connected to Google');

    try {
      const locations = await this.fetchAllLocations(accessToken);
      if (locations.length === 0) {
        throw new Error(
          'ไม่พบ Location — ตรวจสอบว่าเปิดใช้งาน "My Business Business Information API" ใน Google Cloud Console',
        );
      }
      this.locationsCache = { at: Date.now(), data: locations };
      return locations;
    } catch (err) {
      if (this.locationsCache) {
        this.logger.warn('Returning stale locations cache after API error');
        return this.locationsCache.data;
      }
      throw err;
    }
  }

  /** บันทึก location ที่เลือก */
  async selectGoogleLocation(name: string, title: string): Promise<void> {
    await Promise.all([
      this.settings.set('google_location_name',  name),
      this.settings.set('google_location_title', title),
    ]);
  }

  /** ดึงรีวิวจาก GBP API และ upsert ลง google_reviews */
  async syncGoogleReviews(tenantId: number): Promise<{ synced: number; errors: number }> {
    await this.refreshGoogleTokenIfNeeded();
    const [accessToken, locationName] = await Promise.all([
      this.settings.get('google_access_token'),
      this.settings.get('google_location_name'),
    ]);
    if (!accessToken) throw new Error('Not connected to Google');
    if (!locationName) throw new Error('No location selected — please select a location first');

    const reviewsUrl = `${GBP_V4_BASE}/${locationName}/reviews`;

    const res = await fetch(reviewsUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`GBP reviews API error: ${res.status} ${body}`);
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data = (await res.json()) as any;
    const reviews: any[] = data.reviews ?? [];

    let synced = 0;
    let errors = 0;

    for (const r of reviews) {
      try {
        const googleReviewId = r.reviewId as string;
        const starRating = this.starToNumber(r.starRating as string);
        const text = r.comment as string | null ?? null;
        const author = r.reviewer?.displayName as string | null ?? null;
        const reviewDate = r.createTime
          ? new Date(r.createTime as string)
          : null;

        // Upsert by googleReviewId
        const existing = await this.repo.findOne({
          where: { tenantId, googleReviewId },
        });
        if (existing) {
          existing.author = author;
          existing.rating = starRating;
          existing.text = text;
          existing.reviewDate = reviewDate;
          existing.sentiment = this.guessSentiment(starRating);
          await this.repo.save(existing);
        } else {
          await this.repo.save(
            this.repo.create({
              tenantId,
              googleReviewId,
              author,
              rating: starRating,
              text,
              sentiment: this.guessSentiment(starRating),
              reviewDate,
            }),
          );
        }
        synced++;
      } catch (err) {
        this.logger.warn(`Failed to upsert review: ${(err as Error).message}`);
        errors++;
      }
    }
    this.logger.log(`GBP sync complete: ${synced} upserted, ${errors} errors`);
    return { synced, errors };
  }

  /** ยกเลิกการเชื่อมต่อ Google */
  async disconnectGoogle(): Promise<void> {
    this.locationsCache = null;
    await Promise.all([
      this.settings.set('google_access_token',  ''),
      this.settings.set('google_refresh_token',  ''),
      this.settings.set('google_token_expiry',   ''),
      this.settings.set('google_location_name',  ''),
      this.settings.set('google_location_title', ''),
    ]);
    this.logger.log('Google disconnected');
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  /** GET จาก Google API — throw พร้อม error message จาก Google */
  private async googleApiGet(accessToken: string, url: string): Promise<Record<string, unknown>> {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const text = await res.text();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let data: any;
    try {
      data = JSON.parse(text);
    } catch {
      data = { raw: text };
    }
    if (!res.ok) {
      if (res.status === 429) {
        throw new Error('429 Quota exceeded — กรุณารอ 1 นาทีแล้วลองใหม่');
      }
      const googleMsg =
        data?.error?.message ??
        (text.includes('<!DOCTYPE') ? 'API ไม่พร้อมใช้งาน — ตรวจสอบว่าเปิด API ใน Google Cloud Console' : text.slice(0, 200));
      throw new Error(`${res.status} ${googleMsg}`);
    }
    return data;
  }

  /**
   * ดึง locations ทั้งหมดด้วย Business Information API
   * ใช้ accounts/-/locations (1 call + pagination) แทน loop หลาย account
   */
  private async fetchAllLocations(
    accessToken: string,
  ): Promise<Array<{ name: string; title: string; accountName: string }>> {
    // ดึง account หลักไว้ normalize location name สำหรับ Reviews API v4
    let primaryAccount = '';
    try {
      const accData = await this.googleApiGet(accessToken, GBP_ACCOUNTS_V1_URL);
      const accounts = (accData.accounts as Array<{ name: string; type?: string }>) ?? [];
      const group =
        accounts.find((a) => a.type === 'LOCATION_GROUP') ??
        accounts.find((a) => a.type === 'ORGANIZATION') ??
        accounts[0];
      primaryAccount = group?.name ?? '';
    } catch (err) {
      this.logger.warn(`Could not list GBP accounts: ${(err as Error).message}`);
    }

    const locations: Array<{ name: string; title: string; accountName: string }> = [];
    let pageToken: string | undefined;

    do {
      const params = new URLSearchParams({
        readMask: 'name,title,storeCode',
        pageSize: '100',
      });
      if (pageToken) params.set('pageToken', pageToken);

      const url =
        `https://mybusinessbusinessinformation.googleapis.com/v1/accounts/-/locations?${params}`;
      const locData = await this.googleApiGet(accessToken, url);

      for (const loc of (locData.locations as Array<Record<string, string>>) ?? []) {
        const rawName = loc.name;
        // Business Information API อาจคืน "locations/123" — normalize เป็น full path
        let fullName = rawName;
        if (rawName.startsWith('locations/') && primaryAccount) {
          fullName = `${primaryAccount}/${rawName}`;
        }

        locations.push({
          name: fullName,
          title: String(loc.title ?? loc.storeCode ?? rawName),
          accountName: primaryAccount || fullName.split('/locations/')[0] || '',
        });
      }
      pageToken = locData.nextPageToken as string | undefined;
    } while (pageToken);

    return locations;
  }

  /** URL ที่ Google จะ redirect กลับมาหลัง OAuth */
  private buildRedirectUri(): string {
    return getGoogleOAuthRedirectUri();
  }

  private starToNumber(star: string): number {
    const map: Record<string, number> = {
      ONE: 1, TWO: 2, THREE: 3, FOUR: 4, FIVE: 5,
    };
    return map[star] ?? 3;
  }

  private guessSentiment(rating: number): 'positive' | 'neutral' | 'negative' {
    if (rating >= 4) return 'positive';
    if (rating === 3) return 'neutral';
    return 'negative';
  }

  private defaultReply(sentiment: string): string {
    if (sentiment === 'positive') return 'ขอบคุณมากเลยนะคะที่ให้เกียรติมาใช้บริการและฝากรีวิวดีๆ ไว้ ทีมงาน 100 Baht Shop Thailand ยินดีต้อนรับเสมอค่ะ 🙏';
    if (sentiment === 'negative') return 'ขออภัยในความไม่สะดวกค่ะ ทีมงานรับทราบแล้วและจะเร่งปรับปรุงทันที หากต้องการแจ้งรายละเอียดเพิ่มเติม ติดต่อเราได้โดยตรงค่ะ';
    return 'ขอบคุณสำหรับ Feedback นะคะ เราจะนำไปปรับปรุงบริการเพื่อให้ดียิ่งขึ้นค่ะ';
  }
}
