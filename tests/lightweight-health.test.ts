import request from 'supertest';
import express from 'express';

// Create a minimal test app without external dependencies
const testApp = express();

testApp.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    uptimeSeconds: Math.floor(process.uptime()),
    timestamp: Date.now(),
  });
});

describe('Lightweight Health Check Tests', () => {
  describe('GET /health', () => {
    it('should return health status', async () => {
      const response = await request(testApp)
        .get('/health')
        .expect(200);

      expect(response.body).toHaveProperty('status', 'ok');
      expect(response.body).toHaveProperty('timestamp');
      expect(response.body).toHaveProperty('uptimeSeconds');
    });
  });
});
