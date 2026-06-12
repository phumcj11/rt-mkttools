-- Phase 9: Omnichannel Inbox — channel_configs, conversations, inbox_messages

-- Channel credentials per page/account (LINE OA, Facebook Page, WhatsApp, Web Chat)
CREATE TABLE IF NOT EXISTS channel_configs (
  id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  tenant_id   BIGINT UNSIGNED NOT NULL,
  channel     VARCHAR(50) NOT NULL COMMENT 'line|facebook|whatsapp|webchat',
  page_id     VARCHAR(255) NOT NULL COMMENT 'LINE channelId / FB pageId / WA phone number',
  page_name   VARCHAR(255) NOT NULL DEFAULT '',
  credentials JSON NOT NULL COMMENT 'channel-specific tokens stored as JSON',
  is_active   TINYINT(1) NOT NULL DEFAULT 1,
  created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_channel_page (tenant_id, channel, page_id),
  INDEX idx_cc_tenant (tenant_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Unified inbox conversations (one row per customer × channel)
CREATE TABLE IF NOT EXISTS conversations (
  id                BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  tenant_id         BIGINT UNSIGNED NOT NULL,
  channel           VARCHAR(50) NOT NULL,
  channel_config_id BIGINT UNSIGNED,
  external_id       VARCHAR(512) NOT NULL COMMENT 'userId/psid from the channel',
  customer_name     VARCHAR(255),
  customer_handle   VARCHAR(255),
  status            ENUM('open','resolved','pending') NOT NULL DEFAULT 'open',
  assigned_user_id  BIGINT UNSIGNED,
  last_message_at   TIMESTAMP NULL,
  unread_count      INT UNSIGNED NOT NULL DEFAULT 0,
  created_at        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_conv_external (tenant_id, channel, external_id),
  INDEX idx_conv_tenant (tenant_id),
  INDEX idx_conv_status (tenant_id, status),
  INDEX idx_conv_last (tenant_id, last_message_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Messages in each conversation (both inbound and outbound)
CREATE TABLE IF NOT EXISTS inbox_messages (
  id              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  conversation_id BIGINT UNSIGNED NOT NULL,
  tenant_id       BIGINT UNSIGNED NOT NULL,
  direction       ENUM('in','out') NOT NULL COMMENT 'in=from customer, out=from agent/AI',
  content         TEXT NOT NULL,
  media_url       VARCHAR(512),
  channel_msg_id  VARCHAR(512) COMMENT 'original message ID from channel',
  sent_at         TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_im_conv (conversation_id),
  INDEX idx_im_tenant (tenant_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SELECT 'Phase 9 inbox migration completed.' AS status;
