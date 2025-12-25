import { redirect } from "next/navigation";
import { validateRequest } from "@/auth";
import AdminNavbar from "./AdminNavbar";
import AdminSidebar from "./AdminSidebar";
import SessionProvider from "../(main)/SessionProvider";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  try {
    const session = await validateRequest();
    if (!session.user || session.user.role !== "ADMIN") {
      redirect("/");
    }
    return (
      <SessionProvider value={session as any}>
        <div className="min-h-screen">
          <AdminNavbar />
          <div className="mx-auto w-full max-w-7xl p-5">
            <div className="flex gap-5 text-[15px] sm:text-base">
              <aside className="sticky top-24 hidden h-[calc(100vh-8rem)] w-64 flex-none sm:block">
                <AdminSidebar />
              </aside>
              <main className="min-w-0 flex-1">{children}</main>
            </div>
          </div>
        </div>
      </SessionProvider>
    );
  } catch (err) {
    // NEXT_REDIRECT is not an error, it's how Next.js handles redirects
    // Check if it's a redirect signal
    if (
      err &&
      typeof err === "object" &&
      "digest" in err &&
      typeof err.digest === "string" &&
      err.digest.startsWith("NEXT_REDIRECT")
    ) {
      // Re-throw redirect errors so Next.js can handle them
      throw err;
    }

    // Log actual errors
    console.error("Admin layout error:", err);
    
    // Check if it's a database connection error
    const errorMessage = err instanceof Error ? err.message : String(err);
    if (
      errorMessage.includes("connect") ||
      errorMessage.includes("ECONNREFUSED") ||
      errorMessage.includes("timeout") ||
      errorMessage.includes("Prisma") ||
      errorMessage.includes("P1001") || // Prisma connection error
      errorMessage.includes("Can't reach database")
    ) {
      redirect("/login?error=db-unreachable");
    } else {
      // Other errors, redirect to home
      redirect("/");
    }
  }
}
