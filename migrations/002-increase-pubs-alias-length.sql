-- Migration: Increase alias column length in pubs table
-- Date: 2025-11-12
-- Purpose: Fix "Data too long for column 'alias'" error when duplicating publications
--
-- This migration increases the alias column length from VARCHAR(50) to VARCHAR(150)
-- to accommodate longer aliases generated from site URL + publication name.
--
-- Example alias that caused failure:
-- "org.ircobi.conference.long-publication-name-copy" (>50 chars)
--
-- WHEN TO RUN THIS:
-- 1. In production Cloud SQL immediately
-- 2. In any environment where publication duplication is failing
-- 3. After updating the Sequelize model in models/pubs.js
--
-- HOW TO RUN:
-- Option A: Via gcloud (from local machine):
--   gcloud sql connect ircobi-papers-db --user=ircobiusr --database=ircobi
--   Then paste this SQL
--
-- Option B: Via mysql command line:
--   mysql -h CLOUD_SQL_IP -u ircobiusr -p ircobi < migrations/002-increase-pubs-alias-length.sql
--
-- Option C: Via Cloud SQL proxy:
--   cloud_sql_proxy -instances=PROJECT:REGION:INSTANCE=tcp:3306 &
--   mysql -h 127.0.0.1 -P 3306 -u ircobiusr -p ircobi < migrations/002-increase-pubs-alias-length.sql
--
-- SAFETY: This migration is idempotent - safe to run multiple times
-- ============================================================================

-- Check current column definition
SELECT 'Checking current alias column definition...' AS Status;

SELECT
  COLUMN_NAME,
  COLUMN_TYPE,
  CHARACTER_MAXIMUM_LENGTH
FROM information_schema.COLUMNS
WHERE table_schema = DATABASE()
  AND table_name = 'pubs'
  AND column_name = 'alias';

-- Alter the column to increase length
SELECT 'Increasing alias column length from VARCHAR(50) to VARCHAR(150)...' AS Status;

ALTER TABLE pubs MODIFY COLUMN alias VARCHAR(150) NOT NULL;

-- Verify the change
SELECT
  CASE
    WHEN CHARACTER_MAXIMUM_LENGTH = 150 THEN 'SUCCESS: alias column is now VARCHAR(150)'
    ELSE CONCAT('ERROR: alias column is still ', COLUMN_TYPE)
  END AS Result
FROM information_schema.COLUMNS
WHERE table_schema = DATABASE()
  AND table_name = 'pubs'
  AND column_name = 'alias';

-- Show the updated column definition
SELECT '=== Updated column definition ===' AS '';
DESCRIBE pubs;
