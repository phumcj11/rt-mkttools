'use client';

import type { ErpProduct } from '@/lib/media-api';

export interface BenefitPosterData {
  productName: string;
  price: string;
  category: string;
  imageUrl: string;
  benefitLines: string[];
}

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

export function BenefitPosterTemplate({ data }: { data: BenefitPosterData }) {
  return (
    <div
      style={{
        width: 1080,
        height: 1080,
        fontFamily: "'Kanit', var(--font-kanit), sans-serif",
        background: 'linear-gradient(160deg, #fff7ed 0%, #ffffff 45%, #eff6ff 100%)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        boxSizing: 'border-box',
      }}
    >
      {/* Header */}
      <div
        style={{
          background: 'linear-gradient(90deg, #dc2626, #ea580c)',
          padding: '28px 40px',
          color: '#fff',
          flexShrink: 0,
        }}
      >
        <div style={{ fontSize: 22, fontWeight: 600, opacity: 0.9, marginBottom: 6 }}>
          สรรพคุณสินค้า
        </div>
        <div style={{ fontSize: 32, fontWeight: 800, lineHeight: 1.25, maxHeight: 80, overflow: 'hidden' }}>
          {data.productName}
        </div>
        <div style={{ display: 'flex', gap: 16, marginTop: 12, alignItems: 'center' }}>
          <span
            style={{
              background: '#fff',
              color: '#dc2626',
              fontSize: 36,
              fontWeight: 900,
              padding: '4px 20px',
              borderRadius: 12,
            }}
          >
            ฿{data.price}
          </span>
          {data.category && (
            <span style={{ fontSize: 18, opacity: 0.85 }}>{data.category}</span>
          )}
        </div>
      </div>

      {/* Body */}
      <div style={{ flex: 1, display: 'flex', padding: '32px 40px', gap: 32, minHeight: 0 }}>
        {/* Product photo */}
        <div
          style={{
            width: 380,
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: '#fff',
            borderRadius: 20,
            boxShadow: '0 4px 24px rgba(0,0,0,0.08)',
            padding: 24,
          }}
        >
          {data.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={data.imageUrl}
              alt={data.productName}
              crossOrigin="anonymous"
              style={{ maxWidth: '100%', maxHeight: 340, objectFit: 'contain' }}
            />
          ) : (
            <div style={{ color: '#94a3b8', fontSize: 18 }}>ไม่มีรูปสินค้า</div>
          )}
        </div>

        {/* Benefits list */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <div
            style={{
              fontSize: 26,
              fontWeight: 800,
              color: '#1e40af',
              marginBottom: 20,
              borderBottom: '3px solid #1e40af',
              paddingBottom: 8,
            }}
          >
            จุดเด่น / สรรพคุณ
          </div>
          <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {data.benefitLines.map((line, i) => (
              <li
                key={i}
                style={{
                  display: 'flex',
                  gap: 14,
                  marginBottom: 16,
                  alignItems: 'flex-start',
                }}
              >
                <span
                  style={{
                    flexShrink: 0,
                    width: 36,
                    height: 36,
                    borderRadius: '50%',
                    background: '#dc2626',
                    color: '#fff',
                    fontSize: 18,
                    fontWeight: 800,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {i + 1}
                </span>
                <span
                  style={{
                    fontSize: 22,
                    lineHeight: 1.45,
                    color: '#1e293b',
                    fontWeight: 500,
                  }}
                >
                  {line}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Footer */}
      <div
        style={{
          background: '#1e40af',
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
    </div>
  );
}
