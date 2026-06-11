-- ============================================================
--  Phase 7 — Branch foundation
--  เพิ่มตาราง branches และคอลัมน์ branch_id ในตารางที่เกี่ยวข้อง
--  รันกับฐานข้อมูลเดิม (idempotent-ish: ใช้ IF NOT EXISTS เท่าที่ MySQL รองรับ)
-- ============================================================

SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS branches (
  id              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  tenant_id       BIGINT UNSIGNED NOT NULL,
  name            VARCHAR(150) NOT NULL,
  code            VARCHAR(50) NULL,
  address         VARCHAR(255) NULL,
  phone           VARCHAR(30) NULL,
  status          ENUM('active','inactive') NOT NULL DEFAULT 'active',
  created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_branches_tenant (tenant_id),
  CONSTRAINT fk_branches_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- MySQL < 8 ไม่รองรับ ADD COLUMN IF NOT EXISTS — ถ้าคอลัมน์มีอยู่แล้วให้ข้าม error ได้
ALTER TABLE users        ADD COLUMN branch_id BIGINT UNSIGNED NULL AFTER tenant_id;
ALTER TABLE campaigns    ADD COLUMN branch_id BIGINT UNSIGNED NULL AFTER tenant_id;
ALTER TABLE sales_records ADD COLUMN branch_id BIGINT UNSIGNED NULL AFTER tenant_id;
