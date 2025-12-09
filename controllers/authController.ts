import express from 'express';
import z from "zod";
import { registerUser, loginUser } from "../services/authService.ts";
import { asyncHandler } from "../middlewares/errorHandler.ts";
import { createSuccessResponse } from "../utils/response.ts";
import { validatePasswordStrength } from "../utils/passwordValidator.ts";

// Validation schemas
const registerSchema = z.object({
    name: z.string().min(1).max(255).optional(),
    email: z.string().email('Invalid email format'),
    password: z.string().min(8, 'Password must be at least 8 characters'),
});

const loginSchema = z.object({
    email: z.string().email('Invalid email format'),
    password: z.string().min(1, 'Password is required'),
});

export const registerController = asyncHandler(
    async (req: express.Request, res: express.Response): Promise<void> => {
        const validatedData = registerSchema.parse(req.body);
        
        // Validate password strength
        const passwordStrength = validatePasswordStrength(validatedData.password);
        console.log(`[Register] User: ${validatedData.email}, Password strength: ${passwordStrength.score}/4`);

        const user = await registerUser(
            validatedData.name,
            validatedData.email,
            validatedData.password
        );

        res.status(201).json(
            createSuccessResponse(user, 'User registered successfully')
        );
    }
);

export const loginController = asyncHandler(
    async (req: express.Request, res: express.Response): Promise<void> => {
        const validatedData = loginSchema.parse(req.body);
        
        const response = await loginUser(validatedData.email, validatedData.password);

        res.status(200).json(
            createSuccessResponse(response, 'Login successful')
        );
    }
);