# 06 — API Conventions

## Base
- Prefix: `/api`
- Format: JSON (request + response)
- Charset: UTF-8 (รองรับภาษาไทย)

## Authentication
- `Authorization: Bearer <access_token>` (JWT)
- Access token อายุสั้น (เช่น 15m), refresh token อายุยาว (เช่น 7d)
- Refresh ผ่าน `POST /api/auth/refresh`

## Multi-tenancy
- ทุก resource เป็น tenant-scoped
- `tenant_id` มาจาก JWT claim (ไม่รับจาก client โดยตรง)
- Guard ปฏิเสธ cross-tenant access

## รูปแบบ Response
สำเร็จ:
```json
{ "success": true, "data": { } }
```
แบบมี pagination:
```json
{ "success": true, "data": [], "meta": { "page": 1, "pageSize": 20, "total": 100 } }
```
ผิดพลาด (ข้อความ i18n ตาม locale):
```json
{ "success": false, "error": { "code": "AUTH_INVALID_CREDENTIALS", "message": "อีเมลหรือรหัสผ่านไม่ถูกต้อง" } }
```

## HTTP Status
| Code | ความหมาย |
| --- | --- |
| 200 / 201 | สำเร็จ |
| 400 | ข้อมูลไม่ถูกต้อง (validation) |
| 401 | ไม่ได้ยืนยันตัวตน |
| 403 | ไม่มีสิทธิ์ (RBAC/tenant) |
| 404 | ไม่พบข้อมูล |
| 409 | ขัดแย้ง (เช่น email ซ้ำ) |
| 422 | ประมวลผลไม่ได้ |
| 429 | เกิน rate limit |
| 500 | ข้อผิดพลาดเซิร์ฟเวอร์ |

## Conventions อื่น ๆ
- ตั้งชื่อ resource เป็นพหูพจน์: `/api/products`, `/api/campaigns`
- Query params สำหรับกรอง/แบ่งหน้า: `?page=1&pageSize=20&status=active`
- Validation ด้วย DTO ทุก endpoint
- Rate limit: ตั้งผ่าน `RATE_LIMIT_TTL`, `RATE_LIMIT_MAX`

## Realtime (Socket.io)
- Path: `/socket.io`
- Auth: ส่ง JWT ตอน handshake
- Event ตัวอย่าง: `notification:new`, `chat:message`, `ai:stream`
