import { CONTENT_TEMPLATES, GenerateContentType } from '../ai/templates';

/** All AI-generatable content type keys (15). */
export const GENERATE_CONTENT_TYPES = CONTENT_TEMPLATES.map((t) => t.key) as GenerateContentType[];

/** Legacy DB values kept for backward compatibility. */
export const LEGACY_CONTENT_TYPES = ['blog'] as const;

export const ALL_CONTENT_TYPES = [
  ...GENERATE_CONTENT_TYPES,
  ...LEGACY_CONTENT_TYPES,
] as const;

export type StoredContentType = (typeof ALL_CONTENT_TYPES)[number];

export type ContentStatus = 'draft' | 'approved' | 'scheduled' | 'published';

export const CONTENT_STATUSES: ContentStatus[] = [
  'draft',
  'approved',
  'scheduled',
  'published',
];

/** Map content type → default channel label for library filtering. */
export function defaultChannelForType(type: string): string | null {
  const map: Record<string, string> = {
    fb_post: 'facebook',
    tiktok_caption: 'tiktok',
    tiktok_script: 'tiktok',
    instagram: 'instagram',
    line_broadcast: 'line',
    gbp_post: 'google_business',
    seo_article: 'web',
    product_desc: 'web',
    ugc_script: 'ugc',
  };
  return map[type] ?? null;
}
