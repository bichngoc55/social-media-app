import { z } from "zod";

const requiredString = z.string().trim().min(1, "Required");

export const signUpSchema = z.object({
  email: requiredString.email("Invalid email address"),
  username: requiredString.regex(
    /^[a-zA-Z0-9_-]+$/,
    "Only letters, numbers, - and _ allowed"
  ),
  password: requiredString.min(8, "Must be at least 8 characters"),
});

export type SignUpValues = z.infer<typeof signUpSchema>;

export const loginSchema = z.object({
  username: requiredString,
  password: requiredString,
});

export type LoginValues = z.infer<typeof loginSchema>;

export const createPostSchema = z.object({
  content: requiredString,
  mediaIds: z.array(z.string()).max(5, "Cannot have more than 5 attachments"),
  privacy: z.enum(["DRAFT", "FOLLOWERS", "PUBLIC"]).default("PUBLIC"),
});

export type CreatePostValues = z.infer<typeof createPostSchema>;

export const updateUserProfileSchema = z.object({
  displayName: requiredString,
  bio: z.string().max(1000, "Must be at most 1000 characters"),
});

export type UpdateUserProfileValues = z.infer<typeof updateUserProfileSchema>;

export const createCommentSchema = z.object({
  content: requiredString,
});

// OTP Email Verification Schemas
export const verifyEmailSchema = z.object({
  email: requiredString.email("Invalid email address"),
  otp: requiredString.regex(/^\d{6}$/, "OTP must be 6 digits"),
});

export type VerifyEmailValues = z.infer<typeof verifyEmailSchema>;

export const resendOTPSchema = z.object({
  email: requiredString.email("Invalid email address"),
});

export type ResendOTPValues = z.infer<typeof resendOTPSchema>;
