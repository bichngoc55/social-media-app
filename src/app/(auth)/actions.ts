"use server";

import { lucia, validateRequest } from "@/auth";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export async function logout() {
  try {
    const { session } = await validateRequest();

    if (session) {
      try {
        await lucia.invalidateSession(session.id);
      } catch {}
    }

    const sessionCookie = lucia.createBlankSessionCookie();
    (await cookies()).set(
      sessionCookie.name,
      sessionCookie.value,
      sessionCookie.attributes
    );
  } catch {}

  return redirect("/login");
}
