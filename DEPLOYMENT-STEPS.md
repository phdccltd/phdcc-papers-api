# Deployment Steps for Optimization Changes

## ✅ Completed
- [x] Code optimizations implemented
- [x] Changes committed to git
- [x] Changes pushed to remote repository (commit: 73bfb2f)

## 🚀 Next Steps to Complete

### 1. Authenticate with Google Cloud

The gcloud authentication needs to be refreshed. Run:

```bash
/home/edward/google-cloud-sdk/bin/gcloud auth login
```

This will:
1. Open a browser window
2. Ask you to sign in with edward@ehibbert.org.uk
3. Grant permissions to gcloud

### 2. Deploy to Cloud Run

Once authenticated, run:

```bash
GCLOUD_PATH=/home/edward/google-cloud-sdk/bin/gcloud bash deploy-cloud-run.sh
```

Expected output:
- 📦 Building container image (5-10 minutes)
- 🚢 Deploying to Cloud Run (2-3 minutes)
- ✅ Deployment complete with service URL

**Deployment Configuration:**
- **Project**: ircobi-papers-api
- **Service**: ircobi-papers-api
- **Region**: europe-west2 (London, UK)
- **Max instances**: 1
- **Memory**: 1Gi
- **CPU**: 1

### 3. Run Database Migration

After successful deployment, run the migration to add the composite index:

```bash
/home/edward/google-cloud-sdk/bin/gcloud sql connect ircobi-papers-db \
  --user=ircobiusr \
  --database=ircobi \
  --project=ircobi-papers-api < migrations/001-add-submits-composite-index.sql
```

You'll be prompted for the database password (stored in Secret Manager).

**What the migration does:**
- Checks if `user_flow_idx` index exists on `submits` table
- Creates composite index on `(userId, flowId)` if not present
- Verifies the index was created successfully
- Shows all indexes on submits table for confirmation

**Expected output:**
```
Status: Checking for existing user_flow_idx index on submits table...
Result: SUCCESS: Index user_flow_idx exists on submits table
=== Current indexes on submits table ===
Table: submits
Non_unique: 0
Key_name: PRIMARY
...
Non_unique: 1
Key_name: user_flow_idx
...
```

### 4. Verify Deployment

After migration, verify everything is working:

```bash
# Check Cloud Run service status
/home/edward/google-cloud-sdk/bin/gcloud run services describe ircobi-papers-api \
  --region=europe-west2 \
  --project=ircobi-papers-api \
  --format="value(status.url,status.conditions)"

# Check recent logs
/home/edward/google-cloud-sdk/bin/gcloud run services logs read ircobi-papers-api \
  --region=europe-west2 \
  --project=ircobi-papers-api \
  --limit=50
```

### 5. Test the Optimized Endpoint

Test the admin-users page to verify performance improvement:

1. Visit: https://ircobi-papers-api.web.app/panel/9/admin-users
2. Verify page loads faster (should be 2-4x faster)
3. Check browser DevTools Network tab to see API response time

**Expected improvement:**
- Before: ~700ms+ response time
- After: ~200ms response time (71% reduction)

## 📊 What Was Changed

### Code Changes
1. **routes/users.js:180** - `getPubUsers` function
   - Reduced from 7 sequential queries to 2 parallel queries
   - Added eager loading for pub/flows/pubroles/users
   - Filtered role query by publication

2. **models/submits.js:17** - Added composite index
   - Index on (userId, flowId)
   - Optimizes batch submission counting

### Migration Created
- **migrations/001-add-submits-composite-index.sql**
  - Idempotent SQL migration
  - Safe to run multiple times
  - Adds composite index to submits table

## 🔄 Rollback Plan (if needed)

If issues occur after deployment:

### 1. Rollback Code
```bash
# Revert to previous commit
git revert 73bfb2f
git push

# Redeploy
GCLOUD_PATH=/home/edward/google-cloud-sdk/bin/gcloud bash deploy-cloud-run.sh
```

### 2. Remove Index (if causing issues)
```bash
# Connect to database
/home/edward/google-cloud-sdk/bin/gcloud sql connect ircobi-papers-db \
  --user=ircobiusr \
  --database=ircobi \
  --project=ircobi-papers-api

# Run in MySQL prompt:
DROP INDEX user_flow_idx ON submits;
```

## 📝 Troubleshooting

### Authentication Issues
If authentication fails:
```bash
# List accounts
/home/edward/google-cloud-sdk/bin/gcloud auth list

# Revoke and re-authenticate
/home/edward/google-cloud-sdk/bin/gcloud auth revoke edward@ehibbert.org.uk
/home/edward/google-cloud-sdk/bin/gcloud auth login
```

### Deployment Fails
Check build logs:
```bash
/home/edward/google-cloud-sdk/bin/gcloud builds list \
  --project=ircobi-papers-api \
  --limit=5
```

### Migration Fails
- Migration is idempotent - safe to re-run
- Check database connection with:
  ```bash
  /home/edward/google-cloud-sdk/bin/gcloud sql instances describe ircobi-papers-db \
    --project=ircobi-papers-api
  ```

## 📞 Support

For detailed technical documentation, see:
- **OPTIMIZATION-SUMMARY.md** - Full technical details
- **migrations/README.md** - Migration documentation
- **CLOUD-RUN-README.md** - Cloud Run setup guide

---

**Status**: Ready to deploy
**Commit**: 73bfb2f
**Date**: 2025-10-29
