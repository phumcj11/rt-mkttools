import { apiRequest } from './api';

export interface ErpProduct {
  sku: string;
  productId: number;
  name: string;
  category: string;
  brand: string;
  retailPrice: string;
  costSales?: number;
  marginGpPct?: number;
  salesGpPct?: number;
  effectiveGpPct?: number;
  activePromotionCount?: number;
  marketingReadiness?: string;
  imageUrl: string;
}

export type MediaProductFilter = 'ready' | 'new_today' | 'new' | 'promo' | 'all';

export interface ProductMediaResult {
  sku: string;
  productName: string;
  imageUrl: string;
  benefits: string;
  benefitLines?: string[];
  originalImageUrl: string;
  generatedAt: string;
  source?: 'benefit_poster' | 'gpt_image' | 'dalle' | 'erp_composite';
  price?: string;
  category?: string;
}

/** Static uploads served via /api/media/serve/:filename */
export function resolveMediaUrl(path: string): string {
  if (path.startsWith('data:') || path.startsWith('blob:')) return path;
  if (path.startsWith('http')) return path;
  const api = (process.env.NEXT_PUBLIC_API_URL ?? '/api').replace(/\/$/, '');
  if (path.startsWith('/media/')) return `${api}${path}`;
  // legacy /uploads paths
  const origin = api.replace(/\/api$/, '');
  return `${origin}${path.startsWith('/') ? path : `/${path}`}`;
}

export interface MediaFile {
  filename: string;
  url: string;
  createdAt: string;
}

export interface VideoTask {
  taskId: string;
  provider?: VideoProviderId;
  model?: string;
  status: 'queued' | 'processing' | 'done' | 'failed';
  videoUrl?: string;
  localPath?: string;
  error?: string;
  pollAfterSeconds?: number;
  metadata?: Record<string, unknown>;
}

export interface DriveUploadResult {
  fileId: string;
  name: string;
  webViewLink: string;
}

export interface DriveSyncResult {
  uploaded: DriveUploadResult[];
  failed: { file: string; error: string }[];
}

export interface DriveSettings {
  drive_configured: boolean;
  drive_folder_id_preview: string | null;
  drive_service_account_set: boolean;
}

export interface VideoSettings {
  video_configured: boolean;
  video_provider_default: VideoProviderId;
  video_model_default: string;
  gemini_configured: boolean;
  kling_configured: boolean;
  grok_configured: boolean;
  gemini_key_preview: string | null;
  kling_key_preview: string | null;
  grok_key_preview: string | null;
}

export type VideoProviderId = 'gemini' | 'kling' | 'grok';

export const VIDEO_MODELS: Record<VideoProviderId, string[]> = {
  gemini: ['veo-3.1-generate-preview', 'veo-3.0-generate-preview', 'veo-2.0-generate-001'],
  kling: ['kling-v1', 'kling-v1-6'],
  grok: ['grok-imagine-video-1.5-preview', 'grok-imagine-video'],
};

export const VIDEO_DURATION_OPTIONS = [8, 10, 15] as const;

export interface VideoSubmitOptions {
  provider?: VideoProviderId;
  model?: string;
  script?: string;
  visualBrief?: string;
  mascotAssetFilenames?: string[];
  useCutoutProductImage?: boolean;
  duration?: number;
  aspectRatio?: string;
  resolution?: '720p' | '480p';
  locale?: 'en' | 'th';
}

export interface VideoPlanStep {
  step: 'cutout' | 'benefits' | 'script' | 'prompt';
  status: 'done' | 'skipped' | 'failed';
  detail?: string;
}

export interface VideoPlanResult {
  sku: string;
  productName: string;
  cutoutUsed: boolean;
  cutoutUrl?: string;
  benefits: string[];
  script: string;
  visualBrief: string;
  prompt: string;
  locale: 'en' | 'th';
  steps: VideoPlanStep[];
}

// Products
export function listMediaProducts(
  limit = 50,
  offset = 0,
  options: { q?: string; filter?: MediaProductFilter } = {},
) {
  const page = Math.floor(offset / limit) + 1;
  const search = new URLSearchParams({
    filter: options.filter ?? 'ready',
    page: String(page),
    limit: String(limit),
  });
  if (options.q?.trim()) search.set('q', options.q.trim());
  return apiRequest<{ items: Array<Omit<ErpProduct, 'retailPrice'> & { retailPrice: number }> }>(
    `/products/catalog?${search.toString()}`,
  ).then((res) => res.items.map((item) => ({ ...item, retailPrice: String(item.retailPrice) })));
}

// Image generation
export function generateBenefitImage(sku: string) {
  return apiRequest<ProductMediaResult>(`/media/products/${sku}/image`, { method: 'POST' });
}

/** Full poster via OpenAI GPT Image (server-side, uses ERP photo) */
export function generateGptBenefitImage(sku: string) {
  return apiRequest<ProductMediaResult>(`/media/products/${sku}/gpt-image`, { method: 'POST' });
}

// ---------------------------------------------------------------------------
// POP Sticker Generator
// ---------------------------------------------------------------------------

export interface PopStickerCopy {
  headline: string;
  subheadline: string;
  benefits: string[];
  badges: string[];
}

export interface PopStickerVariation {
  styleId: string;
  styleName: string;
  imageUrl: string;
  filename: string;
  promptUsed: string;
  model: string;
  cutoutUsed: boolean;
  branded?: boolean;
}

export interface PopStickerResult {
  sku: string;
  productName: string;
  copy: PopStickerCopy;
  variations: PopStickerVariation[];
  generatedAt: string;
  productImageSize?: { width: number; height: number };
}

export interface BrandAsset {
  filename: string;
  kind: 'logo' | 'mascot';
  url: string;
  createdAt: string;
}

export interface PopStickerOptions {
  includeBranded?: boolean;
  brandAssetFilenames?: string[];
  brandedCount?: number;
}

/**
 * AI Product POP Sticker Generator:
 * analyzes ERP image → generates safe copy → 4 GPT Image shelf sticker variations
 */
export function generatePopStickers(sku: string, options?: PopStickerOptions) {
  return apiRequest<PopStickerResult>(`/media/products/${sku}/pop-stickers`, {
    method: 'POST',
    body: options ?? {},
  });
}

export function listBrandAssets() {
  return apiRequest<BrandAsset[]>('/media/brand-assets');
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error('อ่านไฟล์ไม่สำเร็จ'));
    reader.readAsDataURL(file);
  });
}

function loadImageFromFile(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('โหลดรูปไม่สำเร็จ'));
    };
    img.src = url;
  });
}

/** Resize/compress brand assets so JSON upload stays under reverse-proxy limits (~12MB). */
export async function prepareBrandAssetDataUrl(file: File, maxEdge = 1200): Promise<string> {
  const img = await loadImageFromFile(file);
  let width = img.naturalWidth;
  let height = img.naturalHeight;
  const scale = Math.min(1, maxEdge / Math.max(width, height));
  width = Math.max(1, Math.round(width * scale));
  height = Math.max(1, Math.round(height * scale));

  const needsResize = scale < 1;
  const needsCompress = file.size > 900 * 1024;
  if (!needsResize && !needsCompress) {
    return readFileAsDataUrl(file);
  }

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('ไม่สามารถประมวลผลรูปได้');

  ctx.drawImage(img, 0, 0, width, height);

  const keepAlpha = file.type === 'image/png' || file.type === 'image/webp';
  let dataUrl = keepAlpha
    ? canvas.toDataURL('image/png')
    : canvas.toDataURL('image/jpeg', 0.88);

  if (dataUrl.length > 6 * 1024 * 1024) {
    dataUrl = canvas.toDataURL('image/jpeg', 0.82);
  }
  if (dataUrl.length > 8 * 1024 * 1024) {
    throw new Error('รูปใหญ่เกินไป — ลองใช้ไฟล์ที่เล็กลง (แนะนำต่ำกว่า 5MB)');
  }

  return dataUrl;
}

export function uploadBrandAsset(kind: 'logo' | 'mascot', dataUrl: string) {
  return apiRequest<BrandAsset>('/media/brand-assets/upload', {
    method: 'POST',
    body: { kind, dataUrl },
  });
}

export function uploadBenefitPoster(sku: string, dataUrl: string) {
  return apiRequest<{ imageUrl: string; filename: string }>(`/media/products/${sku}/poster`, {
    method: 'POST',
    body: { dataUrl },
  });
}

/** Same-origin proxy for ERP images (html-to-image CORS) */
export function proxyImageUrl(originalUrl: string): string {
  if (!originalUrl) return '';
  const api = (process.env.NEXT_PUBLIC_API_URL ?? '/api').replace(/\/$/, '');
  return `${api}/media/proxy-image?url=${encodeURIComponent(originalUrl)}`;
}

export function batchGenerateImages(skus: string[]) {
  return apiRequest<{ success: ProductMediaResult[]; failed: { sku: string; error: string }[] }>(
    '/media/products/batch-image',
    { method: 'POST', body: { skus } },
  );
}

// Generated files
export function listMediaFiles() {
  return apiRequest<MediaFile[]>('/media/files');
}

export function deleteMediaFile(filename: string) {
  return apiRequest<{ ok: boolean; filename: string }>(`/media/files/${encodeURIComponent(filename)}`, {
    method: 'DELETE',
  });
}

// Video generation
export function submitProductVideo(sku: string, options: VideoSubmitOptions = {}) {
  return apiRequest<VideoTask | { error: true; message: string }>(
    '/media/products/video',
    { method: 'POST', body: { sku, ...options } },
  );
}

export function getVideoPlan(sku: string, options: Omit<VideoSubmitOptions, never> = {}) {
  return apiRequest<VideoPlanResult>(`/media/products/${encodeURIComponent(sku)}/video/plan`, {
    method: 'POST',
    body: options,
  });
}

export function pollVideoTask(task: Pick<VideoTask, 'taskId' | 'provider' | 'model' | 'metadata'> & { taskType?: string }) {
  return apiRequest<VideoTask>('/media/video/poll', {
    method: 'POST',
    body: {
      taskId: task.taskId,
      provider: task.provider,
      model: task.model,
      metadata: task.metadata,
      taskType: task.taskType,
    },
  });
}

export function generateVideoAndWait(sku: string, options: VideoSubmitOptions = {}) {
  return apiRequest<VideoTask | { error: true; message: string }>(
    `/media/products/${sku}/video/generate`,
    { method: 'POST', body: options },
  );
}

// Promotion posters
export interface PromoCompositeResult {
  imageUrl: string;
  filename: string;
  generatedAt: string;
  source: 'composite';
  cutoutUsed: boolean;
}

export interface PromoGptResult {
  imageUrl: string;
  filename: string;
  model: string;
  promptUsed: string;
  generatedAt: string;
  source: 'gpt_image';
}

/** Default: pixel-perfect composite (template + sharp + optionally n8n cutout) */
export function generatePromoComposite(
  promoType: string,
  data: Record<string, string>,
  imageUrls: Record<string, string>,
) {
  return apiRequest<PromoCompositeResult>('/media/promo/generate', {
    method: 'POST',
    body: { promoType, data, imageUrls },
  });
}

/** Optional AI Creative mode: GPT Image */
export function generatePromoGptImage(
  promoType: string,
  data: Record<string, unknown>,
  referenceImageUrl?: string,
) {
  return apiRequest<PromoGptResult>('/media/promo/generate-gpt', {
    method: 'POST',
    body: { promoType, data, referenceImageUrl: referenceImageUrl || undefined },
  });
}

export function savePromoImage(promoType: string, dataUrl: string) {
  return apiRequest<{ imageUrl: string; filename: string }>('/media/promo/save', {
    method: 'POST',
    body: { promoType, dataUrl },
  });
}

export function generatePromoFeatures(sku: string) {
  return apiRequest<{ feature1: string; feature2: string; feature3: string }>(
    `/media/promo/features/${sku}`,
    { method: 'POST' },
  );
}

// Google Drive
export function getDriveSettings() {
  return apiRequest<DriveSettings>('/settings/system/drive');
}

export function saveDriveSettings(body: {
  google_drive_folder_id?: string;
  google_service_account_json?: string;
}) {
  return apiRequest<{ ok: boolean }>('/settings/system/drive', { method: 'PATCH', body });
}

export function getVideoSettings() {
  return apiRequest<VideoSettings>('/settings/system/video');
}

export function saveVideoSettings(body: { video_provider_default?: VideoProviderId; video_model_default?: string; gemini_api_key?: string; kling_api_key?: string; grok_api_key?: string }) {
  return apiRequest<{ ok: boolean }>('/settings/system/video', { method: 'PATCH', body });
}

export interface N8nSettings {
  n8n_configured: boolean;
  n8n_webhook_url_preview: string | null;
}

export function getN8nSettings() {
  return apiRequest<N8nSettings>('/settings/system/n8n');
}

export function saveN8nSettings(body: { n8n_promo_webhook_url: string }) {
  return apiRequest<{ ok: boolean }>('/settings/system/n8n', { method: 'PATCH', body });
}

export function syncToDrive() {
  return apiRequest<DriveSyncResult>('/media/drive/sync', { method: 'POST' });
}

export function uploadFileToDrive(filename: string) {
  return apiRequest<DriveUploadResult>('/media/drive/upload', {
    method: 'POST',
    body: { filename },
  });
}
