-- Phase 8: New module tables for POSM, Google Reviews, Social Listening, AI Agents

-- AI POSM Projects
CREATE TABLE IF NOT EXISTS posm_projects (
  id           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  tenant_id    BIGINT UNSIGNED NOT NULL,
  user_id      BIGINT UNSIGNED,
  type         VARCHAR(50) NOT NULL,
  product_name VARCHAR(255) NOT NULL,
  price        DECIMAL(10,2),
  promotion    VARCHAR(255),
  output_url   VARCHAR(512),
  status       ENUM('pending','done','error') NOT NULL DEFAULT 'pending',
  created_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_posm_tenant (tenant_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Google Reviews
CREATE TABLE IF NOT EXISTS google_reviews (
  id               BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  tenant_id        BIGINT UNSIGNED NOT NULL,
  branch_id        BIGINT UNSIGNED,
  google_review_id VARCHAR(255) UNIQUE,
  author           VARCHAR(255),
  rating           TINYINT UNSIGNED NOT NULL,
  text             TEXT,
  sentiment        VARCHAR(20),
  ai_reply         TEXT,
  replied_at       TIMESTAMP NULL,
  review_date      DATE,
  created_at       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_review_tenant (tenant_id),
  INDEX idx_review_branch (branch_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Social Mentions
CREATE TABLE IF NOT EXISTS social_mentions (
  id            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  tenant_id     BIGINT UNSIGNED NOT NULL,
  platform      VARCHAR(100) NOT NULL,
  keyword       VARCHAR(255) NOT NULL,
  author_handle VARCHAR(255),
  text          TEXT NOT NULL,
  sentiment     VARCHAR(20),
  is_viral      TINYINT(1) NOT NULL DEFAULT 0,
  source_url    VARCHAR(512),
  published_at  TIMESTAMP NULL,
  created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_mention_tenant (tenant_id),
  INDEX idx_mention_keyword (keyword(100))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Listening Keywords
CREATE TABLE IF NOT EXISTS listening_keywords (
  id        BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  tenant_id BIGINT UNSIGNED NOT NULL,
  keyword   VARCHAR(255) NOT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_keyword_tenant (tenant_id, keyword)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- AI Agents
CREATE TABLE IF NOT EXISTS ai_agents (
  id               BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  tenant_id        BIGINT UNSIGNED NOT NULL,
  name             VARCHAR(100) NOT NULL,
  type             VARCHAR(50) NOT NULL,
  description      TEXT,
  status           ENUM('idle','running','error','disabled') NOT NULL DEFAULT 'idle',
  tasks_completed  INT UNSIGNED NOT NULL DEFAULT 0,
  last_run_at      TIMESTAMP NULL,
  created_at       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_agent_tenant (tenant_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- AI Tasks
CREATE TABLE IF NOT EXISTS ai_tasks (
  id        BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  tenant_id BIGINT UNSIGNED NOT NULL,
  agent_id  BIGINT UNSIGNED,
  action    VARCHAR(100) NOT NULL,
  payload   JSON,
  status    ENUM('queued','running','done','error') NOT NULL DEFAULT 'queued',
  result    TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_task_tenant (tenant_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Seed default listening keywords for 100 Baht Shop Thailand
INSERT IGNORE INTO listening_keywords (tenant_id, keyword) VALUES
  (1, '100 Baht Shop Thailand'),
  (1, 'ChangSiam'),
  (1, '3 Brothers'),
  (1, 'Little Thailand'),
  (1, 'Souvenir Thailand'),
  (1, 'ร้าน 100 บาท'),
  (1, 'ร้านร้อยบาท');

SELECT 'Phase 8 new modules migration completed.' AS status;
