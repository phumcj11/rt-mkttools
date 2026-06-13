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
import {
  generatePopStickers,
  getDriveSettings,
  getN8nSettings,
  getVideoSettings,
  listBrandAssets,
  listMediaFiles,
  listMediaProducts,
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
  const [videoTasks, setVideoTasks] = useState<Record<string, string>>({});

  const [files, setFiles] = useState<MediaFile[]>([]);
  const [filesLoading, setFilesLoading] = useState(false);
  const [uploadingFile, setUploadingFile] = useState<string | null>(null);
  const [syncRunning, setSyncRunning] = useState(false);

  const [driveSettings, setDriveSettings] = useState<DriveSettings | null>(null);
  const [videoSettings, setVideoSettings] = useState<VideoSettings | null>(null);
  const [n8nSettings, setN8nSettings] = useState<N8nSettings | null>(null);
  const [driveFolderId, setDriveFolderId] = useState('');
  const [driveServiceAccount, setDriveServiceAccount] = useState('');
  const [klingKey, setKlingKey] = useState('');
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
      const res = await submitProductVideo(sku);
      if ('error' in res && res.error) {
        alert((res as { error: true; message: string }).message);
        return;
      }
      if ('taskId' in res) {
        setVideoTasks((prev) => ({ ...prev, [sku]: res.taskId }));
        alert(`ส่งคำขอ Video สำเร็จ! Task ID: ${res.taskId}\nใช้เวลาประมาณ 2-5 นาที`);
      }
    } catch {
      alert('ส่งคำขอ Video ล้มเหลว — ตรวจสอบ Kling API Key ในหน้าตั้งค่า');
    } finally {
      setVideoSubmitting(null);
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
      if (klingKey.trim()) {
        await saveVideoSettings({ kling_api_key: klingKey.trim() });
      }
      if (n8nWebhookUrl.trim()) {
        await saveN8nSettings({ n8n_promo_webhook_url: n8nWebhookUrl.trim() });
      }
      setSettingsMsg('บันทึกสำเร็จ');
      setDriveFolderId('');
      setDriveServiceAccount('');
      setKlingKey('');
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
                    onChange={(e) => setIncludeBranded(e.target.checked)}
                    disabled={selectedBrandAssets.size === 0}
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
                const hasVideoTask = !!videoTasks[p.sku];

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
                            disabled={isVideoSubmitting || hasVideoTask}
                            onClick={() => void handleVideoSubmit(p.sku)}
                          >
                            {isVideoSubmitting ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : hasVideoTask ? (
                              <><CheckCircle2 className="h-3 w-3 text-green-500 mr-1" />Video</>
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

          {/* Kling AI */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Film className="h-4 w-4 text-primary" />
                Kling AI — Video Generation
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
                    Key: {videoSettings.kling_key_preview}
                  </p>
                </div>
              ) : (
                <div className="rounded-md bg-blue-50 border border-blue-200 px-3 py-2 text-xs text-blue-800">
                  <p className="font-semibold">วิธีขอ API Key:</p>
                  <p>สมัครที่ <span className="font-mono">platform.klingai.com</span> → API Keys → สร้างใหม่</p>
                  <p className="mt-1">ค่าใช้จ่าย: ~฿0.14 ต่อ 5 วินาที (image-to-video)</p>
                </div>
              )}
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
            disabled={settingsSaving || (!driveFolderId.trim() && !driveServiceAccount.trim() && !klingKey.trim() && !n8nWebhookUrl.trim())}
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
