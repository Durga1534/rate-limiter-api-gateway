import { prisma } from "../prisma.ts"
import { hashPassword, verifyPassword, generateAccessToken } from "../utils/authHelper.ts"
import { validatePasswordStrength } from "../utils/passwordValidator.ts"
import { ValidationError, AuthenticationError, ConflictError } from "../utils/errors.ts"

export interface UserResponse {
    id: string;
    name?: string | null;
    email: string;
    createdAt: Date;
}

export interface AuthResponse {
    token: string;
    user: UserResponse;
}

export async function registerUser(
    name: string | undefined,
    email: string,
    password: string
): Promise<UserResponse> {
    // Validate password strength
    const passwordStrength = validatePasswordStrength(password);
    if (!passwordStrength.valid) {
        throw new ValidationError(
            'Password does not meet security requirements',
            { feedback: passwordStrength.feedback }
        );
    }

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
        throw new ConflictError('Email already registered');
    }

    // Hash password and create user
    const passwordHash = await hashPassword(password);
    const user = await prisma.user.create({
        data: { name, email, passwordHash },
        select: { id: true, name: true, email: true, createdAt: true }
    });

    return user;
}

export async function loginUser(email: string, password: string): Promise<AuthResponse> {
    // Find user by email
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
        throw new AuthenticationError('Invalid email or password');
    }

    // Verify password
    const isPasswordValid = await verifyPassword(password, user.passwordHash);
    if (!isPasswordValid) {
        throw new AuthenticationError('Invalid email or password');
    }

    // Generate token
    const token = generateAccessToken(user.id);

    return {
        token,
        user: {
            id: user.id,
            name: user.name,
            email: user.email,
            createdAt: user.createdAt
        }
    };
}