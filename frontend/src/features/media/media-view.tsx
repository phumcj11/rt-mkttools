'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import {
  CheckSquare,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  CloudUpload,
  Download,
  Eye,
  Film,
  Image,
  Loader2,
  Pencil,
  RefreshCw,
  Search,
  Sparkles,
  Trash2,
  Upload,
  Video,
  X,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';
import { generateContent } from '@/lib/ai-api';
import { confirmDelete, showError, showInfo, showSuccess } from '@/lib/sweetalert';
import {
  generatePopStickers,
  getDriveSettings,
  getN8nSettings,
  getVideoSettings,
  getVideoPlan,
  listBrandAssets,
  listMediaFiles,
  listMediaProducts,
  pollVideoTask,
  prepareBrandAssetDataUrl,
  saveDriveSettings,
  saveN8nSettings,
  saveVideoSettings,
  submitProductVideo,
  syncToDrive,
  uploadBrandAsset,
  uploadFileToDrive,
  resolveMediaUrl,
  type BrandAsset,
  deleteMediaFile,
  type DriveSettings,
  type ErpProduct,
  type MediaFile,
  type MediaProductFilter,
  type N8nSettings,
  type PopStickerResult,
  type VideoPlanResult,
  type VideoSettings,
  type VideoSubmitOptions,
  type VideoTask,
  VIDEO_MODELS,
  VIDEO_DURATION_OPTIONS,
  type VideoProviderId,
} from '@/lib/media-api';
import { PromoTab } from './promo-tab';

type Tab = 'products' | 'promotion' | 'files' | 'settings';

export function MediaView() {
  const [tab, setTab] = useState<Tab>('products');

  const [products, setProducts] = useState<ErpProduct[]>([]);
  const [productsLoading, setProductsLoading] = useState(true);
  const [productSearch, setProductSearch] = useState('');
  const [productFilter, setProductFilter] = useState<MediaProductFilter>('ready');
  const [generating, setGenerating] = useState<string | null>(null);
  const [popResults, setPopResults] = useState<Record<string, PopStickerResult>>({});
  const [expandedSku, setExpandedSku] = useState<string | null>(null);
  const [brandAssets, setBrandAssets] = useState<BrandAsset[]>([]);
  const [selectedBrandAssets, setSelectedBrandAssets] = useState<Set<string>>(new Set());
  const [includeBranded, setIncludeBranded] = useState(false);
  const [brandUploading, setBrandUploading] = useState<'logo' | 'mascot' | null>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const mascotInputRef = useRef<HTMLInputElement>(null);
  const [videoSubmitting, setVideoSubmitting] = useState<string | null>(null);
  const [briefGenerating, setBriefGenerating] = useState<string | null>(null);
  const [videoTasks, setVideoTasks] = useState<Record<string, VideoTask>>({});
  const [, setVideoProgressTick] = useState(0);
  const [videoProvider, setVideoProvider] = useState<VideoProviderId>('grok');
  const [videoModel, setVideoModel] = useState(VIDEO_MODELS.grok[0]);
  const [videoDuration, setVideoDuration] = useState<number>(15);
  const [videoUseCutout, setVideoUseCutout] = useState(true);
  const [videoPlans, setVideoPlans] = useState<Record<string, VideoPlanResult>>({});
  const [planLoading, setPlanLoading] = useState<string | null>(null);
  const [videoBriefs, setVideoBriefs] = useState<Record<string, string>>({});
  const [openBriefSkus, setOpenBriefSkus] = useState<Set<string>>(new Set());

  const toggleBriefPanel = useCallback((sku: string) => {
    setOpenBriefSkus((prev) => {
      const next = new Set(prev);
      next.has(sku) ? next.delete(sku) : next.add(sku);
      return next;
    });
  }, []);

  const [files, setFiles] = useState<MediaFile[]>([]);
  const [filesLoading, setFilesLoading] = useState(false);
  const [uploadingFile, setUploadingFile] = useState<string | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
  const [deletingFile, setDeletingFile] = useState<string | null>(null);
  const [syncRunning, setSyncRunning] = useState(false);

  const [driveSettings, setDriveSettings] = useState<DriveSettings | null>(null);
  const [videoSettings, setVideoSettings] = useState<VideoSettings | null>(null);
  const [n8nSettings, setN8nSettings] = useState<N8nSettings | null>(null);
  const [driveFolderId, setDriveFolderId] = useState('');
  const [driveServiceAccount, setDriveServiceAccount] = useState('');
  const [geminiKey, setGeminiKey] = useState('');
  const [klingKey, setKlingKey] = useState('');
  const [grokKey, setGrokKey] = useState('');
  const [n8nWebhookUrl, setN8nWebhookUrl] = useState('');
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [settingsMsg, setSettingsMsg] = useState<string | null>(null);

  useEffect(() => {
    listBrandAssets()
      .then((assets) => setBrandAssets(Array.isArray(assets) ? assets : []))
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setProductsLoading(true);
      listMediaProducts(100, 0, { q: productSearch, filter: productFilter })
        .then(setProducts)
        .catch(() => setProducts([]))
        .finally(() => setProductsLoading(false));
    }, 250);
    return () => window.clearTimeout(timer);
  }, [productSearch, productFilter]);

  // Pre-select all brand assets on load so the Branded checkbox works after refresh.
  useEffect(() => {
    if (brandAssets.length === 0) return;
    setSelectedBrandAssets((prev) => {
      if (prev.size > 0) return prev;
      return new Set(brandAssets.filter((a) => a?.filename).map((a) => a.filename));
    });
  }, [brandAssets]);

  useEffect(() => {
    if (tab === 'files') {
      setFilesLoading(true);
      listMediaFiles()
        .then(setFiles)
        .catch(() => undefined)
        .finally(() => setFilesLoading(false));
    }
    if (tab === 'settings') {
      getDriveSettings().then(setDriveSettings).catch(() => undefined);
      getVideoSettings().then(setVideoSettings).catch(() => undefined);
      getN8nSettings().then(setN8nSettings).catch(() => undefined);
    }
  }, [tab]);

  useEffect(() => {
    if (!videoSettings) return;
    const provider = videoSettings.video_provider_default || 'gemini';
    setVideoProvider(provider);
    setVideoModel(videoSettings.video_model_default || VIDEO_MODELS[provider]?.[0] || VIDEO_MODELS.gemini[0]);
  }, [videoSettings]);

  useEffect(() => {
    const activeTasks = Object.entries(videoTasks).filter(([, task]) => task.status === 'queued' || task.status === 'processing');
    if (activeTasks.length === 0) return;

    const timer = window.setTimeout(() => {
      activeTasks.forEach(([sku, task]) => {
        pollVideoTask(task)
          .then((next) => setVideoTasks((prev) => ({ ...prev, [sku]: next })))
          .catch((err: unknown) => {
            const message = err instanceof Error ? err.message : 'Poll video failed';
            setVideoTasks((prev) => ({
              ...prev,
              [sku]: { ...task, status: 'failed', error: message },
            }));
          });
      });
    }, Math.max(5, activeTasks[0]?.[1].pollAfterSeconds ?? 12) * 1000);

    return () => window.clearTimeout(timer);
  }, [videoTasks]);

  useEffect(() => {
    const hasActiveVideo = Object.values(videoTasks).some((task) => task.status === 'queued' || task.status === 'processing');
    if (!hasActiveVideo) return;
    const timer = window.setInterval(() => setVideoProgressTick((value) => value + 1), 1000);
    return () => window.clearInterval(timer);
  }, [videoTasks]);

  const handleGeneratePopStickers = async (sku: string) => {
    setGenerating(sku);
    setExpandedSku(sku);
    try {
      const res = await generatePopStickers(sku, {
        includeBranded,
        brandAssetFilenames: Array.from(selectedBrandAssets),
        brandedCount: 2,
      });
      setPopResults((prev) => ({ ...prev, [sku]: res }));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'สร้าง POP Sticker ไม่สำเร็จ';
      showError('สร้าง POP ไม่สำเร็จ', `${sku}: ${msg}`);
    } finally {
      setGenerating(null);
    }
  };

  const handleBrandAssetUpload = async (kind: 'logo' | 'mascot', file: File | null) => {
    if (!file) return;
    setBrandUploading(kind);
    const knownBefore = new Set(brandAssets.map((a) => a.filename));
    try {
      const dataUrl = await prepareBrandAssetDataUrl(file);
      let saved: BrandAsset | null = null;
      try {
        saved = await uploadBrandAsset(kind, dataUrl);
      } catch {
        // Server may still have saved the file — recover via list below.
      }

      const latest = await listBrandAssets().catch(() => null);
      const assets = Array.isArray(latest) ? latest : brandAssets;
      setBrandAssets(assets);

      const uploaded =
        saved?.filename && saved.url
          ? saved
          : assets.find((asset) => asset.kind === kind && !knownBefore.has(asset.filename));

      if (!uploaded?.filename || !uploaded.url) {
        throw new Error('อัปโหลดไม่สำเร็จ — ลองใช้รูป PNG/JPG ที่เล็กลง (แนะนำต่ำกว่า 5MB)');
      }

      setSelectedBrandAssets((prev) => new Set(prev).add(uploaded.filename));
      setIncludeBranded(true);
    } catch (err: unknown) {
      showError('อัปโหลดไม่สำเร็จ', err instanceof Error ? err.message : 'อัปโหลด Brand Asset ไม่สำเร็จ');
    } finally {
      setBrandUploading(null);
    }
  };

  const toggleBrandAsset = (filename: string) => {
    setSelectedBrandAssets((prev) => {
      const next = new Set(prev);
      next.has(filename) ? next.delete(filename) : next.add(filename);
      return next;
    });
  };

  const selectedMascotFilenames = () =>
    Array.from(selectedBrandAssets).filter((filename) => {
      const asset = brandAssets.find((a) => a.filename === filename);
      return asset?.kind === 'mascot';
    });

  const buildVideoOptions = (sku: string): VideoSubmitOptions => ({
    provider: videoProvider,
    model: videoModel,
    duration: videoDuration,
    aspectRatio: '9:16',
    resolution: '720p',
    locale: 'en',
    visualBrief: videoBriefs[sku]?.trim() || undefined,
    useCutoutProductImage: videoUseCutout,
    mascotAssetFilenames: selectedMascotFilenames(),
  });

  const handleVideoPlan = async (sku: string) => {
    setPlanLoading(sku);
    try {
      const plan = await getVideoPlan(sku, buildVideoOptions(sku));
      setVideoPlans((prev) => ({ ...prev, [sku]: plan }));
      setOpenBriefSkus((prev) => new Set(prev).add(sku));
    } catch (err: unknown) {
      showError('สร้างแผน Video ไม่สำเร็จ', err instanceof Error ? err.message : undefined);
    } finally {
      setPlanLoading(null);
    }
  };

  const handleVideoSubmit = async (sku: string) => {
    setVideoSubmitting(sku);
    try {
      const options = buildVideoOptions(sku);
      const res = await submitProductVideo(sku, options);
      if ('error' in res && res.error) {
        showError('ส่งคำขอ Video ไม่สำเร็จ', (res as { error: true; message: string }).message);
        return;
      }
      if ('taskId' in res) {
        setVideoTasks((prev) => ({
          ...prev,
          [sku]: {
            ...res,
            metadata: {
              ...res.metadata,
              clientStartedAt: Date.now(),
            },
          },
        }));
      }
    } catch (err: unknown) {
      showError(
        'ส่งคำขอ Video ล้มเหลว',
        err instanceof Error ? err.message : 'ตรวจสอบ API Key ในหน้าตั้งค่า',
      );
    } finally {
      setVideoSubmitting(null);
    }
  };

  const handleDraftVideoBrief = async (product: ErpProduct) => {
    setBriefGenerating(product.sku);
    try {
      const current = videoBriefs[product.sku]?.trim();
      const res = await generateContent({
        type: 'tiktok_script',
        productName: product.name,
        price: Number(product.retailPrice) || undefined,
        tone: 'friendly',
        details: [
          'Product explainer video brief in English for international customers.',
          '15-second vertical 9:16 clip with English voiceover explaining product benefits.',
          'Use die-cut product hero. Brand mascot presents the product if mascot assets are selected.',
          'Explain what the product is and what it helps with.',
          `Mascot selected: ${selectedMascotFilenames().length > 0 ? 'yes' : 'no'}`,
          `Provider: ${videoProvider}, Model: ${videoModel}`,
          current ? `Existing brief: ${current}` : '',
        ].filter(Boolean).join('\n'),
      }, 'en');
      setVideoBriefs((prev) => ({ ...prev, [product.sku]: res.content }));
    } catch (err: unknown) {
      showError('AI ช่วยร่าง brief ไม่สำเร็จ', err instanceof Error ? err.message : undefined);
    } finally {
      setBriefGenerating(null);
    }
  };

  const handleSyncDrive = async () => {
    setSyncRunning(true);
    try {
      const res = await syncToDrive();
      if ('error' in (res as object)) {
        showError('Sync ไม่สำเร็จ', (res as unknown as { message: string }).message);
        return;
      }
      showInfo(
        'Sync สำเร็จ',
        `อัปโหลดสำเร็จ ${res.uploaded.length} ไฟล์${res.failed.length ? `, ล้มเหลว ${res.failed.length} ไฟล์` : ''}`,
      );
      setFilesLoading(true);
      listMediaFiles().then(setFiles).finally(() => setFilesLoading(false));
    } catch {
      showError('Sync ล้มเหลว', 'ตรวจสอบการตั้งค่า Google Drive');
    } finally {
      setSyncRunning(false);
    }
  };

  const toggleFileSelected = (filename: string) => {
    setSelectedFiles((prev) => {
      const next = new Set(prev);
      next.has(filename) ? next.delete(filename) : next.add(filename);
      return next;
    });
  };

  const handleSyncSelected = async () => {
    const filenames = Array.from(selectedFiles);
    if (filenames.length === 0) return;
    setSyncRunning(true);
    try {
      const uploaded: string[] = [];
      const failed: string[] = [];
      for (const filename of filenames) {
        try {
          await uploadFileToDrive(filename);
          uploaded.push(filename);
        } catch {
          failed.push(filename);
        }
      }
      showInfo(
        'อัปโหลดไฟล์ที่เลือก',
        `สำเร็จ ${uploaded.length} ไฟล์${failed.length ? `, ล้มเหลว ${failed.length} ไฟล์` : ''}`,
      );
    } finally {
      setSyncRunning(false);
    }
  };

  const handleUploadOne = async (filename: string) => {
    setUploadingFile(filename);
    try {
      const res = await uploadFileToDrive(filename);
      showSuccess('อัปโหลดสำเร็จ', `ดูไฟล์ได้ที่ Google Drive\n${res.webViewLink}`);
    } catch {
      showError('Upload ล้มเหลว', 'ตรวจสอบการตั้งค่า Google Drive');
    } finally {
      setUploadingFile(null);
    }
  };

  const handleDeleteOne = async (filename: string) => {
    const confirmed = await confirmDelete('ลบไฟล์นี้หรือไม่?', filename);
    if (!confirmed) return;
    setDeletingFile(filename);
    try {
      await deleteMediaFile(filename);
      setFiles((prev) => prev.filter((file) => file.filename !== filename));
      setSelectedFiles((prev) => {
        const next = new Set(prev);
        next.delete(filename);
        return next;
      });
      showSuccess('ลบไฟล์แล้ว');
    } catch (err: unknown) {
      showError('ลบไฟล์ไม่สำเร็จ', err instanceof Error ? err.message : undefined);
    } finally {
      setDeletingFile(null);
    }
  };

  const handleDeleteSelected = async () => {
    const filenames = Array.from(selectedFiles);
    if (filenames.length === 0) return;
    const confirmed = await confirmDelete(
      `ลบไฟล์ที่เลือก ${filenames.length} ไฟล์หรือไม่?`,
      'การลบไม่สามารถย้อนกลับได้',
    );
    if (!confirmed) return;
    setDeletingFile('__selected__');
    try {
      const deleted = new Set<string>();
      for (const filename of filenames) {
        try {
          await deleteMediaFile(filename);
          deleted.add(filename);
        } catch {
          // Keep failed deletes in the list so the user can retry.
        }
      }
      setFiles((prev) => prev.filter((file) => !deleted.has(file.filename)));
      setSelectedFiles((prev) => {
        const next = new Set(prev);
        deleted.forEach((filename) => next.delete(filename));
        return next;
      });
      if (deleted.size === filenames.length) {
        showSuccess(`ลบแล้ว ${deleted.size} ไฟล์`);
      } else {
        showInfo('ลบบางส่วนสำเร็จ', `ลบแล้ว ${deleted.size}/${filenames.length} ไฟล์`);
      }
    } finally {
      setDeletingFile(null);
    }
  };

  const handleSaveSettings = async () => {
    setSettingsSaving(true);
    setSettingsMsg(null);
    try {
      if (driveFolderId.trim() || driveServiceAccount.trim()) {
        await saveDriveSettings({
          google_drive_folder_id: driveFolderId.trim() || undefined,
          google_service_account_json: driveServiceAccount.trim() || undefined,
        });
      }
      await saveVideoSettings({
        video_provider_default: videoProvider,
        video_model_default: videoModel,
        gemini_api_key: geminiKey.trim() || undefined,
        kling_api_key: klingKey.trim() || undefined,
        grok_api_key: grokKey.trim() || undefined,
      });
      if (n8nWebhookUrl.trim()) {
        await saveN8nSettings({ n8n_promo_webhook_url: n8nWebhookUrl.trim() });
      }
      setSettingsMsg('บันทึกสำเร็จ');
      setDriveFolderId('');
      setDriveServiceAccount('');
      setGeminiKey('');
      setKlingKey('');
      setGrokKey('');
      setN8nWebhookUrl('');
      const [ds, vs, n8n] = await Promise.all([getDriveSettings(), getVideoSettings(), getN8nSettings()]);
      setDriveSettings(ds);
      setVideoSettings(vs);
      setN8nSettings(n8n);
    } catch {
      setSettingsMsg('บันทึกไม่สำเร็จ');
    } finally {
      setSettingsSaving(false);
    }
  };

  const TABS: { id: Tab; label: string; icon: typeof Image }[] = [
    { id: 'products',  label: 'POP Sticker AI', icon: Sparkles },
    { id: 'promotion', label: 'Promotion Poster', icon: Film },
    { id: 'files',     label: 'ไฟล์ที่สร้าง', icon: Image },
    { id: 'settings',  label: 'ตั้งค่า', icon: CheckCircle2 },
  ];

  const productEmptyMessage = productSearch.trim()
    ? 'ไม่พบสินค้าที่ค้นหา — ลองเปลี่ยนคำค้นหรือเลือกตัวกรอง “ทั้งหมด”'
    : productFilter === 'new_today'
      ? 'ยังไม่มีสินค้าเข้าใหม่วันนี้'
      : productFilter === 'new'
        ? 'ยังไม่มีสินค้าใหม่ใน 7 วันล่าสุด'
        : productFilter === 'promo'
          ? 'ยังไม่มีสินค้าที่มีโปรโมชั่น'
          : productFilter === 'ready'
            ? 'ยังไม่มีสินค้าที่พร้อมทำสื่อ — ลองเลือก “ทั้งหมด”'
            : 'ไม่มีสินค้าในเงื่อนไขนี้';

  const videoProgress = (task: VideoTask) => {
    if (task.status === 'done') return 100;
    if (task.status === 'failed') return 100;
    const started = typeof task.metadata?.clientStartedAt === 'number' ? task.metadata.clientStartedAt : Date.now();
    const elapsedSeconds = Math.max(0, (Date.now() - started) / 1000);
    const expectedSeconds = task.provider === 'grok' ? 360 : task.provider === 'gemini' ? 180 : 240;
    const base = task.status === 'processing' ? 25 : 8;
    return Math.min(92, Math.round(base + (elapsedSeconds / expectedSeconds) * 70));
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold tracking-tight">Product Media AI</h1>

        {/* Tabs */}
        <div className="flex gap-1 rounded-lg border bg-muted/30 p-1">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors sm:text-sm sm:px-3 ${
                tab === id ? 'bg-background shadow text-foreground' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Icon className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              <span className="hidden xs:inline sm:inline">{label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* POP Sticker AI Tab */}
      {tab === 'products' && (
        <div className="space-y-3">

          {/* ─── Compact toolbar ─── */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border bg-muted/30 px-4 py-3">
            {/* Video provider */}
            <div className="flex items-center gap-2">
              <Video className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <span className="text-[11px] font-medium text-violet-700 whitespace-nowrap px-1.5 py-0.5 rounded bg-violet-100">
                Explainer EN
              </span>
              <NativeSelect
                value={videoProvider}
                className="h-8 text-xs w-[120px]"
                onChange={(e) => {
                  const next = e.target.value as VideoProviderId;
                  setVideoProvider(next);
                  setVideoModel(VIDEO_MODELS[next][0]);
                }}
              >
                <option value="gemini">Gemini / Veo</option>
                <option value="kling">Kling AI</option>
                <option value="grok">Grok Imagine</option>
              </NativeSelect>
              <NativeSelect
                value={videoModel}
                className="h-8 text-xs w-[180px]"
                onChange={(e) => setVideoModel(e.target.value)}
              >
                {(VIDEO_MODELS[videoProvider] ?? []).map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </NativeSelect>
              <NativeSelect
                value={String(videoDuration)}
                className="h-8 text-xs w-[72px]"
                onChange={(e) => setVideoDuration(Number(e.target.value))}
                title="ความยาวคลิป (วินาที)"
              >
                {VIDEO_DURATION_OPTIONS.map((d) => (
                  <option key={d} value={d}>{d}s</option>
                ))}
              </NativeSelect>
              <span className="text-[11px] text-muted-foreground whitespace-nowrap">9:16</span>
              <label className="flex items-center gap-1.5 text-xs text-muted-foreground whitespace-nowrap">
                <input
                  type="checkbox"
                  checked={videoUseCutout}
                  onChange={(e) => setVideoUseCutout(e.target.checked)}
                  className="rounded"
                />
                Cutout
              </label>
            </div>

            <div className="hidden lg:flex items-center gap-1.5 text-[10px] text-muted-foreground">
              <span className="rounded bg-muted px-1.5 py-0.5">1 Die-cut</span>
              <span>→</span>
              <span className="rounded bg-muted px-1.5 py-0.5">2 AI Benefits</span>
              <span>→</span>
              <span className="rounded bg-muted px-1.5 py-0.5">3 Script EN</span>
              <span>→</span>
              <span className="rounded bg-muted px-1.5 py-0.5">4 Video</span>
            </div>

            <div className="h-5 w-px bg-border hidden sm:block" />

            {/* Brand assets for POP */}
            <div className="flex flex-wrap items-center gap-2">
              <input
                ref={logoInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
                onChange={(e) => { void handleBrandAssetUpload('logo', e.target.files?.[0] ?? null); e.target.value = ''; }}
              />
              <input
                ref={mascotInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
                onChange={(e) => { void handleBrandAssetUpload('mascot', e.target.files?.[0] ?? null); e.target.value = ''; }}
              />
              <Button size="sm" variant="outline" className="h-8 text-xs gap-1.5" disabled={brandUploading === 'logo'} onClick={() => logoInputRef.current?.click()}>
                {brandUploading === 'logo' ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />}
                Logo
              </Button>
              <Button size="sm" variant="outline" className="h-8 text-xs gap-1.5" disabled={brandUploading === 'mascot'} onClick={() => mascotInputRef.current?.click()}>
                {brandUploading === 'mascot' ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />}
                Mascot
              </Button>
              <span className="text-[10px] text-muted-foreground hidden sm:inline">เลือก Mascot = ใช้ใน Video</span>

              {/* Asset thumbnails */}
              {brandAssets.filter((a) => a?.filename && a?.url).map((asset) => {
                const selected = selectedBrandAssets.has(asset.filename);
                return (
                  <button
                    key={asset.filename}
                    type="button"
                    title={`${selected ? 'ยกเลิก' : 'เลือก'} ${asset.kind}`}
                    onClick={() => toggleBrandAsset(asset.filename)}
                    className={`relative h-8 w-8 rounded-full border-2 overflow-hidden transition-all ${selected ? 'border-violet-500 ring-2 ring-violet-200' : 'border-border opacity-50 hover:opacity-80'}`}
                  >
                    <img src={resolveMediaUrl(asset.url)} alt={asset.kind} className="h-full w-full object-cover bg-white" />
                    {selected && (
                      <div className="absolute inset-0 bg-violet-500/20 flex items-center justify-center">
                        <CheckCircle2 className="h-3 w-3 text-violet-700" />
                      </div>
                    )}
                  </button>
                );
              })}

              <label className="flex items-center gap-1.5 text-xs text-muted-foreground whitespace-nowrap">
                <input
                  type="checkbox"
                  checked={includeBranded}
                  disabled={brandAssets.length === 0}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    if (checked && selectedBrandAssets.size === 0 && brandAssets.length > 0) {
                      setSelectedBrandAssets(new Set(brandAssets.filter((a) => a?.filename).map((a) => a.filename)));
                    }
                    setIncludeBranded(checked);
                  }}
                  className="rounded"
                />
                Branded +2
              </label>
            </div>

            <div className="h-5 w-px bg-border hidden lg:block" />

            <div className="flex min-w-0 flex-1 flex-col gap-2 lg:flex-row lg:items-center lg:justify-end">
              <NativeSelect
                value={productFilter}
                className="h-8 text-xs lg:w-[150px]"
                onChange={(e) => setProductFilter(e.target.value as MediaProductFilter)}
              >
                <option value="new_today">เข้าใหม่วันนี้</option>
                <option value="new">สินค้าใหม่ 7 วัน</option>
                <option value="ready">พร้อมทำสื่อ</option>
                <option value="promo">มีโปรโมชั่น</option>
                <option value="all">ทั้งหมด</option>
              </NativeSelect>
              <div className="relative lg:w-[260px]">
                <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  value={productSearch}
                  onChange={(e) => setProductSearch(e.target.value)}
                  placeholder="ค้นหา SKU / ชื่อสินค้า"
                  className="h-8 pl-8 text-xs"
                />
              </div>
              <span className="whitespace-nowrap text-xs text-muted-foreground">{products.length} สินค้า</span>
            </div>
          </div>

          {/* ─── Product list ─── */}
          {productsLoading ? (
            <div className="flex items-center justify-center gap-2 text-muted-foreground py-16">
              <Loader2 className="h-5 w-5 animate-spin" /> โหลดสินค้า ERP...
            </div>
          ) : products.length === 0 ? (
            <div className="flex items-center justify-center py-16">
              <p className="text-sm text-muted-foreground">{productEmptyMessage}</p>
            </div>
          ) : (
            <div className="rounded-xl border divide-y overflow-hidden">
              {products.map((p) => {
                const popResult = popResults[p.sku];
                const isGenerating = generating === p.sku;
                const isExpanded = expandedSku === p.sku;
                const isVideoSubmitting = videoSubmitting === p.sku;
                const videoTask = videoTasks[p.sku];
                const videoPlayableUrl = videoTask?.localPath ?? videoTask?.videoUrl ?? null;
                const videoPlan = videoPlans[p.sku];
                const briefOpen = openBriefSkus.has(p.sku);
                const hasBrief = !!videoBriefs[p.sku]?.trim();

                return (
                  <div key={p.sku} className={`bg-background transition-colors ${isExpanded ? 'bg-violet-50/30' : ''}`}>
                    {/* ── Main row ── */}
                    <div className="flex items-center gap-3 px-4 py-3">
                      {/* Thumbnail */}
                      <div className="h-12 w-12 rounded-lg overflow-hidden bg-muted/50 shrink-0">
                        {p.imageUrl ? (
                          <img src={p.imageUrl} alt={p.name} className="h-full w-full object-cover" />
                        ) : (
                          <div className="flex h-full items-center justify-center">
                            <Image className="h-5 w-5 text-muted-foreground/40" />
                          </div>
                        )}
                      </div>

                      {/* Name + meta */}
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm leading-tight truncate">{p.name}</p>
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-0.5">
                          <span className="text-xs text-muted-foreground">฿{p.retailPrice}</span>
                          {p.activePromotionCount ? (
                            <span className="text-xs text-amber-600">{p.activePromotionCount} โปร</span>
                          ) : null}
                          {typeof p.effectiveGpPct === 'number' && p.effectiveGpPct > 0 ? (
                            <span className="text-xs text-muted-foreground">GP {p.effectiveGpPct.toFixed(1)}%</span>
                          ) : null}
                          {popResult && (
                            <span className="text-xs text-violet-600">
                              ✓ {popResult.variations.filter((v) => v.imageUrl).length}/{popResult.variations.length} POP
                            </span>
                          )}
                          {videoTask?.status === 'done' && (
                            <span className="text-xs text-green-600">✓ Video</span>
                          )}
                          {(videoTask?.status === 'queued' || videoTask?.status === 'processing') && (
                            <span className="text-xs text-blue-600 flex items-center gap-1">
                              <Loader2 className="h-2.5 w-2.5 animate-spin" />Video...
                            </span>
                          )}
                          {videoTask?.status === 'failed' && (
                            <span className="text-xs text-red-500">✗ Video ล้มเหลว</span>
                          )}
                        </div>
                      </div>

                      {/* Action buttons */}
                      <div className="flex items-center gap-1.5 shrink-0">
                        {/* Brief toggle */}
                        <Button
                          size="sm"
                          variant={briefOpen || hasBrief ? 'secondary' : 'ghost'}
                          className="h-8 w-8 p-0"
                          title="Video Brief"
                          onClick={() => toggleBriefPanel(p.sku)}
                        >
                          <Pencil className={`h-3.5 w-3.5 ${hasBrief ? 'text-violet-600' : ''}`} />
                        </Button>

                        {/* POP */}
                        <Button
                          size="sm"
                          variant={popResult ? 'outline' : 'default'}
                          className="h-8 gap-1 text-xs px-3"
                          disabled={isGenerating || !!generating}
                          onClick={() => void handleGeneratePopStickers(p.sku)}
                        >
                          {isGenerating ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                          <span className="hidden sm:inline">{isGenerating ? 'สร้าง...' : popResult ? 'Regen' : 'POP'}</span>
                        </Button>

                        {/* Video */}
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 gap-1 text-xs px-3"
                          disabled={isVideoSubmitting || videoTask?.status === 'queued' || videoTask?.status === 'processing'}
                          onClick={() => void handleVideoSubmit(p.sku)}
                        >
                          {isVideoSubmitting || videoTask?.status === 'queued' || videoTask?.status === 'processing'
                            ? <Loader2 className="h-3 w-3 animate-spin" />
                            : videoTask?.status === 'done'
                              ? <CheckCircle2 className="h-3 w-3 text-green-500" />
                              : <Video className="h-3 w-3" />}
                          <span className="hidden sm:inline">Video</span>
                        </Button>

                        {/* Expand results */}
                        {popResult && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 w-8 p-0"
                            onClick={() => setExpandedSku(isExpanded ? null : p.sku)}
                          >
                            {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                          </Button>
                        )}
                      </div>
                    </div>

                    {/* ── Generating progress ── */}
                    {isGenerating && (
                      <div className="mx-4 mb-3 rounded-lg bg-violet-50 border border-violet-100 px-3 py-2 text-xs text-violet-700 flex items-center gap-2">
                        <Loader2 className="h-3.5 w-3.5 animate-spin shrink-0" />
                        <span>กำลังสร้าง POP Sticker AI... (~1–2 นาที)</span>
                      </div>
                    )}

                    {/* ── Video brief panel (collapsible) ── */}
                    {briefOpen && (
                      <div className="mx-4 mb-3 rounded-lg border bg-muted/20 px-3 py-2.5 space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-medium text-muted-foreground">Product Explainer (EN)</span>
                          <div className="flex items-center gap-1.5">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="h-7 text-[11px] gap-1"
                              disabled={planLoading === p.sku}
                              onClick={() => void handleVideoPlan(p.sku)}
                            >
                              {planLoading === p.sku ? <Loader2 className="h-3 w-3 animate-spin" /> : <Eye className="h-3 w-3" />}
                              ดูแผน AI
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="h-7 text-[11px] gap-1"
                              disabled={briefGenerating === p.sku}
                              onClick={() => void handleDraftVideoBrief(p)}
                            >
                              {briefGenerating === p.sku ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                              AI Brief
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0"
                              onClick={() => toggleBriefPanel(p.sku)}
                            >
                              <X className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>
                        <textarea
                          className="min-h-[72px] w-full rounded-md border bg-background px-3 py-2 text-xs resize-none focus:outline-none focus:ring-1 focus:ring-ring"
                          placeholder="Optional visual brief — AI auto-generates die-cut, English benefits & script"
                          value={videoBriefs[p.sku] ?? ''}
                          onChange={(e) => setVideoBriefs((prev) => ({ ...prev, [p.sku]: e.target.value }))}
                        />
                        {videoPlan && (
                          <div className="rounded-md border bg-background px-3 py-2 text-[11px] space-y-2">
                            <p className="font-medium text-violet-700">
                              แผน AI ({videoPlan.locale.toUpperCase()}{videoPlan.hasMascot ? ' · Mascot' : ''})
                            </p>
                            <div className="flex flex-wrap gap-1">
                              {videoPlan.steps.map((step) => (
                                <span
                                  key={step.step}
                                  className={`rounded px-1.5 py-0.5 ${
                                    step.status === 'done' ? 'bg-green-100 text-green-800'
                                      : step.status === 'failed' ? 'bg-red-100 text-red-700'
                                        : 'bg-muted text-muted-foreground'
                                  }`}
                                >
                                  {step.step}: {step.status}
                                </span>
                              ))}
                            </div>
                            {videoPlan.cutoutUrl && (
                              <div className="flex items-center gap-2">
                                <img
                                  src={resolveMediaUrl(videoPlan.cutoutUrl)}
                                  alt="cutout"
                                  className="h-16 w-16 object-contain rounded border bg-white"
                                />
                                <span className="text-muted-foreground">Die-cut product</span>
                              </div>
                            )}
                            <div>
                              <p className="font-medium">Benefits</p>
                              <ul className="list-disc pl-4 text-muted-foreground">
                                {videoPlan.benefits.map((b) => <li key={b}>{b}</li>)}
                              </ul>
                            </div>
                            <div>
                              <p className="font-medium">Script (EN voiceover)</p>
                              <p className="text-muted-foreground whitespace-pre-wrap">{videoPlan.script}</p>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* ── Video status ── */}
                    {videoTask && (
                      <div className={`mx-4 mb-3 rounded-lg px-3 py-2 text-xs border ${
                        videoTask.status === 'failed'
                          ? 'bg-red-50 border-red-200 text-red-700'
                          : videoTask.status === 'done'
                            ? 'bg-green-50 border-green-200 text-green-700'
                            : 'bg-blue-50 border-blue-200 text-blue-700'
                      }`}>
                        <div className="flex items-center justify-between gap-3">
                          <span className="font-medium">
                            Video {videoTask.status === 'queued' ? 'กำลังเข้าคิว' : videoTask.status === 'processing' ? 'กำลังประมวลผล' : videoTask.status === 'done' ? 'เสร็จแล้ว' : 'ล้มเหลว'}
                          </span>
                          <span className="tabular-nums">{videoProgress(videoTask)}%</span>
                        </div>
                        {(videoTask.status === 'queued' || videoTask.status === 'processing') && (
                          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-blue-100">
                            <div
                              className="h-full rounded-full bg-blue-500 transition-all duration-700"
                              style={{ width: `${videoProgress(videoTask)}%` }}
                            />
                          </div>
                        )}
                        {videoTask.error && <p className="mt-1 text-red-600">{videoTask.error}</p>}
                        {typeof videoTask.metadata?.promptSent === 'string' && (
                          <details className="mt-2">
                            <summary className="cursor-pointer text-[11px] underline opacity-80">
                              ดู Prompt ที่ส่งไป API ({String(videoTask.metadata?.mode ?? videoTask.provider)})
                            </summary>
                            <pre className="mt-1 max-h-48 overflow-auto whitespace-pre-wrap rounded bg-black/5 p-2 text-[10px] text-foreground">
                              {videoTask.metadata.promptSent}
                            </pre>
                            {typeof videoTask.metadata?.script === 'string' && (
                              <p className="mt-1 text-[10px] opacity-80">
                                Script: {videoTask.metadata.script}
                              </p>
                            )}
                            {Array.isArray(videoTask.metadata?.benefits) && (
                              <ul className="mt-1 list-disc pl-4 text-[10px] opacity-80">
                                {(videoTask.metadata.benefits as string[]).map((b) => <li key={b}>{b}</li>)}
                              </ul>
                            )}
                          </details>
                        )}
                        {videoPlayableUrl && videoTask.status === 'done' && (
                          <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-start">
                            <video
                              key={videoPlayableUrl}
                              controls
                              preload="metadata"
                              playsInline
                              className="w-full max-w-[220px] rounded-lg border bg-black aspect-[9/16] object-contain"
                              src={resolveMediaUrl(videoPlayableUrl)}
                            />
                            <a
                              className="inline-flex text-xs underline self-start sm:mt-2"
                              href={resolveMediaUrl(videoPlayableUrl)}
                              target="_blank"
                              rel="noreferrer"
                            >
                              เปิดในแท็บใหม่
                            </a>
                          </div>
                        )}
                      </div>
                    )}

                    {/* ── POP results gallery ── */}
                    {isExpanded && popResult && (
                      <div className="mx-4 mb-4 space-y-3">
                        <div className="rounded-lg bg-muted/40 px-3 py-2 text-xs space-y-1">
                          <p className="font-semibold">{popResult.copy.headline}</p>
                          <p className="text-muted-foreground">{popResult.copy.subheadline}</p>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {popResult.copy.benefits.map((b) => (
                              <Badge key={b} variant="secondary" className="text-[10px]">✓ {b}</Badge>
                            ))}
                            {popResult.copy.badges.map((b) => (
                              <Badge key={b} variant="outline" className="text-[10px]">{b}</Badge>
                            ))}
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                          {popResult.variations.map((v) => (
                            <div key={v.styleId} className="space-y-1">
                              <div className="aspect-square rounded-lg overflow-hidden bg-muted/50 relative group">
                                {v.imageUrl ? (
                                  <>
                                    <img
                                      src={resolveMediaUrl(v.imageUrl)}
                                      alt={v.styleName}
                                      className="h-full w-full object-cover"
                                    />
                                    {v.branded && (
                                      <Badge className="absolute left-2 top-2 bg-violet-600 text-[10px] hover:bg-violet-600">
                                        Branded
                                      </Badge>
                                    )}
                                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                      <a
                                        href={resolveMediaUrl(v.imageUrl)}
                                        download={v.filename}
                                        className="bg-white text-black rounded-full p-2"
                                        onClick={(e) => e.stopPropagation()}
                                      >
                                        <Download className="h-4 w-4" />
                                      </a>
                                    </div>
                                  </>
                                ) : (
                                  <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
                                    สร้างไม่สำเร็จ
                                  </div>
                                )}
                              </div>
                              <p className="text-[10px] font-medium text-center truncate px-1">{v.styleName}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Promotion Tab */}
      {tab === 'promotion' && (
        <PromoTab products={products} />
      )}

      {/* Files Tab */}
      {tab === 'files' && (
        <div className="space-y-4">
          <Card>
            <CardContent className="pt-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold">Generated Media Library</p>
                  <p className="text-xs text-muted-foreground">
                    ดูตัวอย่าง เลือกหลายไฟล์ อัปโหลดขึ้น Drive หรือลบไฟล์ที่ไม่ใช้
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" onClick={() => {
                    setFilesLoading(true);
                    listMediaFiles().then((items) => {
                      setFiles(items);
                      setSelectedFiles((prev) => new Set([...prev].filter((filename) => items.some((f) => f.filename === filename))));
                    }).finally(() => setFilesLoading(false));
                  }}>
                    <RefreshCw className="mr-2 h-4 w-4" /> รีเฟรช
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={files.length === 0}
                    onClick={() => {
                      setSelectedFiles((prev) => prev.size === files.length ? new Set() : new Set(files.map((file) => file.filename)));
                    }}
                  >
                    <CheckSquare className="mr-2 h-4 w-4" />
                    {selectedFiles.size === files.length && files.length > 0 ? 'ยกเลิกเลือกทั้งหมด' : 'เลือกทั้งหมด'}
                  </Button>
                  <Button
                    size="sm"
                    disabled={syncRunning || selectedFiles.size === 0}
                    onClick={() => void handleSyncSelected()}
                  >
                    {syncRunning
                      ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />กำลังส่ง...</>
                      : <><CloudUpload className="mr-2 h-4 w-4" />ส่งที่เลือก ({selectedFiles.size})</>}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={syncRunning || files.length === 0}
                    onClick={() => void handleSyncDrive()}
                  >
                    <CloudUpload className="mr-2 h-4 w-4" />Sync ทั้งหมด
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    disabled={selectedFiles.size === 0 || deletingFile === '__selected__'}
                    onClick={() => void handleDeleteSelected()}
                  >
                    {deletingFile === '__selected__' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
                    ลบที่เลือก
                  </Button>
                </div>
              </div>
              {selectedFiles.size > 0 && (
                <p className="text-xs text-muted-foreground">เลือกอยู่ {selectedFiles.size} ไฟล์</p>
              )}
            </CardContent>
          </Card>

          {filesLoading ? (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> โหลด...
            </div>
          ) : files.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              ยังไม่มีไฟล์ — ไปที่ &ldquo;สินค้า ERP&rdquo; เพื่อสร้างรูปหรือ Video
            </p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {files.map((file) => {
                const isImage = /\.(png|jpe?g|webp)$/i.test(file.filename);
                const isVideo = /\.mp4$/i.test(file.filename);
                const isUploading = uploadingFile === file.filename;
                const isDeleting = deletingFile === file.filename;
                const selected = selectedFiles.has(file.filename);
                const url = resolveMediaUrl(file.url);
                return (
                  <Card key={file.filename} className={`overflow-hidden transition-colors ${selected ? 'border-primary ring-1 ring-primary/30' : ''}`}>
                    <div className="relative aspect-square bg-muted/40">
                      <button
                        type="button"
                        className="absolute left-2 top-2 z-10 rounded-md bg-background/90 px-2 py-1 text-xs shadow-sm"
                        onClick={() => toggleFileSelected(file.filename)}
                      >
                        <input type="checkbox" readOnly checked={selected} className="mr-1 align-middle" />
                        เลือก
                      </button>
                      {isImage ? (
                        <img src={url} alt={file.filename} className="h-full w-full object-contain bg-white" />
                      ) : isVideo ? (
                        <video src={url} className="h-full w-full bg-black object-contain" controls preload="metadata" />
                      ) : (
                        <div className="flex h-full items-center justify-center">
                          <Film className="h-8 w-8 text-muted-foreground" />
                        </div>
                      )}
                      <Badge className="absolute bottom-2 left-2 text-[10px]" variant="secondary">
                        {isVideo ? 'Video' : 'Image'}
                      </Badge>
                    </div>
                    <CardContent className="space-y-3 p-3">
                      <div className="min-w-0">
                        <p className="truncate text-xs font-medium" title={file.filename}>{file.filename}</p>
                        <p className="text-[11px] text-muted-foreground">
                          {new Date(file.createdAt).toLocaleString('th-TH', { dateStyle: 'short', timeStyle: 'short' })}
                        </p>
                      </div>
                      <div className="grid grid-cols-4 gap-1">
                        <Button variant="outline" size="icon" className="h-8 w-full" asChild title="ดูตัวอย่าง">
                          <a href={url} target="_blank" rel="noreferrer">
                            <Eye className="h-4 w-4" />
                          </a>
                        </Button>
                        <Button variant="outline" size="icon" className="h-8 w-full" asChild title="ดาวน์โหลด">
                          <a href={url} download={file.filename}>
                            <Download className="h-4 w-4" />
                          </a>
                        </Button>
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-8 w-full"
                          title="อัปโหลดขึ้น Drive"
                          disabled={isUploading}
                          onClick={() => void handleUploadOne(file.filename)}
                        >
                          {isUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <CloudUpload className="h-4 w-4" />}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-full text-destructive hover:text-destructive"
                          title="ลบไฟล์"
                          disabled={isDeleting}
                          onClick={() => void handleDeleteOne(file.filename)}
                        >
                          {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Settings Tab */}
      {tab === 'settings' && (
        <div className="space-y-4 max-w-2xl">
          {/* Google Drive */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <CloudUpload className="h-4 w-4 text-primary" />
                Google Drive — Service Account
                {driveSettings?.drive_configured && (
                  <Badge variant="default" className="ml-auto text-xs">เชื่อมต่อแล้ว</Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {driveSettings?.drive_configured ? (
                <div className="rounded-md bg-muted/50 px-3 py-2 text-sm">
                  <p className="font-medium text-green-600">ตั้งค่าแล้ว</p>
                  <p className="text-muted-foreground text-xs mt-0.5">
                    Folder ID: {driveSettings.drive_folder_id_preview}
                  </p>
                </div>
              ) : (
                <div className="rounded-md bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-800 space-y-1">
                  <p className="font-semibold">วิธีตั้งค่า (ใช้เวลา ~10 นาที):</p>
                  <ol className="list-decimal ml-4 space-y-0.5">
                    <li>Google Cloud Console → IAM → Service Accounts → สร้างใหม่</li>
                    <li>Download JSON key</li>
                    <li>เปิด Google Drive → สร้าง Folder → Share ให้ service account email</li>
                    <li>คัดลอก Folder ID จาก URL (ส่วนหลัง /folders/)</li>
                  </ol>
                </div>
              )}
              <div className="space-y-1.5">
                <Label>Google Drive Folder ID</Label>
                <Input
                  placeholder="เช่น 1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms"
                  value={driveFolderId}
                  onChange={(e) => setDriveFolderId(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Service Account JSON (วางทั้งไฟล์)</Label>
                <textarea
                  className="flex min-h-[100px] w-full rounded-md border bg-background px-3 py-2 text-sm font-mono"
                  placeholder={'{\n  "type": "service_account",\n  "client_email": "...",\n  "private_key": "..."\n}'}
                  value={driveServiceAccount}
                  onChange={(e) => setDriveServiceAccount(e.target.value)}
                />
              </div>
            </CardContent>
          </Card>

          {/* Video AI */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Film className="h-4 w-4 text-primary" />
                Video AI — Multi Provider
                {videoSettings?.video_configured && (
                  <Badge variant="default" className="ml-auto text-xs">ตั้งค่าแล้ว</Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {videoSettings?.video_configured ? (
                <div className="rounded-md bg-muted/50 px-3 py-2 text-sm">
                  <p className="font-medium text-green-600">ตั้งค่าแล้ว</p>
                  <p className="text-muted-foreground text-xs mt-0.5">
                    Default: {videoSettings.video_provider_default} · {videoSettings.video_model_default}
                  </p>
                  <p className="text-muted-foreground text-xs mt-0.5">
                    Gemini: {videoSettings.gemini_key_preview ?? '-'} · Kling: {videoSettings.kling_key_preview ?? '-'} · Grok: {videoSettings.grok_key_preview ?? '-'}
                  </p>
                </div>
              ) : (
                <div className="rounded-md bg-blue-50 border border-blue-200 px-3 py-2 text-xs text-blue-800">
                  <p className="font-semibold">ตั้งค่า Video Provider:</p>
                  <p>แนะนำ Grok Imagine — รองรับ 9:16, 15 วินาที และเสียง voiceover ภาษาไทย</p>
                </div>
              )}
              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Default Provider</Label>
                  <NativeSelect
                    value={videoProvider}
                    onChange={(e) => {
                      const next = e.target.value as VideoProviderId;
                      setVideoProvider(next);
                      setVideoModel(VIDEO_MODELS[next][0]);
                    }}
                  >
                    <option value="gemini">Gemini / Veo</option>
                    <option value="kling">Kling AI</option>
                    <option value="grok">Grok Imagine</option>
                  </NativeSelect>
                </div>
                <div className="space-y-1.5">
                  <Label>Default Model</Label>
                  <NativeSelect value={videoModel} onChange={(e) => setVideoModel(e.target.value)}>
                    {(VIDEO_MODELS[videoProvider] ?? []).map((model) => (
                      <option key={model} value={model}>{model}</option>
                    ))}
                  </NativeSelect>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Gemini API Key</Label>
                <Input
                  type="password"
                  placeholder="AIza..."
                  value={geminiKey}
                  onChange={(e) => setGeminiKey(e.target.value)}
                  autoComplete="new-password"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Kling AI API Key</Label>
                <Input
                  type="password"
                  placeholder="kling-..."
                  value={klingKey}
                  onChange={(e) => setKlingKey(e.target.value)}
                  autoComplete="new-password"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Grok / xAI API Key</Label>
                <Input
                  type="password"
                  placeholder="xai-..."
                  value={grokKey}
                  onChange={(e) => setGrokKey(e.target.value)}
                  autoComplete="new-password"
                />
              </div>
            </CardContent>
          </Card>

          {/* n8n Composite */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <RefreshCw className="h-4 w-4 text-primary" />
                n8n — Cutout Webhook (ไดคัทสินค้า)
                {n8nSettings?.n8n_configured && (
                  <Badge variant="default" className="ml-auto text-xs">เชื่อมต่อแล้ว</Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {n8nSettings?.n8n_configured ? (
                <div className="rounded-md bg-muted/50 px-3 py-2 text-sm">
                  <p className="font-medium text-green-600">ตั้งค่าแล้ว</p>
                  <p className="text-muted-foreground text-xs mt-0.5">URL: {n8nSettings.n8n_webhook_url_preview}</p>
                </div>
              ) : (
                <div className="rounded-md bg-blue-50 border border-blue-200 px-3 py-2 text-xs text-blue-800 space-y-1">
                  <p className="font-semibold">วิธีตั้งค่า n8n Cutout:</p>
                  <ol className="list-decimal ml-4 space-y-0.5">
                    <li>Import workflow จากไฟล์ <span className="font-mono">backend/assets/n8n/promo-cutout-workflow.json</span></li>
                    <li>ติดตั้ง rembg บน server: <span className="font-mono">pip install rembg[cli]</span></li>
                    <li>Activate workflow ใน n8n → copy Webhook URL</li>
                    <li>วาง URL ด้านล่าง</li>
                  </ol>
                  <p className="text-muted-foreground mt-1">ถ้าไม่ตั้งค่า ระบบจะใช้รูปสินค้าโดยตรงโดยไม่ไดคัท</p>
                </div>
              )}
              <div className="space-y-1.5">
                <Label>n8n Webhook URL</Label>
                <Input
                  placeholder="https://your-n8n.com/webhook/promo-cutout"
                  value={n8nWebhookUrl}
                  onChange={(e) => setN8nWebhookUrl(e.target.value)}
                />
              </div>
            </CardContent>
          </Card>

          {settingsMsg && (
            <p className={`text-sm ${settingsMsg.includes('สำเร็จ') ? 'text-green-600' : 'text-destructive'}`}>
              {settingsMsg}
            </p>
          )}
          <Button
            disabled={settingsSaving}
            onClick={() => void handleSaveSettings()}
          >
            {settingsSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            บันทึกการตั้งค่า
          </Button>
        </div>
      )}

    </div>
  );
}
