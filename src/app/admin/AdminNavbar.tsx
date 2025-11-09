"use client";

import Link from "next/link";
import Image from "next/image";
import UserButton from "@/components/UserButton";
import AdminThemeToggle from "./AdminThemeToggle";

export default function AdminNavbar() {
  return (
    <header className="card-elevated sticky top-0 z-20">
      <div className="mx-auto flex max-w-7xl items-center gap-4 px-5 py-3">
        <Link
          href="/admin/dashboard"
          className="gradient-text flex items-center gap-2 text-2xl font-bold"
        >
          <Image
            src="/logo-image.png"
            alt="Loopy Logo"
            width={48}
            height={48}
            className="rounded-full transition-transform duration-300 hover:scale-110"
          />
          Loopy Admin
        </Link>
        <div className="ms-auto flex items-center gap-3">
          <AdminThemeToggle />
          <UserButton />
        </div>
      </div>
    </header>
  );
}
