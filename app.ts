import express from "express";
import authRoutes from "./routes/auth.routes.ts";
import apiKeyRoutes from "./routes/apiKey.routes.ts";
import { errorHandler } from "./middlewares/errorHandler.ts";

const app = express();

app.use(express.json());

app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/api-keys", apiKeyRoutes);

// Error handling middleware (must be last)
app.use(errorHandler);

export default app;
