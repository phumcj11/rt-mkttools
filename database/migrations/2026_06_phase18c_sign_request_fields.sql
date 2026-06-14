-- sign_requests: link to chosen template + user-provided copy
ALTER TABLE sign_requests
  ADD COLUMN template_id BIGINT UNSIGNED NULL AFTER sign_size,
  ADD COLUMN headline VARCHAR(255) NULL AFTER template_id,
  ADD COLUMN benefits TEXT NULL AFTER headline;
