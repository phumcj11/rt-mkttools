import { apiRequest } from './api';

export interface ErpProduct {
  sku: string;
  productId: number;
  name: string;
  category: string;
  brand: string;
  retailPrice: string;
  imageUrl: string;
}

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
  status: 'queued' | 'processing' | 'done' | 'failed';
  videoUrl?: string;
  localPath?: string;
  error?: string;
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
  kling_key_preview: string | null;
}

// Products
export function listMediaProducts(limit = 50, offset = 0) {
  return apiRequest<ErpProduct[]>(`/media/products?limit=${limit}&offset=${offset}`);
}

// Image generation
export function generateBenefitImage(sku: string) {
  return apiRequest<ProductMediaResult>(`/media/products/${sku}/image`, { method: 'POST' });
}

/** Full poster via OpenAI GPT Image (server-side, uses ERP photo) */
export function generateGptBenefitImage(sku: string) {
  return apiRequest<ProductMediaResult>(`/media/products/${sku}/gpt-image`, { method: 'POST' });
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

// Video generation
export function submitProductVideo(sku: string) {
  return apiRequest<VideoTask | { error: true; message: string }>(
    '/media/products/video',
    { method: 'POST', body: { sku } },
  );
}

export function pollVideoTask(taskId: string, taskType?: string) {
  return apiRequest<VideoTask>('/media/video/poll', {
    method: 'POST',
    body: { taskId, taskType },
  });
}

export function generateVideoAndWait(sku: string) {
  return apiRequest<VideoTask | { error: true; message: string }>(
    `/media/products/${sku}/video/generate`,
    { method: 'POST' },
  );
}

// Promotion posters
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

export function saveVideoSettings(body: { kling_api_key?: string }) {
  return apiRequest<{ ok: boolean }>('/settings/system/video', { method: 'PATCH', body });
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
