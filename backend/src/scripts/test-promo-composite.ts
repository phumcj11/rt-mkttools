/**
 * Smoke test: composite spend_free_gift poster (text only, no product image).
 * Run: npm run build && node dist/scripts/test-promo-composite.js
 */
const fs = require('fs');
const path = require('path');

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { PromoCompositeService } = require('../modules/media/promo-composite.service');

async function main() {
  const svc = new PromoCompositeService();
  const out = await svc.composite(
    'spend_free_gift',
    {
      spendAmount: '299',
      freeGift: 'กระเป๋าผ้าสุดน่ารัก 1 ใบ',
      validDate: '30 มิ.ย. 2569',
    },
    {},
  );

  const outDir = path.join(process.cwd(), 'uploads', 'media');
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, 'test-promo-composite.png');
  fs.writeFileSync(outPath, out);
  console.log(`OK: wrote ${outPath} (${out.length} bytes)`);
}

main().catch((err) => {
  console.error('FAIL:', err);
  process.exit(1);
});
