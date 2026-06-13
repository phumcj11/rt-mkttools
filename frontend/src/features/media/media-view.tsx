'use client';

import { useEffect, useRef, useState } from 'react';
import {
  CheckCircle2,
  CloudUpload,
  Download,
  Film,
  Image,
  Loader2,
  RefreshCw,
  Sparkles,
  Video,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';
import { generateContent } from '@/lib/ai-api';
import {
  generatePopStickers,
  getDriveSettings,
  getN8nSettings,
  getVideoSettings,
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
  type DriveSettings,
  type ErpProduct,
  type MediaFile,
  type N8nSettings,
  type PopStickerResult,
  type VideoSettings,
  type VideoSubmitOptions,
  type VideoTask,
  VIDEO_MODELS,
  type VideoProviderId,
} from '@/lib/media-api';
import { PromoTab } from './promo-tab';

type Tab = 'products' | 'promotion' | 'files' | 'settings';

export function MediaView() {
  const [tab, setTab] = useState<Tab>('products');

  const [products, setProducts] = useState<ErpProduct[]>([]);
  const [productsLoading, setProductsLoading] = useState(true);
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
  const [videoProvider, setVideoProvider] = useState<VideoProviderId>('gemini');
  const [videoModel, setVideoModel] = useState(VIDEO_MODELS.gemini[0]);
  const [videoUseCutout, setVideoUseCutout] = useState(true);
  const [videoBriefs, setVideoBriefs] = useState<Record<string, string>>({});

  const [files, setFiles] = useState<MediaFile[]>([]);
  const [filesLoading, setFilesLoading] = useState(false);
  const [uploadingFile, setUploadingFile] = useState<string | null>(null);
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
    setProductsLoading(true);
    Promise.all([
      listMediaProducts(100).then(setProducts).catch(() => undefined),
      listBrandAssets()
        .then((assets) => setBrandAssets(Array.isArray(assets) ? assets : []))
        .catch(() => undefined),
    ]).finally(() => setProductsLoading(false));
  }, []);

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
      alert(`${sku}: ${msg}`);
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
      alert(err instanceof Error ? err.message : 'อัปโหลด Brand Asset ไม่สำเร็จ');
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

  const handleVideoSubmit = async (sku: string) => {
    setVideoSubmitting(sku);
    try {
      const options: VideoSubmitOptions = {
        provider: videoProvider,
        model: videoModel,
        visualBrief: videoBriefs[sku]?.trim() || undefined,
        mascotAssetFilenames: Array.from(selectedBrandAssets).filter((filename) => {
          const asset = brandAssets.find((a) => a.filename === filename);
          return asset?.kind === 'mascot';
        }),
        useCutoutProductImage: videoUseCutout,
      };
      const res = await submitProductVideo(sku, options);
      if ('error' in res && res.error) {
        alert((res as { error: true; message: string }).message);
        return;
      }
      if ('taskId' in res) {
        setVideoTasks((prev) => ({ ...prev, [sku]: res }));
      }
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'ส่งคำขอ Video ล้มเหลว — ตรวจสอบ API Key ในหน้าตั้งค่า');
    } finally {
      setVideoSubmitting(null);
    }
  };

  const handleDraftVideoBrief = async (product: ErpProduct) => {
    setBriefGenerating(product.sku);
    try {
      const current = videoBriefs[product.sku]?.trim();
      const mascotCount = Array.from(selectedBrandAssets).filter((filename) => {
        const asset = brandAssets.find((a) => a.filename === filename);
        return asset?.kind === 'mascot';
      }).length;
      const res = await generateContent({
        type: 'tiktok_script',
        productName: product.name,
        price: Number(product.retailPrice) || undefined,
        tone: 'friendly',
        details: [
          'สร้างคำสั่งเสริมสำหรับ image-to-video 6 วินาที แนวตั้ง 9:16',
          'ไม่ต้องเขียนสรรพคุณละเอียด เพราะ backend จะวิเคราะห์ benefit จากรูป/ชื่อสินค้าให้อัตโนมัติ',
          'ให้ mascot จากรูป reference เป็นคนพูด/ชี้สินค้า ถ้ามี mascot',
          'ใช้รูปสินค้า ERP ที่ลบพื้นหลังแล้วเป็น product reference',
          'ฉากในร้าน ChangSiam 100 Baht Shop Thailand',
          'ห้ามกล่าวอ้างรักษาโรค ห้ามใส่ SKU/product code',
          `Provider: ${videoProvider}, Model: ${videoModel}`,
          `Mascot selected: ${mascotCount}`,
          current ? `คำสั่งเดิมของผู้ใช้: ${current}` : '',
        ].filter(Boolean).join('\n'),
      }, 'th');
      setVideoBriefs((prev) => ({ ...prev, [product.sku]: res.content }));
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'AI ช่วยร่าง brief ไม่สำเร็จ');
    } finally {
      setBriefGenerating(null);
    }
  };

  const handleSyncDrive = async () => {
    setSyncRunning(true);
    try {
      const res = await syncToDrive();
      if ('error' in (res as object)) {
        alert((res as unknown as { message: string }).message);
        return;
      }
      alert(`อัปโหลดสำเร็จ ${res.uploaded.length} ไฟล์, ล้มเหลว ${res.failed.length} ไฟล์`);
      setFilesLoading(true);
      listMediaFiles().then(setFiles).finally(() => setFilesLoading(false));
    } catch {
      alert('Sync ล้มเหลว — ตรวจสอบการตั้งค่า Google Drive');
    } finally {
      setSyncRunning(false);
    }
  };

  const handleUploadOne = async (filename: string) => {
    setUploadingFile(filename);
    try {
      const res = await uploadFileToDrive(filename);
      alert(`อัปโหลดสำเร็จ! ดูที่: ${res.webViewLink}`);
    } catch {
      alert('Upload ล้มเหลว — ตรวจสอบการตั้งค่า Google Drive');
    } finally {
      setUploadingFile(null);
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Product Media Automation</h1>
        <p className="text-muted-foreground">
          สร้างรูปสรรพคุณสินค้าและ Clip Video อัตโนมัติ แล้วอัปโหลดขึ้น Google Drive
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-lg border bg-muted/30 p-1 w-fit">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              tab === id ? 'bg-background shadow text-foreground' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
      </div>

      {/* POP Sticker AI Tab */}
      {tab === 'products' && (
        <div className="space-y-4">
          {/* Header info */}
          <Card className="border-violet-200 bg-violet-50/50">
            <CardContent className="pt-4 pb-3">
              <div className="flex items-start gap-3">
                <Sparkles className="h-5 w-5 text-violet-600 mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-violet-900">AI Product POP Sticker Generator</p>
                  <p className="text-xs text-violet-700 mt-0.5">
                    AI วิเคราะห์รูปสินค้า → สร้าง copy ปลอดภัย → GPT Image ใช้รูปสินค้าเป็น reference เพื่อสร้าง POP sticker ทั้งชิ้น
                  </p>
                  <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1.5">
                    <span className="text-[11px] text-muted-foreground">ใช้เวลา ~1–2 นาที/สินค้า</span>
                    <span className="text-[11px] text-muted-foreground">~$0.04–0.12/สินค้า (GPT Image ×4)</span>
                    <span className="text-[11px] text-violet-600 font-medium">แนวเดียวกับ ChatGPT: สร้าง die-cut retail sticker จากรูปสินค้า reference</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground">{products.length} สินค้า</span>
          </div>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Video AI Provider</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-3">
              <div className="space-y-1.5">
                <Label>Provider</Label>
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
                  <option value="grok">Grok (เตรียมไว้)</option>
                </NativeSelect>
              </div>
              <div className="space-y-1.5">
                <Label>Model</Label>
                <NativeSelect value={videoModel} onChange={(e) => setVideoModel(e.target.value)}>
                  {(VIDEO_MODELS[videoProvider] ?? []).map((model) => (
                    <option key={model} value={model}>{model}</option>
                  ))}
                </NativeSelect>
              </div>
              <label className="flex items-center gap-2 text-xs text-muted-foreground md:pt-8">
                <input
                  type="checkbox"
                  checked={videoUseCutout}
                  onChange={(e) => setVideoUseCutout(e.target.checked)}
                />
                ใช้รูปสินค้าแบบลบพื้นหลังผ่าน n8n ถ้ามี
              </label>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Brand Assets สำหรับ Branded POP</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <input
                  ref={logoInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="hidden"
                  onChange={(e) => {
                    void handleBrandAssetUpload('logo', e.target.files?.[0] ?? null);
                    e.target.value = '';
                  }}
                />
                <Button
                  size="sm"
                  variant="outline"
                  type="button"
                  disabled={brandUploading === 'logo'}
                  onClick={() => logoInputRef.current?.click()}
                >
                  {brandUploading === 'logo' ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : null}
                  อัปโหลด Logo
                </Button>
                <input
                  ref={mascotInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="hidden"
                  onChange={(e) => {
                    void handleBrandAssetUpload('mascot', e.target.files?.[0] ?? null);
                    e.target.value = '';
                  }}
                />
                <Button
                  size="sm"
                  variant="outline"
                  type="button"
                  disabled={brandUploading === 'mascot'}
                  onClick={() => mascotInputRef.current?.click()}
                >
                  {brandUploading === 'mascot' ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : null}
                  อัปโหลด Mascot
                </Button>
                <label className="ml-1 flex items-center gap-2 text-xs text-muted-foreground">
                  <input
                    type="checkbox"
                    checked={includeBranded}
                    onChange={(e) => {
                      const checked = e.target.checked;
                      if (checked && selectedBrandAssets.size === 0 && brandAssets.length > 0) {
                        setSelectedBrandAssets(
                          new Set(brandAssets.filter((a) => a?.filename).map((a) => a.filename)),
                        );
                      }
                      setIncludeBranded(checked);
                    }}
                    disabled={brandAssets.length === 0}
                  />
                  สร้าง Branded เพิ่ม 2 แบบ
                </label>
                {selectedBrandAssets.size > 0 && (
                  <Badge variant="secondary" className="text-[10px]">
                    เลือก {selectedBrandAssets.size} assets
                  </Badge>
                )}
              </div>

              {brandAssets.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  อัปโหลดโลโก้ร้านหรือมาสคอตก่อน ถ้าต้องการสร้าง Branded POP เพิ่มจาก 4 แบบหลัก
                </p>
              ) : (
                <div className="space-y-2">
                  <p className="text-[11px] text-muted-foreground">
                    คลิกการ์ดเพื่อเลือก logo/mascot ที่จะใช้ — ติ๊ก &quot;สร้าง Branded เพิ่ม 2 แบบ&quot; แล้วกด Generate จะได้ 4 แบบหลัก + Branded 2 แบบ
                  </p>
                  <div className="flex flex-wrap gap-2">
                  {brandAssets.filter((asset) => asset?.filename && asset?.url).map((asset) => {
                    const selected = selectedBrandAssets.has(asset.filename);
                    return (
                      <button
                        key={asset.filename}
                        type="button"
                        onClick={() => toggleBrandAsset(asset.filename)}
                        className={`flex items-center gap-2 rounded-md border px-2 py-1.5 text-left transition-colors ${
                          selected ? 'border-violet-400 bg-violet-50' : 'border-border hover:bg-muted/50'
                        }`}
                      >
                        <img
                          src={resolveMediaUrl(asset.url)}
                          alt={asset.kind}
                          className="h-8 w-8 rounded bg-white object-contain"
                        />
                        <span className="text-[11px] capitalize">{asset.kind}</span>
                        {selected && <CheckCircle2 className="h-3.5 w-3.5 text-violet-600" />}
                      </button>
                    );
                  })}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {productsLoading ? (
            <div className="flex items-center gap-2 text-muted-foreground py-8 justify-center">
              <Loader2 className="h-5 w-5 animate-spin" /> โหลดสินค้า ERP...
            </div>
          ) : products.length === 0 ? (
            <p className="text-muted-foreground text-sm">ยังไม่มีข้อมูลสินค้า — ซิงค์สินค้าจาก ERP ก่อน</p>
          ) : (
            <div className="space-y-3">
              {products.map((p) => {
                const popResult = popResults[p.sku];
                const isGenerating = generating === p.sku;
                const isExpanded = expandedSku === p.sku;
                const isVideoSubmitting = videoSubmitting === p.sku;
                const videoTask = videoTasks[p.sku];
                const hasVideoTask = !!videoTask;

                return (
                  <Card key={p.sku} className={`transition-colors ${isExpanded ? 'border-violet-300' : ''}`}>
                    <CardContent className="pt-3 space-y-3">
                      {/* Product row */}
                      <div className="flex items-center gap-3">
                        <div className="h-14 w-14 rounded-lg overflow-hidden bg-muted/50 shrink-0">
                          {p.imageUrl ? (
                            <img src={p.imageUrl} alt={p.name} className="w-full h-full object-cover" />
                          ) : (
                            <div className="flex h-full items-center justify-center">
                              <Image className="h-6 w-6 text-muted-foreground/50" />
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">{p.name}</p>
                          <p className="text-xs text-muted-foreground">{p.category} · ฿{p.retailPrice}</p>
                          {popResult && (
                            <div className="flex flex-wrap gap-1 mt-0.5 items-center">
                              <span className="text-xs text-violet-600">
                                ✓ {popResult.variations.filter((v) => v.imageUrl).length}/{popResult.variations.length} variations
                              </span>
                              {popResult.variations[0]?.cutoutUsed && (
                                <Badge variant="outline" className="text-[10px] text-emerald-700 border-emerald-300">cutout ✓</Badge>
                              )}
                              {popResult.productImageSize && (popResult.productImageSize.width < 400 || popResult.productImageSize.height < 400) && (
                                <Badge variant="outline" className="text-[10px] text-amber-700 border-amber-300">
                                  รูป ERP ความละเอียดต่ำ ({popResult.productImageSize.width}×{popResult.productImageSize.height}px)
                                </Badge>
                              )}
                            </div>
                          )}
                        </div>
                        <div className="flex gap-1.5 shrink-0">
                          <Button
                            size="sm"
                            variant={popResult ? 'outline' : 'default'}
                            className="h-8 text-xs"
                            disabled={isGenerating || !!generating}
                            onClick={() => void handleGeneratePopStickers(p.sku)}
                          >
                            {isGenerating ? (
                              <><Loader2 className="h-3 w-3 animate-spin mr-1" />กำลังสร้าง...</>
                            ) : (
                              <><Sparkles className="h-3 w-3 mr-1" />{popResult ? 'Regenerate' : 'สร้าง POP'}</>
                            )}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 text-xs"
                            disabled={isVideoSubmitting || videoProvider === 'grok' || (videoTask?.status === 'queued' || videoTask?.status === 'processing')}
                            onClick={() => void handleVideoSubmit(p.sku)}
                          >
                            {isVideoSubmitting ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : videoTask?.status === 'done' ? (
                              <><CheckCircle2 className="h-3 w-3 text-green-500 mr-1" />Video</>
                            ) : videoTask?.status === 'queued' || videoTask?.status === 'processing' ? (
                              <><Loader2 className="h-3 w-3 animate-spin mr-1" />Video</>
                            ) : (
                              <><Video className="h-3 w-3 mr-1" />Video</>
                            )}
                          </Button>
                          {popResult && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-8 text-xs"
                              onClick={() => setExpandedSku(isExpanded ? null : p.sku)}
                            >
                              {isExpanded ? '▲ ซ่อน' : '▼ ดู 4 แบบ'}
                            </Button>
                          )}
                        </div>
                      </div>

                      <div className="rounded-md border bg-muted/20 px-3 py-2 space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-xs font-medium">Video brief เสริม (ไม่กรอกก็ได้)</p>
                          <div className="flex items-center gap-1.5">
                            <Badge variant="outline" className="text-[10px]">
                              {videoProvider} · {videoModel}
                            </Badge>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="h-7 text-[11px]"
                              disabled={briefGenerating === p.sku}
                              onClick={() => void handleDraftVideoBrief(p)}
                            >
                              {briefGenerating === p.sku ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : null}
                              AI ช่วยร่าง
                            </Button>
                          </div>
                        </div>
                        <textarea
                          className="min-h-[70px] w-full rounded-md border bg-background px-3 py-2 text-xs"
                          placeholder="ปล่อยว่างได้: AI จะวิเคราะห์รูป/ชื่อสินค้าและสรุปสรรพคุณให้เอง หรือพิมพ์เพิ่ม เช่น ให้ mascot ถือสินค้า ยิ้ม และชี้จุดเด่นในร้าน"
                          value={videoBriefs[p.sku] ?? ''}
                          onChange={(e) => setVideoBriefs((prev) => ({ ...prev, [p.sku]: e.target.value }))}
                        />
                        <p className="text-[11px] text-muted-foreground">
                          กด Video ได้เลย: AI จะหา benefit ปลอดภัย + เขียน voiceover จากสินค้าอัตโนมัติ แล้วใช้ mascot ที่เลือกไว้ + รูปสินค้า ERP {videoUseCutout ? '+ พยายามลบพื้นหลังด้วย n8n' : ''} เป็น reference
                        </p>
                      </div>

                      {videoTask && (
                        <div className={`rounded-md px-3 py-2 text-xs border ${
                          videoTask.status === 'failed'
                            ? 'bg-red-50 border-red-200 text-red-700'
                            : videoTask.status === 'done'
                              ? 'bg-green-50 border-green-200 text-green-700'
                              : 'bg-blue-50 border-blue-200 text-blue-700'
                        }`}>
                          <p className="font-medium">
                            Video {videoTask.status} · {videoTask.provider ?? videoProvider} · {videoTask.model ?? videoModel}
                          </p>
                          {videoTask.error && <p className="mt-1">{videoTask.error}</p>}
                          {videoTask.videoUrl && (
                            <a
                              className="mt-1 inline-flex underline"
                              href={resolveMediaUrl(videoTask.localPath ?? videoTask.videoUrl)}
                              target="_blank"
                              rel="noreferrer"
                            >
                              เปิดวิดีโอที่สร้าง
                            </a>
                          )}
                        </div>
                      )}

                      {/* Generating progress */}
                      {isGenerating && (
                        <div className="rounded-md bg-violet-50 border border-violet-100 px-3 py-2.5 text-xs text-violet-700 space-y-1">
                          <p className="font-medium">กำลังสร้าง POP Sticker AI...</p>
                          <p>
                            1. วิเคราะห์รูปสินค้า ERP → 2. สร้าง copy ปลอดภัย → 3. GPT Image สร้าง die-cut POP sticker
                            {includeBranded && selectedBrandAssets.size > 0 ? ' 4 แบบหลัก + Branded เพิ่ม' : ' ×4'}
                          </p>
                          <p className="text-violet-500">ใช้เวลาประมาณ 1–2 นาที</p>
                        </div>
                      )}

                      {/* 4-variation gallery */}
                      {isExpanded && popResult && (
                        <div className="space-y-3 pt-1">
                          {/* Copy summary */}
                          <div className="rounded-md bg-muted/40 px-3 py-2 text-xs space-y-1">
                            <p className="font-semibold text-sm">{popResult.copy.headline}</p>
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
                          {/* Image grid */}
                          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                            {popResult.variations.map((v) => (
                              <div key={v.styleId} className="space-y-1">
                                <div className="aspect-square rounded-lg overflow-hidden bg-muted/50 relative group">
                                  {v.imageUrl ? (
                                    <>
                                      <img
                                        src={resolveMediaUrl(v.imageUrl)}
                                        alt={v.styleName}
                                        className="w-full h-full object-cover"
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
                                    <div className="flex h-full items-center justify-center text-xs text-muted-foreground px-2 text-center">
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
                    </CardContent>
                  </Card>
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
          <div className="flex items-center gap-3">
            <Button size="sm" variant="outline" onClick={() => {
              setFilesLoading(true);
              listMediaFiles().then(setFiles).finally(() => setFilesLoading(false));
            }}>
              <RefreshCw className="mr-2 h-4 w-4" /> รีเฟรช
            </Button>
            <Button
              size="sm"
              disabled={syncRunning || files.length === 0}
              onClick={() => void handleSyncDrive()}
            >
              {syncRunning
                ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />กำลัง Sync...</>
                : <><CloudUpload className="mr-2 h-4 w-4" />Sync ทั้งหมดขึ้น Drive</>}
            </Button>
          </div>

          {filesLoading ? (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> โหลด...
            </div>
          ) : files.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              ยังไม่มีไฟล์ — ไปที่ &ldquo;สินค้า ERP&rdquo; เพื่อสร้างรูปหรือ Video
            </p>
          ) : (
            <div className="space-y-2">
              {files.map((file) => {
                const isImage = file.filename.endsWith('.png') || file.filename.endsWith('.jpg');
                const isUploading = uploadingFile === file.filename;
                return (
                  <div key={file.filename} className="flex items-center gap-3 rounded-lg border px-3 py-2.5">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted/50 shrink-0">
                      {isImage
                        ? <Image className="h-5 w-5 text-muted-foreground" />
                        : <Film className="h-5 w-5 text-muted-foreground" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{file.filename}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(file.createdAt).toLocaleString('th-TH', { dateStyle: 'short', timeStyle: 'short' })}
                      </p>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        asChild
                        title="ดาวน์โหลด"
                      >
                        <a href={resolveMediaUrl(file.url)} download={file.filename}>
                          <Download className="h-4 w-4" />
                        </a>
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        title="อัปโหลดขึ้น Drive"
                        disabled={isUploading}
                        onClick={() => void handleUploadOne(file.filename)}
                      >
                        {isUploading
                          ? <Loader2 className="h-4 w-4 animate-spin" />
                          : <CloudUpload className="h-4 w-4" />}
                      </Button>
                    </div>
                  </div>
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
                  <p>รอบแรกใช้ Gemini / Veo เป็นหลัก และยังเก็บ Kling/Grok ไว้สำหรับเลือก provider ต่อไป</p>
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
                    <option value="grok">Grok (เตรียมไว้)</option>
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
                <Label>Grok / xAI API Key (เตรียมไว้)</Label>
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
