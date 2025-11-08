"use client";

import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";

// Lazy load heavy components
const AdminDashboardContent = dynamic(() => import("./AdminDashboardContent"), {
  loading: () => (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Skeleton className="h-8 w-8" />
        <Skeleton className="h-9 w-32" />
      </div>
      <div className="grid gap-4 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="p-4">
              <Skeleton className="mb-2 h-4 w-24" />
              <Skeleton className="h-8 w-28" />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  ),
  ssr: false,
});

export default function AdminDashboard() {
  return <AdminDashboardContent />;
}
