# N8n Promo Cutout Workflow Setup

## 1. ติดตั้ง rembg บน server

```bash
# AlmaLinux / CentOS
pip3 install rembg[cli]

# ทดสอบ
rembg i /tmp/test.jpg /tmp/test-out.png
```

หรือใช้ Docker:
```bash
docker run --rm -v /tmp:/tmp danielgatis/rembg i /tmp/test.jpg /tmp/test-out.png
```

## 2. Import workflow ใน n8n

1. เปิด n8n → **Workflows** → **Import from File**
2. เลือกไฟล์ `promo-cutout-workflow.json`
3. กด **Activate**

## 3. ได้ Webhook URL

หลัง Activate → คลิก Webhook node → copy **Production URL**

รูปแบบ: `https://your-n8n.com/webhook/promo-cutout`

## 4. ตั้งค่าใน mkttools

ไปที่ **Product Media AI** → **ตั้งค่า** → ช่อง **n8n Cutout Webhook URL**

ใส่ URL ที่ได้จากขั้นตอน 3

## 5. ทดสอบ

```bash
curl -X POST https://your-n8n.com/webhook/promo-cutout \
  -H "Content-Type: application/json" \
  -d '{"productImageUrl":"https://your-erp.com/product.jpg","sku":"PM00001"}'
```

Response จะมี `cutoutBase64` (PNG พื้นหลังโปร่งใส)

## หมายเหตุ

- rembg ใช้ RAM ~500MB-1GB ต่อ request (โหลด model ครั้งแรก)
- หากไม่มี GPU ใช้ CPU mode ได้ (ช้ากว่า ~3-5 วิ)
- ไฟล์ /tmp ถูก cleanup อัตโนมัติหลังแต่ละ request
