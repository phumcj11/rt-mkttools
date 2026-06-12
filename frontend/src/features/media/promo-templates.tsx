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

/** Opaque rectangle to hide baked-in [PLACEHOLDER] text from template PNG */
function Mask({
  left,
  top,
  width,
  height,
  color = '#ffffff',
  borderRadius = 0,
  zIndex = 1,
}: {
  left: number;
  top: number;
  width: number;
  height: number;
  color?: string;
  borderRadius?: number;
  zIndex?: number;
}) {
  return (
    <div
      style={{
        position: 'absolute',
        left,
        top,
        width,
        height,
        background: color,
        borderRadius,
        zIndex,
      }}
    />
  );
}

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

/** Mask placeholder area then render content on top */
function Slot({
  left,
  top,
  width,
  height,
  maskColor = '#ffffff',
  borderRadius = 0,
  style,
  children,
}: {
  left: number;
  top: number;
  width: number;
  height: number;
  maskColor?: string;
  borderRadius?: number;
  style?: React.CSSProperties;
  children?: React.ReactNode;
}) {
  return (
    <>
      <Mask left={left} top={top} width={width} height={height} color={maskColor} borderRadius={borderRadius} />
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
          zIndex: 2,
          ...style,
        }}
      >
        {children}
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// Template 1 — Spend & Free Gift (1024 × 729)
// ---------------------------------------------------------------------------

function SpendFreeGiftTemplate({ data }: { data: SpendFreeGiftData }) {
  return (
    <div style={{ width: 1024, height: 729, position: 'relative', fontFamily: FONT, overflow: 'hidden' }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/templates/promo-spend-free-gift.png" alt="" crossOrigin="anonymous"
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} />

      {/* [PRODUCT_IMAGE] — mask dashed box + product */}
      <Slot left={32} top={102} width={326} height={498} maskColor="#ffffff" borderRadius={14}
        style={{ padding: '16px 12px' }}>
        <PromoImg src={data.productImage} />
      </Slot>

      {/* [PRICE] — white rounded box between SPEND and THB */}
      <Slot left={548} top={54} width={352} height={96} maskColor="#ffffff" borderRadius={18}>
        <span style={{ fontSize: 68, fontWeight: 900, color: '#c41e1e', lineHeight: 1, letterSpacing: -2 }}>
          {data.spendAmount}
        </span>
      </Slot>

      {/* [FREE_GIFT] — yellow parallelogram area */}
      <Slot left={488} top={348} width={502} height={232} maskColor="#ffd028" borderRadius={4}
        style={{ padding: '12px 28px' }}>
        <span style={{ fontSize: 34, fontWeight: 900, color: '#b91c1c', textAlign: 'center', lineHeight: 1.25, textTransform: 'uppercase' }}>
          {data.freeGift}
        </span>
      </Slot>

      {/* [VALID_DATE] — bottom white pill */}
      <Slot left={432} top={636} width={538} height={58} maskColor="#ffffff" borderRadius={28}>
        <span style={{ fontSize: 24, fontWeight: 700, color: '#1e293b', textAlign: 'center' }}>
          {data.validDate}
        </span>
      </Slot>
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

      <Slot left={22} top={142} width={378} height={532} maskColor="#ffffff" borderRadius={14}
        style={{ padding: '12px' }}>
        <PromoImg src={data.mainProductImage} />
      </Slot>

      <Slot left={490} top={462} width={206} height={210} maskColor="#ffffff" borderRadius={12}
        style={{ flexDirection: 'column', gap: 4, padding: 8 }}>
        {data.buyProductImage
          ? <PromoImg src={data.buyProductImage} />
          : null}
        <span style={{ fontSize: 17, fontWeight: 800, color: '#b91c1c', textAlign: 'center', lineHeight: 1.2 }}>
          {data.buyProductName}
        </span>
      </Slot>

      <Slot left={712} top={462} width={244} height={210} maskColor="#ffffff" borderRadius={12}
        style={{ flexDirection: 'column', gap: 4, padding: 8 }}>
        {data.getProductImage
          ? <PromoImg src={data.getProductImage} />
          : null}
        <span style={{ fontSize: 17, fontWeight: 800, color: '#b91c1c', textAlign: 'center', lineHeight: 1.2 }}>
          {data.getProductName}
        </span>
      </Slot>

      <Slot left={462} top={682} width={498} height={52} maskColor="#ffffff" borderRadius={26}>
        <span style={{ fontSize: 24, fontWeight: 700, color: '#1e293b', textAlign: 'center' }}>
          {data.validDate}
        </span>
      </Slot>
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

      <Slot left={22} top={132} width={354} height={500} maskColor="#ffffff" borderRadius={14}
        style={{ padding: '12px' }}>
        <PromoImg src={data.product1Image} />
      </Slot>
      <Slot left={22} top={638} width={354} height={44} maskColor="#dc2626" borderRadius={8}>
        <span style={{ fontSize: 18, fontWeight: 800, color: '#fff', textAlign: 'center', padding: '0 8px' }}>
          {data.product1Name}
        </span>
      </Slot>

      <Slot left={390} top={208} width={288} height={408} maskColor="#ffffff" borderRadius={14}
        style={{ padding: '10px' }}>
        <PromoImg src={data.product2Image} />
      </Slot>
      <Slot left={390} top={622} width={288} height={44} maskColor="#dc2626" borderRadius={8}>
        <span style={{ fontSize: 18, fontWeight: 800, color: '#fff', textAlign: 'center', padding: '0 8px' }}>
          {data.product2Name}
        </span>
      </Slot>

      <Slot left={718} top={300} width={258} height={218} maskColor="#dc2626" borderRadius={0}
        style={{ flexDirection: 'column', gap: 0 }}>
        <span style={{ fontSize: 58, fontWeight: 900, color: '#fde047', lineHeight: 1 }}>
          {data.bundlePrice}
        </span>
      </Slot>

      <Slot left={698} top={532} width={288} height={138} maskColor="#ffd028" borderRadius={6}
        style={{ padding: '8px 16px' }}>
        <span style={{ fontSize: 24, fontWeight: 900, color: '#b91c1c', textAlign: 'center', lineHeight: 1.25 }}>
          {data.freeGiftName ?? ''}
        </span>
      </Slot>

      <Slot left={442} top={678} width={518} height={54} maskColor="#ffffff" borderRadius={26}>
        <span style={{ fontSize: 24, fontWeight: 700, color: '#1e293b', textAlign: 'center' }}>
          {data.validDate}
        </span>
      </Slot>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Template 4 — New Arrival (1024 × 741)
// ---------------------------------------------------------------------------

function NewArrivalTemplate({ data }: { data: NewArrivalData }) {
  const features = [data.feature1, data.feature2, data.feature3];
  const featureSlots = [
    { left: 478, top: 488, width: 148, height: 188 },
    { left: 636, top: 488, width: 149, height: 188 },
    { left: 795, top: 488, width: 180, height: 188 },
  ];

  return (
    <div style={{ width: 1024, height: 741, position: 'relative', fontFamily: FONT, overflow: 'hidden' }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/templates/promo-new-arrival.png" alt="" crossOrigin="anonymous"
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} />

      <Slot left={22} top={122} width={384} height={528} maskColor="#ffffff" borderRadius={14}
        style={{ padding: '12px' }}>
        <PromoImg src={data.productImage} />
      </Slot>

      {features.map((feat, i) => (
        <Slot
          key={i}
          left={featureSlots[i].left}
          top={featureSlots[i].top}
          width={featureSlots[i].width}
          height={featureSlots[i].height}
          maskColor="#ffffff"
          borderRadius={10}
          style={{ padding: '8px 6px', alignItems: 'flex-end', paddingBottom: 14 }}
        >
          <span style={{ fontSize: 15, fontWeight: 700, color: '#b91c1c', textAlign: 'center', lineHeight: 1.3 }}>
            {feat}
          </span>
        </Slot>
      ))}

      <Slot left={442} top={681} width={528} height={54} maskColor="#ffffff" borderRadius={26}>
        <span style={{ fontSize: 24, fontWeight: 700, color: '#1e293b', textAlign: 'center' }}>
          {data.validDate}
        </span>
      </Slot>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Template 5 — Clearance Sale (1024 × 742)
// ---------------------------------------------------------------------------

function ClearanceSaleTemplate({ data }: { data: ClearanceSaleData }) {
  const smallSlots = [
    { left: 437, top: 402 },
    { left: 630, top: 402 },
    { left: 812, top: 402 },
  ];
  const smallW = 186;
  const smallImgH = 145;

  return (
    <div style={{ width: 1024, height: 742, position: 'relative', fontFamily: FONT, overflow: 'hidden' }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/templates/promo-clearance-sale.png" alt="" crossOrigin="anonymous"
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} />

      <Slot left={22} top={132} width={358} height={482} maskColor="#ffffff" borderRadius={14}
        style={{ padding: '10px' }}>
        <PromoImg src={data.mainProductImage} />
      </Slot>
      <Slot left={22} top={618} width={358} height={44} maskColor="#0f172a" borderRadius={6}>
        <span style={{ fontSize: 19, fontWeight: 800, color: '#fff', textAlign: 'center', padding: '0 10px' }}>
          {data.mainProductName}
        </span>
      </Slot>

      <Slot left={818} top={62} width={168} height={188} maskColor="#dc2626" borderRadius={0}>
        <span style={{ fontSize: 56, fontWeight: 900, color: '#fde047', lineHeight: 1 }}>
          {data.discountPercent}
        </span>
      </Slot>

      {data.products.slice(0, 3).map((p, i) => {
        const pos = smallSlots[i];
        return (
          <div key={i} style={{ position: 'absolute', left: pos.left, top: pos.top, width: smallW, zIndex: 2 }}>
            <Mask left={0} top={12} width={smallW} height={smallImgH} color="#ffffff" borderRadius={10} />
            <div style={{ position: 'absolute', left: 0, top: 12, width: smallW, height: smallImgH, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', zIndex: 3, padding: 6 }}>
              <PromoImg src={p.image} />
            </div>
            <Mask left={0} top={smallImgH + 22} width={smallW} height={32} color="#ffffff" borderRadius={4} />
            <div style={{ position: 'absolute', left: 0, top: smallImgH + 22, width: smallW, textAlign: 'center', zIndex: 3 }}>
              <span style={{ fontSize: 18, fontWeight: 900, color: '#b91c1c' }}>฿{p.price}</span>
            </div>
            <Mask left={0} top={smallImgH + 58} width={smallW} height={36} color="#0f172a" borderRadius={4} />
            <div style={{ position: 'absolute', left: 0, top: smallImgH + 58, width: smallW, textAlign: 'center', zIndex: 3, padding: '4px 4px' }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: '#fff', lineHeight: 1.2 }}>{p.name}</span>
            </div>
          </div>
        );
      })}

      <Slot left={406} top={648} width={570} height={56} maskColor="#ffffff" borderRadius={26}
        style={{ paddingLeft: 32 }}>
        <span style={{ fontSize: 24, fontWeight: 700, color: '#1e293b', textAlign: 'center' }}>
          {data.validDate}
        </span>
      </Slot>
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
