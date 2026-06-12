'use client';

const FONT = "'Kanit', var(--font-kanit), sans-serif";

// ---------------------------------------------------------------------------
// Template catalogue
// ---------------------------------------------------------------------------

export type PromoType =
  | 'spend_free_gift'
  | 'buy_x_get_y'
  | 'bundle_deal'
  | 'new_arrival'
  | 'clearance_sale';

export interface PromoOption {
  id: PromoType;
  label: string;
  description: string;
  bgImage: string;
  width: number;
  height: number;
}

export const PROMO_OPTIONS: PromoOption[] = [
  {
    id: 'spend_free_gift',
    label: 'Spend & Free Gift',
    description: 'ซื้อครบ X บาท รับของแถม',
    bgImage: '/templates/promo-spend-free-gift.png',
    width: 1024,
    height: 729,
  },
  {
    id: 'buy_x_get_y',
    label: 'Buy X Get Y',
    description: 'ซื้อ X ชิ้น ได้ Y ชิ้นฟรี',
    bgImage: '/templates/promo-buy-x-get-y.png',
    width: 1024,
    height: 740,
  },
  {
    id: 'bundle_deal',
    label: 'Bundle Deal',
    description: 'จัดเซตสินค้า ราคาพิเศษ',
    bgImage: '/templates/promo-bundle-deal.png',
    width: 1024,
    height: 742,
  },
  {
    id: 'new_arrival',
    label: 'New Arrival',
    description: 'สินค้าใหม่เข้าร้าน',
    bgImage: '/templates/promo-new-arrival.png',
    width: 1024,
    height: 741,
  },
  {
    id: 'clearance_sale',
    label: 'Clearance Sale',
    description: 'ลดแรง สินค้าจำนวนจำกัด',
    bgImage: '/templates/promo-clearance-sale.png',
    width: 1024,
    height: 742,
  },
];

// ---------------------------------------------------------------------------
// Data interfaces per template type
// ---------------------------------------------------------------------------

export interface SpendFreeGiftData {
  productImage: string;
  spendAmount: string;  // e.g. "299"
  freeGift: string;     // free gift description text
  validDate: string;
}

export interface BuyXGetYData {
  mainProductImage: string;
  buyProductName: string;
  buyProductImage?: string;
  getProductName: string;
  getProductImage?: string;
  validDate: string;
}

export interface BundleDealData {
  product1Image: string;
  product1Name: string;
  product2Image: string;
  product2Name: string;
  bundlePrice: string;
  freeGiftName?: string;
  validDate: string;
}

export interface NewArrivalData {
  productImage: string;
  feature1: string;
  feature2: string;
  feature3: string;
  validDate: string;
}

export interface ClearanceSaleProduct {
  image: string;
  name: string;
  price: string;
  savePercent: string;
}

export interface ClearanceSaleData {
  mainProductImage: string;
  mainProductName: string;
  discountPercent: string;
  products: ClearanceSaleProduct[];  // up to 3
  validDate: string;
}

export type PromoData =
  | SpendFreeGiftData
  | BuyXGetYData
  | BundleDealData
  | NewArrivalData
  | ClearanceSaleData;

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

function PromoImg({
  src,
  style,
}: {
  src: string;
  style?: React.CSSProperties;
}) {
  if (!src) return null;
  // eslint-disable-next-line @next/next/no-img-element
  return (
    <img
      src={src}
      alt=""
      crossOrigin="anonymous"
      style={{ width: '100%', height: '100%', objectFit: 'contain', ...style }}
    />
  );
}

function Overlay({
  left,
  top,
  width,
  height,
  style,
  children,
}: {
  left: number;
  top: number;
  width: number;
  height: number;
  style?: React.CSSProperties;
  children?: React.ReactNode;
}) {
  return (
    <div
      style={{
        position: 'absolute',
        left,
        top,
        width,
        height,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        ...style,
      }}
    >
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Template 1 — Spend & Free Gift (1024 × 729)
// ---------------------------------------------------------------------------

function SpendFreeGiftTemplate({ data }: { data: SpendFreeGiftData }) {
  return (
    <div style={{ width: 1024, height: 729, position: 'relative', fontFamily: FONT, overflow: 'hidden' }}>
      {/* Background */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/templates/promo-spend-free-gift.png" alt="" crossOrigin="anonymous"
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} />

      {/* [PRODUCT_IMAGE] — left dashed box */}
      <Overlay left={25} top={95} width={338} height={515}>
        <PromoImg src={data.productImage} />
      </Overlay>

      {/* [PRICE] — white rounded box (right, upper) */}
      <Overlay left={562} top={65} width={358} height={88}
        style={{ flexDirection: 'column', gap: 0 }}>
        <span style={{ fontSize: 52, fontWeight: 900, color: '#c41e1e', letterSpacing: -1 }}>
          {data.spendAmount}
        </span>
      </Overlay>

      {/* [FREE_GIFT] — yellow/gold box */}
      <Overlay left={508} top={370} width={466} height={210}
        style={{ flexDirection: 'column', padding: '8px 24px' }}>
        <span style={{ fontSize: 30, fontWeight: 800, color: '#c41e1e', textAlign: 'center', lineHeight: 1.3 }}>
          {data.freeGift}
        </span>
      </Overlay>

      {/* [VALID_DATE] — bottom bar */}
      <Overlay left={450} top={645} width={510} height={52}>
        <span style={{ fontSize: 22, fontWeight: 700, color: '#333', textAlign: 'center' }}>
          {data.validDate}
        </span>
      </Overlay>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Template 2 — Buy X Get Y (1024 × 740)
// ---------------------------------------------------------------------------

function BuyXGetYTemplate({ data }: { data: BuyXGetYData }) {
  return (
    <div style={{ width: 1024, height: 740, position: 'relative', fontFamily: FONT, overflow: 'hidden' }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/templates/promo-buy-x-get-y.png" alt="" crossOrigin="anonymous"
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} />

      {/* [PRODUCT_IMAGE] — main left product */}
      <Overlay left={20} top={140} width={383} height={540}>
        <PromoImg src={data.mainProductImage} />
      </Overlay>

      {/* [BUY_PRODUCT] — lower right BUY box */}
      <Overlay left={487} top={460} width={210} height={218}
        style={{ flexDirection: 'column', gap: 6, padding: 8 }}>
        {data.buyProductImage
          ? <PromoImg src={data.buyProductImage} style={{ objectFit: 'contain' }} />
          : <span style={{ fontSize: 20, fontWeight: 700, color: '#c41e1e', textAlign: 'center' }}>
              {data.buyProductName}
            </span>}
        {data.buyProductImage && (
          <span style={{ fontSize: 16, fontWeight: 700, color: '#c41e1e', textAlign: 'center', marginTop: 4 }}>
            {data.buyProductName}
          </span>
        )}
      </Overlay>

      {/* [GET_PRODUCT] — lower right GET box */}
      <Overlay left={710} top={460} width={248} height={218}
        style={{ flexDirection: 'column', gap: 6, padding: 8 }}>
        {data.getProductImage
          ? <PromoImg src={data.getProductImage} style={{ objectFit: 'contain' }} />
          : <span style={{ fontSize: 20, fontWeight: 700, color: '#c41e1e', textAlign: 'center' }}>
              {data.getProductName}
            </span>}
        {data.getProductImage && (
          <span style={{ fontSize: 16, fontWeight: 700, color: '#c41e1e', textAlign: 'center', marginTop: 4 }}>
            {data.getProductName}
          </span>
        )}
      </Overlay>

      {/* [VALID_DATE] — bottom bar */}
      <Overlay left={468} top={685} width={492} height={50}>
        <span style={{ fontSize: 22, fontWeight: 700, color: '#333', textAlign: 'center' }}>
          {data.validDate}
        </span>
      </Overlay>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Template 3 — Bundle Deal (1024 × 742)
// ---------------------------------------------------------------------------

function BundleDealTemplate({ data }: { data: BundleDealData }) {
  return (
    <div style={{ width: 1024, height: 742, position: 'relative', fontFamily: FONT, overflow: 'hidden' }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/templates/promo-bundle-deal.png" alt="" crossOrigin="anonymous"
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} />

      {/* [PRODUCT_1_IMAGE] — large left */}
      <Overlay left={20} top={130} width={358} height={515}>
        <PromoImg src={data.product1Image} />
      </Overlay>

      {/* [PRODUCT_1_NAME] — left bottom label */}
      <Overlay left={20} top={645} width={358} height={40}>
        <span style={{ fontSize: 18, fontWeight: 800, color: '#c41e1e', textAlign: 'center', background: 'rgba(255,255,255,0.85)', padding: '2px 12px', borderRadius: 6 }}>
          {data.product1Name}
        </span>
      </Overlay>

      {/* [PRODUCT_2_IMAGE] — center */}
      <Overlay left={388} top={205} width={295} height={420}>
        <PromoImg src={data.product2Image} />
      </Overlay>

      {/* [PRODUCT_2_NAME] — center bottom label */}
      <Overlay left={388} top={628} width={295} height={43}>
        <span style={{ fontSize: 18, fontWeight: 800, color: '#c41e1e', textAlign: 'center', background: 'rgba(255,255,255,0.85)', padding: '2px 12px', borderRadius: 6 }}>
          {data.product2Name}
        </span>
      </Overlay>

      {/* [PRICE] — starburst right center */}
      <Overlay left={712} top={295} width={268} height={228}
        style={{ flexDirection: 'column', gap: 2 }}>
        <span style={{ fontSize: 52, fontWeight: 900, color: '#fff', lineHeight: 1, textShadow: '0 2px 8px rgba(0,0,0,0.4)' }}>
          {data.bundlePrice}
        </span>
        <span style={{ fontSize: 20, fontWeight: 700, color: '#fff' }}>THB</span>
      </Overlay>

      {/* [FREE_GIFT] — yellow box right */}
      <Overlay left={700} top={530} width={285} height={135}
        style={{ flexDirection: 'column', padding: '8px 16px' }}>
        <span style={{ fontSize: 22, fontWeight: 800, color: '#c41e1e', textAlign: 'center', lineHeight: 1.3 }}>
          {data.freeGiftName ?? ''}
        </span>
      </Overlay>

      {/* [VALID_DATE] — bottom bar */}
      <Overlay left={445} top={680} width={515} height={52}>
        <span style={{ fontSize: 22, fontWeight: 700, color: '#333', textAlign: 'center' }}>
          {data.validDate}
        </span>
      </Overlay>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Template 4 — New Arrival (1024 × 741)
// ---------------------------------------------------------------------------

function NewArrivalTemplate({ data }: { data: NewArrivalData }) {
  const features = [data.feature1, data.feature2, data.feature3];
  const featurePositions = [
    { left: 480, top: 485, width: 146 },
    { left: 638, top: 485, width: 147 },
    { left: 797, top: 485, width: 178 },
  ];

  return (
    <div style={{ width: 1024, height: 741, position: 'relative', fontFamily: FONT, overflow: 'hidden' }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/templates/promo-new-arrival.png" alt="" crossOrigin="anonymous"
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} />

      {/* [PRODUCT_IMAGE] — left */}
      <Overlay left={20} top={120} width={388} height={535}>
        <PromoImg src={data.productImage} />
      </Overlay>

      {/* [FEATURE_1/2/3] — 3 boxes bottom right */}
      {features.map((feat, i) => (
        <Overlay
          key={i}
          left={featurePositions[i].left}
          top={featurePositions[i].top}
          width={featurePositions[i].width}
          height={195}
          style={{ flexDirection: 'column', padding: '4px 6px', alignItems: 'center', justifyContent: 'flex-end', paddingBottom: 12 }}
        >
          <span style={{ fontSize: 16, fontWeight: 700, color: '#c41e1e', textAlign: 'center', lineHeight: 1.3 }}>
            {feat}
          </span>
        </Overlay>
      ))}

      {/* [VALID_DATE] — bottom bar */}
      <Overlay left={445} top={683} width={530} height={52}>
        <span style={{ fontSize: 22, fontWeight: 700, color: '#333', textAlign: 'center' }}>
          {data.validDate}
        </span>
      </Overlay>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Template 5 — Clearance Sale (1024 × 742)
// ---------------------------------------------------------------------------

function ClearanceSaleTemplate({ data }: { data: ClearanceSaleData }) {
  const smallProductPositions = [
    { left: 435, top: 400 },
    { left: 628, top: 400 },
    { left: 810, top: 400 },
  ];
  const smallW = 188;
  const smallH = 245;

  return (
    <div style={{ width: 1024, height: 742, position: 'relative', fontFamily: FONT, overflow: 'hidden' }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/templates/promo-clearance-sale.png" alt="" crossOrigin="anonymous"
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} />

      {/* [MAIN_PRODUCT_IMAGE] — left large */}
      <Overlay left={20} top={130} width={363} height={490}>
        <PromoImg src={data.mainProductImage} />
      </Overlay>

      {/* [MAIN_PRODUCT_NAME] — left bottom black bar */}
      <Overlay left={20} top={622} width={363} height={43}>
        <span style={{ fontSize: 20, fontWeight: 800, color: '#fff', textAlign: 'center', background: 'rgba(0,0,0,0.75)', padding: '4px 14px', borderRadius: 6 }}>
          {data.mainProductName}
        </span>
      </Overlay>

      {/* [DISCOUNT%] — starburst top right */}
      <Overlay left={812} top={58} width={178} height={197}
        style={{ flexDirection: 'column', gap: 0 }}>
        <span style={{ fontSize: 52, fontWeight: 900, color: '#fbbf24', lineHeight: 1, textShadow: '0 2px 6px rgba(0,0,0,0.5)' }}>
          {data.discountPercent}
        </span>
      </Overlay>

      {/* 3 small products */}
      {data.products.slice(0, 3).map((p, i) => {
        const pos = smallProductPositions[i];
        return (
          <div key={i} style={{ position: 'absolute', left: pos.left, top: pos.top, width: smallW, height: smallH }}>
            {/* product image area */}
            <div style={{ position: 'absolute', left: 0, top: 15, width: smallW, height: 148, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
              <PromoImg src={p.image} />
            </div>
            {/* SAVE ribbon handled by background template */}
            {/* price */}
            <div style={{ position: 'absolute', left: 0, bottom: 68, width: smallW, textAlign: 'center' }}>
              <span style={{ fontSize: 18, fontWeight: 800, color: '#c41e1e' }}>฿{p.price}</span>
            </div>
            {/* name */}
            <div style={{ position: 'absolute', left: 0, bottom: 8, width: smallW, textAlign: 'center', background: 'rgba(0,0,0,0.8)', padding: '3px 6px' }}>
              <span style={{ fontSize: 14, fontWeight: 700, color: '#fff' }}>{p.name}</span>
            </div>
          </div>
        );
      })}

      {/* [VALID_DATE] — bottom bar */}
      <Overlay left={408} top={650} width={567} height={55}
        style={{ paddingLeft: 36 }}>
        <span style={{ fontSize: 22, fontWeight: 700, color: '#333', textAlign: 'center' }}>
          {data.validDate}
        </span>
      </Overlay>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Unified renderer
// ---------------------------------------------------------------------------

export function PromoTemplateRenderer({
  type,
  data,
}: {
  type: PromoType;
  data: PromoData;
}) {
  switch (type) {
    case 'spend_free_gift':
      return <SpendFreeGiftTemplate data={data as SpendFreeGiftData} />;
    case 'buy_x_get_y':
      return <BuyXGetYTemplate data={data as BuyXGetYData} />;
    case 'bundle_deal':
      return <BundleDealTemplate data={data as BundleDealData} />;
    case 'new_arrival':
      return <NewArrivalTemplate data={data as NewArrivalData} />;
    case 'clearance_sale':
      return <ClearanceSaleTemplate data={data as ClearanceSaleData} />;
    default:
      return null;
  }
}

export function getPromoDimensions(type: PromoType): { width: number; height: number } {
  const opt = PROMO_OPTIONS.find((o) => o.id === type);
  return { width: opt?.width ?? 1024, height: opt?.height ?? 740 };
}

export function emptyPromoData(type: PromoType): PromoData {
  switch (type) {
    case 'spend_free_gift':
      return { productImage: '', spendAmount: '299', freeGift: '', validDate: '' };
    case 'buy_x_get_y':
      return { mainProductImage: '', buyProductName: '', getProductName: '', validDate: '' };
    case 'bundle_deal':
      return { product1Image: '', product1Name: '', product2Image: '', product2Name: '', bundlePrice: '199', freeGiftName: '', validDate: '' };
    case 'new_arrival':
      return { productImage: '', feature1: '', feature2: '', feature3: '', validDate: '' };
    case 'clearance_sale':
      return {
        mainProductImage: '', mainProductName: '', discountPercent: '50',
        products: [
          { image: '', name: '', price: '', savePercent: '20' },
          { image: '', name: '', price: '', savePercent: '30' },
          { image: '', name: '', price: '', savePercent: '40' },
        ],
        validDate: '',
      };
  }
}
