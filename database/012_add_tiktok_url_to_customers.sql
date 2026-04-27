-- Migration: Add tiktok_url to customers table
ALTER TABLE customers ADD COLUMN IF NOT EXISTS tiktok_url TEXT;
