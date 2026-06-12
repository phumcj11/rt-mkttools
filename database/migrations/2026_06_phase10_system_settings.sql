-- Phase 10: System Settings table
-- Stores runtime-configurable key/value settings (e.g. OpenAI API key, model, channel tokens)

CREATE TABLE IF NOT EXISTS `system_settings` (
  `key`        VARCHAR(100)  NOT NULL,
  `value`      TEXT,
  `updated_at` TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Seed default rows (empty values — admin fills them via Settings UI)
INSERT IGNORE INTO `system_settings` (`key`, `value`) VALUES
  ('openai_api_key',      ''),
  ('openai_model',        'gpt-4o-mini'),
  ('openai_max_tokens',   '1024'),
  ('openai_temperature',  '0.7');
