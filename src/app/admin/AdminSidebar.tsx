"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Users,
  FileText,
  Flag,
  AlertTriangle,
} from "lucide-react";

const items = [
  { href: "/admin/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/users", label: "Users", icon: Users },
  { href: "/admin/posts", label: "Posts", icon: FileText },
  // { href: "/admin/reports", label: "Reports", icon: Flag },
  { href: "/admin/appeals", label: "Appeals", icon: AlertTriangle },
];

export default function AdminSidebar() {
  const pathname = usePathname();

  return (
    <nav className="card-glass h-full rounded-2xl p-4">
      <div className="mb-4 px-2 text-sm font-semibold text-muted-foreground">
        Admin
      </div>
      <ul className="space-y-1">
        {items.map(({ href, label, icon: Icon }) => {
          const active = pathname === href;
          return (
            <li key={href}>
              <Link
                href={href}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                  active
                    ? "bg-primary/10 text-primary"
                    : "hover:bg-muted hover:text-foreground"
                )}
              >
                <Icon className="h-4 w-4" />
                <span>{label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
