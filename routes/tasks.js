/**
 * Background Tasks Endpoint
 * Triggered by Cloud Scheduler or manual testing
 */

const { Router } = require('express')
const backgroundRunner = require('../task')
const logger = require('../logger')

const router = Router()

/**
 * POST /tasks/background
 * Runs the reminder email background task
 *
 * Authentication: Bearer token from Cloud Scheduler
 * Timeout: 60 minutes (Cloud Run maximum)
 */
router.post('/tasks/background', async (req, res) => {
  // Verify request is from Cloud Scheduler
  const authHeader = req.get('Authorization')
  const expectedToken = `Bearer ${process.env.SCHEDULER_SECRET}`

  if (!process.env.SCHEDULER_SECRET) {
    logger.log('ERROR: SCHEDULER_SECRET not configured')
    return res.status(500).json({
      success: false,
      error: 'Server misconfiguration'
    })
  }

  if (authHeader !== expectedToken) {
    logger.log('ERROR: Unauthorized background task request')
    return res.status(401).json({
      success: false,
      error: 'Unauthorized'
    })
  }

  try {
    logger.log('Background task triggered by Cloud Scheduler')

    // Run background task (from task.js)
    await backgroundRunner()

    logger.log('Background task completed successfully')
    return res.status(200).json({
      success: true,
      message: 'Background task completed',
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    logger.log('ERROR: Background task failed:', error)
    return res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    })
  }
})

/**
 * GET /tasks/health
 * Health check endpoint for monitoring
 */
router.get('/tasks/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    nodeVersion: process.version
  })
})

module.exports = router
