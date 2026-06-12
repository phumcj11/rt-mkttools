'use client';

import { useEffect, useRef, useState } from 'react';
import { toPng } from 'html-to-image';
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
  X,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  generateBenefitImage,
  getDriveSettings,
  getVideoSettings,
  listMediaFiles,
  listMediaProducts,
  saveDriveSettings,
  saveVideoSettings,
  submitProductVideo,
  syncToDrive,
  uploadFileToDrive,
  uploadBenefitPoster,
  proxyImageUrl,
  resolveMediaUrl,
  type DriveSettings,
  type ErpProduct,
  type MediaFile,
  type ProductMediaResult,
  type VideoSettings,
} from '@/lib/media-api';
import { BenefitPosterTemplate, buildPosterData, type BenefitPosterData } from './benefit-poster';

type Tab = 'products' | 'files' | 'settings';

export function MediaView() {
  const [tab, setTab] = useState<Tab>('products');

  const [products, setProducts] = useState<ErpProduct[]>([]);
  const [productsLoading, setProductsLoading] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [generating, setGenerating] = useState<string | null>(null);
  const [batchRunning, setBatchRunning] = useState(false);
  const [results, setResults] = useState<Record<string, ProductMediaResult>>({});
  const [videoSubmitting, setVideoSubmitting] = useState<string | null>(null);
  const [videoTasks, setVideoTasks] = useState<Record<string, string>>({});

  const [files, setFiles] = useState<MediaFile[]>([]);
  const [filesLoading, setFilesLoading] = useState(false);
  const [uploadingFile, setUploadingFile] = useState<string | null>(null);
  const [syncRunning, setSyncRunning] = useState(false);

  const [driveSettings, setDriveSettings] = useState<DriveSettings | null>(null);
  const [videoSettings, setVideoSettings] = useState<VideoSettings | null>(null);
  const [driveFolderId, setDriveFolderId] = useState('');
  const [driveServiceAccount, setDriveServiceAccount] = useState('');
  const [klingKey, setKlingKey] = useState('');
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [settingsMsg, setSettingsMsg] = useState<string | null>(null);

  const posterRef = useRef<HTMLDivElement>(null);
  const [posterRender, setPosterRender] = useState<{
    sku: string;
    data: BenefitPosterData;
    resolve: (imageUrl: string) => void;
    reject: (err: Error) => void;
  } | null>(null);

  /** Off-screen poster → PNG → upload */
  useEffect(() => {
    if (!posterRender || !posterRef.current) return;
    const timer = setTimeout(() => {
      void (async () => {
        try {
          const dataUrl = await toPng(posterRef.current!, {
            pixelRatio: 2,
            cacheBust: true,
          });
          const saved = await uploadBenefitPoster(posterRender.sku, dataUrl);
          posterRender.resolve(saved.imageUrl);
        } catch (e) {
          posterRender.reject(e instanceof Error ? e : new Error(String(e)));
        } finally {
          setPosterRender(null);
        }
      })();
    }, 600);
    return () => clearTimeout(timer);
  }, [posterRender]);

  const capturePoster = (sku: string, product: ErpProduct, apiResult: ProductMediaResult) => {
    const data = buildPosterData(product, apiResult.benefits, apiResult.benefitLines);
    if (data.imageUrl) data.imageUrl = proxyImageUrl(data.imageUrl);
    return new Promise<string>((resolve, reject) => {
      setPosterRender({ sku, data, resolve, reject });
    });
  };

  const generateWithPoster = async (sku: string): Promise<ProductMediaResult> => {
    const product = products.find((p) => p.sku === sku);
    if (!product) throw new Error(`ไม่พบสินค้า ${sku}`);
    const apiResult = await generateBenefitImage(sku);
    const imageUrl = await capturePoster(sku, product, apiResult);
    return { ...apiResult, imageUrl, source: 'benefit_poster' };
  };

  useEffect(() => {
    setProductsLoading(true);
    listMediaProducts(100)
      .then(setProducts)
      .catch(() => undefined)
      .finally(() => setProductsLoading(false));
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
    }
  }, [tab]);

  const toggleSelect = (sku: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(sku) ? next.delete(sku) : next.add(sku);
      return next;
    });

  const handleGenerateOne = async (sku: string) => {
    setGenerating(sku);
    try {
      const res = await generateWithPoster(sku);
      setResults((prev) => ({ ...prev, [sku]: res }));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'สร้างรูปไม่สำเร็จ';
      alert(`${sku}: ${msg}`);
    } finally {
      setGenerating(null);
    }
  };

  const handleBatchGenerate = async () => {
    if (selected.size === 0) return;
    setBatchRunning(true);
    const skus = Array.from(selected);
    const success: ProductMediaResult[] = [];
    const failed: { sku: string; error: string }[] = [];

    for (const sku of skus) {
      try {
        success.push(await generateWithPoster(sku));
      } catch (err: unknown) {
        failed.push({ sku, error: err instanceof Error ? err.message : String(err) });
      }
    }

    const newResults: Record<string, ProductMediaResult> = {};
    success.forEach((r) => { newResults[r.sku] = r; });
    setResults((prev) => ({ ...prev, ...newResults }));

    if (failed.length > 0) {
      const detail = failed.map((f) => `${f.sku}: ${f.error}`).join('\n');
      alert(`สำเร็จ ${success.length} รายการ, ล้มเหลว ${failed.length} รายการ\n\n${detail}`);
    }

    setBatchRunning(false);
    setSelected(new Set());
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
      setSettingsMsg('บันทึกสำเร็จ');
      setDriveFolderId('');
      setDriveServiceAccount('');
      setKlingKey('');
      const [ds, vs] = await Promise.all([getDriveSettings(), getVideoSettings()]);
      setDriveSettings(ds);
      setVideoSettings(vs);
    } catch {
      setSettingsMsg('บันทึกไม่สำเร็จ');
    } finally {
      setSettingsSaving(false);
    }
  };

  const TABS: { id: Tab; label: string; icon: typeof Image }[] = [
    { id: 'products', label: 'สินค้า ERP', icon: Sparkles },
    { id: 'files',    label: 'ไฟล์ที่สร้าง', icon: Image },
    { id: 'settings', label: 'ตั้งค่า', icon: CheckCircle2 },
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

      {/* Products Tab */}
      {tab === 'products' && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground">{products.length} สินค้า</span>
            {selected.size > 0 && (
              <>
                <Badge variant="secondary">{selected.size} เลือกอยู่</Badge>
                <Button
                  size="sm"
                  disabled={batchRunning}
                  onClick={() => void handleBatchGenerate()}
                >
                  {batchRunning
                    ? <><Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />กำลังสร้าง...</>
                    : <><Sparkles className="mr-2 h-3.5 w-3.5" />Batch Generate รูป ({selected.size})</>}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>
                  <X className="h-3.5 w-3.5" />
                </Button>
              </>
            )}
          </div>

          {productsLoading ? (
            <div className="flex items-center gap-2 text-muted-foreground py-8 justify-center">
              <Loader2 className="h-5 w-5 animate-spin" /> โหลดสินค้า ERP...
            </div>
          ) : products.length === 0 ? (
            <p className="text-muted-foreground text-sm">ยังไม่มีข้อมูลสินค้า — ซิงค์สินค้าจาก ERP ก่อน</p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {products.map((p) => {
                const result = results[p.sku];
                const isGenerating = generating === p.sku;
                const isVideoSubmitting = videoSubmitting === p.sku;
                const hasVideoTask = !!videoTasks[p.sku];

                return (
                  <Card
                    key={p.sku}
                    className={`cursor-pointer transition-colors ${selected.has(p.sku) ? 'border-primary' : ''}`}
                    onClick={() => toggleSelect(p.sku)}
                  >
                    <CardContent className="pt-3 space-y-2">
                      {/* Product image or generated result */}
                      <div className="aspect-square rounded-lg overflow-hidden bg-muted/50 relative">
                        {result ? (
                          <img
                            src={resolveMediaUrl(result.imageUrl)}
                            alt={result.productName}
                            className="w-full h-full object-cover"
                          />
                        ) : p.imageUrl ? (
                          <img
                            src={p.imageUrl}
                            alt={p.name}
                            className="w-full h-full object-cover opacity-70"
                          />
                        ) : (
                          <div className="flex h-full items-center justify-center">
                            <Image className="h-8 w-8 text-muted-foreground/50" />
                          </div>
                        )}
                        {selected.has(p.sku) && (
                          <div className="absolute top-2 right-2 rounded-full bg-primary p-0.5">
                            <CheckCircle2 className="h-4 w-4 text-primary-foreground" />
                          </div>
                        )}
                      </div>

                      <div>
                        <p className="font-medium text-sm truncate">{p.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {p.category} · ฿{p.retailPrice}
                        </p>
                      </div>

                      {result && (
                        <div className="rounded-md bg-muted/50 p-2 text-xs text-muted-foreground line-clamp-3">
                          {result.benefits}
                        </div>
                      )}

                      <div className="flex gap-1.5" onClick={(e) => e.stopPropagation()}>
                        <Button
                          size="sm"
                          variant="outline"
                          className="flex-1 h-7 text-xs"
                          disabled={isGenerating || batchRunning}
                          onClick={() => void handleGenerateOne(p.sku)}
                        >
                          {isGenerating
                            ? <Loader2 className="h-3 w-3 animate-spin" />
                            : <><Sparkles className="mr-1 h-3 w-3" />{result ? 'Regenerate' : 'รูปสรรพคุณ'}</>}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="flex-1 h-7 text-xs"
                          disabled={isVideoSubmitting || hasVideoTask}
                          onClick={() => void handleVideoSubmit(p.sku)}
                        >
                          {isVideoSubmitting
                            ? <Loader2 className="h-3 w-3 animate-spin" />
                            : hasVideoTask
                            ? <><CheckCircle2 className="mr-1 h-3 w-3 text-green-500" />ส่งแล้ว</>
                            : <><Video className="mr-1 h-3 w-3" />Video</>}
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

          {settingsMsg && (
            <p className={`text-sm ${settingsMsg.includes('สำเร็จ') ? 'text-green-600' : 'text-destructive'}`}>
              {settingsMsg}
            </p>
          )}
          <Button
            disabled={settingsSaving || (!driveFolderId.trim() && !driveServiceAccount.trim() && !klingKey.trim())}
            onClick={() => void handleSaveSettings()}
          >
            {settingsSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            บันทึกการตั้งค่า
          </Button>
        </div>
      )}

      {/* Off-screen poster renderer for html-to-image */}
      {posterRender && (
        <div aria-hidden style={{ position: 'fixed', left: -9999, top: 0, pointerEvents: 'none' }}>
          <div ref={posterRef}>
            <BenefitPosterTemplate data={posterRender.data} />
          </div>
        </div>
      )}
    </div>
  );
}
