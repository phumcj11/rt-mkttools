import { ErpProductCache } from '../../database/entities/erp-product-cache.entity';

export type VideoProviderId = 'gemini' | 'kling' | 'grok';

export type VideoStatus = 'queued' | 'processing' | 'done' | 'failed';

export interface VideoGenerationResult {
  taskId: string;
  provider: VideoProviderId;
  model: string;
  status: VideoStatus;
  videoUrl?: string;
  localPath?: string;
  error?: string;
  pollAfterSeconds?: number;
  metadata?: Record<string, unknown>;
}

export interface VideoSubmitOptions {
  provider?: VideoProviderId;
  model?: string;
  script?: string;
  visualBrief?: string;
  mascotAssetFilenames?: string[];
  useCutoutProductImage?: boolean;
}

export interface VideoPollOptions {
  provider?: VideoProviderId;
  model?: string;
  metadata?: Record<string, unknown>;
  taskType?: 'image2video' | 'text2video';
}

export interface VideoReferenceImage {
  label: string;
  buffer: Buffer;
  mimeType: string;
  url?: string;
}

export interface PreparedVideoAssets {
  product: ErpProductCache;
  prompt: string;
  script: string;
  benefits: string[];
  visualBrief: string;
  referenceImages: VideoReferenceImage[];
  primaryImageUrl?: string;
  contactSheet?: VideoReferenceImage;
  cutoutUsed: boolean;
}

export interface VideoProvider {
  readonly id: VideoProviderId;
  readonly defaultModel: string;
  readonly models: string[];
  isConfigured(): Promise<boolean>;
  submit(assets: PreparedVideoAssets, options: Required<Pick<VideoSubmitOptions, 'model'>>): Promise<VideoGenerationResult>;
  poll(taskId: string, options: VideoPollOptions): Promise<VideoGenerationResult>;
}

export const VIDEO_PROVIDER_MODELS: Record<VideoProviderId, string[]> = {
  gemini: ['veo-3.0-generate-preview', 'veo-2.0-generate-001'],
  kling: ['kling-v1', 'kling-v1-6'],
  grok: ['grok-video'],
};

export const DEFAULT_VIDEO_PROVIDER: VideoProviderId = 'gemini';
export const DEFAULT_VIDEO_MODEL = VIDEO_PROVIDER_MODELS.gemini[0];
