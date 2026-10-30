import { z } from "zod";

/**
 * Request-body validation for the auth surface. All error-mapping to the
 * API envelope lives with the central error handler.
 */
export const loginSchema = z.object({
  email: z
    .string({ message: "Email is required" })
    .trim()
    .min(1, "Email is required")
    .max(254, "Email is too long")
    .email("A valid email address is required"),
  password: z
    .string({ message: "Password is required" })
    .min(1, "Password is required")
    .max(200, "Password is too long"),
});

export type LoginDto = z.infer<typeof loginSchema>;
