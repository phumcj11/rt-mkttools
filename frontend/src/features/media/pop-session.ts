import {
  generatePopStickers,
  listMediaFiles,
  type MediaFile,
  type PopStickerOptions,
  type PopStickerResult,
} from '@/lib/media-api';

const SESSION_KEY = 'media_pop_session_v1';
const POP_STYLE_RE = /-(style_\d+|brand_style_\d+)-(\d+)\.png$/;

const STYLE_NAMES: Record<string, string> = {
  style_01: 'Healthy Aging Premium',
  style_02: 'Natural Beauty From Inside',
  style_03: 'Tourist Favorite Retail POP',
  style_04: 'Japanese Drugstore Best Seller',
  brand_style_01: '100 Baht Shop Branded POP',
  brand_style_02: 'Mascot Tourist Favorite',
  brand_style_03: 'Brand Shelf Stopper',
  brand_style_04: 'Mascot Best Seller Badge',
};

export interface PopGeneratingTask {
  sku: string;
  productName: string;
  startedAt: number;
  expectedCount: number;
  options: PopStickerOptions;
  filesFound: number;
}

export interface PopSessionState {
  results: Record<string, PopStickerResult>;
  generating: PopGeneratingTask | null;
}

const pending = new Map<string, Promise<PopStickerResult>>();

export function popExpectedCount(options: PopStickerOptions): number {
  const branded = options.includeBranded ? Math.max(1, Math.min(options.brandedCount ?? 2, 4)) : 0;
  return 4 + branded;
}

export function runPopGeneration(sku: string, options: PopStickerOptions): Promise<PopStickerResult> {
  let promise = pending.get(sku);
  if (!promise) {
    promise = generatePopStickers(sku, options).finally(() => pending.delete(sku));
    pending.set(sku, promise);
  }
  return promise;
}

export function hasPendingPopGeneration(sku: string): boolean {
  return pending.has(sku);
}

export function loadPopSession(): PopSessionState {
  if (typeof window === 'undefined') {
    return { results: {}, generating: null };
  }
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return { results: {}, generating: null };
    const parsed = JSON.parse(raw) as PopSessionState;
    return {
      results: parsed.results ?? {},
      generating: parsed.generating ?? null,
    };
  } catch {
    return { results: {}, generating: null };
  }
}

export function savePopSession(state: PopSessionState): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(state));
  } catch {
    // ignore quota errors
  }
}

export function popProgress(task: PopGeneratingTask): number {
  const elapsed = Math.max(0, (Date.now() - task.startedAt) / 1000);
  const expectedSeconds = task.expectedCount * 22 + 18;
  const timePct = 8 + (elapsed / expectedSeconds) * 78;
  const filePct = task.expectedCount > 0
    ? (task.filesFound / task.expectedCount) * 90
    : 0;
  return Math.min(92, Math.round(Math.max(timePct, filePct)));
}

function popFilePrefix(sku: string): string {
  const safe = sku.replace(/[^a-zA-Z0-9_-]/g, '_');
  return `pop-${safe}-`;
}

export function countPopFilesForTask(files: MediaFile[], task: PopGeneratingTask): number {
  const prefix = popFilePrefix(task.sku);
  const startedMs = task.startedAt - 5000;
  const groups = new Set<string>();
  for (const file of files) {
    if (!file.filename.startsWith(prefix)) continue;
    const created = new Date(file.createdAt).getTime();
    if (Number.isFinite(created) && created < startedMs) continue;
    const match = file.filename.match(POP_STYLE_RE);
    if (!match) continue;
    groups.add(`${match[1]}-${match[2]}`);
  }
  return groups.size;
}

export function buildPopResultFromFiles(
  sku: string,
  productName: string,
  files: MediaFile[],
  startedAt: number,
  existing?: PopStickerResult,
): PopStickerResult | null {
  const prefix = popFilePrefix(sku);
  const startedMs = startedAt - 5000;
  const byStyle = new Map<string, { filename: string; url: string; branded: boolean }>();

  for (const file of files) {
    if (!file.filename.startsWith(prefix)) continue;
    const created = new Date(file.createdAt).getTime();
    if (Number.isFinite(created) && created < startedMs) continue;
    const match = file.filename.match(POP_STYLE_RE);
    if (!match) continue;
    const styleId = match[1];
    const ts = Number(match[2]);
    const prev = byStyle.get(styleId);
    if (!prev || ts > Number(prev.filename.match(/-(\d+)\.png$/)?.[1] ?? 0)) {
      byStyle.set(styleId, {
        filename: file.filename,
        url: file.url,
        branded: styleId.startsWith('brand_'),
      });
    }
  }

  if (byStyle.size === 0) return null;

  const copy = existing?.copy ?? {
    headline: productName,
    subheadline: '',
    benefits: [],
    badges: [],
  };

  const variations = Array.from(byStyle.entries()).map(([styleId, file]) => ({
    styleId,
    styleName: STYLE_NAMES[styleId] ?? styleId,
    imageUrl: `/media/serve/${file.filename}`,
    filename: file.filename,
    promptUsed: '',
    model: '',
    cutoutUsed: false,
    branded: file.branded,
  }));

  return {
    sku,
    productName,
    copy,
    variations,
    generatedAt: new Date().toISOString(),
  };
}

export async function recoverPopFromFiles(task: PopGeneratingTask, existing?: PopStickerResult): Promise<PopStickerResult | null> {
  const files = await listMediaFiles().catch(() => [] as MediaFile[]);
  return buildPopResultFromFiles(task.sku, task.productName, files, task.startedAt, existing);
}
