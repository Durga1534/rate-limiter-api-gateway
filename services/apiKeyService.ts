/**
 * API Key Management Service
 */

import crypto from 'crypto';
import { prisma } from '../prisma.ts';
import { NotFoundError } from '../utils/errors.ts';

export interface ApiKeyResponse {
  id: string;
  key: string; // Only returned on creation
  maskedKey: string;
  status: 'ACTIVE' | 'DISABLED' | 'REVOKED';
  createdAt: Date;
  updatedAt: Date;
}

export interface ApiKeyListResponse {
  id: string;
  maskedKey: string;
  status: 'ACTIVE' | 'DISABLED' | 'REVOKED';
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Generate a random API key
 * Format: rl_<32 random chars>
 */
export function generateApiKey(): string {
  return 'rl_' + crypto.randomBytes(24).toString('hex');
}

/**
 * Hash API key using SHA256
 */
export function hashApiKey(key: string): string {
  return crypto.createHash('sha256').update(key).digest('hex');
}

/**
 * Mask API key for display (show first 6 and last 6 chars)
 */
export function maskApiKey(key: string): string {
  if (key.length <= 12) return '***';
  const start = key.substring(0, 6);
  const end = key.substring(key.length - 6);
  return `${start}...${end}`;
}

/**
 * Create a new API key for a user
 */
export async function createApiKey(userId: string, planId?: string): Promise<ApiKeyResponse> {
  // Check if user exists
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    throw new NotFoundError('User');
  }

  // Get or create default plan
  let plan = null;
  if (!planId) {
    plan = await prisma.ratePlan.findFirst({
      where: { name: 'free' },
    });
    if (!plan) {
      plan = await prisma.ratePlan.create({
        data: {
          name: 'free',
          requestsPerMinute: 10,
          requestsPerHour: 100,
          requestsPerDay: 1000,
          burstLimit: 20,
        },
      });
    }
    planId = plan.id;
  }

  const plainKey = generateApiKey();
  const keyHash = hashApiKey(plainKey);

  const apiKey = await prisma.apiKey.create({
    data: {
      userId,
      planId,
      keyHash,
      status: 'ACTIVE',
    },
  });

  return {
    id: apiKey.id,
    key: plainKey, // Only returned once
    maskedKey: maskApiKey(plainKey),
    status: apiKey.status,
    createdAt: apiKey.createdAt,
    updatedAt: apiKey.updatedAt,
  };
}

/**
 * List all API keys for a user (without exposing full keys)
 */
export async function listApiKeys(userId: string): Promise<ApiKeyListResponse[]> {
  const apiKeys = await prisma.apiKey.findMany({
    where: { userId },
    select: {
      id: true,
      keyHash: true,
      status: true,
      createdAt: true,
      updatedAt: true,
    },
    orderBy: { createdAt: 'desc' },
  });

  return apiKeys.map((key) => ({
    id: key.id,
    maskedKey: maskApiKey(key.keyHash), // Mask the hash for display
    status: key.status,
    createdAt: key.createdAt,
    updatedAt: key.updatedAt,
  }));
}

/**
 * Validate API key and return userId if valid
 */
export async function validateApiKey(key: string): Promise<string | null> {
  const keyHash = hashApiKey(key);

  const apiKey = await prisma.apiKey.findUnique({
    where: { keyHash },
    include: { user: true },
  });

  if (!apiKey || apiKey.status !== 'ACTIVE') {
    return null;
  }

  return apiKey.userId;
}

/**
 * Revoke an API key
 */
export async function revokeApiKey(userId: string, keyId: string): Promise<void> {
  const apiKey = await prisma.apiKey.findUnique({ where: { id: keyId } });

  if (!apiKey) {
    throw new NotFoundError('API Key');
  }

  if (apiKey.userId !== userId) {
    throw new Error('Unauthorized');
  }

  await prisma.apiKey.update({
    where: { id: keyId },
    data: { status: 'REVOKED' },
  });
}

/**
 * Regenerate an API key (revoke old, create new)
 */
export async function regenerateApiKey(userId: string, keyId: string): Promise<ApiKeyResponse> {
  const apiKey = await prisma.apiKey.findUnique({ where: { id: keyId } });

  if (!apiKey) {
    throw new NotFoundError('API Key');
  }

  if (apiKey.userId !== userId) {
    throw new Error('Unauthorized');
  }

  // Revoke old key
  await prisma.apiKey.update({
    where: { id: keyId },
    data: { status: 'REVOKED' },
  });

  // Create new key with same plan
  return createApiKey(userId, apiKey.planId);
}

/**
 * Delete an API key permanently
 */
export async function deleteApiKey(userId: string, keyId: string): Promise<void> {
  const apiKey = await prisma.apiKey.findUnique({ where: { id: keyId } });

  if (!apiKey) {
    throw new NotFoundError('API Key');
  }

  if (apiKey.userId !== userId) {
    throw new Error('Unauthorized');
  }

  await prisma.apiKey.delete({
    where: { id: keyId },
  });
}
