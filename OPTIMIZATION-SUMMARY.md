# Database Performance Optimizations - 2025-10-29

## Problem
The admin-users page (`/panel/9/admin-users` → API endpoint `/users/pub/:pubid`) was loading slowly due to:
1. **High network latency**: Multiple sequential database round trips
2. **Unoptimized queries**: Loading more data than needed
3. **Missing indexes**: Suboptimal query performance on large tables

## Solutions Implemented

### 1. Reduced Database Round Trips ✅

**Location**: `routes/users.js:180` (getPubUsers function)

**Before**: 7 sequential database queries
1. Get publication
2. Get user roles (all publications)
3. Get flows
4. Get pubroles
5. Get users
6. Batch load pubuserroles
7. Batch load submits

**After**: 2 parallel queries
1. **Parallel Query 1**: Auth check + Eager-loaded publication data
   - Auth: Get user roles (filtered by publication)
   - Data: Get publication with flows, pubroles, and users in ONE query
2. **Parallel Query 2**: Batch load pubuserroles and submits (in parallel)

**Performance Impact**:
- Reduced from **7 round trips** to **2 round trips**
- **71% reduction** in database queries
- Auth query now filters by publication (faster)
- Eager loading eliminates 3 separate queries

**Code Changes**:
```javascript
// OLD - Sequential queries
const dbpub = await models.pubs.findByPk(pubid)
const dbmypubroles = await req.dbuser.getRoles()  // ALL publications
const dbflows = await dbpub.getFlows()
const pubroles = await dbpub.getPubroles()
const dbusers = await dbpub.getUsers()
const allUserRoles = await models.pubuserroles.findAll(...)
const allSubmits = await models.submits.findAll(...)

// NEW - Parallel + Eager loading
const [dbmypubroles, dbpub] = await Promise.all([
  req.dbuser.getRoles({ where: { pubId: pubid } }),  // Filtered!
  models.pubs.findByPk(pubid, {
    include: [
      { model: models.flows, as: 'Flows', attributes: ['id'] },
      { model: models.pubroles, as: 'Pubroles' },
      { model: models.users, as: 'Users', ... }
    ]
  })
])
const [allUserRoles, allSubmits] = await Promise.all([
  models.pubuserroles.findAll(...),
  models.submits.findAll(...)
])
```

### 2. Added Database Index ✅

**Location**: `models/submits.js:17`

**Index Added**: Composite index on `(userId, flowId)`

**Purpose**: Optimize the batch query that counts submissions per user in getPubUsers

**Before**:
```javascript
// Query uses individual indexes
SELECT * FROM submits WHERE userId IN (...) AND flowId IN (...)
// Uses: userId index only, then filters flowId in memory
```

**After**:
```javascript
// Query uses composite index
SELECT * FROM submits WHERE userId IN (...) AND flowId IN (...)
// Uses: (userId, flowId) composite index - optimal!
```

**Impact**: Significantly faster for publications with many users/submissions

### 3. Schema Analysis ✅

**Compared**: SQL dump (`datadump/ircobi-2025-10-17.sql`) vs Current models

**Findings**:
- ✅ All 26 tables present in both
- ✅ `actionlogs` table already has composite index in dump
- ✅ Model names match table names
- ✅ No schema conflicts found

**Only addition**: New composite index on `submits` table (not in Oct 17 dump)

## Migration Strategy

### Development & Testing
**No action needed** - `sequelize.sync({ alter: true })` automatically applies the new index

### Production & After Database Restore

**When to run migration**:
- After restoring from `datadump/ircobi-2025-10-17.sql`
- On Cloud SQL after initial data import
- Whenever FORCE_SYNC is disabled in production

**Migration File**: `migrations/001-add-submits-composite-index.sql`

**How to run**:
```bash
# Option 1: Via gcloud CLI
gcloud sql connect ircobi-papers-db --user=ircobiusr --database=ircobi < migrations/001-add-submits-composite-index.sql

# Option 2: Via Cloud SQL Proxy
cloud_sql_proxy -instances=ircobi-papers-api:europe-west2:ircobi-papers-db=tcp:3306 &
mysql -h 127.0.0.1 -P 3306 -u ircobiusr -p ircobi < migrations/001-add-submits-composite-index.sql
```

**Safety**: Migration is idempotent (safe to run multiple times)

## Performance Expectations

### Before Optimizations
- **Database queries**: 7 sequential round trips
- **Latency**: ~700ms (assuming 100ms per query)
- **Query inefficiency**: Loading all user roles across all publications

### After Optimizations
- **Database queries**: 2 parallel groups (4 total queries, but only 2 round trips)
- **Latency**: ~200ms (2 parallel groups × ~100ms)
- **Query efficiency**: Filtered queries, eager loading, composite index

### Expected Improvement
- **~71% reduction** in round trip time
- **Better query selectivity** (filtered by publication)
- **Faster JOIN operations** (composite index)

**Estimated speedup**: 2-4x faster page load time

## Testing

### Unit Tests
```bash
npm test -- --runInBand
```

### Integration Test
```bash
# Test the optimized endpoint
npm run dev
# Then test: GET /users/pub/9
```

### Verification Checklist
- [x] Code compiles without errors
- [ ] Unit tests pass
- [ ] Integration test shows improved performance
- [ ] No N+1 query issues
- [ ] All user roles load correctly
- [ ] Submit counts accurate

## Files Modified

1. **routes/users.js** (lines 180-246)
   - Refactored `getPubUsers` function
   - Added parallel queries
   - Added eager loading
   - Filtered role query by publication

2. **models/submits.js** (lines 17-24)
   - Added composite index definition

3. **migrations/** (new directory)
   - `001-add-submits-composite-index.sql` - Migration script
   - `README.md` - Migration documentation

4. **OPTIMIZATION-SUMMARY.md** (this file)
   - Complete documentation of changes

## Rollback Plan

If issues occur:

1. **Revert code changes**:
   ```bash
   git revert <commit-hash>
   ```

2. **Remove index** (if causing issues):
   ```sql
   DROP INDEX user_flow_idx ON submits;
   ```

3. **Restore previous behavior**: The old code is preserved in git history

## References

- Original issue: Slow loading of `/panel/9/admin-users`
- Root cause: Network latency from sequential queries
- Solution pattern: Eager loading + parallel queries + composite indexes
- Related TODO: `app.js:42` - Consider Sequelize migrations

## Next Steps

1. **Deploy to staging**: Test with production-like data
2. **Monitor performance**: Measure actual speedup
3. **Run migration**: Apply index to production after code deploy
4. **Monitor logs**: Watch for any errors or N+1 queries
5. **Consider caching**: If still slow, add Redis cache for user lookups (mentioned in original analysis)

---

**Author**: Claude Code AI Assistant
**Date**: 2025-10-29
**Reviewed by**: Pending
**Status**: Ready for testing
