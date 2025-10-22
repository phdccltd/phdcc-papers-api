#!/bin/bash
# Cloud Run Deployment Script for IRCOBI Papers API
# Deploy to UK (London) region: europe-west2

set -e

# Use gcloud from PATH, or override with GCLOUD_PATH environment variable
GCLOUD="${GCLOUD_PATH:-gcloud}"

PROJECT_ID="ircobi-papers-api"
SERVICE_NAME="ircobi-papers-api"
REGION="europe-west2"
SQL_INSTANCE="ircobi-papers-api:europe-west2:ircobi-papers-db"
SERVICE_ACCOUNT="ircobi-papers-api-sa@ircobi-papers-api.iam.gserviceaccount.com"

echo "🚀 Deploying IRCOBI Papers API to Cloud Run (UK - London)"
echo "Project: $PROJECT_ID"
echo "Region: $REGION"

# Build and submit the container to Google Cloud Build
echo "📦 Building container image..."
$GCLOUD builds submit --tag gcr.io/$PROJECT_ID/$SERVICE_NAME --project=$PROJECT_ID

# Deploy to Cloud Run
echo "🚢 Deploying to Cloud Run..."
$GCLOUD run deploy $SERVICE_NAME \
  --image gcr.io/$PROJECT_ID/$SERVICE_NAME \
  --platform managed \
  --region $REGION \
  --service-account $SERVICE_ACCOUNT \
  --add-cloudsql-instances $SQL_INSTANCE \
  --allow-unauthenticated \
  --max-instances 1 \
  --min-instances 0 \
  --memory 512Mi \
  --cpu 1 \
  --timeout 300 \
  --concurrency 80 \
  --set-env-vars "NODE_ENV=production,BASEURL=/api,LOGMODE=console,GCP_PROJECT_ID=ircobi-papers-api,CLOUD_SQL_CONNECTION_NAME=ircobi-papers-api:europe-west2:ircobi-papers-db" \
  --set-secrets "DATABASE=DATABASE:latest,DBUSER=DBUSER:latest,DBPASS=DBPASS:latest,DB_HOST=DB_HOST:latest,JWT_SECRET=JWT_SECRET:latest,RECAPTCHA_SECRET_KEY=RECAPTCHA_SECRET_KEY:latest,RECAPTCHA_BYPASS=RECAPTCHA_BYPASS:latest,SCHEDULER_SECRET=SCHEDULER_SECRET:latest,GCS_BUCKET_NAME=GCS_BUCKET_NAME:latest" \
  --project=$PROJECT_ID

echo "✅ Deployment complete!"
echo "🔗 Service URL:"
$GCLOUD run services describe $SERVICE_NAME --region $REGION --project=$PROJECT_ID --format="value(status.url)"
