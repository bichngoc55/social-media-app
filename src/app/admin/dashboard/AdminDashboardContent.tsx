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
import { Badge } from "@/components/ui/badge";
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
import { Pagination } from "@/components/ui/pagination";

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

  // Map emotion labels to colors with light background and dark text
  const getEmotionStyle = (emotion: string) => {
    const lowerEmotion = emotion.toLowerCase();
    if (lowerEmotion === "positive") {
      return {
        backgroundColor: "#DCFCE7", // Light green background (nhạt bên ngoài)
        color: "#216D3E", // Dark green text (đậm bên trong)
        borderColor: "#86efac", // Light green border (nhạt hơn text)
        barColor: "#86efac", // Light green for bar
        badgeText: "Above 60%: Positive",
      };
    }
    if (lowerEmotion === "neutral") {
      return {
        backgroundColor: "#F3F4F6", // Light grey background (nhạt bên ngoài)
        color: "#6F767F", // Dark grey text (đậm bên trong)
        borderColor: "#d1d5db", // Light grey border (nhạt hơn text)
        barColor: "#d1d5db", // Light grey for bar
        badgeText: "40-60%: Neutral",
      };
    }
    if (lowerEmotion === "negative") {
      return {
        backgroundColor: "#FEE2E2", // Light red background (nhạt bên ngoài)
        color: "#991B1B", // Dark red text (đậm bên trong)
        borderColor: "#fca5a5", // Light red border (nhạt hơn text)
        barColor: "#fca5a5", // Light red for bar
        badgeText: "Below 40%: Negative",
      };
    }
    return {
      backgroundColor: "hsl(var(--muted))",
      color: "hsl(var(--foreground))",
      borderColor: "hsl(var(--border))",
      barColor: "hsl(var(--primary))",
      badgeText: label,
    };
  };

  const style = getEmotionStyle(label);

  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <Badge
          variant="outline"
          className="rounded-full border-2 px-3 py-0.5 text-xs font-bold"
          style={{
            backgroundColor: style.backgroundColor,
            color: style.color,
            borderColor: style.borderColor,
            borderWidth: "1px",
          }}
        >
          {style.badgeText}
        </Badge>
        <span className="text-xs font-semibold text-muted-foreground">
          {pct}%
        </span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full transition-all"
          style={{
            width: `${pct}%`,
            backgroundColor: style.barColor,
          }}
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
              <Legend
                content={({ payload }) => (
                  <div className="mt-4 flex justify-center gap-4">
                    {payload?.map((entry, index) => {
                      let style = {
                        backgroundColor: "#F3F4F6",
                        color: "#6F767F",
                        borderColor: "#d1d5db",
                        badgeText: entry.value || "",
                      };
                      if (entry.dataKey === "positive") {
                        style = {
                          backgroundColor: "#DCFCE7",
                          color: "#216D3E",
                          borderColor: "#86efac",
                          badgeText: "Positive",
                        };
                      } else if (entry.dataKey === "neutral") {
                        style = {
                          backgroundColor: "#F3F4F6",
                          color: "#6F767F",
                          borderColor: "#d1d5db",
                          badgeText: "Neutral",
                        };
                      } else if (entry.dataKey === "negative") {
                        style = {
                          backgroundColor: "#FEE2E2",
                          color: "#991B1B",
                          borderColor: "#fca5a5",
                          badgeText: "Negative",
                        };
                      }
                      return (
                        <Badge
                          key={index}
                          variant="outline"
                          className="rounded-full border px-3 py-0.5 text-xs font-bold"
                          style={{
                            backgroundColor: style.backgroundColor,
                            color: style.color,
                            borderColor: style.borderColor,
                            borderWidth: "1px",
                          }}
                        >
                          {style.badgeText}
                        </Badge>
                      );
                    })}
                  </div>
                )}
              />
              <Line
                type="monotone"
                dataKey="positive"
                stroke="#86efac"
                strokeWidth={2}
                name="Positive"
                strokeDasharray="0"
                dot={{
                  r: 5,
                  fill: "#86efac",
                  strokeWidth: 2,
                  stroke: "#216D3E",
                }}
                activeDot={{
                  r: 7,
                  fill: "#86efac",
                  strokeWidth: 2,
                  stroke: "#216D3E",
                }}
              />
              <Line
                type="monotone"
                dataKey="neutral"
                stroke="#d1d5db"
                strokeWidth={2}
                name="Neutral"
                strokeDasharray="0"
                dot={{
                  r: 5,
                  fill: "#d1d5db",
                  strokeWidth: 2,
                  stroke: "#6F767F",
                }}
                activeDot={{
                  r: 7,
                  fill: "#d1d5db",
                  strokeWidth: 2,
                  stroke: "#6F767F",
                }}
              />
              <Line
                type="monotone"
                dataKey="negative"
                stroke="#fca5a5"
                strokeWidth={2}
                name="Negative"
                strokeDasharray="0"
                dot={{
                  r: 5,
                  fill: "#fca5a5",
                  strokeWidth: 2,
                  stroke: "#991B1B",
                }}
                activeDot={{
                  r: 7,
                  fill: "#fca5a5",
                  strokeWidth: 2,
                  stroke: "#991B1B",
                }}
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
        const res = await kyInstance.get("/api/admin/analytics/summary").json<{
          totalUsers: number;
          totalAdmins: number;
          totalPosts: number;
          totalReports: number;
        }>();
        return res;
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
  const [page, setPage] = useState(1);
  const { data, isLoading } = useQuery({
    queryKey: ["admin-trending", page],
    queryFn: async () => {
      try {
        const res = await kyInstance
          .get("/api/admin/analytics/trending", {
            searchParams: { page, limit: 10 },
          })
          .json<{
            topics: { tag: string; count: number }[];
            pagination: {
              page: number;
              limit: number;
              total: number;
              totalPages: number;
            };
          }>();

        return res;
      } catch (error) {
        console.error("Error fetching trending topics:", error);
        return {
          topics: [],
          pagination: { page: 1, limit: 10, total: 0, totalPages: 0 },
        };
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
        ) : data && data.topics && data.topics.length > 0 ? (
          <>
            <div className="grid gap-2 md:grid-cols-2">
              {data.topics.map((t, idx) => {
                const globalIndex = (page - 1) * 10 + idx;
                return (
                  <div
                    key={t.tag}
                    className="flex items-center gap-3 rounded-lg border p-3 transition-colors hover:bg-muted/40"
                  >
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                      {globalIndex + 1}
                    </div>
                    <div className="font-medium">{t.tag}</div>
                    <div className="ms-auto text-sm text-muted-foreground">
                      {t.count.toLocaleString()} posts
                    </div>
                  </div>
                );
              })}
            </div>
            {data.pagination && data.pagination.totalPages > 1 && (
              <div className="mt-4 flex items-center justify-between">
                <div className="text-sm text-muted-foreground">
                  Trang {data.pagination.page} / {data.pagination.totalPages} (
                  {data.pagination.total} topics)
                </div>
                <Pagination
                  currentPage={data.pagination.page}
                  totalPages={data.pagination.totalPages}
                  onPageChange={setPage}
                />
              </div>
            )}
          </>
        ) : (
          <div className="py-8 text-center text-sm text-muted-foreground">
            Không có dữ liệu trending topics
          </div>
        )}
      </CardContent>
    </Card>
  );
}
