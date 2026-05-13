import { z } from 'zod';

// Lead Validation
export const leadCreateSchema = z.object({
  clickId: z.string().min(1, 'Click ID is required'),
  email: z.string().email('Invalid email address').optional().nullable(),
  phone: z.string().optional().nullable(),
  name: z.string().min(2, 'Name must be at least 2 characters').optional().nullable(),
  source: z.string().optional().nullable(),
  campaignId: z.string().optional().nullable(),
  tags: z.array(z.string()).optional(),
  metadata: z.record(z.string(), z.any()).optional(),
});

// Lead Update Validation
export const leadUpdateSchema = z.object({
  email: z.string().email('Invalid email address').optional().nullable(),
  phone: z.string().optional().nullable(),
  name: z.string().min(2).optional().nullable(),
  status: z.enum(['NEW', 'ACTIVE', 'INACTIVE', 'CHURNED']).optional(),
  metadata: z.record(z.string(), z.any()).optional(),
});

// Tag Management Validation
export const tagSchema = z.object({
  action: z.enum(['add', 'remove']),
  tag: z.string().min(1, 'Tag is required'),
  reason: z.string().optional(),
});

// Postback Validation
export const postbackSchema = z.object({
  clickId: z.string().min(1, 'Click ID is required'),
  event: z.string().min(1, 'Event type is required'),
  amount: z.number().optional(),
  currency: z.string().default('BRL'),
  metadata: z.record(z.string(), z.any()).optional(),
  timestamp: z.string().datetime().optional(),
});

// Program Settings Validation
export const programSettingsSchema = z.object({
  productName: z.string().min(1),
  programName: z.string().min(1),
  websiteUrl: z.string().url(),
  currency: z.string().length(3),
  companyName: z.string().optional(),
});

// User Registration Validation
export const registerSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  name: z.string().min(2, 'Name must be at least 2 characters'),
});

// Login Validation
export const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});
