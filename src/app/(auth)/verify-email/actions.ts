"use server";

import { verifyEmailSchema, VerifyEmailValues } from "@/lib/validation";
import { redirect } from "next/navigation";

export async function verifyEmailAction(data: VerifyEmailValues) {
  try {
    // Validate input
    const validatedData = verifyEmailSchema.parse(data);

    // Call API to verify email
    const response = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/api/verify-email`, {
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
    console.error("Error verifying email:", error);
    return { 
      success: false, 
      error: "Có lỗi xảy ra, vui lòng thử lại" 
    };
  }
}
