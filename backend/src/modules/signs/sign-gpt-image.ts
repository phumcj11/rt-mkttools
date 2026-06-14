import { SignRequest, SignSize } from '../../database/entities';

export type SignImageSize = '1024x1024' | '1024x1536' | '1536x1024';

export interface SignImagePromptFields {
  headline?: unknown;
  productName?: unknown;
  price?: unknown;
  promotion?: unknown;
  benefits?: unknown;
  branchName?: unknown;
  signTypeLabel?: unknown;
  signSizeLabel?: unknown;
}

const LAYOUT_HINTS: Record<SignSize, string> = {
  a5: [
    'Portrait standing shelf sign.',
    'Keep the template composition and branding exactly.',
    'Use large readable Thai headline and price areas.',
    'Place product imagery only inside existing product/photo placeholder areas if present.',
  ].join(' '),
  a6: [
    'Portrait medium standing shelf sign.',
    'Keep the official layout, borders, colors, logo, mascot, and decorative graphics.',
    'Replace placeholder text with the requested product, price, and promotion copy.',
  ].join(' '),
  a7: [
    'Small portrait standing shelf sign.',
    'Preserve layout and simplify text for readability.',
    'Do not invent extra claims beyond the provided copy.',
  ].join(' '),
  shelf_tag: [
    'Landscape shelf-edge price tag.',
    'Keep the exact template layout, branding, barcode zone, price boxes, and promotional blocks.',
    'Replace visible placeholders such as PRODUCT NAME, PRODUCT DESCRIPTION, price boxes, and PRODUCT IMAGE with the provided values.',
  ].join(' '),
};

export function gptImageSizeForSign(signSize: SignSize): SignImageSize {
  return signSize === 'shelf_tag' ? '1536x1024' : '1024x1536';
}

export function craftSignImagePrompt(
  request: SignRequest,
  fields: SignImagePromptFields,
  productVisualHint?: string | null,
): string {
  const benefits = Array.isArray(fields.benefits)
    ? fields.benefits.map((value) => String(value).trim()).filter(Boolean)
    : [];
  const data = {
    productName: String(fields.productName ?? request.productName),
    headline: String(fields.headline ?? ''),
    price: String(fields.price ?? (request.price != null ? `฿${request.price}` : '')),
    promotion: String(fields.promotion ?? request.promotion ?? ''),
    benefits,
  };

  return [
    'You are editing an official Thai retail sign TEMPLATE image.',
    'Use GPT Image EDIT mode with the provided template image as the source.',
    '',
    'Critical instructions:',
    '- KEEP the exact template layout, aspect ratio, brand colors, logo, mascot, barcode area, borders, icons, and decorative elements.',
    '- DO NOT redesign the template from scratch.',
    '- Replace placeholder text and placeholder image areas with the customer-facing data below only.',
    '- NEVER print internal codes, request numbers, SKU, branch names, or system metadata on the sign.',
    '- NEVER redraw or invent barcodes — leave existing barcode graphics untouched.',
    '- Remove placeholder labels such as PRODUCT NAME, PRODUCT DESCRIPTION, PRODUCT IMAGE, and empty price-box examples when replacing them.',
    '- Render Thai text clearly and as large/readable as the template allows.',
    '- Do not add medical claims, discount claims, or extra promotions that are not present in the data.',
    '- If a product image placeholder exists, render the product packaging there using the product reference hint.',
    '',
    `Layout hint: ${LAYOUT_HINTS[request.signSize]}`,
    '',
    'Exact data to put on the sign:',
    JSON.stringify(data, null, 2),
    '',
    productVisualHint?.trim()
      ? `Product visual reference: ${productVisualHint.trim()}`
      : 'Product visual reference: Use the product name and SKU only. If unsure, keep the product image area clean and product-like without inventing brand details.',
    '',
    'Final output: one clean production-ready sign image based on the template. No mockup, no shelf background.',
  ].join('\n');
}
