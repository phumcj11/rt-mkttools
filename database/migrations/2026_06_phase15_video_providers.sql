-- Multi-provider Product Video AI settings
INSERT IGNORE INTO system_settings (`key`, `value`) VALUES
  ('video_provider_default', 'gemini'),
  ('video_model_default', 'veo-3.0-generate-preview'),
  ('gemini_api_key', NULL),
  ('grok_api_key', NULL);
