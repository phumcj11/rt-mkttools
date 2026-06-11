-- ============================================================
--  ERP integration — daily sales snapshot
--  เก็บยอดขายรายวันที่ sync มาจาก ChangSiam ERP เพื่อทำรายงานย้อนหลัง
--  และตรวจจับความผิดปกติ (alerts). เป็นข้อมูลระดับระบบ (ไม่ผูก tenant)
-- ============================================================

SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS erp_sales_daily (
  sale_date   DATE NOT NULL,
  orders      INT UNSIGNED NOT NULL DEFAULT 0,
  revenue     DECIMAL(16,2) NOT NULL DEFAULT 0.00,
  synced_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (sale_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
