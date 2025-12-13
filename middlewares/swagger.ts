import express from 'express';
import fs from 'fs';
import path from 'path';
import swaggerUi from 'swagger-ui-express';
import yaml from 'js-yaml';

export default function mountSwagger(app: express.Application) {
  const specPath = path.join(process.cwd(), 'docs', 'openapi.yaml');
  let spec: any = {};
  try {
    const raw = fs.readFileSync(specPath, 'utf8');
    spec = yaml.load(raw);
  } catch (err) {
    console.error('Failed to load OpenAPI spec:', err);
  }

  app.use('/docs', swaggerUi.serve, swaggerUi.setup(spec));
}
