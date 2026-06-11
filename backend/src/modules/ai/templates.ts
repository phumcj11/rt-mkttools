export type GenerateContentType =
  | 'caption'
  | 'post'
  | 'ad'
  | 'line_broadcast'
  | 'fb_post'
  | 'tiktok_caption'
  | 'tiktok_script'
  | 'instagram'
  | 'gbp_post'
  | 'seo_article'
  | 'product_desc'
  | 'ugc_script'
  | 'rewrite'
  | 'translate'
  | 'hashtag';

export type ContentTone = 'friendly' | 'fun' | 'professional' | 'urgent';

export interface TemplateDef {
  key: GenerateContentType;
  labelTh: string;
  labelEn: string;
  descriptionTh: string;
  descriptionEn: string;
  group: 'social' | 'platform' | 'seo' | 'tools';
}

export const CONTENT_TEMPLATES: TemplateDef[] = [
  // Social
  {
    key: 'caption',
    labelTh: 'แคปชั่นโซเชียล',
    labelEn: 'Social Caption',
    descriptionTh: 'แคปชั่นสั้น กระชับ พร้อมแฮชแท็กและอีโมจิ',
    descriptionEn: 'Short, catchy caption with hashtags and emojis',
    group: 'social',
  },
  {
    key: 'post',
    labelTh: 'โพสต์โซเชียลทั่วไป',
    labelEn: 'Social Post',
    descriptionTh: 'โพสต์ขายของความยาวปานกลาง',
    descriptionEn: 'Medium-length sales post',
    group: 'social',
  },
  {
    key: 'ad',
    labelTh: 'ข้อความโฆษณา',
    labelEn: 'Ad Copy',
    descriptionTh: 'ข้อความโฆษณาเน้นขาย มี CTA',
    descriptionEn: 'Persuasive ad copy with CTA',
    group: 'social',
  },
  // Platform-specific
  {
    key: 'fb_post',
    labelTh: 'Facebook Post',
    labelEn: 'Facebook Post',
    descriptionTh: 'โพสต์ Facebook เน้น engagement',
    descriptionEn: 'Engagement-focused Facebook post',
    group: 'platform',
  },
  {
    key: 'tiktok_caption',
    labelTh: 'TikTok Caption',
    labelEn: 'TikTok Caption',
    descriptionTh: 'แคปชั่น TikTok พร้อม trending hashtags',
    descriptionEn: 'TikTok caption with trending hashtags',
    group: 'platform',
  },
  {
    key: 'tiktok_script',
    labelTh: 'TikTok Script',
    labelEn: 'TikTok Script',
    descriptionTh: 'สคริปต์วิดีโอ TikTok 30-60 วินาที',
    descriptionEn: '30-60 second TikTok video script',
    group: 'platform',
  },
  {
    key: 'instagram',
    labelTh: 'Instagram Caption',
    labelEn: 'Instagram Caption',
    descriptionTh: 'แคปชั่น Instagram สวยงาม มี hashtags',
    descriptionEn: 'Aesthetic Instagram caption with hashtags',
    group: 'platform',
  },
  {
    key: 'line_broadcast',
    labelTh: 'LINE Broadcast',
    labelEn: 'LINE Broadcast',
    descriptionTh: 'ข้อความส่งหาลูกค้าผ่าน LINE OA',
    descriptionEn: 'Message for LINE Official Account',
    group: 'platform',
  },
  {
    key: 'gbp_post',
    labelTh: 'Google Business Post',
    labelEn: 'Google Business Post',
    descriptionTh: 'โพสต์บน Google Business Profile',
    descriptionEn: 'Google Business Profile post',
    group: 'platform',
  },
  // SEO / Long-form
  {
    key: 'seo_article',
    labelTh: 'บทความ SEO',
    labelEn: 'SEO Article',
    descriptionTh: 'บทความ SEO เพิ่ม organic traffic',
    descriptionEn: 'SEO-optimized article for organic traffic',
    group: 'seo',
  },
  {
    key: 'product_desc',
    labelTh: 'คำอธิบายสินค้า',
    labelEn: 'Product Description',
    descriptionTh: 'คำอธิบายสินค้าสำหรับเว็บไซต์/มาร์เก็ตเพลส',
    descriptionEn: 'Product description for website/marketplace',
    group: 'seo',
  },
  {
    key: 'ugc_script',
    labelTh: 'UGC Script',
    labelEn: 'UGC Script',
    descriptionTh: 'สคริปต์รีวิวสินค้าแบบผู้ใช้จริง',
    descriptionEn: 'User-generated content style review script',
    group: 'seo',
  },
  // Tools
  {
    key: 'rewrite',
    labelTh: 'Rewrite คอนเทนต์เดิม',
    labelEn: 'Rewrite Content',
    descriptionTh: 'ปรับภาษาและโทนคอนเทนต์ที่มีอยู่แล้ว',
    descriptionEn: 'Rewrite and improve existing content',
    group: 'tools',
  },
  {
    key: 'translate',
    labelTh: 'แปลภาษา (TH↔EN)',
    labelEn: 'Translate (TH↔EN)',
    descriptionTh: 'แปลคอนเทนต์ระหว่างไทยและอังกฤษ',
    descriptionEn: 'Translate content between Thai and English',
    group: 'tools',
  },
  {
    key: 'hashtag',
    labelTh: 'สร้าง Hashtags',
    labelEn: 'Generate Hashtags',
    descriptionTh: 'สร้างชุด hashtags สำหรับสินค้า',
    descriptionEn: 'Generate relevant hashtag sets for your product',
    group: 'tools',
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
  line_broadcast: 'เขียนข้อความ LINE Broadcast แบบเป็นกันเอง ทักทายลูกค้า แนะนำสินค้า/โปรโมชั่น และเชิญชวนแวะร้าน',
  fb_post: 'เขียน Facebook Post ที่ดึงดูด engagement มี hook ในย่อหน้าแรก อธิบายจุดเด่นสินค้า ราคา และ CTA แบบ conversational',
  tiktok_caption: 'เขียนแคปชั่น TikTok แบบสั้น hook ดี มี trending hashtags ภาษาไทยอย่างน้อย 5-8 อัน และ CTA ชวน follow/comment',
  tiktok_script: 'เขียนสคริปต์วิดีโอ TikTok ความยาว 30-60 วินาที แบ่งเป็น: Hook (3วิ), เนื้อหา (20-50วิ), CTA (5วิ) พร้อมข้อความ caption',
  instagram: 'เขียนแคปชั่น Instagram ที่สวยงาม storytelling เบา ๆ มีอีโมจิ และ hashtags 10-15 อัน แบ่งกลุ่ม niche + brand',
  gbp_post: 'เขียนโพสต์ Google Business Profile (400-1500 ตัวอักษร) แนะนำสินค้า/โปรโมชั่น เน้น local SEO และ CTA ชวนแวะร้าน',
  seo_article: 'เขียนบทความ SEO ภาษาไทย 300-500 คำ เกี่ยวกับสินค้า มีคำค้นหาตลอดเนื้อหา มี subheading และ conclusion',
  product_desc: 'เขียนคำอธิบายสินค้าสำหรับเว็บไซต์/มาร์เก็ตเพลส บอกจุดเด่น คุณสมบัติ วิธีใช้ และทำไมต้องซื้อ',
  ugc_script: 'เขียนสคริปต์รีวิวสินค้าแบบผู้ใช้จริง (UGC) เสมือนลูกค้าจริงรีวิว ฟังดูเป็นธรรมชาติ ไม่โฆษณาเกินจริง',
  rewrite: 'ปรับภาษา โทน และโครงสร้างของคอนเทนต์ที่ให้มาใน "รายละเอียด" ให้ดีขึ้น กระชับขึ้น และน่าอ่านขึ้น',
  translate: 'แปลคอนเทนต์ที่ให้มาใน "รายละเอียด" จากภาษาไทยเป็นอังกฤษ หรืออังกฤษเป็นไทย ตามที่ระบุในรายละเอียด',
  hashtag: 'สร้างชุด hashtags 3 กลุ่ม: (1) Niche/Topic 5 อัน (2) Brand/Product 5 อัน (3) Trending Thai 5 อัน รวม 15 hashtags',
};

const TYPE_INSTRUCTION_EN: Record<GenerateContentType, string> = {
  caption: 'Write a short caption (2-3 lines) with emojis and 3-5 relevant hashtags.',
  post: 'Write a medium-length sales post (3-5 sentences) highlighting the product and ending with a call to buy.',
  ad: 'Write persuasive ad copy with a catchy headline, key selling points and a clear call to action.',
  line_broadcast: 'Write a friendly LINE broadcast message greeting the customer, introducing the product/promotion and inviting them to visit the shop.',
  fb_post: 'Write a Facebook post with an engaging hook, product highlights, price, and a conversational CTA.',
  tiktok_caption: 'Write a short TikTok caption with a good hook, 5-8 trending hashtags, and CTA to follow/comment.',
  tiktok_script: 'Write a 30-60 second TikTok video script: Hook (3s), Content (20-50s), CTA (5s) plus caption text.',
  instagram: 'Write an Instagram caption with light storytelling, emojis, and 10-15 hashtags in niche + brand groups.',
  gbp_post: 'Write a Google Business Profile post (400-1500 chars) with local SEO focus and a visit CTA.',
  seo_article: 'Write a 300-500 word SEO article about the product with keyword usage, subheadings and a conclusion.',
  product_desc: 'Write a product description for a website/marketplace highlighting features, benefits and why to buy.',
  ugc_script: 'Write a natural-sounding user-generated review script as if from a real customer.',
  rewrite: 'Rewrite and improve the content provided in "Details" to be more engaging, concise and effective.',
  translate: 'Translate the content in "Details" between Thai and English as specified.',
  hashtag: 'Generate 3 groups of hashtags: (1) Niche/Topic x5, (2) Brand/Product x5, (3) Trending x5 = 15 total.',
};

export function buildSystemPrompt(locale: string): string {
  if (locale === 'en') {
    return [
      'You are a professional marketing copywriter for a Thai "100 Baht Shop" (everyday low-price retail, multiple branches).',
      'Write engaging, ready-to-publish content that drives sales and fits each platform.',
      'Keep language concise, friendly and suitable for Thai social media audiences.',
      'Respond ONLY with the final content, no explanations.',
    ].join(' ');
  }
  return [
    'คุณเป็นนักเขียนคอนเทนต์การตลาดมืออาชีพสำหรับ "ร้าน 100 บาท" (100 Baht Shop Thailand, สินค้าราคาประหยัด หลายสาขา)',
    'เขียนคอนเทนต์ที่น่าสนใจ พร้อมโพสต์ได้ทันที เหมาะกับแต่ละแพลตฟอร์ม และช่วยกระตุ้นยอดขาย',
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
      input.details ? `Details/Content to process: ${input.details}` : '',
      `Tone: ${tone}`,
      'Language: English',
    ];
    return parts.filter(Boolean).join('\n');
  }

  const parts = [
    TYPE_INSTRUCTION_TH[input.type],
    `สินค้า/หัวข้อ: ${input.productName}`,
    input.price !== undefined ? `ราคา: ${input.price} บาท` : '',
    input.details ? `รายละเอียดเพิ่มเติม/คอนเทนต์ที่ต้องการ: ${input.details}` : '',
    `โทนการเขียน: ${TONE_TH[tone]}`,
    'ภาษา: ไทย',
  ];
  return parts.filter(Boolean).join('\n');
}
