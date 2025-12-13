/**
 * API Key Controller
 */

import express from 'express';
import {
  createApiKey,
  listApiKeys,
  revokeApiKey,
  regenerateApiKey,
  deleteApiKey,
} from '../services/apiKeyService.ts';
import { asyncHandler } from '../middlewares/errorHandler.ts';
import { createSuccessResponse } from '../utils/response.ts';
import { AuthenticationError } from '../utils/errors.ts';

// Get userId from authenticated request
function getUserIdFromRequest(req: express.Request): string {
  const userId = (req as any).userId;
  if (!userId) {
    throw new AuthenticationError('User not authenticated');
  }
  return userId;
}

/**
 * POST /api/v1/api-keys
 * Create a new API key
 */
export const createApiKeyController = asyncHandler(
  async (req: express.Request, res: express.Response): Promise<void> => {
    const userId = getUserIdFromRequest(req);
    const apiKey = await createApiKey(userId);

    console.log(`[API Key] Created new key for user ${userId}`);

    res.status(201).json(
      createSuccessResponse(apiKey, 'API key created successfully')
    );
  }
);

export const listApiKeysController = asyncHandler(
  async (req: express.Request, res: express.Response): Promise<void> => {
    const userId = getUserIdFromRequest(req);
    const apiKeys = await listApiKeys(userId);

    res.status(200).json(
      createSuccessResponse(apiKeys, 'API keys retrieved successfully')
    );
  }
);

/**
 * POST /api/v1/api-keys/:keyId/revoke
 * Revoke an API key
 */
export const revokeApiKeyController = asyncHandler(
  async (req: express.Request, res: express.Response): Promise<void> => {
    const userId = getUserIdFromRequest(req);
    const { keyId } = req.params;

    await revokeApiKey(userId, keyId);

    console.log(`[API Key] Revoked key ${keyId} for user ${userId}`);

    res.status(200).json(
      createSuccessResponse(null, 'API key revoked successfully')
    );
  }
);

/**
 * POST /api/v1/api-keys/:keyId/regenerate
 * Regenerate an API key
 */
export const regenerateApiKeyController = asyncHandler(
  async (req: express.Request, res: express.Response): Promise<void> => {
    const userId = getUserIdFromRequest(req);
    const { keyId } = req.params;

    const newApiKey = await regenerateApiKey(userId, keyId);

    console.log(`[API Key] Regenerated key ${keyId} for user ${userId}`);

    res.status(201).json(
      createSuccessResponse(newApiKey, 'API key regenerated successfully')
    );
  }
);

/**
 * DELETE /api/v1/api-keys/:keyId
 * Delete an API key
 */
export const deleteApiKeyController = asyncHandler(
  async (req: express.Request, res: express.Response): Promise<void> => {
    const userId = getUserIdFromRequest(req);
    const { keyId } = req.params;

    await deleteApiKey(userId, keyId);

    console.log(`[API Key] Deleted key ${keyId} for user ${userId}`);

    res.status(200).json(
      createSuccessResponse(null, 'API key deleted successfully')
    );
  }
);
