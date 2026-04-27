-- Migration: Add characteristics to customers table
ALTER TABLE customers ADD COLUMN IF NOT EXISTS characteristics TEXT;
