'use client';

import { ChangeEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  CheckCircle2,
  Download,
  FileImage,
  ImagePlus,
  Loader2,
  MessageSquareWarning,
  RefreshCw,
  Search,
  Send,
  Sparkles,
  Trash2,
  Upload,
  XCircle,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';
import {
  createSignRequest,
  deleteSignTemplate,
  exportSignRequest,
  getSignRequest,
  listSignRequests,
  listSignReviewQueue,
  listSignTemplates,
  regenerateSignDraft,
  resolveSignUrl,
  respondSignRequest,
  reviewSignRequest,
  updateSignDraft,
  uploadSignTemplate,
  type CreateSignRequestDto,
  type SignAssetInput,
  type SignRequestDetail,
  type SignRequestStatus,
  type SignRequestSummary,
  type SignSize,
  type SignTemplateRecord,
  type SignType,
} from '@/lib/signs-api';
import { getProductCatalogDetail, listProductCatalog, type ProductCatalogItem } from '@/lib/products-api';
import { showError, showSuccess } from '@/lib/sweetalert';
import { useAuthStore } from '@/stores/auth-store';

type Tab = 'new' | 'mine' | 'review' | 'templates';

const SIGN_TYPES: { id: SignType; label: string; hint: string }[] = [
  { id: 'price_tag', label: 'ป้ายราคา', hint: 'เน้นราคาใหญ่ อ่านง่าย' },
  { id: 'promotion', label: 'ป้ายโปรโมชั่น', hint: 'โปรลดราคา / ซื้อครบ / ของแถม' },
  { id: 'benefit_card', label: 'ป้ายสรรพคุณ', hint: 'เล่าจุดเด่นสินค้า' },
  { id: 'shelf_tag', label: 'Shelf Tag', hint: 'ป้ายเล็กติดชั้นวาง' },
];

const SIGN_SIZES: { id: SignSize; label: string; sub: string; w: number; h: number }[] = [
  { id: 'a5', label: 'A5', sub: '14.8 × 21 cm', w: 38, h: 54 },
  { id: 'a6', label: 'A6', sub: '10.5 × 14.8 cm', w: 32, h: 45 },
  { id: 'a7', label: 'A7', sub: '7.4 × 10.5 cm', w: 26, h: 37 },
  { id: 'shelf_tag', label: 'Shelf Tag', sub: '8 × 5 cm', w: 52, h: 32 },
];

const STATUS_LABELS: Record<SignRequestStatus, string> = {
  submitted: 'Submitted',
  ai_processing: 'AI Processing',
  pending_review: 'Pending Review',
  approved: 'Approved',
  rejected: 'Rejected',
  need_more_info: 'Need More Info',
  exported: 'Exported',
};

const STATUS_CLASS: Record<SignRequestStatus, string> = {
  submitted: 'bg-slate-100 text-slate-700',
  ai_processing: 'bg-blue-100 text-blue-700',
  pending_review: 'bg-amber-100 text-amber-800',
  approved: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-700',
  need_more_info: 'bg-orange-100 text-orange-800',
  exported: 'bg-violet-100 text-violet-700',
};

const initialForm: CreateSignRequestDto = {
  branchName: '',
  requesterName: '',
  sku: '',
  productName: '',
  price: undefined,
  promotion: '',
  signType: 'price_tag',
  signSize: 'a6',
  notes: '',
  assets: [],
};

export function SignsView() {
  const user = useAuthStore((state) => state.user);
  const canReview = !!user?.roles?.some((role) => ['super_admin', 'admin', 'marketing_manager', 'marketing_staff'].includes(String(role)));
  const [tab, setTab] = useState<Tab>('new');
  const [requests, setRequests] = useState<SignRequestSummary[]>([]);
  const [queue, setQueue] = useState<SignRequestSummary[]>([]);
  const [selected, setSelected] = useState<SignRequestDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState<CreateSignRequestDto>(initialForm);
  const [assetInputs, setAssetInputs] = useState<SignAssetInput[]>([]);
  const [reviewNote, setReviewNote] = useState('');
  const [responseNote, setResponseNote] = useState('');
  const [editFields, setEditFields] = useState({ headline: '', promotion: '' });
  const [signTemplates, setSignTemplates] = useState<SignTemplateRecord[]>([]);
  const [templatesLoading, setTemplatesLoading] = useState(false);
  const [selectedCatalog, setSelectedCatalog] = useState<ProductCatalogItem | null>(null);
  const [skuSuggestions, setSkuSuggestions] = useState<ProductCatalogItem[]>([]);
  const [skuSearching, setSkuSearching] = useState(false);
  const [skuDropdownOpen, setSkuDropdownOpen] = useState(false);
  const skuDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const currentList = tab === 'review' ? queue : requests;
  const selectedId = selected?.id;
  const selectedDraftId = selected?.latestDraft?.id;
  const selectedDraftFields = selected?.latestDraft?.editableFields;

  const openDetail = useCallback(async (id: number) => {
    const detail = await getSignRequest(id);
    setSelected(detail);
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [mine, reviewItems] = await Promise.all([
        listSignRequests(),
        canReview ? listSignReviewQueue().catch(() => []) : Promise.resolve([]),
      ]);
      setRequests(mine);
      setQueue(reviewItems);
      if (selectedId) {
        await openDetail(selectedId);
      }
    } finally {
      setLoading(false);
    }
  }, [canReview, openDetail, selectedId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!selectedDraftFields) return;
    setEditFields({
      headline: String(selectedDraftFields.headline ?? ''),
      promotion: String(selectedDraftFields.promotion ?? ''),
    });
  }, [selectedId, selectedDraftId, selectedDraftFields]);

  const applyCatalogProduct = useCallback((product: ProductCatalogItem) => {
    setSelectedCatalog(product);
    setForm((prev) => ({
      ...prev,
      sku: product.sku,
      productName: product.name,
      price: product.retailPrice || prev.price,
      promotion: product.promotions?.[0]
        ? `${product.promotions[0].name} ฿${Math.round(product.promotions[0].promoPrice)}`
        : product.lowestPromoPrice
          ? `โปรพิเศษ ฿${Math.round(product.lowestPromoPrice)}`
          : product.promotionNames || prev.promotion,
    }));
    setSkuDropdownOpen(false);
  }, []);

  const selectCatalogProduct = useCallback(async (item: ProductCatalogItem) => {
    try {
      const detail = await getProductCatalogDetail(item.sku);
      applyCatalogProduct(detail);
    } catch {
      applyCatalogProduct(item);
    }
  }, [applyCatalogProduct]);

  useEffect(() => {
    const q = (form.sku ?? '').trim();
    if (q.length < 2) {
      setSkuSuggestions([]);
      setSkuSearching(false);
      return;
    }
    if (selectedCatalog?.sku === q.replace(/\s+/g, '').toUpperCase()) return;

    if (skuDebounceRef.current) clearTimeout(skuDebounceRef.current);
    skuDebounceRef.current = setTimeout(() => {
      setSkuSearching(true);
      listProductCatalog({ q, limit: 8 })
        .then((res) => {
          setSkuSuggestions(res.items);
          setSkuDropdownOpen(res.items.length > 0);
        })
        .catch(() => setSkuSuggestions([]))
        .finally(() => setSkuSearching(false));
    }, 300);

    return () => {
      if (skuDebounceRef.current) clearTimeout(skuDebounceRef.current);
    };
  }, [form.sku, selectedCatalog?.sku]);

  const kpis = useMemo(() => {
    const all = [...requests, ...queue];
    return {
      total: requests.length,
      review: queue.length,
      exported: all.filter((r) => r.status === 'exported').length,
      info: all.filter((r) => r.status === 'need_more_info').length,
    };
  }, [requests, queue]);

  async function handleFiles(e: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []).slice(0, 8);
    const next = await Promise.all(files.map((file, index) => fileToAsset(file, index)));
    setAssetInputs((prev) => [...prev, ...next].slice(0, 8));
    e.target.value = '';
  }

  async function handleSubmit() {
    if (!form.branchName || !form.requesterName || !form.productName) {
      showError('ข้อมูลไม่ครบ', 'กรุณากรอกสาขา ผู้ขอ และชื่อสินค้า');
      return;
    }
    setSubmitting(true);
    try {
      const detail = await createSignRequest({
        ...form,
        price: form.price ? Number(form.price) : undefined,
        assets: assetInputs,
      });
      setSelected(detail);
      setForm(initialForm);
      setAssetInputs([]);
      setSelectedCatalog(null);
      setSkuSuggestions([]);
      setTab('mine');
      showSuccess('ส่งคำขอแล้ว', 'AI สร้าง Draft และส่งเข้า Approval Queue แล้ว');
      await refresh();
    } catch (err) {
      showError('ส่งคำขอไม่สำเร็จ', err instanceof Error ? err.message : 'กรุณาลองใหม่');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDecision(decision: 'approve' | 'reject' | 'need_more_info') {
    if (!selected) return;
    setSubmitting(true);
    try {
      const detail = await reviewSignRequest(selected.id, {
        decision,
        note: reviewNote || undefined,
      });
      setSelected(detail);
      setReviewNote('');
      showSuccess('อัปเดตสถานะแล้ว', STATUS_LABELS[detail.status]);
      await refresh();
    } catch (err) {
      showError('ตัดสินใจไม่สำเร็จ', err instanceof Error ? err.message : 'กรุณาลองใหม่');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDraftSave() {
    if (!selected) return;
    setSubmitting(true);
    try {
      const detail = await updateSignDraft(selected.id, editFields);
      setSelected(detail);
      showSuccess('แก้ Draft แล้ว', 'ระบบสร้าง preview เวอร์ชันใหม่แล้ว');
    } catch (err) {
      showError('แก้ Draft ไม่สำเร็จ', err instanceof Error ? err.message : 'กรุณาลองใหม่');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRegenerate() {
    if (!selected) return;
    setSubmitting(true);
    try {
      const detail = await regenerateSignDraft(selected.id);
      setSelected(detail);
      showSuccess('สร้างใหม่แล้ว', 'Draft ใหม่พร้อมตรวจแล้ว');
      await refresh();
    } catch (err) {
      showError('สร้างใหม่ไม่สำเร็จ', err instanceof Error ? err.message : 'กรุณาลองใหม่');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleExport() {
    if (!selected) return;
    setSubmitting(true);
    try {
      const detail = await exportSignRequest(selected.id);
      setSelected(detail);
      showSuccess('Export แล้ว', 'ไฟล์พร้อมดาวน์โหลดและส่งเข้า Drive หากตั้งค่าไว้');
      await refresh();
    } catch (err) {
      showError('Export ไม่สำเร็จ', err instanceof Error ? err.message : 'กรุณาลองใหม่');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRespond() {
    if (!selected || !responseNote.trim()) return;
    setSubmitting(true);
    try {
      const detail = await respondSignRequest(selected.id, { note: responseNote, assets: assetInputs });
      setSelected(detail);
      setResponseNote('');
      setAssetInputs([]);
      showSuccess('ส่งข้อมูลเพิ่มแล้ว', 'AI สร้าง Draft ใหม่และส่งกลับไปตรวจแล้ว');
      await refresh();
    } catch (err) {
      showError('ส่งข้อมูลเพิ่มไม่สำเร็จ', err instanceof Error ? err.message : 'กรุณาลองใหม่');
    } finally {
      setSubmitting(false);
    }
  }

  async function loadTemplates() {
    if (!canReview) return;
    setTemplatesLoading(true);
    try {
      const list = await listSignTemplates();
      setSignTemplates(list);
    } catch {
      /* ignore */
    } finally {
      setTemplatesLoading(false);
    }
  }

  async function handleTemplateUpload(e: ChangeEvent<HTMLInputElement>, tplSignType?: SignType, tplSignSize?: SignSize) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });
    try {
      const name = tplSignType && tplSignSize
        ? `${SIGN_TYPES.find((t) => t.id === tplSignType)?.label ?? tplSignType} ${SIGN_SIZES.find((s) => s.id === tplSignSize)?.label ?? tplSignSize}`
        : file.name.replace(/\.[^.]+$/, '');
      await uploadSignTemplate({ name, signType: tplSignType, signSize: tplSignSize, dataUrl });
      showSuccess('อัปโหลด Template แล้ว', name);
      await loadTemplates();
    } catch (err) {
      showError('อัปโหลดไม่สำเร็จ', err instanceof Error ? err.message : 'กรุณาลองใหม่');
    }
  }

  async function handleTemplateDelete(id: number) {
    try {
      await deleteSignTemplate(id);
      setSignTemplates((prev) => prev.filter((t) => t.id !== id));
    } catch (err) {
      showError('ลบไม่สำเร็จ', err instanceof Error ? err.message : 'กรุณาลองใหม่');
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">AI Sign Generator</h1>
          <p className="text-sm text-muted-foreground">ระบบขอป้าย สร้าง Draft ด้วย AI ตรวจอนุมัติ และส่งออกไฟล์พร้อมใช้งาน</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void refresh()} disabled={loading}>
          {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
          รีเฟรช
        </Button>
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        <KpiCard label="คำขอทั้งหมด" value={kpis.total} />
        <KpiCard label="รอ Marketing" value={kpis.review} tone="amber" />
        <KpiCard label="ต้องการข้อมูลเพิ่ม" value={kpis.info} tone="orange" />
        <KpiCard label="Exported" value={kpis.exported} tone="violet" />
      </div>

      <div className="flex gap-1 rounded-lg border bg-muted/30 p-1 w-fit flex-wrap">
        <TabButton active={tab === 'new'} onClick={() => setTab('new')}>ขอป้ายใหม่</TabButton>
        <TabButton active={tab === 'mine'} onClick={() => setTab('mine')}>คำขอทั้งหมด</TabButton>
        {canReview && <TabButton active={tab === 'review'} onClick={() => setTab('review')}>Approval Queue</TabButton>}
        {canReview && (
          <TabButton active={tab === 'templates'} onClick={() => { setTab('templates'); void loadTemplates(); }}>
            Templates
          </TabButton>
        )}
      </div>

      {tab !== 'templates' && <div className="grid gap-4 xl:grid-cols-[420px_1fr]">
        <div className="space-y-4">
          {tab === 'new' ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Request Portal</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Field label="สาขา"><Input value={form.branchName} onChange={(e) => setForm({ ...form, branchName: e.target.value })} placeholder="เช่น CL / PTN / JJ" /></Field>
                <Field label="ชื่อผู้ขอ"><Input value={form.requesterName} onChange={(e) => setForm({ ...form, requesterName: e.target.value })} placeholder={user?.fullName ?? 'ชื่อผู้ขอ'} /></Field>
                <SkuProductSearch
                  sku={form.sku ?? ''}
                  searching={skuSearching}
                  suggestions={skuSuggestions}
                  open={skuDropdownOpen}
                  selected={selectedCatalog}
                  onSkuChange={(sku) => {
                    setForm((prev) => ({ ...prev, sku }));
                    if (selectedCatalog && selectedCatalog.sku !== sku.replace(/\s+/g, '').toUpperCase()) {
                      setSelectedCatalog(null);
                    }
                    setSkuDropdownOpen(true);
                  }}
                  onSelect={(item) => void selectCatalogProduct(item)}
                  onClear={() => {
                    setSelectedCatalog(null);
                    setForm((prev) => ({ ...prev, sku: '', productName: '', price: undefined, promotion: '' }));
                  }}
                  onApplyPromo={(promo) => setForm((prev) => ({
                    ...prev,
                    price: promo.promoPrice,
                    promotion: `${promo.name} ฿${Math.round(promo.promoPrice)}${promo.conditions ? ` · ${promo.conditions}` : ''}`,
                  }))}
                />
                <Field label="ชื่อสินค้า"><Input value={form.productName} onChange={(e) => setForm({ ...form, productName: e.target.value })} /></Field>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="ราคาขาย">
                    <Input type="number" value={form.price ?? ''} onChange={(e) => setForm({ ...form, price: e.target.value ? Number(e.target.value) : undefined })} />
                  </Field>
                  <Field label="โปรโมชั่น"><Input value={form.promotion ?? ''} onChange={(e) => setForm({ ...form, promotion: e.target.value })} /></Field>
                </div>
                <Field label="ประเภทป้าย">
                  <NativeSelect value={form.signType} onChange={(e) => setForm({ ...form, signType: e.target.value as SignType })}>
                    {SIGN_TYPES.map((t) => <option key={t.id} value={t.id}>{t.label} — {t.hint}</option>)}
                  </NativeSelect>
                </Field>
                <Field label="ขนาดป้าย">
                  <SignSizePicker value={form.signSize} onChange={(s) => setForm({ ...form, signSize: s })} />
                </Field>
                <Field label="หมายเหตุ">
                  <textarea className="min-h-[84px] w-full rounded-md border bg-background px-3 py-2 text-sm" value={form.notes ?? ''} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
                </Field>
                <AssetPicker assets={assetInputs} onFiles={handleFiles} onClear={() => setAssetInputs([])} />
                <Button className="w-full gap-2" onClick={() => void handleSubmit()} disabled={submitting}>
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  ส่งคำขอและสร้าง Draft
                </Button>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">{tab === 'review' ? 'Marketing Approval Queue' : 'คำขอป้าย'}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {currentList.length === 0 ? (
                  <p className="py-8 text-center text-sm text-muted-foreground">ยังไม่มีรายการ</p>
                ) : currentList.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => void openDetail(item.id)}
                    className={`w-full rounded-lg border p-3 text-left transition hover:bg-muted/50 ${selected?.id === item.id ? 'border-primary bg-primary/5' : ''}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold">{item.productName}</p>
                        <p className="text-xs text-muted-foreground">{item.requestNo} • {item.branchName}</p>
                      </div>
                      <StatusBadge status={item.status} />
                    </div>
                    <p className="mt-2 text-xs text-muted-foreground">{SIGN_TYPES.find((t) => t.id === item.signType)?.label} • {SIGN_SIZES.find((s) => s.id === item.signSize)?.label}</p>
                  </button>
                ))}
              </CardContent>
            </Card>
          )}
        </div>

        <RequestDetail
          detail={selected}
          canReview={canReview}
          submitting={submitting}
          reviewNote={reviewNote}
          responseNote={responseNote}
          editFields={editFields}
          responseAssets={assetInputs}
          onReviewNote={setReviewNote}
          onResponseNote={setResponseNote}
          onEditFields={setEditFields}
          onFiles={handleFiles}
          onClearAssets={() => setAssetInputs([])}
          onDecision={handleDecision}
          onDraftSave={handleDraftSave}
          onRegenerate={handleRegenerate}
          onExport={handleExport}
          onRespond={handleRespond}
        />
      </div>}

      {tab === 'templates' && canReview && (
        <TemplatesPanel
          templates={signTemplates}
          loading={templatesLoading}
          onUpload={handleTemplateUpload}
          onDelete={handleTemplateDelete}
        />
      )}
    </div>
  );
}

function KpiCard({ label, value, tone = 'slate' }: { label: string; value: number; tone?: 'slate' | 'amber' | 'orange' | 'violet' }) {
  const colors = {
    slate: 'border-slate-200 bg-slate-50 text-slate-700',
    amber: 'border-amber-200 bg-amber-50 text-amber-700',
    orange: 'border-orange-200 bg-orange-50 text-orange-700',
    violet: 'border-violet-200 bg-violet-50 text-violet-700',
  };
  return (
    <div className={`rounded-xl border p-3 ${colors[tone]}`}>
      <p className="text-xs opacity-80">{label}</p>
      <p className="mt-1 text-2xl font-bold">{value}</p>
    </div>
  );
}

function TabButton({ active, children, onClick }: { active: boolean; children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      className={`rounded-md px-3 py-1.5 text-sm font-medium ${active ? 'bg-background shadow text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  );
}

function StatusBadge({ status }: { status: SignRequestStatus }) {
  return <Badge className={`${STATUS_CLASS[status]} border-0`}>{STATUS_LABELS[status]}</Badge>;
}

function AssetPicker({
  assets,
  onFiles,
  onClear,
}: {
  assets: SignAssetInput[];
  onFiles: (e: ChangeEvent<HTMLInputElement>) => void;
  onClear: () => void;
}) {
  return (
    <div className="rounded-lg border border-dashed p-3">
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-sm font-medium">รูปหน้างาน</p>
          <p className="text-xs text-muted-foreground">สินค้า / ป้ายเดิม / ชั้นวาง</p>
        </div>
        <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border px-3 py-1.5 text-xs hover:bg-muted">
          <Upload className="h-3.5 w-3.5" />
          อัปโหลด
          <input type="file" accept="image/*" multiple className="hidden" onChange={onFiles} />
        </label>
      </div>
      {assets.length > 0 && (
        <div className="mt-3 flex items-center justify-between rounded bg-muted/40 px-2 py-1 text-xs">
          <span>{assets.length} รูปพร้อมส่ง</span>
          <button type="button" className="text-red-600" onClick={onClear}>ล้าง</button>
        </div>
      )}
    </div>
  );
}

function RequestDetail({
  detail,
  canReview,
  submitting,
  reviewNote,
  responseNote,
  editFields,
  responseAssets,
  onReviewNote,
  onResponseNote,
  onEditFields,
  onFiles,
  onClearAssets,
  onDecision,
  onDraftSave,
  onRegenerate,
  onExport,
  onRespond,
}: {
  detail: SignRequestDetail | null;
  canReview: boolean;
  submitting: boolean;
  reviewNote: string;
  responseNote: string;
  editFields: { headline: string; promotion: string };
  responseAssets: SignAssetInput[];
  onReviewNote: (value: string) => void;
  onResponseNote: (value: string) => void;
  onEditFields: (value: { headline: string; promotion: string }) => void;
  onFiles: (e: ChangeEvent<HTMLInputElement>) => void;
  onClearAssets: () => void;
  onDecision: (decision: 'approve' | 'reject' | 'need_more_info') => Promise<void>;
  onDraftSave: () => Promise<void>;
  onRegenerate: () => Promise<void>;
  onExport: () => Promise<void>;
  onRespond: () => Promise<void>;
}) {
  if (!detail) {
    return (
      <Card className="min-h-[520px]">
        <CardContent className="flex h-[520px] flex-col items-center justify-center text-center text-muted-foreground">
          <FileImage className="mb-3 h-10 w-10 opacity-40" />
          <p className="font-medium">เลือกคำขอเพื่อดูรายละเอียด</p>
          <p className="text-sm">หรือส่งคำขอใหม่เพื่อให้ AI สร้าง Draft ป้าย</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-3">
          <div>
            <CardTitle className="text-lg">{detail.productName}</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">{detail.requestNo} • {detail.branchName} • {detail.requesterName}</p>
          </div>
          <StatusBadge status={detail.status} />
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
            <Info label="SKU" value={detail.sku || '-'} />
            <Info label="ราคา" value={detail.price != null ? `฿${detail.price}` : '-'} />
            <Info label="ประเภท" value={SIGN_TYPES.find((t) => t.id === detail.signType)?.label ?? detail.signType} />
            <Info label="ขนาด" value={SIGN_SIZES.find((s) => s.id === detail.signSize)?.label ?? detail.signSize} />
          </div>
          {detail.statusNote && <p className="rounded-lg bg-muted/50 px-3 py-2 text-sm text-muted-foreground">{detail.statusNote}</p>}
          {detail.notes && <p className="text-sm whitespace-pre-wrap">{detail.notes}</p>}
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Draft Preview</CardTitle>
          </CardHeader>
          <CardContent>
            {detail.latestDraft ? (
              <div className="space-y-3">
                <div className="overflow-hidden rounded-xl border bg-white">
                  <img src={resolveSignUrl(detail.latestDraft.previewUrl)} alt="Sign draft preview" className="w-full object-contain" />
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" size="sm" onClick={() => void onRegenerate()} disabled={submitting || !canReview}>
                    <Sparkles className="mr-2 h-4 w-4" />
                    สร้างใหม่
                  </Button>
                  {detail.exports.map((file) => (
                    <a key={file.id} href={resolveSignUrl(file.url)} target="_blank" rel="noreferrer" className="inline-flex h-9 items-center rounded-md border px-3 text-sm hover:bg-muted">
                      <Download className="mr-2 h-4 w-4" />
                      {file.format.toUpperCase()}
                    </a>
                  ))}
                  {detail.status === 'approved' && canReview && (
                    <Button size="sm" onClick={() => void onExport()} disabled={submitting}>
                      <Download className="mr-2 h-4 w-4" />
                      Export
                    </Button>
                  )}
                </div>
              </div>
            ) : (
              <p className="py-12 text-center text-sm text-muted-foreground">ยังไม่มี Draft</p>
            )}
          </CardContent>
        </Card>

        <div className="space-y-4">
          {canReview && detail.latestDraft && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Marketing Edit</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Field label="Headline">
                  <Input value={editFields.headline} onChange={(e) => onEditFields({ ...editFields, headline: e.target.value })} />
                </Field>
                <Field label="Promotion">
                  <Input value={editFields.promotion} onChange={(e) => onEditFields({ ...editFields, promotion: e.target.value })} />
                </Field>
                <Button variant="outline" className="w-full" onClick={() => void onDraftSave()} disabled={submitting}>
                  บันทึก Draft ใหม่
                </Button>
              </CardContent>
            </Card>
          )}

          {canReview && detail.status === 'pending_review' && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Approval Decision</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <textarea className="min-h-[84px] w-full rounded-md border bg-background px-3 py-2 text-sm" placeholder="หมายเหตุสำหรับ Reject / Need More Info" value={reviewNote} onChange={(e) => onReviewNote(e.target.value)} />
                <div className="grid gap-2">
                  <Button className="gap-2 bg-green-600 hover:bg-green-700" onClick={() => void onDecision('approve')} disabled={submitting}>
                    <CheckCircle2 className="h-4 w-4" /> Approve
                  </Button>
                  <Button variant="outline" className="gap-2 border-orange-300 text-orange-700" onClick={() => void onDecision('need_more_info')} disabled={submitting}>
                    <MessageSquareWarning className="h-4 w-4" /> Need More Info
                  </Button>
                  <Button variant="outline" className="gap-2 border-red-300 text-red-700" onClick={() => void onDecision('reject')} disabled={submitting}>
                    <XCircle className="h-4 w-4" /> Reject
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {detail.status === 'need_more_info' && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">ตอบกลับข้อมูลเพิ่มเติม</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <textarea className="min-h-[84px] w-full rounded-md border bg-background px-3 py-2 text-sm" value={responseNote} onChange={(e) => onResponseNote(e.target.value)} placeholder="เพิ่มรายละเอียดหรือคำอธิบายให้ Marketing" />
                <AssetPicker assets={responseAssets} onFiles={onFiles} onClear={onClearAssets} />
                <Button className="w-full" onClick={() => void onRespond()} disabled={submitting || !responseNote.trim()}>
                  ส่งกลับเข้าตรวจ
                </Button>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="text-base">AI Extraction</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {detail.aiResult ? (
                <>
                  <Info label="Headline" value={detail.aiResult.headline ?? '-'} />
                  <Info label="Product" value={detail.aiResult.extractedProductName ?? '-'} />
                  <Info label="Price" value={detail.aiResult.extractedPrice ?? '-'} />
                  <Info label="Promotion" value={detail.aiResult.extractedPromotion ?? '-'} />
                  {detail.aiResult.benefits?.length ? (
                    <ul className="list-disc pl-5 text-muted-foreground">
                      {detail.aiResult.benefits.map((b) => <li key={b}>{b}</li>)}
                    </ul>
                  ) : null}
                </>
              ) : <p className="text-muted-foreground">ยังไม่มีผล AI</p>}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">รูปต้นทาง</CardTitle>
            </CardHeader>
            <CardContent>
              {detail.assets.length === 0 ? (
                <p className="text-sm text-muted-foreground">ไม่มีรูปแนบ</p>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  {detail.assets.map((asset) => (
                    <a key={asset.id} href={resolveSignUrl(asset.url)} target="_blank" rel="noreferrer" className="overflow-hidden rounded border bg-muted">
                      <img src={resolveSignUrl(asset.url)} alt={asset.kind} className="h-28 w-full object-cover" />
                    </a>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-medium">{value}</p>
    </div>
  );
}

function SkuProductSearch({
  sku,
  searching,
  suggestions,
  open,
  selected,
  onSkuChange,
  onSelect,
  onClear,
  onApplyPromo,
}: {
  sku: string;
  searching: boolean;
  suggestions: ProductCatalogItem[];
  open: boolean;
  selected: ProductCatalogItem | null;
  onSkuChange: (sku: string) => void;
  onSelect: (item: ProductCatalogItem) => void;
  onClear: () => void;
  onApplyPromo: (promo: NonNullable<ProductCatalogItem['promotions']>[number]) => void;
}) {
  const money = (n: number) => n.toLocaleString('th-TH', { maximumFractionDigits: 0 });

  return (
    <div className="space-y-2">
      <Label>SKU / ค้นหาสินค้า</Label>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={sku}
          onChange={(e) => onSkuChange(e.target.value)}
          onFocus={() => suggestions.length > 0 && onSkuChange(sku)}
          placeholder="พิมพ์ SKU หรือชื่อสินค้า..."
          className="pl-9 pr-9"
        />
        {(searching || sku) && (
          <div className="absolute right-2 top-1/2 -translate-y-1/2">
            {searching ? (
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            ) : (
              <button type="button" className="text-muted-foreground hover:text-foreground" onClick={onClear}>×</button>
            )}
          </div>
        )}
        {open && suggestions.length > 0 && !selected && (
          <div className="absolute z-20 mt-1 max-h-64 w-full overflow-auto rounded-lg border bg-background shadow-lg">
            {suggestions.map((item) => (
              <button
                key={item.sku}
                type="button"
                className="flex w-full items-center gap-3 border-b px-3 py-2 text-left last:border-0 hover:bg-muted/50"
                onClick={() => onSelect(item)}
              >
                <div className="h-10 w-10 shrink-0 overflow-hidden rounded-md border bg-muted">
                  {item.imageUrl ? (
                    <img src={item.imageUrl} alt={item.name} className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-[10px] text-muted-foreground">ไม่มีรูป</div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{item.name}</p>
                  <p className="text-xs text-muted-foreground">{item.sku} · ฿{money(item.retailPrice)}</p>
                </div>
                {item.lowestPromoPrice != null && (
                  <span className="shrink-0 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-800">
                    โปร ฿{money(item.lowestPromoPrice)}
                  </span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {selected && (
        <div className="rounded-lg border bg-muted/20 p-3 space-y-3">
          <div className="flex gap-3">
            <div className="h-20 w-20 shrink-0 overflow-hidden rounded-lg border bg-white">
              {selected.imageUrl ? (
                <img src={selected.imageUrl} alt={selected.name} className="h-full w-full object-contain" />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-xs text-muted-foreground">ไม่มีรูป</div>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-semibold leading-tight">{selected.name}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{selected.sku} · {selected.category || '-'}</p>
              <div className="mt-2 flex flex-wrap gap-2 text-sm">
                <span className="rounded-md bg-white px-2 py-0.5 border font-medium">ราคาขาย ฿{money(selected.retailPrice)}</span>
                {selected.lowestPromoPrice != null && (
                  <span className="rounded-md bg-amber-50 px-2 py-0.5 border border-amber-200 text-amber-800 font-medium">
                    โปรต่ำสุด ฿{money(selected.lowestPromoPrice)}
                  </span>
                )}
              </div>
            </div>
          </div>

          {selected.promotions && selected.promotions.length > 0 ? (
            <div>
              <p className="text-xs font-semibold text-muted-foreground mb-1.5">โปรโมชั่นแต่ละ Step — คลิกเพื่อใช้ราคานี้</p>
              <div className="space-y-1.5">
                {selected.promotions.map((promo, idx) => (
                  <button
                    key={promo.id}
                    type="button"
                    onClick={() => onApplyPromo(promo)}
                    className="flex w-full items-center justify-between gap-2 rounded-md border bg-white px-2.5 py-2 text-left text-sm hover:border-primary/40 hover:bg-primary/5"
                  >
                    <div className="min-w-0">
                      <p className="font-medium truncate">
                        <span className="mr-1.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-violet-100 text-[10px] font-bold text-violet-700">{idx + 1}</span>
                        {promo.name}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {promo.typeName || promo.type}
                        {promo.conditions ? ` · ${promo.conditions}` : ''}
                        {promo.remainingGpPct != null ? ` · GP ${promo.remainingGpPct.toFixed(1)}%` : ''}
                      </p>
                    </div>
                    <span className="shrink-0 font-bold text-red-600 tabular-nums">฿{money(promo.promoPrice)}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">ไม่มีโปรโมชั่น active สำหรับ SKU นี้</p>
          )}
        </div>
      )}
    </div>
  );
}

function SignSizePicker({ value, onChange }: { value: SignSize; onChange: (s: SignSize) => void }) {
  return (
    <div className="grid grid-cols-4 gap-2">
      {SIGN_SIZES.map((s) => {
        const active = value === s.id;
        return (
          <button
            key={s.id}
            type="button"
            onClick={() => onChange(s.id)}
            className={`flex flex-col items-center rounded-lg border-2 px-1 py-2 transition
              ${active ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/40 hover:bg-muted/40'}`}
          >
            <div className="flex items-end justify-center" style={{ height: 60 }}>
              <div
                className={`rounded-sm border-2 transition
                  ${active ? 'border-primary bg-primary/20' : 'border-muted-foreground/40 bg-muted/60'}`}
                style={{ width: s.w, height: s.h }}
              />
            </div>
            <p className={`mt-1.5 text-[11px] font-semibold leading-tight ${active ? 'text-primary' : 'text-foreground'}`}>{s.label}</p>
            <p className="text-[9px] text-muted-foreground leading-tight">{s.sub}</p>
          </button>
        );
      })}
    </div>
  );
}

function TemplatesPanel({
  templates,
  loading,
  onUpload,
  onDelete,
}: {
  templates: SignTemplateRecord[];
  loading: boolean;
  onUpload: (e: ChangeEvent<HTMLInputElement>, signType?: SignType, signSize?: SignSize) => Promise<void>;
  onDelete: (id: number) => Promise<void>;
}) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <div>
            <CardTitle className="text-base">Templates พื้นหลัง</CardTitle>
            <p className="mt-0.5 text-xs text-muted-foreground">อัปโหลดภาพพื้นหลัง PNG — ระบบจะ overlay ข้อความสินค้าและราคาทับอัตโนมัติ</p>
          </div>
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90">
            <ImagePlus className="h-3.5 w-3.5" />
            อัปโหลดใหม่
            <input type="file" accept="image/png,image/jpeg" className="hidden" onChange={(e) => void onUpload(e)} />
          </label>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> กำลังโหลด...
          </div>
        ) : templates.length === 0 ? (
          <div className="rounded-xl border border-dashed py-16 text-center text-sm text-muted-foreground">
            <ImagePlus className="mx-auto mb-2 h-8 w-8 opacity-30" />
            <p>ยังไม่มี Template</p>
            <p className="text-xs mt-1">อัปโหลด PNG พื้นหลังเพื่อใช้แทน Template เริ่มต้น</p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {templates.map((tpl) => (
              <div key={tpl.id} className="group relative overflow-hidden rounded-xl border bg-muted/20">
                <div className="aspect-[3/4] overflow-hidden bg-muted">
                  <img src={resolveSignUrl(tpl.url)} alt={tpl.name} className="h-full w-full object-cover" />
                </div>
                <div className="p-2">
                  <p className="text-sm font-medium leading-tight">{tpl.name}</p>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {tpl.signType && (
                      <span className="rounded bg-blue-100 px-1.5 py-0.5 text-[10px] font-medium text-blue-700">
                        {SIGN_TYPES.find((t) => t.id === tpl.signType)?.label ?? tpl.signType}
                      </span>
                    )}
                    {tpl.signSize && (
                      <span className="rounded bg-violet-100 px-1.5 py-0.5 text-[10px] font-medium text-violet-700">
                        {SIGN_SIZES.find((s) => s.id === tpl.signSize)?.label ?? tpl.signSize}
                      </span>
                    )}
                    {!tpl.signType && !tpl.signSize && (
                      <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-600">ใช้กับทุกขนาด</span>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  className="absolute right-1.5 top-1.5 hidden rounded-full bg-red-600 p-1 text-white shadow group-hover:flex"
                  onClick={() => void onDelete(tpl.id)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="mt-6">
          <p className="mb-3 text-sm font-semibold text-muted-foreground">อัปโหลดตาม Type × Size</p>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {SIGN_TYPES.flatMap((type) =>
              SIGN_SIZES.map((size) => (
                <label
                  key={`${type.id}-${size.id}`}
                  className="flex cursor-pointer items-center gap-2 rounded-lg border border-dashed p-2.5 text-xs hover:bg-muted/40"
                >
                  <ImagePlus className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <span className="font-medium">{type.label}</span>
                  <span className="text-muted-foreground">×</span>
                  <span>{size.label}</span>
                  <input
                    type="file"
                    accept="image/png,image/jpeg"
                    className="hidden"
                    onChange={(e) => void onUpload(e, type.id, size.id)}
                  />
                </label>
              ))
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

async function fileToAsset(file: File, index: number): Promise<SignAssetInput> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
  const kinds = ['product', 'current_sign', 'shelf', 'other'] as const;
  return { kind: kinds[index] ?? 'other', dataUrl, originalName: file.name };
}
