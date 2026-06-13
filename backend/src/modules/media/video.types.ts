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
  duration?: number;
  aspectRatio?: string;
  resolution?: '720p' | '480p';
}

export interface VideoGenerationConfig {
  model: string;
  duration?: number;
  aspectRatio?: string;
  resolution?: '720p' | '480p';
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
  submit(assets: PreparedVideoAssets, options: VideoGenerationConfig): Promise<VideoGenerationResult>;
  poll(taskId: string, options: VideoPollOptions): Promise<VideoGenerationResult>;
}

export const VIDEO_PROVIDER_MODELS: Record<VideoProviderId, string[]> = {
  gemini: ['veo-3.1-generate-preview', 'veo-3.0-generate-preview', 'veo-2.0-generate-001'],
  kling: ['kling-v1', 'kling-v1-6'],
  grok: ['grok-imagine-video-1.5-preview', 'grok-imagine-video'],
};

export const DEFAULT_VIDEO_PROVIDER: VideoProviderId = 'grok';
export const DEFAULT_VIDEO_MODEL = VIDEO_PROVIDER_MODELS.grok[0];
export const DEFAULT_VIDEO_DURATION = 15;
export const DEFAULT_VIDEO_ASPECT_RATIO = '9:16';
export const DEFAULT_VIDEO_RESOLUTION = '720p' as const;
