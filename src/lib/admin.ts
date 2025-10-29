import { validateRequest } from "@/auth";

/**
 * Check if current user is admin
 */
export async function isAdmin() {
  const { user } = await validateRequest();
  return user?.role === "ADMIN";
}

/**
 * Require admin role, throw error if not admin
 */
export async function requireAdmin() {
  const { user } = await validateRequest();

  if (!user) {
    throw new Error("Unauthorized");
  }

  if (user.role !== "ADMIN") {
    throw new Error("Forbidden: Admin access required");
  }

  return user;
}
