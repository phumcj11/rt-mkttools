-- ============================================================
--  ร้าน 100 บาท — Seed Data (master + demo)
--  รันหลังสร้าง schema แล้ว
-- ============================================================
SET NAMES utf8mb4;

-- Roles (master)
INSERT INTO roles (name, description) VALUES
  ('owner',  'เจ้าของร้าน — สิทธิ์เต็ม'),
  ('admin',  'ผู้ดูแลระบบของร้าน'),
  ('editor', 'สร้าง/แก้ไขคอนเทนต์และแคมเปญ'),
  ('viewer', 'ดูข้อมูลอย่างเดียว');

-- Plans (master)
INSERT INTO plans (code, name, price_monthly, ai_token_limit, user_limit) VALUES
  ('free',     'ฟรี',       0.00,    100000,  1),
  ('pro',      'โปร',       299.00,  1000000, 5),
  ('business', 'ธุรกิจ',    990.00,  5000000, 20);

-- Demo tenant
INSERT INTO tenants (name, slug, status, locale) VALUES
  ('ร้านตัวอย่าง 100 บาท', 'demo-shop', 'trial', 'th');

-- หมายเหตุ: รหัสผ่าน demo ควรถูกสร้างผ่าน backend (bcrypt) ในเฟส 1
-- INSERT INTO users (...) VALUES (...);
