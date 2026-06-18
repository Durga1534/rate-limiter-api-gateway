import { z } from 'zod';

/**
 * Validation schemas for authentication endpoints
 * Using Zod for runtime type validation and documentation
 */

// Reusable patterns
const emailSchema = z
  .string()
  .email('Invalid email format')
  .toLowerCase()
  .trim()
  .max(254, 'Email too long');

const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .regex(/[a-z]/, 'Password must contain lowercase letter')
  .regex(/[A-Z]/, 'Password must contain uppercase letter')
  .regex(/[0-9]/, 'Password must contain number')
  .regex(/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/, 'Password must contain special character')
  .max(128, 'Password too long');

const nameSchema = z
  .string()
  .min(2, 'Name must be at least 2 characters')
  .max(100, 'Name too long')
  .trim()
  .optional();

/**
 * User registration validation
 */
export const registerSchema = z.object({
  name: nameSchema,
  email: emailSchema,
  password: passwordSchema,
});

export type RegisterRequest = z.infer<typeof registerSchema>;

/**
 * User login validation
 */
export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Password required'),
});

export type LoginRequest = z.infer<typeof loginSchema>;

/**
 * API Key creation validation
 */
export const createApiKeySchema = z.object({
  name: z
    .string()
    .min(1, 'API key name required')
    .max(100, 'Name too long')
    .trim(),
  ratePlanId: z
    .string()
    .uuid('Invalid rate plan ID format')
    .optional(),
  description: z
    .string()
    .max(500, 'Description too long')
    .optional(),
});

export type CreateApiKeyRequest = z.infer<typeof createApiKeySchema>;

/**
 * Pagination validation
 */
export const paginationSchema = z.object({
  page: z.number().int().min(1, 'Page must be >= 1').default(1),
  limit: z.number().int().min(1, 'Limit must be >= 1').max(100, 'Limit must be <= 100').default(10),
});

export type PaginationRequest = z.infer<typeof paginationSchema>;

/**
 * Rate plan validation
 */
export const ratePlanSchema = z.object({
  name: z.string().min(1).max(100),
  requestsPerWindow: z.number().int().positive(),
  windowMs: z.number().int().positive(),
  description: z.string().optional(),
});

export type RatePlanRequest = z.infer<typeof ratePlanSchema>;