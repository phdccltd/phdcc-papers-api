# PHDCC Papers API - Deployment Guide

This guide explains how the PHDCC Papers API is deployed on Google Cloud Platform using Cloud Run.

## Architecture Overview

```
Frontend (Firebase Hosting)              Backend API (This Repo)
┌─────────────────────────┐             ┌──────────────────────────┐
│ Nuxt.js SPA             │   HTTPS     │ Cloud Run                │
│ ircobi-papers-api.web   │────────────▶│ Node.js Express API      │
│   .app                  │             │ Port 9000                │
└─────────────────────────┘             └──────────┬───────────────┘
                                                   │
                                                   │ Unix Socket
                                                   ▼
                                        ┌──────────────────────────┐
                                        │ Cloud SQL (MySQL 8.0)    │
                                        │ ircobi-papers-db         │
                                        └──────────────────────────┘
                                                   ▲
                                        ┌──────────┴───────────────┐
                                        │ Cloud Storage (GCS)      │
                                        │ ircobi-papers-files-     │
                                        │   staging                │
                                        └──────────────────────────┘

Project: ircobi-papers-api
Region: europe-west2 (London)
```

## Deployed Infrastructure

### GCP Resources

**Cloud Run Service:**
- Name: `ircobi-papers-api`
- URL: `https://ircobi-papers-api-192399026075.europe-west2.run.app`
- Region: europe-west2
- CPU: 1 vCPU
- Memory: 512 MB
- Scaling: 0-10 instances (auto-scales to zero)
- Service Account: `ircobi-papers-api-sa@ircobi-papers-api.iam.gserviceaccount.com`

**Cloud SQL:**
- Instance: `ircobi-papers-db`
- Type: MySQL 8.0, db-f1-micro
- Connection: `ircobi-papers-api:europe-west2:ircobi-papers-db`
- Database: `ircobi`
- User: `ircobiusr`

**Cloud Storage:**
- Bucket: `gs://ircobi-papers-files-staging`
- Location: europe-west2
- Class: Standard
- Access: Uniform bucket-level access

**Service Account Permissions:**
- Cloud SQL Client
- Storage Object Admin
- Secret Manager Secret Accessor

## Configuration

### Environment Variables

Set directly in Cloud Run:
```bash
NODE_ENV=production
BASEURL=/api
LOGMODE=console  # or cloudrun
GCP_PROJECT_ID=ircobi-papers-api
CLOUD_SQL_CONNECTION_NAME=ircobi-papers-api:europe-west2:ircobi-papers-db
```

### Secrets (Cloud Secret Manager)

Sensitive configuration stored in Secret Manager:
- `DATABASE` - Database name (ircobi)
- `DBUSER` - Database username
- `DBPASS` - Database password
- `DB_HOST` - Cloud SQL Unix socket path
- `JWT_SECRET` - JWT signing secret
- `RECAPTCHA_SECRET_KEY` - reCAPTCHA verification key
- `RECAPTCHA_BYPASS` - Development bypass token
- `SCHEDULER_SECRET` - Cloud Scheduler authentication
- `GCS_BUCKET_NAME` - Storage bucket name

### Database Connection

The API connects to Cloud SQL via **Unix socket** (no Cloud SQL Proxy needed):

```javascript
// DB configuration (db.js)
const isCloudRun = process.env.K_SERVICE !== undefined

const dbConfig = {
  host: isCloudRun
    ? process.env.DB_HOST  // Unix socket: /cloudsql/...
    : process.env.DBHOST || 'localhost',
  dialect: 'mysql',
  database: process.env.DATABASE,
  username: process.env.DBUSER,
  password: process.env.DBPASS,
  // ... other config
}
```

## Deployment Process

### Prerequisites

- **GCP CLI** authenticated (`gcloud auth login`)
- **Project access** (Owner/Editor on `ircobi-papers-api`)
- **Docker** (for local testing, optional)
- **Node.js 20+** (for local development)

### Standard Deployment

Deploy using the deployment script:

```bash
./deploy-cloud-run.sh
```

This script:
1. Builds Docker image using Cloud Build
2. Pushes to Google Container Registry
3. Deploys new revision to Cloud Run
4. Routes 100% traffic to new revision
5. Connects to Cloud SQL
6. Injects secrets from Secret Manager

### Manual Deployment

If you need to deploy manually:

```bash
# Build and push container
gcloud builds submit \
  --tag gcr.io/ircobi-papers-api/papers-api:latest \
  --project ircobi-papers-api

# Deploy to Cloud Run
gcloud run deploy ircobi-papers-api \
  --image gcr.io/ircobi-papers-api/papers-api:latest \
  --platform managed \
  --region europe-west2 \
  --allow-unauthenticated \
  --add-cloudsql-instances ircobi-papers-api:europe-west2:ircobi-papers-db \
  --set-env-vars NODE_ENV=production,BASEURL=/api \
  --set-secrets DATABASE=DATABASE:latest,DBUSER=DBUSER:latest,DBPASS=DBPASS:latest \
  --service-account ircobi-papers-api-sa@ircobi-papers-api.iam.gserviceaccount.com \
  --memory 512Mi \
  --cpu 1 \
  --max-instances 10 \
  --project ircobi-papers-api
```

## Managing Secrets

### View Secrets

```bash
gcloud secrets list --project ircobi-papers-api
```

### Update a Secret

```bash
# Update RECAPTCHA_SECRET_KEY
echo -n "new-secret-value" | gcloud secrets versions add RECAPTCHA_SECRET_KEY --data-file=-
```

### Restart Cloud Run (to pick up new secrets)

```bash
gcloud run services update ircobi-papers-api \
  --region=europe-west2 \
  --update-labels=updated=$(date +%s)
```

Secrets are loaded when containers start, so you need to force a new revision for changes to take effect.

## Local Development

### Setup

1. **Clone repository**
2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Create `.env.local`:**
   ```bash
   DATABASE=ircobi
   DBUSER=ircobiusr
   DBPASS=your-password
   DBHOST=localhost  # or Cloud SQL Proxy connection
   JWT_SECRET=your-jwt-secret
   RECAPTCHA_SECRET_KEY=6LcPQfMrAAAAAOKGm1RHSbXixdnXbOa9BU3iVsM6
   RECAPTCHA_BYPASS=your-dev-bypass-token
   GCS_BUCKET_NAME=ircobi-papers-files-staging
   ```

4. **Connect to Cloud SQL (optional):**
   ```bash
   # Option 1: Cloud SQL Proxy
   cloud_sql_proxy -instances=ircobi-papers-api:europe-west2:ircobi-papers-db=tcp:3306

   # Option 2: Use local MySQL for development
   ```

5. **Run development server:**
   ```bash
   npm run dev
   ```

The API will run on `http://localhost:9000`.

## Monitoring & Logs

### View Logs

**Cloud Run logs:**
```bash
gcloud run services logs read ircobi-papers-api \
  --region=europe-west2 \
  --limit=100
```

**Or in Console:**
https://console.cloud.google.com/run/detail/europe-west2/ircobi-papers-api/logs

### View Service Details

```bash
gcloud run services describe ircobi-papers-api \
  --region=europe-west2 \
  --format yaml
```

### View Current Revision

```bash
gcloud run revisions list \
  --service=ircobi-papers-api \
  --region=europe-west2 \
  --limit=5
```

### Monitor Database

```bash
# Cloud SQL instance status
gcloud sql instances describe ircobi-papers-db

# Cloud SQL operations
gcloud sql operations list --instance=ircobi-papers-db --limit=10
```

## Troubleshooting

### API Returns 500 Errors

**Check logs:**
```bash
gcloud run services logs read ircobi-papers-api \
  --region=europe-west2 \
  --limit=50
```

**Common issues:**
- Database connection failure (check Cloud SQL instance is running)
- Missing/incorrect secrets (verify in Secret Manager)
- Out of memory (check memory usage, increase if needed)

### Database Connection Issues

**Verify Cloud SQL:**
```bash
gcloud sql instances describe ircobi-papers-db
# Should show: state: RUNNABLE
```

**Check service account permissions:**
```bash
gcloud projects get-iam-policy ircobi-papers-api \
  --flatten="bindings[].members" \
  --filter="bindings.members:ircobi-papers-api-sa@"
```

### "Failed captcha verification" in Frontend

**Problem:** reCAPTCHA secret key is incorrect or not set

**Solution:**
```bash
# Verify secret exists
gcloud secrets versions list RECAPTCHA_SECRET_KEY

# Update if needed
echo -n "6LcPQfMrAAAAAOKGm1RHSbXixdnXbOa9BU3iVsM6" | \
  gcloud secrets versions add RECAPTCHA_SECRET_KEY --data-file=-

# Restart Cloud Run
gcloud run services update ircobi-papers-api \
  --region=europe-west2 \
  --update-labels=updated=$(date +%s)
```

### Cold Start Latency

Cloud Run scales to zero when idle. First request after idle period takes 2-5 seconds.

**Options:**
- Accept cold starts (free when idle)
- Set minimum instances to 1 (costs more)
- Use Cloud Scheduler to keep instance warm

### File Upload/Download Issues

**Check Cloud Storage:**
```bash
# List files in bucket
gsutil ls gs://ircobi-papers-files-staging/

# Check bucket permissions
gsutil iam get gs://ircobi-papers-files-staging/
```

**Verify service account has access:**
- Storage Object Admin role required

## Rolling Back

### Rollback to Previous Revision

1. **List recent revisions:**
   ```bash
   gcloud run revisions list \
     --service=ircobi-papers-api \
     --region=europe-west2
   ```

2. **Route traffic to old revision:**
   ```bash
   gcloud run services update-traffic ircobi-papers-api \
     --region=europe-west2 \
     --to-revisions=REVISION_NAME=100
   ```

## Security

### Authentication & Authorization
- **Public endpoint:** API is publicly accessible (no IAM required)
- **Application auth:** JWT tokens for user authentication
- **reCAPTCHA:** Bot protection on login/registration

### Network Security
- **HTTPS only:** Automatic SSL/TLS via Cloud Run
- **CORS:** Configured to allow Firebase Hosting domain
- **Rate limiting:** Consider adding Cloud Armor for DDoS protection

### Data Protection
- **Secrets:** All sensitive data in Secret Manager (never in code)
- **Database:** Cloud SQL with automatic backups
- **Files:** Cloud Storage with versioning enabled
- **Encryption:** Data encrypted at rest and in transit

## Cost Management

### Current Configuration Costs

**Cloud Run:**
- **Idle:** $0 (scales to zero)
- **Active:** ~$0.00002400/request + $0.0000100/GB-second memory

**Cloud SQL (db-f1-micro):**
- **Running:** ~$7.67/month (0.6 GB RAM, 3 GB storage)
- **Consider:** Stop instance when not in use for development

**Cloud Storage:**
- **Storage:** ~$0.020/GB/month
- **Operations:** Minimal (free tier covers most usage)

**Cloud Build:**
- **First 120 minutes/day:** Free
- **After:** $0.003/build-minute

**Typical monthly cost:** $10-20 for light usage

### Cost Optimization Tips

1. **Stop Cloud SQL when not in use** (development):
   ```bash
   gcloud sql instances patch ircobi-papers-db --activation-policy=NEVER
   ```

2. **Monitor usage:**
   https://console.cloud.google.com/billing/

3. **Set up billing alerts:**
   - Budget: $50/month
   - Alert at 50%, 90%, 100%

## Related Documentation

- **Frontend Deployment:** See `../phdcc-papers/DEPLOYMENT-GUIDE.md`
- **API Documentation:** See `README.md`
- **Database Schema:** See `docs/database-schema.md` (if exists)

## Support

- **GCP Console:** https://console.cloud.google.com/run/detail/europe-west2/ircobi-papers-api
- **Firebase Console:** https://console.firebase.google.com/project/ircobi-papers-api
- **GCP Support:** https://cloud.google.com/support
