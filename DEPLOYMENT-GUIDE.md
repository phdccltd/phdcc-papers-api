# IRCOBI Papers API - Cloud Run Deployment Guide

## 🌍 Infrastructure Setup (Completed)

All infrastructure is deployed in **UK (London) - europe-west2 region**.

### ✅ Created Resources

1. **GCP Project**: `ircobi-papers-api`
2. **Cloud SQL MySQL 8.0**: `ircobi-papers-db` (europe-west2)
   - Connection: `ircobi-papers-api:europe-west2:ircobi-papers-db`
   - Status: Creating (takes 5-10 minutes)
3. **GCS Bucket**: `gs://ircobi-papers-files-staging` (europe-west2)
4. **Service Account**: `ircobi-papers-api-sa@ircobi-papers-api.iam.gserviceaccount.com`
   - Permissions: Cloud SQL Client, Storage Object Admin, Secret Manager Accessor

### ✅ Enabled APIs
- Cloud Run
- Cloud SQL Admin
- Cloud Storage
- Cloud Scheduler
- Secret Manager

## 📋 Remaining Setup Steps

### Step 1: Wait for Cloud SQL Instance (In Progress)

Check status:
```bash
gcloud sql instances describe ircobi-papers-db --project=ircobi-papers-api
```

When `state: RUNNABLE`, proceed to Step 2.

### Step 2: Configure Cloud SQL Database

Once the instance is ready:

```bash
# Set root password
gcloud sql users set-password root \
  --host=% \
  --instance=ircobi-papers-db \
  --password='YOUR_SECURE_PASSWORD' \
  --project=ircobi-papers-api

# Create database
gcloud sql databases create ircobi \
  --instance=ircobi-papers-db \
  --project=ircobi-papers-api

# Create application user
gcloud sql users create ircobiusr \
  --instance=ircobi-papers-db \
  --password='b9zbH.8p_9PhyYcZ' \
  --project=ircobi-papers-api
```

### Step 3: Store Secrets in Secret Manager

Run the provided script:
```bash
./setup-secrets.sh
```

This will create the following secrets from your `.env.local`:
- DATABASE
- DBUSER
- DBPASS
- DB_HOST (Cloud SQL Unix socket path)
- JWT_SECRET
- RECAPTCHA_SECRET_KEY
- RECAPTCHA_BYPASS
- SCHEDULER_SECRET
- GCS_BUCKET_NAME

### Step 4: Deploy to Cloud Run

```bash
./deploy-cloud-run.sh
```

This will:
1. Build a Docker container using Cloud Build
2. Deploy to Cloud Run in europe-west2
3. Configure Cloud SQL connection
4. Inject secrets as environment variables
5. Set up autoscaling (0-10 instances)

## 🔧 Configuration Details

### Environment Variables (Non-Sensitive)
Set in Cloud Run directly:
- `NODE_ENV=production`
- `BASEURL=/api`
- `LOGMODE=cloudrun`

### Secrets (Sensitive)
Stored in Secret Manager and injected at runtime:
- Database credentials
- JWT secret
- reCAPTCHA keys
- Scheduler secret
- GCS bucket name

### Cloud SQL Connection
The app connects to Cloud SQL via **Unix socket**:
- Path: `/cloudsql/ircobi-papers-api:europe-west2:ircobi-papers-db`
- No need for Cloud SQL Proxy in Cloud Run (built-in)

### Database Configuration
Update `db.js` to detect Cloud Run environment:
```javascript
const isCloudRun = process.env.K_SERVICE !== undefined

const dbConfig = {
  host: isCloudRun
    ? process.env.DB_HOST  // Unix socket path
    : process.env.DBHOST || 'localhost',
  dialect: 'mysql',
  database: process.env.DATABASE,
  username: process.env.DBUSER,
  password: process.env.DBPASS,
  // ... rest of config
}
```

### File Storage
The app uses Google Cloud Storage instead of local filesystem:
- Bucket: `ircobi-papers-files-staging`
- SDK: `@google-cloud/storage` (already added to package.json)

## 🚀 Deployment Commands

### First-time Deployment
```bash
# 1. Wait for SQL instance to be ready
gcloud sql instances describe ircobi-papers-db --project=ircobi-papers-api

# 2. Configure database (see Step 2 above)

# 3. Store secrets
./setup-secrets.sh

# 4. Deploy
./deploy-cloud-run.sh
```

### Subsequent Deployments
```bash
./deploy-cloud-run.sh
```

## 📊 Monitoring and Logs

### View Logs
```bash
gcloud run services logs read ircobi-papers-api --region=europe-west2 --project=ircobi-papers-api
```

### View Service Details
```bash
gcloud run services describe ircobi-papers-api --region=europe-west2 --project=ircobi-papers-api
```

### Cloud SQL Connection
```bash
gcloud sql instances describe ircobi-papers-db --project=ircobi-papers-api
```

## 🔐 Security Notes

1. **Authentication**: Cloud Run service uses IAM service account
2. **Secrets**: All sensitive data in Secret Manager (never in code/env vars)
3. **Database**: Cloud SQL with private IP recommended for production
4. **Storage**: GCS with uniform bucket-level access
5. **HTTPS**: Automatic with Cloud Run managed certificates

## 💰 Cost Optimization

Current configuration:
- **Cloud Run**: Pay per request, auto-scales to zero
  - 512 MB memory, 1 vCPU
  - Min: 0 instances (no cost when idle)
  - Max: 10 instances
- **Cloud SQL**: db-f1-micro (smallest tier)
  - Consider stopping for development when not in use
- **Cloud Storage**: Standard class, europe-west2

## 🔄 Migration from PM2

Key differences from traditional deployment:
- ❌ No PM2 process manager
- ❌ No Apache/Nginx reverse proxy
- ❌ No local file storage
- ✅ Automatic scaling
- ✅ Zero downtime deployments
- ✅ Managed SSL certificates
- ✅ Cloud-native logging and monitoring

## 📝 Next Steps

1. Update `db.js` to support Cloud SQL Unix socket connection
2. Update file upload/download code to use GCS instead of local filesystem
3. Test locally with Cloud SQL Proxy (optional)
4. Deploy to Cloud Run
5. Set up Cloud Scheduler for background tasks
6. Configure custom domain (optional)
7. Set up monitoring alerts
