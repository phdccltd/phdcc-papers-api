-- Migration: Add composite index on submits table for performance optimization
-- Date: 2025-10-29
-- Purpose: Improve query performance for getPubUsers endpoint (admin-users page)
--
-- This migration adds a composite index on (userId, flowId) to the submits table
-- to optimize the batch query that counts submissions per user.
--
-- WHEN TO RUN THIS:
-- 1. After restoring database from datadump/ircobi-2025-10-17.sql
-- 2. In production Cloud SQL after initial data migration
-- 3. In any environment where the submits table exists but lacks this index
--
-- HOW TO RUN:
-- Option A: Via gcloud (from local machine):
--   gcloud sql connect ircobi-papers-db --user=ircobiusr --database=ircobi
--   Then paste this SQL
--
-- Option B: Via mysql command line:
--   mysql -h CLOUD_SQL_IP -u ircobiusr -p ircobi < migrations/001-add-submits-composite-index.sql
--
-- Option C: Via Cloud SQL proxy:
--   cloud_sql_proxy -instances=PROJECT:REGION:INSTANCE=tcp:3306 &
--   mysql -h 127.0.0.1 -P 3306 -u ircobiusr -p ircobi < migrations/001-add-submits-composite-index.sql
--
-- SAFETY: This migration is idempotent - safe to run multiple times
-- ============================================================================

-- Check if index already exists before creating
SELECT 'Checking for existing user_flow_idx index on submits table...' AS Status;

SET @index_exists = (
  SELECT COUNT(*)
  FROM information_schema.statistics
  WHERE table_schema = DATABASE()
    AND table_name = 'submits'
    AND index_name = 'user_flow_idx'
);

-- Create index only if it doesn't exist
SET @sql = IF(@index_exists = 0,
  'CREATE INDEX user_flow_idx ON submits (userId, flowId)',
  'SELECT "Index user_flow_idx already exists, skipping creation" AS Status'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Verify the index was created
SELECT
  CASE
    WHEN COUNT(*) > 0 THEN 'SUCCESS: Index user_flow_idx exists on submits table'
    ELSE 'ERROR: Index was not created'
  END AS Result
FROM information_schema.statistics
WHERE table_schema = DATABASE()
  AND table_name = 'submits'
  AND index_name = 'user_flow_idx';

-- Show the table indexes for verification
SELECT '=== Current indexes on submits table ===' AS '';
SHOW INDEX FROM submits;
