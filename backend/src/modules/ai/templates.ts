export type GenerateContentType = 'caption' | 'post' | 'ad' | 'line_broadcast';
export type ContentTone = 'friendly' | 'fun' | 'professional' | 'urgent';

export interface TemplateDef {
  key: GenerateContentType;
  labelTh: string;
  labelEn: string;
  descriptionTh: string;
  descriptionEn: string;
}

export const CONTENT_TEMPLATES: TemplateDef[] = [
  {
    key: 'caption',
    labelTh: 'แคปชั่นโซเชียล',
    labelEn: 'Social Caption',
    descriptionTh: 'แคปชั่นสั้น กระชับ พร้อมแฮชแท็กและอีโมจิ',
    descriptionEn: 'Short, catchy caption with hashtags and emojis',
  },
  {
    key: 'post',
    labelTh: 'โพสต์โซเชียล',
    labelEn: 'Social Post',
    descriptionTh: 'โพสต์ขายของบนเฟซบุ๊ก/ไอจี ความยาวปานกลาง',
    descriptionEn: 'Medium-length sales post for Facebook/Instagram',
  },
  {
    key: 'ad',
    labelTh: 'ข้อความโฆษณา',
    labelEn: 'Ad Copy',
    descriptionTh: 'ข้อความโฆษณาเน้นขาย มีคำกระตุ้นให้ซื้อ (CTA)',
    descriptionEn: 'Persuasive ad copy with a strong call to action',
  },
  {
    key: 'line_broadcast',
    labelTh: 'ข้อความ LINE Broadcast',
    labelEn: 'LINE Broadcast',
    descriptionTh: 'ข้อความส่งหาลูกค้าผ่าน LINE OA เป็นกันเอง',
    descriptionEn: 'Friendly broadcast message for LINE Official Account',
  },
];

export interface GenerateInput {
  type: GenerateContentType;
  productName: string;
  price?: number;
  details?: string;
  tone?: ContentTone;
  locale?: string;
}

const TONE_TH: Record<ContentTone, string> = {
  friendly: 'เป็นกันเอง อบอุ่น',
  fun: 'สนุกสนาน มีอารมณ์ขัน',
  professional: 'มืออาชีพ น่าเชื่อถือ',
  urgent: 'เร่งด่วน กระตุ้นให้รีบซื้อ',
};

const TYPE_INSTRUCTION_TH: Record<GenerateContentType, string> = {
  caption: 'เขียนแคปชั่นสั้น ๆ ไม่เกิน 2-3 บรรทัด พร้อมอีโมจิและแฮชแท็กที่เกี่ยวข้อง 3-5 อัน',
  post: 'เขียนโพสต์ขายของความยาวปานกลาง (3-5 ประโยค) ดึงดูดความสนใจ บอกจุดเด่นสินค้า และปิดท้ายด้วยคำชวนซื้อ',
  ad: 'เขียนข้อความโฆษณาที่เน้นการขาย มีพาดหัวสะดุดตา จุดเด่นสินค้า และคำกระตุ้นการตัดสินใจ (CTA) ที่ชัดเจน',
  line_broadcast:
    'เขียนข้อความ LINE Broadcast แบบเป็นกันเอง ทักทายลูกค้า แนะนำสินค้า/โปรโมชั่น และเชิญชวนแวะร้าน',
};

const TYPE_INSTRUCTION_EN: Record<GenerateContentType, string> = {
  caption: 'Write a short caption (2-3 lines) with emojis and 3-5 relevant hashtags.',
  post: 'Write a medium-length sales post (3-5 sentences) highlighting the product and ending with a call to buy.',
  ad: 'Write persuasive ad copy with a catchy headline, key selling points and a clear call to action.',
  line_broadcast:
    'Write a friendly LINE broadcast message greeting the customer, introducing the product/promotion and inviting them to visit the shop.',
};

export function buildSystemPrompt(locale: string): string {
  if (locale === 'en') {
    return [
      'You are a professional marketing copywriter for a Thai "100 Baht Shop" (everyday low-price retail).',
      'Write engaging, ready-to-publish content that drives sales.',
      'Keep it concise, friendly and suitable for Thai social media audiences.',
      'Respond ONLY with the final content, no explanations.',
    ].join(' ');
  }
  return [
    'คุณเป็นนักเขียนคอนเทนต์การตลาดมืออาชีพสำหรับ "ร้าน 100 บาท" (สินค้าราคาประหยัด)',
    'เขียนคอนเทนต์ที่น่าสนใจ พร้อมโพสต์ได้ทันที และช่วยกระตุ้นยอดขาย',
    'ใช้ภาษากระชับ เป็นกันเอง เหมาะกับผู้ชมโซเชียลชาวไทย',
    'ตอบกลับเฉพาะเนื้อหาคอนเทนต์เท่านั้น ไม่ต้องมีคำอธิบายเพิ่ม',
  ].join(' ');
}

export function buildUserPrompt(input: GenerateInput): string {
  const locale = input.locale === 'en' ? 'en' : 'th';
  const tone = input.tone ?? 'friendly';

  if (locale === 'en') {
    const parts = [
      TYPE_INSTRUCTION_EN[input.type],
      `Product: ${input.productName}`,
      input.price !== undefined ? `Price: ${input.price} THB` : '',
      input.details ? `Details: ${input.details}` : '',
      `Tone: ${tone}`,
      'Language: English',
    ];
    return parts.filter(Boolean).join('\n');
  }

  const parts = [
    TYPE_INSTRUCTION_TH[input.type],
    `สินค้า: ${input.productName}`,
    input.price !== undefined ? `ราคา: ${input.price} บาท` : '',
    input.details ? `รายละเอียดเพิ่มเติม: ${input.details}` : '',
    `โทนการเขียน: ${TONE_TH[tone]}`,
    'ภาษา: ไทย',
  ];
  return parts.filter(Boolean).join('\n');
}
