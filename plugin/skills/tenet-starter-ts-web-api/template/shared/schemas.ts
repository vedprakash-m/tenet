// Runtime API schemas, used by the server for requests and responses and by the client for forms (TS §12.1).
// Imports nothing from server/ or web/.
import { z } from "zod";

export const Email = z.string().trim().toLowerCase().email().max(254);
export const Password = z.string().min(12).max(256);

export const SignInRequest = z.object({ email: Email, password: z.string().min(1).max(256) });
export const ChangePasswordRequest = z.object({ currentPassword: z.string().min(1).max(256), newPassword: Password });

export const Role = z.enum(["admin", "member"]);
export const UserResponse = z.object({ id: z.string(), email: z.string(), role: Role });
export const SessionResponse = z.object({ user: UserResponse, csrfToken: z.string() });

/** Problem-style errors: no stacks, no SQL. */
export const Problem = z.object({
  type: z.string(), title: z.string(), status: z.number(), detail: z.string().optional(), instance: z.string().optional(), correlationId: z.string(),
});

/** Every list endpoint is paginated and bounded. */
export const PageQuery = z.object({ limit: z.coerce.number().int().min(1).max(100).default(25), offset: z.coerce.number().int().min(0).default(0) });

export type SignInRequest = z.infer<typeof SignInRequest>;
export type SessionResponse = z.infer<typeof SessionResponse>;
export type Role = z.infer<typeof Role>;
