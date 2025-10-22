/**
 * Google Cloud Storage Helper Module
 * Handles file uploads, downloads, and deletions
 */

const { Storage } = require('@google-cloud/storage')
const logger = require('../logger')

let storage = null
let bucket = null
let bucketName = null

/**
 * Initialize GCS client
 * Called once on app startup
 */
function initialize () {
  if (process.env.TESTING) {
    logger.log('GCS: Skipping initialization in test mode')
    return
  }

  bucketName = process.env.GCS_BUCKET_NAME
  if (!bucketName) {
    logger.log('GCS: No bucket name configured, file uploads will fail')
    return
  }

  // In Cloud Run, uses Application Default Credentials automatically
  // In local dev, uses GOOGLE_APPLICATION_CREDENTIALS env var
  storage = new Storage({
    projectId: process.env.GCP_PROJECT_ID
  })

  bucket = storage.bucket(bucketName)
  logger.log(`GCS: Initialized with bucket: ${bucketName}`)
}

/**
 * Upload file to GCS
 * @param {Buffer} fileBuffer - File data as buffer
 * @param {string} gcsPath - Path in GCS bucket (e.g., '1/2/3/4/5/paper.pdf')
 * @param {string} mimeType - MIME type (e.g., 'application/pdf')
 * @returns {Promise<string>} - GCS file path
 */
async function uploadFile (fileBuffer, gcsPath, mimeType) {
  if (process.env.TESTING || !bucket) {
    logger.log(`GCS: Mock upload to ${gcsPath}`)
    return gcsPath
  }

  const file = bucket.file(gcsPath)

  await file.save(fileBuffer, {
    contentType: mimeType,
    metadata: {
      cacheControl: 'public, max-age=31536000' // Cache for 1 year
    }
  })

  logger.log(`GCS: Uploaded file to ${gcsPath}`)
  return gcsPath
}

/**
 * Download file from GCS as buffer
 * @param {string} gcsPath - Path in GCS bucket
 * @returns {Promise<Buffer>} - File data
 */
async function downloadFile (gcsPath) {
  if (process.env.TESTING || !bucket) {
    logger.log(`GCS: Mock download from ${gcsPath}`)
    return Buffer.from('mock file content')
  }

  const file = bucket.file(gcsPath)
  const [contents] = await file.download()

  logger.log(`GCS: Downloaded file from ${gcsPath}`)
  return contents
}

/**
 * Stream file from GCS (for large files)
 * @param {string} gcsPath - Path in GCS bucket
 * @returns {ReadableStream} - File stream
 */
function createReadStream (gcsPath) {
  if (process.env.TESTING || !bucket) {
    const { Readable } = require('stream')
    const mockStream = new Readable()
    mockStream.push('mock file content')
    mockStream.push(null)
    return mockStream
  }

  const file = bucket.file(gcsPath)
  return file.createReadStream()
}

/**
 * Delete file from GCS
 * @param {string} gcsPath - Path in GCS bucket
 */
async function deleteFile (gcsPath) {
  if (process.env.TESTING || !bucket) {
    logger.log(`GCS: Mock delete ${gcsPath}`)
    return
  }

  const file = bucket.file(gcsPath)
  await file.delete()

  logger.log(`GCS: Deleted file ${gcsPath}`)
}

/**
 * Move file to archive directory
 * @param {string} gcsPath - Original path
 * @returns {Promise<string>} - New archive path
 */
async function archiveFile (gcsPath) {
  if (process.env.TESTING || !bucket) {
    const archivePath = `archive/${gcsPath}`
    logger.log(`GCS: Mock archive ${gcsPath} → ${archivePath}`)
    return archivePath
  }

  const archivePath = `archive/${gcsPath}`
  const sourceFile = bucket.file(gcsPath)
  const destFile = bucket.file(archivePath)

  await sourceFile.copy(destFile)
  await sourceFile.delete()

  logger.log(`GCS: Archived ${gcsPath} → ${archivePath}`)
  return archivePath
}

/**
 * Check if file exists in GCS
 * @param {string} gcsPath - Path to check
 * @returns {Promise<boolean>}
 */
async function fileExists (gcsPath) {
  if (process.env.TESTING || !bucket) {
    return true
  }

  const file = bucket.file(gcsPath)
  const [exists] = await file.exists()
  return exists
}

/**
 * Get signed URL for temporary download access
 * @param {string} gcsPath - Path in GCS bucket
 * @param {number} expiresInMinutes - URL expiry time (default 15 minutes)
 * @returns {Promise<string>} - Signed URL
 */
async function getSignedUrl (gcsPath, expiresInMinutes = 15) {
  if (process.env.TESTING || !bucket) {
    return `http://localhost/mock/${gcsPath}`
  }

  const file = bucket.file(gcsPath)
  const [url] = await file.getSignedUrl({
    version: 'v4',
    action: 'read',
    expires: Date.now() + expiresInMinutes * 60 * 1000
  })

  return url
}

module.exports = {
  initialize,
  uploadFile,
  downloadFile,
  createReadStream,
  deleteFile,
  archiveFile,
  fileExists,
  getSignedUrl
}
