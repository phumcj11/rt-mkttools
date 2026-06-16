import { apiRequest } from './api';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? '/api';

export type SignRequestStatus =
  | 'submitted'
  | 'ai_processing'
  | 'pending_review'
  | 'approved'
  | 'rejected'
  | 'need_more_info'
  | 'exported';

export type SignType = 'price_tag' | 'promotion' | 'benefit_card' | 'shelf_tag';
export type SignSize = 'a5' | 'a6' | 'a7' | 'shelf_tag';
export type SignAssetKind = 'product' | 'current_sign' | 'shelf' | 'other';

export interface SignRequestSummary {
  id: number;
  requesterId: number | null;
  requestNo: string;
  branchName: string;
  requesterName: string;
  sku: string | null;
  productName: string;
  price: number | string | null;
  promotion: string | null;
  signType: SignType;
  signSize: SignSize;
  notes: string | null;
  status: SignRequestStatus;
  statusNote: string | null;
  erpCampaignId?: number | null;
  erpCampaignName?: string | null;
  erpStepText?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SignAsset {
  id: number;
  kind: SignAssetKind;
  filename: string;
  url: string;
  originalName: string | null;
  mimeType: string;
  createdAt: string;
}

export interface SignAiResult {
  id: number;
  extractedProductName: string | null;
  extractedPrice: string | null;
  extractedPromotion: string | null;
  headline: string | null;
  benefits: string[] | null;
  rawText: string | null;
  model: string | null;
  createdAt: string;
}

export interface SignDraft {
  id: number;
  version: number;
  templateId: string;
  previewUrl: string;
  editableFields: Record<string, unknown> | null;
  createdAt: string;
}

export interface SignReview {
  id: number;
  decision: 'approve' | 'reject' | 'need_more_info';
  note: string | null;
  editedFields: Record<string, unknown> | null;
  createdAt: string;
}

export interface SignExport {
  id: number;
  format: 'png' | 'pdf';
  filename: string;
  url: string;
  driveUrl: string | null;
  status: 'ready' | 'drive_failed';
  error: string | null;
  createdAt: string;
}

export interface SignRequestDetail extends SignRequestSummary {
  assets: SignAsset[];
  aiResult: SignAiResult | null;
  latestDraft: SignDraft | null;
  reviews: SignReview[];
  exports: SignExport[];
}

export interface SignAssetInput {
  kind: SignAssetKind;
  dataUrl: string;
  originalName?: string;
}

export interface CreateSignRequestDto {
  branchName: string;
  requesterName: string;
  sku?: string;
  productName: string;
  price?: number;
  promotion?: string;
  signType: SignType;
  signSize: SignSize;
  templateId?: number;
  headline?: string;
  benefits?: string;
  notes?: string;
  assets?: SignAssetInput[];
  /** ERP campaign traceability */
  erpCampaignId?: number;
  erpCampaignName?: string;
  erpStepText?: string;
}

export interface SignRequestSummaryFull extends SignRequestSummary {
  erpCampaignId?: number | null;
  erpCampaignName?: string | null;
  erpStepText?: string | null;
}

export function resolveSignUrl(path: string): string {
  if (path.startsWith('data:') || path.startsWith('blob:') || path.startsWith('http')) return path;
  const api = API_URL.replace(/\/$/, '');
  if (path.startsWith('/signs/')) return `${api}${path}`;
  return `${api}/signs/serve/${path.replace(/^\//, '')}`;
}

export function listSignFormats() {
  return apiRequest<SignFormatDefinition[]>('/signs/formats');
}

export type SignSlot = 'productImage' | 'productName' | 'price' | 'headline' | 'promotion' | 'benefits';

export type BranchInputField =
  | 'branchName'
  | 'requesterName'
  | 'sku'
  | 'productName'
  | 'price'
  | 'promotion'
  | 'headline'
  | 'benefits'
  | 'notes'
  | 'assets';

export interface SignFormatDefinition {
  id: string;
  label: string;
  signType: SignType;
  signSize: SignSize;
  orientation: 'portrait' | 'landscape';
  slots: SignSlot[];
  branchRequired: BranchInputField[];
  branchOptional: BranchInputField[];
  aiFillSlots: SignSlot[];
}

export function listSignRequests(status?: SignRequestStatus) {
  const query = status ? `?status=${encodeURIComponent(status)}` : '';
  return apiRequest<SignRequestSummary[]>(`/signs${query}`);
}

export function listSignReviewQueue() {
  return apiRequest<SignRequestSummary[]>('/signs/review-queue');
}

export function getSignRequest(id: number) {
  return apiRequest<SignRequestDetail>(`/signs/${id}`);
}

export function createSignRequest(dto: CreateSignRequestDto) {
  return apiRequest<SignRequestDetail>('/signs', { method: 'POST', body: dto });
}

export function respondSignRequest(id: number, body: { note: string; assets?: SignAssetInput[] }) {
  return apiRequest<SignRequestDetail>(`/signs/${id}/respond`, { method: 'POST', body });
}

export function regenerateSignDraft(id: number) {
  return apiRequest<SignRequestDetail>(`/signs/${id}/regenerate`, { method: 'POST' });
}

export function retrySignDraft(id: number) {
  return apiRequest<SignRequestDetail>(`/signs/${id}/retry`, { method: 'POST' });
}

export function deleteSignRequest(id: number) {
  return apiRequest<{ message: string }>(`/signs/${id}`, { method: 'DELETE' });
}

export function updateSignDraft(id: number, fields: Record<string, unknown>) {
  return apiRequest<SignRequestDetail>(`/signs/${id}/draft`, { method: 'PUT', body: { fields } });
}

export function reviewSignRequest(
  id: number,
  body: { decision: 'approve' | 'reject' | 'need_more_info'; note?: string; editedFields?: Record<string, unknown> },
) {
  return apiRequest<SignRequestDetail>(`/signs/${id}/review`, { method: 'POST', body });
}

export function exportSignRequest(id: number) {
  return apiRequest<SignRequestDetail>(`/signs/${id}/export`, { method: 'POST' });
}

export interface SignTemplateRecord {
  id: number;
  name: string;
  signType: SignType | null;
  signSize: SignSize | null;
  url: string;
  isActive: boolean;
  createdAt: string;
}

export function listSignTemplates() {
  return apiRequest<SignTemplateRecord[]>('/signs/templates');
}

export function uploadSignTemplate(body: { name: string; signType?: SignType; signSize?: SignSize; dataUrl: string }) {
  return apiRequest<SignTemplateRecord>('/signs/templates', { method: 'POST', body });
}

export function deleteSignTemplate(id: number) {
  return apiRequest<{ message: string }>(`/signs/templates/${id}`, { method: 'DELETE' });
}
