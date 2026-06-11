-- Phase 7 — Invoice payment metadata (manual / bank transfer MVP)
SET NAMES utf8mb4;

ALTER TABLE invoices
  ADD COLUMN payment_method VARCHAR(40) NULL AFTER status,
  ADD COLUMN payment_reference VARCHAR(120) NULL AFTER payment_method;
