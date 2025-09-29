import { validationResult } from 'express-validator';
import { Request, Response, NextFunction } from 'express';
import { knex } from '../db.js';
import { User, Address } from '../types/index.js';

/**
 * Account Controller - Manages user account settings and preferences
 * 
 * Handles user profile data that isn't authentication-related,
 * such as shipping addresses and other account preferences.
 * 
 * @module accountController
 */

/**
 * Safely parses JSON address data from database
 * Handles malformed JSON gracefully to prevent crashes
 */
function parseAddress(text: string | null | undefined): Address | null {
  if (!text) return null;
  try { 
    return JSON.parse(text) as Address; 
  } catch { 
    // Return null for malformed JSON instead of crashing
    return null; 
  }
}

/**
 * Get Saved Address Endpoint - Retrieves user's saved shipping address
 * 
 * GET /api/account/address
 * 
 * Requires: Bearer token authentication
 * 
 * Response:
 * - 200: { address: Object|null } - Saved address or null
 * - 401: Not authenticated
 * - 404: User not found
 */
export async function getAddress(
  req: Request, 
  res: Response<{ address: Address | null } | { error: string }>, 
  next: NextFunction
): Promise<void | Response> {
  try {
    // Verify authentication
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    
    // Fetch user record to get address
    const user = await knex<User>('users').where({ id: Number(req.user.id) }).first();
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Parse and return address (null if not set or invalid)
    return res.json({ address: parseAddress(user.address) });
  } catch (err) {
    next(err);
  }
}

/**
 * Update Saved Address Endpoint - Saves/updates user's shipping address
 * 
 * PUT /api/account/address
 * 
 * Requires: Bearer token authentication
 * 
 * Request Body: Address object with fields like:
 * - street: Street address
 * - city: City name
 * - state: State/Province
 * - zipCode: Postal code
 * - country: Country
 * 
 * Features:
 * - Overwrites existing address completely
 * - Stored as JSON string in database
 * - Can be used as default during checkout
 * 
 * Response:
 * - 200: { address: Object } - Updated address
 * - 400: Validation errors
 * - 401: Not authenticated
 */
export async function updateAddress(
  req: Request<{}, {}, Address>, 
  res: Response<{ address: Address } | { error: string } | { errors: any[] }>, 
  next: NextFunction
): Promise<void | Response> {
  try {
    // Validate request body
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    
    // Verify authentication
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    // Extract address from request body
    const address = req.body;
    
    // Update user's address in database (stored as JSON string)
    await knex<User>('users')
      .where({ id: Number(req.user.id) })
      .update({ address: JSON.stringify(address) });
    
    // Return the updated address
    return res.json({ address });
  } catch (err) {
    next(err);
  }
}
