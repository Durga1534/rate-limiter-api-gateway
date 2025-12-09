/**
 * API Key Routes
 * All endpoints require authentication
 */

import express from 'express';
import {
  createApiKeyController,
  listApiKeysController,
  revokeApiKeyController,
  regenerateApiKeyController,
  deleteApiKeyController,
} from '../controllers/apiKeyController.ts';
import { jwtAuthMiddleware } from '../middlewares/apiKeyAuth.ts';
import { asyncMiddleware } from '../middlewares/errorHandler.ts';

const router = express.Router();

// All API key endpoints require JWT authentication
router.use(asyncMiddleware(jwtAuthMiddleware));

/**
 * POST /api/v1/api-keys
 * Create a new API key
 */
router.post('/', createApiKeyController);

/**
 * GET /api/v1/api-keys
 * List all API keys for authenticated user
 */
router.get('/', listApiKeysController);

/**
 * POST /api/v1/api-keys/:keyId/revoke
 * Revoke an API key
 */
router.post('/:keyId/revoke', revokeApiKeyController);

/**
 * POST /api/v1/api-keys/:keyId/regenerate
 * Regenerate an API key (revoke old, create new)
 */
router.post('/:keyId/regenerate', regenerateApiKeyController);

/**
 * DELETE /api/v1/api-keys/:keyId
 * Delete an API key permanently
 */
router.delete('/:keyId', deleteApiKeyController);

export default router;
