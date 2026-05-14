// Authentication and session management for the CRM platform
import { type User, Role, UserStatus } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import * as bcrypt from 'bcryptjs';
import { NextRequest } from 'next/server';
import { jwtVerify } from 'jose';

export interface AuthSession {
  user: User;
  token: string;
  expiresAt: string;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterData {
  email: string;
  password: string;
  name: string;
}

class AuthService {
  private readonly TOKEN_EXPIRY_HOURS = 24;

  /**
   * Register a new user (admin only).
   * This is a server-side only method.
   */
  async register(data: RegisterData): Promise<{ success: boolean; message: string; user?: User }> {
    try {
      // Check if user already exists
      const existingUser = await prisma.user.findUnique({
        where: { email: data.email }
      });

      if (existingUser) {
        return { success: false, message: 'User already exists with this email' };
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(data.password, 12);

      // Create user - only ADMIN role is available now
      const user = await prisma.user.create({
        data: {
          email: data.email,
          name: data.name,
          password: hashedPassword,
          role: 'ADMIN' as Role,
          status: 'ACTIVE' as UserStatus
        }
      });

      return {
        success: true,
        message: 'Registration successful',
        user: user
      };
    } catch (error) {
      console.error('Registration error:', error);
      return { success: false, message: 'Registration failed' };
    }
  }

  /**
   * Update a user's password.
   * Server-side only.
   */
  async updatePassword(userId: string, currentPassword: string, newPassword: string): Promise<{ success: boolean; message: string }> {
    try {
      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (!user) {
        return { success: false, message: 'User not found' };
      }

      // Verify current password
      const isValidPassword = await bcrypt.compare(currentPassword, user.password);
      if (!isValidPassword) {
        return { success: false, message: 'Current password is incorrect' };
      }

      // Hash new password
      const hashedPassword = await bcrypt.hash(newPassword, 12);

      // Update password
      await prisma.user.update({
        where: { id: userId },
        data: { password: hashedPassword }
      });

      return { success: true, message: 'Password updated successfully' };
    } catch (error) {
      console.error('Update password error:', error);
      return { success: false, message: 'Password update failed' };
    }
  }
}

export const auth = new AuthService();

// JWT verification helpers for API routes
const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'your-secret-key-change-in-production'
);

export interface JWTPayload {
  userId: string;
  email: string;
  role: string;
  name: string;
  iat: number;
  exp: number;
}

/**
 * Verify JWT token from cookie and return payload
 * Returns null if token is invalid or missing
 */
export async function verifyAuth(request: NextRequest): Promise<JWTPayload | null> {
  try {
    const token = request.cookies.get('auth-token')?.value;

    if (!token) {
      return null;
    }

    const { payload } = await jwtVerify(token, JWT_SECRET);
    return payload as JWTPayload;
  } catch (error) {
    return null;
  }
}

/**
 * Helper to get userId from JWT token
 * Returns null if token is invalid
 */
export async function getUserIdFromRequest(request: NextRequest): Promise<string | null> {
  const payload = await verifyAuth(request);
  return payload?.userId || null;
}

/**
 * Helper to check if user is ADMIN
 * Returns false if token is invalid or user is not admin
 */
export async function isAdminUser(request: NextRequest): Promise<boolean> {
  const payload = await verifyAuth(request);
  return payload?.role === 'ADMIN';
}
