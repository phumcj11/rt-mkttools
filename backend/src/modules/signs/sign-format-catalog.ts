import { SignSize, SignType } from '../../database/entities';

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

const STANDING_SIZES: { id: SignSize; label: string }[] = [
  { id: 'a5', label: 'ใหญ่ A5' },
  { id: 'a6', label: 'กลาง A6' },
  { id: 'a7', label: 'เล็ก A7' },
];

function standingFormats(
  signType: SignType,
  typeLabel: string,
  slots: SignSlot[],
  branchRequired: BranchInputField[],
  branchOptional: BranchInputField[],
  aiFillSlots: SignSlot[],
): SignFormatDefinition[] {
  return STANDING_SIZES.map(({ id, label }) => ({
    id: `${signType}_${id}`,
    label: `${typeLabel} · ${label}`,
    signType,
    signSize: id,
    orientation: 'portrait' as const,
    slots,
    branchRequired,
    branchOptional,
    aiFillSlots,
  }));
}

export const SIGN_FORMAT_CATALOG: SignFormatDefinition[] = [
  {
    id: 'shelf_edge',
    label: 'ป้ายติดขอบชั้น · 8×5 ซม.',
    signType: 'shelf_tag',
    signSize: 'shelf_tag',
    orientation: 'landscape',
    slots: ['productImage', 'productName', 'price'],
    branchRequired: ['productName', 'price'],
    branchOptional: ['sku', 'notes', 'assets'],
    aiFillSlots: [],
  },
  ...standingFormats(
    'price_tag',
    'ป้ายราคา',
    ['productImage', 'productName', 'price', 'headline'],
    ['productName', 'price'],
    ['sku', 'headline', 'promotion', 'notes', 'assets'],
    ['headline'],
  ),
  ...standingFormats(
    'promotion',
    'ป้ายโปร',
    ['productImage', 'productName', 'price', 'headline', 'promotion'],
    ['productName', 'price', 'promotion'],
    ['sku', 'headline', 'notes', 'assets'],
    ['headline'],
  ),
  ...standingFormats(
    'benefit_card',
    'ป้ายสรรพคุณ',
    ['productImage', 'productName', 'price', 'headline', 'benefits'],
    ['productName', 'price'],
    ['sku', 'headline', 'benefits', 'notes', 'assets'],
    ['headline', 'benefits'],
  ),
];

export function listSignFormats(): SignFormatDefinition[] {
  return SIGN_FORMAT_CATALOG;
}

export function getSignFormat(id: string): SignFormatDefinition | undefined {
  return SIGN_FORMAT_CATALOG.find((f) => f.id === id);
}

export function getSignFormatByTypeSize(signType: SignType, signSize: SignSize): SignFormatDefinition | undefined {
  return SIGN_FORMAT_CATALOG.find((f) => f.signType === signType && f.signSize === signSize);
}

export const SLOT_LABELS: Record<SignSlot, string> = {
  productImage: 'รูปสินค้า',
  productName: 'ชื่อสินค้า',
  price: 'ราคา',
  headline: 'หัวข้อ',
  promotion: 'โปรโมชั่น',
  benefits: 'จุดเด่น',
};

export const BRANCH_FIELD_LABELS: Record<BranchInputField, string> = {
  branchName: 'สาขา',
  requesterName: 'ผู้ขอ',
  sku: 'SKU',
  productName: 'ชื่อสินค้า',
  price: 'ราคา',
  promotion: 'โปรโมชั่น',
  headline: 'หัวข้อ',
  benefits: 'จุดเด่น',
  notes: 'หมายเหตุ',
  assets: 'รูปหน้างาน',
};
