"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Users,
  Search,
  UserX,
  Mail,
  MailCheck,
  ArrowLeft,
  ExternalLink,
  Flag,
  AlertTriangle,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import kyInstance from "@/lib/ky";
import { formatRelativeDate, cn } from "@/lib/utils";
import Link from "next/link";
import { useToast } from "@/components/ui/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface User {
  id: string;
  username: string;
  displayName: string;
  email: string | null;
  avatarUrl: string | null;
  role: "USER" | "ADMIN";
  emailVerified: boolean;
  createdAt: Date;
  warningCount?: number;
  bannedUntil?: Date | null;
  lastWarningAt?: Date | null;
  status?: boolean;
  _count: {
    posts: number;
    followers: number;
    following: number;
    reportsReceived: number; // Count of reports against this user
  };
  reportStats?: {
    totalPosts: number;
    reportedPosts: number;
    aiDetectedPosts: number;
    userReportedPosts: number;
    bothDetectedPosts: number;
    reportPercentage: number;
  };
}

type SortOrder = "asc" | "desc" | null;

export default function AdminUsersPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [sortByReport, setSortByReport] = useState<SortOrder>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    type: "delete" | "ban" | null;
    user: User | null;
  }>({ open: false, type: null, user: null });

  const { data, isLoading, error } = useQuery({
    queryKey: ["admin-users", page, search, roleFilter, sortByReport],
    queryFn: () =>
      kyInstance
        .get("/api/admin/users", {
          searchParams: {
            page,
            limit: 20,
            ...(search && { search }),
            ...(roleFilter !== "all" && { role: roleFilter }),
          },
        })
        .json<{ users: User[]; pagination: any }>(),
  });

  // Sort users by report percentage
  const sortedUsers = data?.users
    ? [...data.users].sort((a, b) => {
        if (!sortByReport) return 0;
        const aPercent = a.reportStats?.reportPercentage || 0;
        const bPercent = b.reportStats?.reportPercentage || 0;
        return sortByReport === "asc"
          ? aPercent - bPercent
          : bPercent - aPercent;
      })
    : [];

  const handleSortByReport = () => {
    if (sortByReport === null) {
      setSortByReport("desc");
    } else if (sortByReport === "desc") {
      setSortByReport("asc");
    } else {
      setSortByReport(null);
    }
  };

  // Format date time: "HH:mm:ss dd/MM/yyyy"
  const formatDateTime = (date: Date | string | null) => {
    if (!date) return "";
    const d = date instanceof Date ? date : new Date(date);
    if (isNaN(d.getTime())) return "";
    const hours = String(d.getHours()).padStart(2, "0");
    const minutes = String(d.getMinutes()).padStart(2, "0");
    const seconds = String(d.getSeconds()).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const year = d.getFullYear();
    return `${hours}:${minutes}:${seconds} ${day}/${month}/${year}`;
  };

  // Check if warning button is on cooldown (3 days)
  const isWarningOnCooldown = (user: User) => {
    if (!user.lastWarningAt) return false;
    const lastWarning = new Date(user.lastWarningAt);
    const now = new Date();
    const daysSinceWarning =
      (now.getTime() - lastWarning.getTime()) / (1000 * 60 * 60 * 24);
    return daysSinceWarning < 3;
  };

  const deleteUserMutation = useMutation({
    mutationFn: async (userId: string) => {
      return kyInstance.delete(`/api/admin/users/${userId}`).json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      toast({ description: "User deleted successfully" });
    },
  });

  const warnUserMutation = useMutation({
    mutationFn: async (userId: string) => {
      return kyInstance
        .post(`/api/admin/users/${userId}/warn`, {
          json: {},
        })
        .json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      toast({ description: "Warning has been sent successfully" });
    },
    onError: (error: any) => {
      toast({
        description: error?.message || "Failed to send warning",
        variant: "destructive",
      });
    },
  });

  const banUserMutation = useMutation({
    mutationFn: async (userId: string) => {
      return kyInstance.post(`/api/admin/users/${userId}/ban`).json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      toast({ description: "User has been banned successfully" });
    },
    onError: (error: any) => {
      toast({
        description: error?.message || "Failed to ban user",
        variant: "destructive",
      });
    },
  });

  const handleDeleteUser = (user: User) => {
    setConfirmDialog({ open: true, type: "delete", user });
  };

  const handleWarnUser = (user: User) => {
    // Check violation rate before warning
    const violationRate = user.reportStats?.reportPercentage || 0;
    if (violationRate < 70) {
      toast({
        description: `Cannot warn: Violation rate is only ${violationRate.toFixed(2)}% (requires >= 70%)`,
        variant: "destructive",
      });
      return;
    }
    warnUserMutation.mutate(user.id);
  };

  const handleBanUser = (user: User) => {
    setConfirmDialog({ open: true, type: "ban", user });
  };

  const handleConfirmAction = () => {
    if (!confirmDialog.user || !confirmDialog.type) return;

    if (confirmDialog.type === "delete") {
      deleteUserMutation.mutate(confirmDialog.user.id);
    } else if (confirmDialog.type === "ban") {
      banUserMutation.mutate(confirmDialog.user.id);
    }

    setConfirmDialog({ open: false, type: null, user: null });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-pink-500/20 to-purple-500/20">
            <Users className="h-6 w-6 text-pink-600 dark:text-pink-400" />
          </div>
          <div>
            <h1 className="bg-gradient-to-r from-pink-600 to-purple-600 bg-clip-text text-3xl font-bold text-transparent">
              User Management
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Manage user accounts and permissions
            </p>
          </div>
        </div>
      </div>

      <Card className="card-glass">
        <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex w-full items-center gap-4 sm:w-auto">
            <Input
              placeholder="Search users..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="max-w-sm"
            />
            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="All roles" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All roles</SelectItem>
                <SelectItem value="USER">User</SelectItem>
                <SelectItem value="ADMIN">Admin</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="space-y-4">
          <Card className="card-glass overflow-hidden border-2">
            <CardContent className="p-0">
              <div className="border-b p-4">
                <Skeleton className="h-4 w-24" />
              </div>
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="flex items-center gap-4 border-b p-4">
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="h-4 w-56" />
                  <Skeleton className="h-6 w-16 rounded-full" />
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-4 w-24" />
                  <div className="ms-auto flex gap-2">
                    <Skeleton className="h-8 w-8 rounded" />
                    <Skeleton className="h-8 w-8 rounded" />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      ) : error ? (
        <Card className="card-glass border-2">
          <CardContent className="p-6">
            <div className="text-center">
              <p className="font-semibold text-red-500">Error loading users</p>
              <p className="mt-2 text-sm text-muted-foreground">
                {error instanceof Error ? error.message : "Unknown error"}
              </p>
              <Button
                onClick={() =>
                  queryClient.invalidateQueries({ queryKey: ["admin-users"] })
                }
                className="mt-4"
              >
                Retry
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : !data?.users || data.users.length === 0 ? (
        <Card className="card-glass border-2">
          <CardContent className="p-6">
            <div className="text-center">
              <p className="text-muted-foreground">No users found</p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
          <Card className="card-glass overflow-hidden border-2">
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="p-3 text-left text-sm font-semibold">
                        User
                      </th>
                      <th className="p-3 text-left text-sm font-semibold">
                        Email
                      </th>
                      <th className="p-3 text-left text-sm font-semibold">
                        Role
                      </th>
                      <th className="p-3 text-left text-sm font-semibold">
                        Stats
                      </th>
                      <th className="p-3 text-left text-sm font-semibold">
                        <button
                          onClick={handleSortByReport}
                          className="flex items-center gap-1.5 transition-colors hover:text-primary"
                        >
                          Report Stats
                          {sortByReport === "desc" ? (
                            <ArrowDown className="h-3.5 w-3.5" />
                          ) : sortByReport === "asc" ? (
                            <ArrowUp className="h-3.5 w-3.5" />
                          ) : (
                            <ArrowUpDown className="h-3.5 w-3.5 opacity-50" />
                          )}
                        </button>
                      </th>
                      <th className="p-3 text-left text-sm font-semibold">
                        Created
                      </th>
                      <th className="p-3 text-left text-sm font-semibold">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {(sortedUsers.length > 0
                      ? sortedUsers
                      : data?.users || []
                    ).map((user) => (
                      <tr key={user.id} className="border-b hover:bg-muted/50">
                        <td className="p-3">
                          <Link
                            href={`/users/${user.username}`}
                            className="text-sm font-medium hover:underline"
                          >
                            {user.displayName}
                          </Link>
                          <div className="text-xs text-muted-foreground">
                            @{user.username}
                          </div>
                        </td>
                        <td className="p-3">
                          <div className="flex items-center gap-1.5 text-sm">
                            <span className="max-w-[150px] truncate">
                              {user.email}
                            </span>
                            {user.emailVerified ? (
                              <MailCheck className="h-3.5 w-3.5 flex-shrink-0 text-green-500" />
                            ) : (
                              <Mail className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" />
                            )}
                          </div>
                        </td>
                        <td className="p-3">
                          <Badge
                            variant="outline"
                            className={cn(
                              "rounded-full text-xs font-semibold",
                              user.role === "ADMIN"
                                ? "border-purple-300 bg-purple-100 text-purple-700 dark:border-purple-700 dark:bg-purple-950/30 dark:text-purple-300"
                                : "border-blue-300 bg-blue-100 text-blue-700 dark:border-blue-700 dark:bg-blue-950/30 dark:text-blue-300"
                            )}
                          >
                            {user.role}
                          </Badge>
                        </td>
                        <td className="p-3 text-xs">
                          <div>Posts: {user._count.posts}</div>
                          <div>Followers: {user._count.followers}</div>
                          <div>Following: {user._count.following}</div>
                        </td>
                        <td className="p-3">
                          {user.reportStats ? (
                            <div className="min-w-[200px] max-w-[240px] space-y-2">
                              {/* Header */}
                              <div className="flex items-baseline justify-between gap-2">
                                <div className="flex items-baseline gap-1.5">
                                  <span className="bg-gradient-to-r from-pink-600 to-purple-600 bg-clip-text text-lg font-bold text-transparent">
                                    {user.reportStats.reportPercentage.toFixed(
                                      1
                                    )}
                                    %
                                  </span>
                                  <span className="text-[10px] font-medium text-muted-foreground">
                                    posts reported
                                  </span>
                                </div>
                              </div>

                              {/* Progress Bar */}
                              {user.reportStats.totalPosts > 0 ? (
                                <div
                                  className="group relative h-5 w-full overflow-hidden rounded-lg border border-border/30 bg-gradient-to-br from-muted/50 to-muted/30 shadow-inner"
                                  style={{ fontSize: 0 }}
                                >
                                  {(() => {
                                    const totalPosts =
                                      user.reportStats.totalPosts;
                                    const aiOnly =
                                      user.reportStats.aiDetectedPosts -
                                      user.reportStats.bothDetectedPosts;
                                    const userOnly =
                                      user.reportStats.userReportedPosts -
                                      user.reportStats.bothDetectedPosts;
                                    const both =
                                      user.reportStats.bothDetectedPosts;

                                    // Calculate percentages and round to avoid long decimals
                                    const aiOnlyPercent = Math.max(
                                      0,
                                      Math.round(
                                        (aiOnly / totalPosts) * 100 * 100
                                      ) / 100
                                    );
                                    const bothPercent = Math.max(
                                      0,
                                      Math.round(
                                        (both / totalPosts) * 100 * 100
                                      ) / 100
                                    );
                                    const userOnlyPercent = Math.max(
                                      0,
                                      Math.round(
                                        (userOnly / totalPosts) * 100 * 100
                                      ) / 100
                                    );
                                    const totalReportedPercent =
                                      Math.round(
                                        (aiOnlyPercent +
                                          bothPercent +
                                          userOnlyPercent) *
                                          100
                                      ) / 100;

                                    let currentLeft = 0;

                                    return (
                                      <div
                                        className="relative h-full w-full"
                                        style={{
                                          fontSize: 0,
                                          lineHeight: 0,
                                          textIndent: "-9999px",
                                        }}
                                      >
                                        {/* AI Only (Pink) - leftmost */}
                                        {aiOnly > 0 && aiOnlyPercent > 0 && (
                                          <div
                                            className="absolute left-0 top-0 h-full bg-gradient-to-r from-pink-400 via-pink-500 to-pink-600 shadow-sm transition-all duration-500 ease-out dark:from-pink-500 dark:via-pink-600 dark:to-pink-700"
                                            style={{
                                              left: `${currentLeft}%`,
                                              width: `${aiOnlyPercent}%`,
                                              fontSize: 0,
                                              lineHeight: 0,
                                              color: "transparent",
                                            }}
                                            title={`AI detected: ${user.reportStats.aiDetectedPosts} posts`}
                                          />
                                        )}
                                        {aiOnly > 0 &&
                                          aiOnlyPercent > 0 &&
                                          (currentLeft += aiOnlyPercent)}

                                        {/* Both (Purple-Pink) - overlap */}
                                        {both > 0 && bothPercent > 0 && (
                                          <div
                                            className="absolute top-0 z-10 h-full bg-gradient-to-r from-purple-500 via-pink-500 to-purple-600 shadow-sm transition-all duration-500 ease-out dark:from-purple-600 dark:via-pink-600 dark:to-purple-700"
                                            style={{
                                              left: `${currentLeft}%`,
                                              width: `${bothPercent}%`,
                                              fontSize: 0,
                                              lineHeight: 0,
                                              color: "transparent",
                                            }}
                                            title={`Cả AI và User: ${both} bài`}
                                          />
                                        )}
                                        {both > 0 &&
                                          bothPercent > 0 &&
                                          (currentLeft += bothPercent)}

                                        {/* User Only (Pink-Orange) - rightmost */}
                                        {userOnly > 0 &&
                                          userOnlyPercent > 0 && (
                                            <div
                                              className="absolute top-0 h-full bg-gradient-to-r from-pink-500 via-pink-400 to-orange-500 shadow-sm transition-all duration-500 ease-out dark:from-pink-600 dark:via-pink-500 dark:to-orange-600"
                                              style={{
                                                left: `${currentLeft}%`,
                                                width: `${userOnlyPercent}%`,
                                                fontSize: 0,
                                                lineHeight: 0,
                                                color: "transparent",
                                              }}
                                              title={`User report: ${user.reportStats.userReportedPosts} bài`}
                                            />
                                          )}

                                        {/* Text overlay - only show on the filled portion if percentage >= 30% */}
                                        {user.reportStats &&
                                          user.reportStats.reportedPosts > 0 &&
                                          totalReportedPercent >= 30 && (
                                            <div
                                              className="pointer-events-none absolute top-0 z-20 flex h-full select-none items-center justify-center"
                                              style={{
                                                left: "0%",
                                                width: `${totalReportedPercent}%`,
                                                fontSize: "0.625rem",
                                                lineHeight: "1",
                                              }}
                                            >
                                              <span className="font-extrabold tracking-tight text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.7)]">
                                                {Math.round(
                                                  user.reportStats
                                                    .reportPercentage
                                                )}
                                                %
                                              </span>
                                            </div>
                                          )}
                                      </div>
                                    );
                                  })()}
                                </div>
                              ) : (
                                <div className="flex h-5 w-full items-center justify-center rounded-lg border border-border/20 bg-gradient-to-br from-muted/30 to-muted/20 text-[9px] font-medium text-muted-foreground">
                                  No posts
                                </div>
                              )}

                              {/* Legend */}
                              <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-[9px]">
                                <div className="group/legend flex items-center gap-1.5">
                                  <div className="ring-1.5 h-2.5 w-2.5 rounded-full bg-gradient-to-br from-pink-400 to-pink-600 shadow-sm ring-pink-200/50 transition-all group-hover/legend:ring-pink-300/70 dark:from-pink-500 dark:to-pink-700 dark:ring-pink-800/50 dark:group-hover/legend:ring-pink-700/70" />
                                  <span className="font-semibold text-pink-600 dark:text-pink-400">
                                    AI:{" "}
                                    <span className="font-bold">
                                      {user.reportStats.aiDetectedPosts}
                                    </span>
                                  </span>
                                </div>
                                <div className="group/legend flex items-center gap-1.5">
                                  <div className="ring-1.5 h-2.5 w-2.5 rounded-full bg-gradient-to-br from-pink-500 to-orange-500 shadow-sm ring-pink-200/50 transition-all group-hover/legend:ring-pink-300/70 dark:from-pink-600 dark:to-orange-600 dark:ring-pink-800/50 dark:group-hover/legend:ring-pink-700/70" />
                                  <span className="font-semibold text-pink-600 dark:text-pink-400">
                                    User:{" "}
                                    <span className="font-bold">
                                      {user.reportStats.userReportedPosts}
                                    </span>
                                  </span>
                                </div>
                                {user.reportStats.bothDetectedPosts > 0 && (
                                  <div className="group/legend flex items-center gap-1.5">
                                    <div className="ring-1.5 h-2.5 w-2.5 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 shadow-sm ring-purple-200/50 transition-all group-hover/legend:ring-purple-300/70 dark:from-purple-600 dark:to-pink-600 dark:ring-purple-800/50 dark:group-hover/legend:ring-purple-700/70" />
                                    <span className="font-semibold text-purple-600 dark:text-purple-400">
                                      Both:{" "}
                                      <span className="font-bold">
                                        {user.reportStats.bothDetectedPosts}
                                      </span>
                                    </span>
                                  </div>
                                )}
                              </div>

                              {/* Summary */}
                              <div className="flex items-center gap-2.5 border-t border-border/40 pt-1.5 text-[10px] text-muted-foreground">
                                <span className="flex items-center gap-1">
                                  <span className="font-medium">Tổng:</span>
                                  <span className="font-bold text-foreground">
                                    {user.reportStats.totalPosts}
                                  </span>
                                  <span>posts</span>
                                </span>
                                <span className="text-border">•</span>
                                <span className="flex items-center gap-1">
                                  <span className="font-medium">Reported:</span>
                                  <span className="font-bold text-foreground">
                                    {user.reportStats.reportedPosts}
                                  </span>
                                  <span>posts</span>
                                </span>
                              </div>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <div className="h-2 w-2 animate-pulse rounded-full bg-current" />
                              <span>Loading...</span>
                            </div>
                          )}
                        </td>
                        <td className="p-3 text-xs text-muted-foreground">
                          {formatRelativeDate(user.createdAt)}
                        </td>
                        <td className="p-3">
                          <div className="flex min-w-[140px] flex-col gap-2">
                            <div className="flex gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleWarnUser(user)}
                                disabled={
                                  warnUserMutation.isPending ||
                                  (user.warningCount || 0) >= 3 ||
                                  user.status === false ||
                                  isWarningOnCooldown(user) ||
                                  !!(
                                    user.bannedUntil &&
                                    new Date(user.bannedUntil) > new Date()
                                  )
                                }
                                className={cn(
                                  "relative flex items-center gap-1.5",
                                  (user.warningCount || 0) >= 3 ||
                                    user.status === false
                                    ? "cursor-not-allowed bg-muted text-muted-foreground opacity-50"
                                    : (user.warningCount || 0) >= 2
                                      ? "border-red-300 bg-red-50 text-red-700 hover:bg-red-100 dark:border-red-700 dark:bg-red-950/30 dark:text-red-400"
                                      : (user.warningCount || 0) >= 1
                                        ? "border-orange-300 bg-orange-50 text-orange-700 hover:bg-orange-100 dark:border-orange-700 dark:bg-orange-950/30 dark:text-orange-400"
                                        : "text-orange-600 hover:text-orange-700 dark:text-orange-400"
                                )}
                                title={
                                  isWarningOnCooldown(user)
                                    ? `In cooldown period (3 days). Can be used again after: ${formatDateTime(user.lastWarningAt ? new Date(new Date(user.lastWarningAt).getTime() + 3 * 24 * 60 * 60 * 1000) : null)}`
                                    : (user.warningCount || 0) >= 3
                                      ? "No warnings left"
                                      : `Warnings (Remaining: ${3 - (user.warningCount || 0)}/3)`
                                }
                              >
                                <AlertTriangle className="h-4 w-4" />
                                <span className="text-xs font-semibold">
                                  {3 - (user.warningCount || 0)}
                                </span>
                              </Button>
                              <Button
                                variant="destructive"
                                size="sm"
                                onClick={() => handleBanUser(user)}
                                disabled={
                                  banUserMutation.isPending ||
                                  user.status === false
                                }
                                title="Ban User"
                                className="flex items-center gap-1.5"
                              >
                                <UserX className="h-4 w-4" />
                                <span className="text-xs">Ban</span>
                              </Button>
                            </div>
                            {user.bannedUntil &&
                              new Date(user.bannedUntil) > new Date() && (
                                <div className="text-[9px] font-semibold text-red-600 dark:text-red-400">
                                  Banned until:{" "}
                                  {formatDateTime(user.bannedUntil)}
                                </div>
                              )}
                            {isWarningOnCooldown(user) && (
                              <div className="text-[9px] font-semibold text-orange-600 dark:text-orange-400">
                                Can warn again after:{" "}
                                {formatDateTime(
                                  user.lastWarningAt
                                    ? new Date(
                                        new Date(user.lastWarningAt).getTime() +
                                          3 * 24 * 60 * 60 * 1000
                                      )
                                    : null
                                )}
                              </div>
                            )}
                            {user.status === false && (
                              <div className="text-[9px] font-semibold text-red-600 dark:text-red-400">
                                Permanently banned
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {data?.pagination && (
            <div className="flex items-center justify-between">
              <div className="text-sm text-muted-foreground">
                Page {data.pagination.page} of {data.pagination.totalPages} (
                {data.pagination.total} total)
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setPage((p) => p + 1)}
                  disabled={page >= data.pagination.totalPages}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Confirm Dialog */}
      <AlertDialog
        open={confirmDialog.open}
        onOpenChange={(open) =>
          !open && setConfirmDialog({ open: false, type: null, user: null })
        }
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmDialog.type === "ban" ? "Ban User" : "Delete User"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmDialog.type === "ban" ? (
                <>
                  Are you sure you want to ban user{" "}
                  <strong>{confirmDialog.user?.displayName}</strong>? The
                  account will be disabled and cannot log in.
                </>
              ) : (
                <>
                  Are you sure you want to delete user{" "}
                  <strong>{confirmDialog.user?.displayName}</strong>? This
                  action cannot be undone.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmAction}
              className={
                confirmDialog.type === "delete" || confirmDialog.type === "ban"
                  ? "bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  : ""
              }
            >
              Confirm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
