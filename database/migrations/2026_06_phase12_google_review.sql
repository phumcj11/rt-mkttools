-- Phase 12: Google Business Profile OAuth + Review Sync
-- เพิ่ม system_settings keys สำหรับ Google credentials และ OAuth tokens

INSERT IGNORE INTO system_settings (`key`, `value`) VALUES
  ('google_client_id',     ''),
  ('google_client_secret', ''),
  ('google_access_token',  ''),
  ('google_refresh_token', ''),
  ('google_token_expiry',  ''),
  ('google_location_name', ''),
  ('google_location_title','');
