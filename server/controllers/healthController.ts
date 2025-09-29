/**
 * Health Controller - System health check and monitoring endpoint
 * 
 * Provides a simple health check endpoint for monitoring services,
 * load balancers, and uptime monitoring tools.
 * 
 * @module healthController
 */

import { Request, Response } from 'express';

/**
 * Health Check Endpoint - Returns server status and basic metrics
 * 
 * GET /health
 * 
 * Purpose:
 * - Load balancer health checks
 * - Uptime monitoring (Datadog, New Relic, etc.)
 * - Deployment verification
 * - Debugging and diagnostics
 * 
 * Response (always 200 if server is running):
 * - status: 'ok' - Server is operational
 * - uptime: Number - Process uptime in seconds
 * - env: String - Current environment (development/production)
 * - now: ISO 8601 timestamp - Current server time
 * 
 * Future Enhancements:
 * - Database connectivity check
 * - Memory usage statistics
 * - Request count metrics
 * - Version information
 */
export function health(_req: Request, res: Response): void {
  res.json({
    status: 'ok',                                      // Always 'ok' if server responds
    uptime: process.uptime(),                          // Process uptime in seconds
    env: process.env.NODE_ENV || 'development',        // Current environment
    now: new Date().toISOString(),                     // Server timestamp (UTC)
  });
}
