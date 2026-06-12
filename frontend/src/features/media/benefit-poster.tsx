'use client';

import type { ErpProduct } from '@/lib/media-api';

export type PosterLayout = 'classic' | 'story' | 'minimal' | 'bold' | 'ai_gpt';

export interface PosterLayoutOption {
  id: PosterLayout;
  label: string;
  description: string;
  ratio: string;
  width: number;
  height: number;
}

export const POSTER_LAYOUTS: PosterLayoutOption[] = [
  {
    id: 'classic',
    label: 'Classic',
    description: 'รูปซ้าย + สรรพคุณขวา (1:1)',
    ratio: '1:1',
    width: 1080,
    height: 1080,
  },
  {
    id: 'story',
    label: 'Story',
    description: 'แนวตั้ง Instagram/TikTok (9:16)',
    ratio: '9:16',
    width: 1080,
    height: 1920,
  },
  {
    id: 'minimal',
    label: 'Minimal',
    description: 'รูปใหญ่ด้านบน + ข้อความด้านล่าง',
    ratio: '1:1',
    width: 1080,
    height: 1080,
  },
  {
    id: 'bold',
    label: 'Bold Sale',
    description: 'เน้นราคา + สรรพคุณพื้นดำ',
    ratio: '1:1',
    width: 1080,
    height: 1080,
  },
  {
    id: 'ai_gpt',
    label: 'AI Generate',
    description: 'GPT Image — AI สร้างโปสเตอร์จากรูป ERP (~15-30 วิ)',
    ratio: '1:1',
    width: 1024,
    height: 1024,
  },
];

export interface BenefitPosterData {
  productName: string;
  price: string;
  category: string;
  imageUrl: string;
  benefitLines: string[];
}

const FONT = "'Kanit', var(--font-kanit), sans-serif";

function parseBenefitLines(benefits: string): string[] {
  return benefits
    .split('\n')
    .map((l) => l.replace(/^\d+[\.\)]\s*/, '').trim())
    .filter((l) => l.length > 3)
    .slice(0, 5);
}

export function buildPosterData(
  product: ErpProduct,
  benefits: string,
  benefitLines?: string[],
): BenefitPosterData {
  const lines =
    benefitLines && benefitLines.length > 0
      ? benefitLines
      : parseBenefitLines(benefits);
  return {
    productName: product.name,
    price: Number(product.retailPrice).toLocaleString('th-TH'),
    category: product.category,
    imageUrl: product.imageUrl,
    benefitLines: lines.length > 0 ? lines : [benefits.slice(0, 120)],
  };
}

function ProductImg({
  src,
  alt,
  maxH,
}: {
  src: string;
  alt: string;
  maxH: number;
}) {
  if (!src) {
    return <div style={{ color: '#94a3b8', fontSize: 18 }}>ไม่มีรูปสินค้า</div>;
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      crossOrigin="anonymous"
      style={{ maxWidth: '100%', maxHeight: maxH, objectFit: 'contain' }}
    />
  );
}

function BenefitList({
  lines,
  accent,
  textColor,
  fontSize = 22,
  compact = false,
}: {
  lines: string[];
  accent: string;
  textColor: string;
  fontSize?: number;
  compact?: boolean;
}) {
  return (
    <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
      {lines.map((line, i) => (
        <li
          key={i}
          style={{
            display: 'flex',
            gap: compact ? 10 : 14,
            marginBottom: compact ? 10 : 16,
            alignItems: 'flex-start',
          }}
        >
          <span
            style={{
              flexShrink: 0,
              width: compact ? 28 : 36,
              height: compact ? 28 : 36,
              borderRadius: '50%',
              background: accent,
              color: '#fff',
              fontSize: compact ? 14 : 18,
              fontWeight: 800,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {i + 1}
          </span>
          <span style={{ fontSize, lineHeight: 1.45, color: textColor, fontWeight: 500 }}>
            {line}
          </span>
        </li>
      ))}
    </ul>
  );
}

function Footer({ bg = '#1e40af' }: { bg?: string }) {
  return (
    <div
      style={{
        background: bg,
        color: '#fff',
        textAlign: 'center',
        padding: '18px 40px',
        fontSize: 22,
        fontWeight: 700,
        flexShrink: 0,
        letterSpacing: 1,
      }}
    >
      100 Baht Shop Thailand
    </div>
  );
}

/** Classic: image left + benefits right */
function ClassicLayout({ data }: { data: BenefitPosterData }) {
  return (
    <div
      style={{
        width: 1080,
        height: 1080,
        fontFamily: FONT,
        background: 'linear-gradient(160deg, #fff7ed 0%, #ffffff 45%, #eff6ff 100%)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      <div style={{ background: 'linear-gradient(90deg, #dc2626, #ea580c)', padding: '28px 40px', color: '#fff' }}>
        <div style={{ fontSize: 22, fontWeight: 600, opacity: 0.9, marginBottom: 6 }}>สรรพคุณสินค้า</div>
        <div style={{ fontSize: 32, fontWeight: 800, lineHeight: 1.25 }}>{data.productName}</div>
        <div style={{ display: 'flex', gap: 16, marginTop: 12, alignItems: 'center' }}>
          <span style={{ background: '#fff', color: '#dc2626', fontSize: 36, fontWeight: 900, padding: '4px 20px', borderRadius: 12 }}>
            ฿{data.price}
          </span>
          {data.category && <span style={{ fontSize: 18, opacity: 0.85 }}>{data.category}</span>}
        </div>
      </div>
      <div style={{ flex: 1, display: 'flex', padding: '32px 40px', gap: 32 }}>
        <div style={{ width: 380, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fff', borderRadius: 20, boxShadow: '0 4px 24px rgba(0,0,0,0.08)', padding: 24 }}>
          <ProductImg src={data.imageUrl} alt={data.productName} maxH={340} />
        </div>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <div style={{ fontSize: 26, fontWeight: 800, color: '#1e40af', marginBottom: 20, borderBottom: '3px solid #1e40af', paddingBottom: 8 }}>
            จุดเด่น / สรรพคุณ
          </div>
          <BenefitList lines={data.benefitLines} accent="#dc2626" textColor="#1e293b" />
        </div>
      </div>
      <Footer />
    </div>
  );
}

/** Story: vertical 9:16 for social */
function StoryLayout({ data }: { data: BenefitPosterData }) {
  return (
    <div
      style={{
        width: 1080,
        height: 1920,
        fontFamily: FONT,
        background: 'linear-gradient(180deg, #1e3a8a 0%, #1e40af 40%, #ffffff 40%)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      <div style={{ padding: '48px 48px 24px', color: '#fff', textAlign: 'center' }}>
        <div style={{ fontSize: 28, fontWeight: 600, opacity: 0.85, marginBottom: 8 }}>สรรพคุณสินค้า</div>
        <div style={{ fontSize: 38, fontWeight: 800, lineHeight: 1.2, marginBottom: 16 }}>{data.productName}</div>
        <span style={{ background: '#dc2626', fontSize: 48, fontWeight: 900, padding: '8px 32px', borderRadius: 16, display: 'inline-block' }}>
          ฿{data.price}
        </span>
      </div>
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 48px' }}>
        <div style={{ background: '#fff', borderRadius: 24, padding: 32, boxShadow: '0 8px 40px rgba(0,0,0,0.15)', width: '100%', display: 'flex', justifyContent: 'center' }}>
          <ProductImg src={data.imageUrl} alt={data.productName} maxH={480} />
        </div>
      </div>
      <div style={{ background: '#fff', padding: '32px 48px 24px', flex: '0 0 auto' }}>
        <div style={{ fontSize: 28, fontWeight: 800, color: '#1e40af', marginBottom: 20, textAlign: 'center' }}>
          จุดเด่น / สรรพคุณ
        </div>
        <BenefitList lines={data.benefitLines} accent="#1e40af" textColor="#1e293b" fontSize={24} />
      </div>
      <Footer bg="#0f172a" />
    </div>
  );
}

/** Minimal: big image top, text bottom */
function MinimalLayout({ data }: { data: BenefitPosterData }) {
  return (
    <div
      style={{
        width: 1080,
        height: 1080,
        fontFamily: FONT,
        background: '#ffffff',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      <div style={{ flex: '0 0 520px', background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 40, borderBottom: '4px solid #e2e8f0' }}>
        <ProductImg src={data.imageUrl} alt={data.productName} maxH={440} />
      </div>
      <div style={{ padding: '28px 48px 16px' }}>
        <div style={{ fontSize: 30, fontWeight: 800, color: '#0f172a', lineHeight: 1.25, marginBottom: 8 }}>{data.productName}</div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <span style={{ fontSize: 40, fontWeight: 900, color: '#dc2626' }}>฿{data.price}</span>
          {data.category && <span style={{ fontSize: 16, color: '#64748b' }}>{data.category}</span>}
        </div>
      </div>
      <div style={{ flex: 1, padding: '8px 48px 24px', overflow: 'hidden' }}>
        <BenefitList lines={data.benefitLines} accent="#64748b" textColor="#334155" fontSize={20} compact />
      </div>
      <Footer bg="#334155" />
    </div>
  );
}

/** Bold: dark bg, price hero, benefits */
function BoldLayout({ data }: { data: BenefitPosterData }) {
  return (
    <div
      style={{
        width: 1080,
        height: 1080,
        fontFamily: FONT,
        background: '#0f172a',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        color: '#fff',
      }}
    >
      <div style={{ padding: '36px 48px 24px', textAlign: 'center' }}>
        <div style={{ fontSize: 20, fontWeight: 600, color: '#fbbf24', letterSpacing: 3, marginBottom: 12 }}>★ สินค้าแนะนำ ★</div>
        <div style={{ fontSize: 72, fontWeight: 900, color: '#fbbf24', lineHeight: 1 }}>฿{data.price}</div>
        <div style={{ fontSize: 28, fontWeight: 700, marginTop: 16, lineHeight: 1.3 }}>{data.productName}</div>
      </div>
      <div style={{ display: 'flex', flex: 1, padding: '0 48px', gap: 32, alignItems: 'center' }}>
        <div style={{ width: 340, flexShrink: 0, background: '#fff', borderRadius: 16, padding: 20, display: 'flex', justifyContent: 'center' }}>
          <ProductImg src={data.imageUrl} alt={data.productName} maxH={280} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 22, fontWeight: 800, color: '#fbbf24', marginBottom: 16 }}>สรรพคุณ</div>
          <BenefitList lines={data.benefitLines} accent="#dc2626" textColor="#e2e8f0" fontSize={20} compact />
        </div>
      </div>
      <Footer bg="#dc2626" />
    </div>
  );
}

export function BenefitPosterTemplate({
  data,
  layout = 'classic',
}: {
  data: BenefitPosterData;
  layout?: PosterLayout;
}) {
  switch (layout) {
    case 'story':
      return <StoryLayout data={data} />;
    case 'minimal':
      return <MinimalLayout data={data} />;
    case 'bold':
      return <BoldLayout data={data} />;
    default:
      return <ClassicLayout data={data} />;
  }
}

export function getLayoutDimensions(layout: PosterLayout): { width: number; height: number } {
  const opt = POSTER_LAYOUTS.find((l) => l.id === layout);
  return { width: opt?.width ?? 1080, height: opt?.height ?? 1080 };
}
