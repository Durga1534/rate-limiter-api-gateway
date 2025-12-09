import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { AuthenticationError } from "./errors.ts";

const SALT_ROUNDS = 10;
const JWT_SECRET = process.env.JWT_SECRET || "defaultsecret";
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "1h";

if (!process.env.JWT_SECRET && process.env.NODE_ENV === 'production') {
  throw new Error('JWT_SECRET environment variable must be set in production');
}

export interface TokenPayload {
  userId: string;
  iat?: number;
  exp?: number;
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function generateAccessToken(userId: string): string {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

export function verifyAccessToken(token: string): TokenPayload {
  try {
    const payload = jwt.verify(token, JWT_SECRET) as TokenPayload;
    return payload;
  } catch (error) {
    throw new AuthenticationError('Invalid or expired token');
  }
}

