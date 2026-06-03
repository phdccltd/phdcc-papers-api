# Database Migrations

This directory contains SQL migration scripts for schema changes that need to be applied to production databases.

## Why Migrations?

The application uses `sequelize.sync({ alter: true })` in development/testing environments (see `app.js:44-53`), which automatically updates the database schema to match the Sequelize models. However:

1. **Production databases** skip sync for performance (unless `FORCE_SYNC=true`)
2. **Database restores** from dumps (like `datadump/ircobi-2025-10-17.sql`) don't include recent schema changes
3. **Cloud SQL** instances need explicit schema updates

## Migration Strategy

### Development & Testing
- No action needed - `sequelize.sync({ alter: true })` automatically applies model changes
- Indexes defined in models are created automatically on startup

### Production & After Database Restore
- Run migration scripts manually after:
  - Restoring from a database dump
  - Initial Cloud SQL database creation
  - When `FORCE_SYNC` is not enabled

## How to Run Migrations

### Option 1: Via Cloud SQL gcloud CLI
```bash
# Connect to Cloud SQL
gcloud sql connect ircobi-papers-db --user=ircobiusr --database=ircobi

# Paste the SQL from the migration file
# Or run it directly:
cat migrations/001-add-submits-composite-index.sql | \
  gcloud sql connect ircobi-papers-db --user=ircobiusr --database=ircobi
```

### Option 2: Via Cloud SQL Proxy
```bash
# Start the proxy
cloud_sql_proxy -instances=ircobi-papers-api:europe-west2:ircobi-papers-db=tcp:3306 &

# Run migration
mysql -h 127.0.0.1 -P 3306 -u ircobiusr -p ircobi < migrations/001-add-submits-composite-index.sql
```

### Option 3: Via Cloud SQL Direct Connection
```bash
# Get the Cloud SQL IP address
gcloud sql instances describe ircobi-papers-db --format="value(ipAddresses[0].ipAddress)"

# Run migration
mysql -h CLOUD_SQL_IP -u ircobiusr -p ircobi < migrations/001-add-submits-composite-index.sql
```

## Migration Files

| File | Date | Description |
|------|------|-------------|
| `001-add-submits-composite-index.sql` | 2025-10-29 | Adds composite index on `submits(userId, flowId)` for admin-users page performance |
| `002-increase-pubs-alias-length.sql` | 2025-11-12 | Increases `pubs.alias` from VARCHAR(50) to VARCHAR(150) to fix duplication error |

## Creating New Migrations

When adding new indexes or schema changes:

1. **Update the Sequelize model** (in `models/` directory)
   - Add indexes to the model definition
   - This ensures dev/test environments get the change via sync

2. **Create a migration SQL file**
   - Name format: `NNN-description.sql` (e.g., `002-add-user-email-index.sql`)
   - Make it idempotent (safe to run multiple times)
   - Include documentation in comments
   - Test in development first

3. **Document the migration**
   - Add entry to the table above
   - Update this README if needed
   - Note any special considerations

## Idempotency

All migrations should be idempotent (safe to run multiple times). Use patterns like:

```sql
-- Check if index exists
SET @index_exists = (
  SELECT COUNT(*)
  FROM information_schema.statistics
  WHERE table_schema = DATABASE()
    AND table_name = 'your_table'
    AND index_name = 'your_index'
);

-- Create only if not exists
SET @sql = IF(@index_exists = 0,
  'CREATE INDEX your_index ON your_table (column)',
  'SELECT "Index already exists, skipping" AS Status'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
```

## After Database Restore Checklist

When restoring from `datadump/ircobi-2025-10-17.sql`:

- [ ] Restore database from dump
- [ ] Run all migration scripts in order (001, 002, etc.)
- [ ] Verify indexes exist: `SHOW INDEX FROM submits;`
- [ ] Test application performance
- [ ] Check Cloud Run logs for errors

## Notes

- **Production Safety**: All migrations are designed to be non-destructive
- **Performance**: Index creation on large tables may take time - run during low-traffic periods
- **Rollback**: To remove an index, use `DROP INDEX index_name ON table_name;`
- **Version Control**: All migration files are tracked in git - never delete old migrations
