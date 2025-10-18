"use server";

import { verifyEmailSchema, VerifyEmailValues } from "@/lib/validation";
import { redirect } from "next/navigation";

export async function verify2FAAction(data: VerifyEmailValues) {
  try {
    // Validate input
    const validatedData = verifyEmailSchema.parse(data);

    // Call API to verify 2FA
    const response = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/api/verify-2fa`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(validatedData),
    });

    const result = await response.json();

    if (response.ok) {
      return { success: true, message: result.message };
    } else {
      return { success: false, error: result.error };
    }
  } catch (error) {
    console.error("Error verifying 2FA:", error);
    return { 
      success: false, 
      error: "Có lỗi xảy ra, vui lòng thử lại" 
    };
  }
}
