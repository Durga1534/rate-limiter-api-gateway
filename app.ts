import express from "express";
import authRoutes from "./routes/auth.routes.ts";
import apiKeyRoutes from "./routes/apiKey.routes.ts";
import protectedRoutes from "./routes/protected.routes.ts";
import { errorHandler } from "./middlewares/errorHandler.ts";
import mountSwagger from './middlewares/swagger.ts';
import requestLogger from './middlewares/requestLogger.ts';
import { cacheResponse } from './middlewares/cache.ts';

const app = express();

app.use(express.json());

// Swagger UI (OpenAPI)
mountSwagger(app);

// Request logging
app.use(requestLogger);

app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/api-keys", apiKeyRoutes);
app.use("/api/v1", protectedRoutes);

// Optional: lightweight cache for GET endpoints (mounted AFTER protected routes so rate-limiter runs first)
app.use(cacheResponse({ ttl: 60 }));

// Error handling middleware (must be last)
app.use(errorHandler);

export default app;
