-- Phase 11: ERP Product + Sales Summary Cache
-- สร้างตาราง cache สำหรับ product master และยอดขายสรุปรายสินค้าจาก ERP
-- sync ผ่าน POST /erp/sync/products และ POST /erp/sync/sales

CREATE TABLE IF NOT EXISTS erp_product_cache (
  sku          VARCHAR(64)     NOT NULL,
  product_id   INT UNSIGNED    NOT NULL DEFAULT 0,
  name         VARCHAR(255)    NOT NULL DEFAULT '',
  category     VARCHAR(100)    NOT NULL DEFAULT '',
  brand        VARCHAR(100)    NOT NULL DEFAULT '',
  retail_price DECIMAL(12, 2)  NOT NULL DEFAULT 0,
  cost_sales   DECIMAL(12, 2)  NOT NULL DEFAULT 0,
  image_url    TEXT            NOT NULL DEFAULT '',
  abc_company  VARCHAR(10)     NOT NULL DEFAULT '',
  synced_at    DATETIME(6)     NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (sku),
  INDEX idx_erp_product_abc (abc_company),
  INDEX idx_erp_product_category (category(50))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS erp_sales_summary (
  sku         VARCHAR(64)     NOT NULL,
  product_id  INT UNSIGNED    NOT NULL DEFAULT 0,
  revenue     DECIMAL(16, 2)  NOT NULL DEFAULT 0,
  qty_sold    INT UNSIGNED    NOT NULL DEFAULT 0,
  gp_baht     DECIMAL(16, 2)  NOT NULL DEFAULT 0,
  gp_pct      DECIMAL(6, 2)   NOT NULL DEFAULT 0,
  abc_company VARCHAR(10)     NOT NULL DEFAULT '',
  period_days INT UNSIGNED    NOT NULL DEFAULT 90,
  synced_at   DATETIME(6)     NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (sku),
  INDEX idx_erp_sales_abc (abc_company)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
