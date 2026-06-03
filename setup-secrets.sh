#!/bin/bash
# Setup Google Secret Manager secrets for IRCOBI Papers API
# These secrets will be injected into Cloud Run at runtime

set -e

PROJECT_ID="ircobi-papers-api"

echo "🔐 Setting up Secret Manager for IRCOBI Papers API"
echo "Project: $PROJECT_ID"
echo ""

# Load values from .env.local
if [ ! -f .env.local ]; then
  echo "❌ Error: .env.local file not found"
  exit 1
fi

source .env.local

# Function to create or update a secret
create_or_update_secret() {
  local SECRET_NAME=$1
  local SECRET_VALUE=$2

  echo "Setting up secret: $SECRET_NAME"

  # Check if secret exists
  if gcloud secrets describe $SECRET_NAME --project=$PROJECT_ID &>/dev/null; then
    # Secret exists, add new version
    echo "$SECRET_VALUE" | gcloud secrets versions add $SECRET_NAME --data-file=- --project=$PROJECT_ID
  else
    # Create new secret
    echo "$SECRET_VALUE" | gcloud secrets create $SECRET_NAME --data-file=- --replication-policy="automatic" --project=$PROJECT_ID
  fi
}

# Create/update all secrets
create_or_update_secret "DATABASE" "$DATABASE"
create_or_update_secret "DBUSER" "$DBUSER"
create_or_update_secret "DBPASS" "$DBPASS"
create_or_update_secret "DB_HOST" "/cloudsql/ircobi-papers-api:europe-west2:ircobi-papers-db"
create_or_update_secret "JWT_SECRET" "$JWT_SECRET"
create_or_update_secret "RECAPTCHA_SECRET_KEY" "$RECAPTCHA_SECRET_KEY"
create_or_update_secret "RECAPTCHA_BYPASS" "$RECAPTCHA_BYPASS"
create_or_update_secret "SCHEDULER_SECRET" "$SCHEDULER_SECRET"
create_or_update_secret "GCS_BUCKET_NAME" "$GCS_BUCKET_NAME"

echo ""
echo "✅ All secrets have been stored in Secret Manager"
echo ""
echo "📋 Secrets created:"
gcloud secrets list --project=$PROJECT_ID
