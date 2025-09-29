/**
 * Type definitions for Bob's Corn Backend
 * Central location for all shared types and interfaces
 */

// ============================================================
// DATABASE MODELS
// ============================================================

/**
 * User model from database
 */
export interface User {
  id: number;
  name: string;
  email: string;
  password_hash: string;
  address?: string | null;
  created_at?: Date | string;
}

/**
 * Product model from database
 */
export interface Product {
  id: number;
  slug: string;
  title: string;
  subtitle?: string | null;
  price: number | string;
  original_price?: number | string | null;
  rating?: number | null;
  rating_count?: number | null;
  tags?: string | null;  // JSON string
  images?: string | null;  // JSON string
  options?: string | null;  // JSON string
  description?: string | null;
  details?: string | null;  // JSON string
  specs?: string | null;  // JSON string
  badges?: string | null;  // JSON string
  created_at?: Date | string;
}

/**
 * Order model from database
 */
export interface Order {
  id: number;
  user_id: number;
  total: number | string;
  shipping_address?: string | null;  // JSON string
  status: string;
  created_at?: Date | string;
}

/**
 * OrderItem model from database
 */
export interface OrderItem {
  id: number;
  order_id: number;
  product_id: number;
  slug: string;
  title: string;
  price: number | string;
  quantity: number;
}

// ============================================================
// API RESPONSE MODELS
// ============================================================

/**
 * Product as returned by API (parsed JSON fields)
 */
export interface ProductResponse {
  id: string;
  slug: string;
  title: string;
  subtitle?: string;
  price: number;
  originalPrice?: number;
  rating: number;
  ratingCount: number;
  tags?: string[];
  images: string[];
  options?: Record<string, any>;
  description: string;
  details?: string[];
  specs?: Record<string, string>;
  badges?: string[];
}

/**
 * User info from JWT payload
 */
export interface JWTUser {
  id: string;
  email: string;
  name: string;
}

/**
 * JWT payload structure
 */
export interface JWTPayload {
  sub: string | number;  // User ID
  email: string;
  name: string;
  iat?: number;
  exp?: number;
}

/**
 * Address structure
 */
export interface Address {
  street: string;
  city: string;
  state: string;
  zipCode: string;
  country?: string;
}

// ============================================================
// REQUEST/RESPONSE TYPES
// ============================================================

/**
 * Purchase request body
 */
export interface PurchaseRequest {
  items: Array<{
    productId: string | number;
    quantity: number;
  }>;
  shippingAddress?: Address;
}

/**
 * Auth signup request
 */
export interface SignupRequest {
  name: string;
  email: string;
  password: string;
}

/**
 * Auth login request
 */
export interface LoginRequest {
  email: string;
  password: string;
}

/**
 * Auth response with token
 */
export interface AuthResponse {
  user: {
    id: string;
    name: string;
    email: string;
  };
  token: string;
}

/**
 * Order response
 */
export interface OrderResponse {
  id: string;
  userId: string;
  total: number;
  shippingAddress?: Address;
  status: string;
  createdAt: string;
  items: Array<{
    productId: string;
    slug: string;
    title: string;
    price: number;
    quantity: number;
  }>;
}

// ============================================================
// EXPRESS AUGMENTATION
// ============================================================

/**
 * Extend Express Request type to include our custom properties
 */
declare global {
  namespace Express {
    interface Request {
      id?: string;  // Request ID for tracing
      user?: JWTUser;  // Authenticated user info
    }
  }
}

// ============================================================
// UTILITY TYPES
// ============================================================

/**
 * Database query result count
 */
export interface CountResult {
  count: number | string;
}

/**
 * Generic API error response
 */
export interface ErrorResponse {
  error: string;
  details?: any;
  requestId?: string;
}

/**
 * Pagination parameters
 */
export interface PaginationParams {
  page?: number;
  limit?: number;
  sort?: string;
  order?: 'asc' | 'desc';
}

/**
 * Search parameters
 */
export interface SearchParams extends PaginationParams {
  q?: string;
  category?: string;
  minPrice?: number;
  maxPrice?: number;
}

/**
 * Rate limit info
 */
export interface RateLimitInfo {
  productId: string | number;
  requested: number;
  recentlyPurchased: number;
  limit: number;
  windowSeconds: number;
}
