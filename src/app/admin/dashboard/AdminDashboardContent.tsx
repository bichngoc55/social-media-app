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
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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
          <CardDescription
            className={trend.up ? "text-green-600" : "text-red-600"}
          >
            {trend.value}
          </CardDescription>
        )}
      </CardHeader>
    </Card>
  );
}

function EmotionAnalytics() {
  const [selectedYear, setSelectedYear] = useState<string>(
    new Date().getFullYear().toString()
  );
  const [selectedMonth, setSelectedMonth] = useState<string>("all");

  const { data, isLoading } = useQuery({
    queryKey: ["admin-emotions", selectedYear, selectedMonth],
    queryFn: async () => {
      try {
        const searchParams: Record<string, string> = { year: selectedYear };
        if (selectedMonth && selectedMonth !== "all") {
          searchParams.month = selectedMonth;
        }
        const res = await kyInstance
          .get("/api/admin/analytics/emotions", { searchParams })
          .json<{
            emotions: Record<string, number>;
            percentages: Record<string, number>;
            total: number;
          }>();
        return res;
      } catch {
        // Fallback demo distribution
        return {
          emotions: {
            positive: 48,
            neutral: 32,
            negative: 20,
          },
          percentages: {
            positive: 48,
            neutral: 32,
            negative: 20,
          },
          total: 100,
        };
      }
    },
  });

  const entries = Object.entries(data?.emotions || {});
  const total = entries.reduce((a, [, v]) => a + v, 0) || 1;

  // Generate year options (current year and 2 years before)
  const currentYear = new Date().getFullYear();
  const yearOptions = Array.from({ length: 3 }, (_, i) => currentYear - i);

  // Generate month options
  const monthOptions = Array.from({ length: 12 }, (_, i) => i + 1);

  return (
    <Card className="card-glass">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Emotion Overview</CardTitle>
            <CardDescription>Tỉ lệ cảm xúc từ bài viết</CardDescription>
          </div>
          <div className="flex gap-2">
            <Select value={selectedYear} onValueChange={setSelectedYear}>
              <SelectTrigger className="w-32">
                <SelectValue placeholder="Năm" />
              </SelectTrigger>
              <SelectContent>
                {yearOptions.map((year) => (
                  <SelectItem key={year} value={year.toString()}>
                    {year}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={selectedMonth} onValueChange={setSelectedMonth}>
              <SelectTrigger className="w-32">
                <SelectValue placeholder="Tất cả tháng" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tất cả tháng</SelectItem>
                {monthOptions.map((month) => (
                  <SelectItem key={month} value={month.toString()}>
                    Tháng {month}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-3 w-2/3" />
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-3">
            {entries.map(([label, value]) => (
              <Bar key={label} label={label} value={(value / total) * 100} />
            ))}
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

function EmotionGrowthChart() {
  const [selectedYear, setSelectedYear] = useState<string>(
    new Date().getFullYear().toString()
  );
  const [monthsToShow, setMonthsToShow] = useState<string>("6");

  const { data, isLoading } = useQuery({
    queryKey: ["admin-emotions-growth", selectedYear, monthsToShow],
    queryFn: async () => {
      try {
        const numMonths = parseInt(monthsToShow);
        const selectedYearNum = parseInt(selectedYear);
        const currentDate = new Date();
        const isCurrentYear = selectedYearNum === currentDate.getFullYear();

        // Calculate end month: if current year, use current month, otherwise use December
        const endMonth = isCurrentYear ? currentDate.getMonth() + 1 : 12;
        const startMonth = Math.max(1, endMonth - numMonths + 1);

        // Fetch data for each month
        const promises: Promise<{
          month: number;
          year: number;
          positive: number;
          neutral: number;
          negative: number;
        }>[] = [];

        for (let i = 0; i < numMonths; i++) {
          const month = startMonth + i;
          // Skip if month exceeds endMonth for current year
          if (isCurrentYear && month > endMonth) break;

          const year = selectedYearNum;

          promises.push(
            kyInstance
              .get("/api/admin/analytics/emotions", {
                searchParams: {
                  year: year.toString(),
                  month: month.toString(),
                },
              })
              .json<{
                emotions: Record<string, number>;
                percentages: Record<string, number>;
                total: number;
              }>()
              .then((res) => ({
                month: month,
                year: year,
                positive: res.percentages.positive || 0,
                neutral: res.percentages.neutral || 0,
                negative: res.percentages.negative || 0,
              }))
              .catch(() => ({
                month: month,
                year: year,
                positive: 0,
                neutral: 0,
                negative: 0,
              }))
          );
        }

        const results = await Promise.all(promises);
        return results.map((r) => ({
          name: `T${r.month}/${r.year}`,
          positive: r.positive,
          neutral: r.neutral,
          negative: r.negative,
        }));
      } catch {
        // Fallback demo data
        return Array.from({ length: parseInt(monthsToShow) }, (_, i) => ({
          name: `T${12 - parseInt(monthsToShow) + i + 1}/${selectedYear}`,
          positive: 40 + Math.random() * 20,
          neutral: 30 + Math.random() * 15,
          negative: 20 + Math.random() * 10,
        }));
      }
    },
  });

  // Generate year options
  const currentYear = new Date().getFullYear();
  const yearOptions = Array.from({ length: 3 }, (_, i) => currentYear - i);

  return (
    <Card className="card-glass">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Tốc Độ Tăng Trưởng Cảm Xúc</CardTitle>
            <CardDescription>
              Xu hướng thay đổi tỉ lệ cảm xúc theo thời gian
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Select value={selectedYear} onValueChange={setSelectedYear}>
              <SelectTrigger className="w-32">
                <SelectValue placeholder="Năm" />
              </SelectTrigger>
              <SelectContent>
                {yearOptions.map((year) => (
                  <SelectItem key={year} value={year.toString()}>
                    {year}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={monthsToShow} onValueChange={setMonthsToShow}>
              <SelectTrigger className="w-32">
                <SelectValue placeholder="Số tháng" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="3">3 tháng</SelectItem>
                <SelectItem value="6">6 tháng</SelectItem>
                <SelectItem value="12">12 tháng</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex h-[400px] items-center justify-center">
            <Skeleton className="h-full w-full" />
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={400}>
            <LineChart data={data || []}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="name"
                tick={{ fontSize: 12 }}
                angle={-45}
                textAnchor="end"
                height={80}
              />
              <YAxis
                domain={[0, 100]}
                tick={{ fontSize: 12 }}
                tickFormatter={(value) => `${value}%`}
              />
              <Tooltip
                formatter={(value: number) => [`${value.toFixed(2)}%`, ""]}
                labelFormatter={(label) => `Tháng: ${label}`}
                contentStyle={{
                  backgroundColor: "hsl(var(--background))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "6px",
                }}
              />
              <Legend />
              <Line
                type="monotone"
                dataKey="positive"
                stroke="hsl(320, 65%, 70%)"
                strokeWidth={2.5}
                name="Positive"
                dot={{ r: 5, fill: "hsl(320, 65%, 70%)" }}
                activeDot={{ r: 7, fill: "hsl(320, 65%, 75%)" }}
              />
              <Line
                type="monotone"
                dataKey="neutral"
                stroke="hsl(280, 40%, 80%)"
                strokeWidth={2.5}
                name="Neutral"
                dot={{ r: 5, fill: "hsl(280, 40%, 80%)" }}
                activeDot={{ r: 7, fill: "hsl(280, 40%, 85%)" }}
              />
              <Line
                type="monotone"
                dataKey="negative"
                stroke="hsl(15, 60%, 65%)"
                strokeWidth={2.5}
                name="Negative"
                dot={{ r: 5, fill: "hsl(15, 60%, 65%)" }}
                activeDot={{ r: 7, fill: "hsl(15, 60%, 70%)" }}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}

export default function AdminDashboardContent() {
  const { data, isLoading } = useQuery({
    queryKey: ["admin-dashboard-summary"],
    queryFn: async () => {
      try {
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
          totalUsers: usersAll.pagination?.total ?? usersAll.users.length ?? 0,
          totalAdmins:
            usersAdmin.pagination?.total ?? usersAdmin.users.length ?? 0,
          totalPosts: posts.pagination?.total ?? posts.posts.length ?? 0,
          totalReports:
            reports.pagination?.total ?? reports.reports.length ?? 0,
        };
      } catch (error) {
        console.error("Error fetching dashboard summary:", error);
        // Return fallback values
        return {
          totalUsers: 0,
          totalAdmins: 0,
          totalPosts: 0,
          totalReports: 0,
        };
      }
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
          <StatCard
            title="Total Users"
            value={data?.totalUsers ?? 0}
            icon={Users}
          />
          <StatCard
            title="Total Posts"
            value={data?.totalPosts ?? 0}
            icon={FileText}
          />
          <StatCard
            title="Total Reports"
            value={data?.totalReports ?? 0}
            icon={Flag}
          />
          <StatCard
            title="Admins"
            value={data?.totalAdmins ?? 0}
            icon={Shield}
          />
        </div>
      )}

      <TrendingAnalytics />

      {/* Emotion analytics */}
      <EmotionAnalytics />

      {/* Emotion growth chart */}
      <EmotionGrowthChart />
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
