"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Users, FileText, Flag, Shield } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import kyInstance from "@/lib/ky";
import { Skeleton } from "@/components/ui/skeleton";

function StatCard({
  title,
  value,
  icon: Icon,
  trend,
}: {
  title: string;
  value: number | string;
  icon: any;
  trend?: { value: string; up?: boolean };
}) {
  return (
    <Card className="card-glass">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between text-base font-medium">
          <span className="text-muted-foreground">{title}</span>
          <Icon className="h-5 w-5 text-primary" />
        </CardTitle>
        <div className="text-3xl font-bold">{value}</div>
        {trend && (
          <CardDescription className={trend.up ? "text-green-600" : "text-red-600"}>
            {trend.value}
          </CardDescription>
        )}
      </CardHeader>
    </Card>
  );
}

function EmotionAnalytics() {
  const { data, isLoading } = useQuery({
    queryKey: ["admin-emotions"],
    queryFn: async () => {
      try {
        const res = await kyInstance
          .get("/api/admin/analytics/emotions")
          .json<{ emotions: Record<string, number> }>();
        return res.emotions;
      } catch {
        // Fallback demo distribution
        return {
          positive: 48,
          neutral: 32,
          negative: 20,
          joy: 35,
          sadness: 10,
          anger: 7,
          surprise: 8,
          fear: 4,
        } as Record<string, number>;
      }
    },
  });

  const entries = Object.entries(data || {});
  const total = entries.reduce((a, [, v]) => a + v, 0) || 1;

  return (
    <Card className="card-glass">
      <CardHeader>
        <CardTitle>Emotion Overview</CardTitle>
        <CardDescription>
          Tỉ lệ cảm xúc từ bài viết
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-3 w-2/3" />
              </div>
            ))}
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-3">
              {entries.slice(0, 3).map(([label, value]) => (
                <Bar key={label} label={label} value={(value / total) * 100} />
              ))}
            </div>
            <div className="space-y-3">
              {entries.slice(3).map(([label, value]) => (
                <Bar key={label} label={label} value={(value / total) * 100} />
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function Bar({ label, value }: { label: string; value: number }) {
  const pct = Math.round(value);
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-xs uppercase tracking-wide text-muted-foreground">
        <span>{label}</span>
        <span>{pct}%</span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-gradient-to-r from-primary to-primary/70 transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function Sparkline({ data }: { data: number[] }) {
  const width = 240;
  const height = 60;
  const max = Math.max(...data);
  const points = data
    .map((y, i) => {
      const x = (i / (data.length - 1)) * width;
      const ny = height - (y / max) * height;
      return `${x},${ny}`;
    })
    .join(" ");
  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full">
      <polyline
        fill="none"
        stroke="hsl(var(--primary))"
        strokeWidth="2"
        points={points}
      />
      <linearGradient id="grad" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.25" />
        <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0" />
      </linearGradient>
    </svg>
  );
}

export default function AdminDashboard() {
  const { data, isLoading } = useQuery({
    queryKey: ["admin-dashboard-summary"],
    queryFn: async () => {
      const [usersAll, usersAdmin, posts, reports] = await Promise.all([
        kyInstance
          .get("/api/admin/users", { searchParams: { page: 1, limit: 1 } })
          .json<{ users: any[]; pagination: any }>(),
        kyInstance
          .get("/api/admin/users", {
            searchParams: { page: 1, limit: 1, role: "ADMIN" },
          })
          .json<{ users: any[]; pagination: any }>(),
        kyInstance
          .get("/api/admin/posts", { searchParams: { page: 1, limit: 1 } })
          .json<{ posts: any[]; pagination: any }>(),
        kyInstance
          .get("/api/admin/reports", { searchParams: { page: 1, limit: 1 } })
          .json<{ reports: any[]; pagination: any }>(),
      ]);
      return {
        totalUsers: usersAll.pagination?.total ?? usersAll.users.length,
        totalAdmins: usersAdmin.pagination?.total ?? usersAdmin.users.length,
        totalPosts: posts.pagination?.total ?? posts.posts.length,
        totalReports: reports.pagination?.total ?? reports.reports.length,
      };
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Shield className="h-8 w-8 text-primary" />
        <h1 className="text-3xl font-bold">Tổng Quan</h1>
      </div>

      {isLoading ? (
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
      ) : (
        <div className="grid gap-4 md:grid-cols-4">
          <StatCard title="Total Users" value={data!.totalUsers} icon={Users} />
          <StatCard title="Total Posts" value={data!.totalPosts} icon={FileText} />
          <StatCard title="Total Reports" value={data!.totalReports} icon={Flag} />
          <StatCard title="Admins" value={data!.totalAdmins} icon={Shield} />
        </div>
      )}

      <TrendingAnalytics />

      {/* Emotion analytics */}
      <EmotionAnalytics />
    </div>
  );
}

function TrendingAnalytics() {
  const { data, isLoading } = useQuery({
    queryKey: ["admin-trending"],
    queryFn: async () => {
      try {
        const res = await kyInstance
          .get("/api/admin/analytics/trending", { searchParams: { limit: 10 } })
          .json<{ topics: { tag: string; count: number; delta?: number }[] }>();
        return res.topics;
      } catch {
        // Fallback demo
        return [
          { tag: "#loopy", count: 1240, delta: 12 },
          { tag: "#fun", count: 980, delta: 5 },
          { tag: "#coding", count: 870, delta: -3 },
          { tag: "#music", count: 760, delta: 7 },
          { tag: "#travel", count: 650, delta: 2 },
          { tag: "#food", count: 580, delta: -1 },
          { tag: "#meme", count: 520, delta: 9 },
          { tag: "#ai", count: 490, delta: 14 },
          { tag: "#games", count: 460, delta: 4 },
          { tag: "#life", count: 420, delta: -2 },
        ];
      }
    },
  });

  return (
    <Card className="card-glass">
      <CardHeader>
        <CardTitle>Trending Topics</CardTitle>
        <CardDescription>Top hashtags/keywords trên hệ thống</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton className="h-4 w-10" />
                <Skeleton className="h-4 w-48" />
                <Skeleton className="ms-auto h-4 w-16" />
              </div>
            ))}
          </div>
        ) : (
          <div className="grid gap-2 md:grid-cols-2">
            {(data || []).map((t, idx) => (
              <div
                key={t.tag}
                className="flex items-center gap-3 rounded-lg border p-3 transition-colors hover:bg-muted/40"
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                  {idx + 1}
                </div>
                <div className="font-medium">{t.tag}</div>
                <div className="ms-auto text-sm text-muted-foreground">
                  {t.count.toLocaleString()} posts
                </div>
                {typeof t.delta === "number" && (
                  <div
                    className={`ms-3 text-xs ${t.delta >= 0 ? "text-green-600" : "text-red-600"}`}
                  >
                    {t.delta >= 0 ? "+" : ""}
                    {t.delta}%
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
