-- Phase 8: Migrate old roles to new 6-role structure + set fixed org
-- Run this BEFORE deploying new backend code

-- 1. Ensure tenant id=1 is 100 Baht Shop Thailand
INSERT INTO tenants (id, name, slug, status, locale, created_at, updated_at)
VALUES (1, '100 Baht Shop Thailand', '100bahtshop', 'active', 'th', NOW(), NOW())
ON DUPLICATE KEY UPDATE
  name = '100 Baht Shop Thailand',
  status = 'active';

-- 2. Add new roles (safe upsert)
INSERT INTO roles (name, description) VALUES
  ('super_admin',       'ผู้ดูแลระบบสูงสุด — สิทธิ์เต็ม'),
  ('marketing_manager', 'ผู้จัดการฝ่ายการตลาด'),
  ('marketing_staff',   'เจ้าหน้าที่การตลาด'),
  ('branch_manager',    'ผู้จัดการสาขา'),
  ('customer_service',  'เจ้าหน้าที่ลูกค้าสัมพันธ์')
ON DUPLICATE KEY UPDATE description = VALUES(description);

-- Ensure admin exists too
INSERT INTO roles (name, description) VALUES ('admin', 'ผู้ดูแลระบบ')
ON DUPLICATE KEY UPDATE description = VALUES(description);

-- 3. Map old role IDs to new ones in user_roles join table
-- owner → super_admin
SET @old_owner = (SELECT id FROM roles WHERE name = 'owner' LIMIT 1);
SET @new_super  = (SELECT id FROM roles WHERE name = 'super_admin' LIMIT 1);
SET @new_admin  = (SELECT id FROM roles WHERE name = 'admin' LIMIT 1);
SET @old_editor = (SELECT id FROM roles WHERE name = 'editor' LIMIT 1);
SET @new_staff  = (SELECT id FROM roles WHERE name = 'marketing_staff' LIMIT 1);
SET @old_viewer = (SELECT id FROM roles WHERE name = 'viewer' LIMIT 1);
SET @new_cs     = (SELECT id FROM roles WHERE name = 'customer_service' LIMIT 1);

-- Migrate user_roles: owner → super_admin (ignore duplicates)
INSERT IGNORE INTO user_roles (user_id, role_id)
  SELECT user_id, @new_super FROM user_roles WHERE role_id = @old_owner AND @old_owner IS NOT NULL;

-- Migrate user_roles: editor → marketing_staff
INSERT IGNORE INTO user_roles (user_id, role_id)
  SELECT user_id, @new_staff FROM user_roles WHERE role_id = @old_editor AND @old_editor IS NOT NULL;

-- Migrate user_roles: viewer → customer_service
INSERT IGNORE INTO user_roles (user_id, role_id)
  SELECT user_id, @new_cs FROM user_roles WHERE role_id = @old_viewer AND @old_viewer IS NOT NULL;

-- admin stays as admin (already exists with same name, no migration needed)

-- 4. Remove old role assignments
DELETE FROM user_roles WHERE role_id IN (
  SELECT id FROM roles WHERE name IN ('owner', 'editor', 'viewer')
);

-- 5. Remove old roles
DELETE FROM roles WHERE name IN ('owner', 'editor', 'viewer');

SELECT 'Phase 8 migration completed.' AS status;
