"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Users,
  Search,
  Shield,
  UserX,
  Mail,
  MailCheck,
  ArrowLeft,
  Heart,
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
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

interface User {
  id: string;
  username: string;
  displayName: string;
  email: string | null;
  avatarUrl: string | null;
  role: "USER" | "ADMIN";
  emailVerified: boolean;
  createdAt: Date;
  _count: {
    posts: number;
    followers: number;
    following: number;
  };
}

export default function AdminUsersPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    type: "toggleRole" | "delete" | null;
    user: User | null;
  }>({ open: false, type: null, user: null });
  const [emotionDialog, setEmotionDialog] = useState<{
    open: boolean;
    userId: string | null;
    userName: string | null;
  }>({ open: false, userId: null, userName: null });

  const { data, isLoading } = useQuery({
    queryKey: ["admin-users", page, search, roleFilter],
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

  const updateUserMutation = useMutation({
    mutationFn: async ({ userId, data }: { userId: string; data: any }) => {
      return kyInstance
        .patch(`/api/admin/users/${userId}`, { json: data })
        .json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      toast({ description: "User updated successfully" });
    },
  });

  const deleteUserMutation = useMutation({
    mutationFn: async (userId: string) => {
      return kyInstance.delete(`/api/admin/users/${userId}`).json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      toast({ description: "User deleted successfully" });
    },
  });

  const handleToggleRole = (user: User) => {
    setConfirmDialog({ open: true, type: "toggleRole", user });
  };

  const handleDeleteUser = (user: User) => {
    setConfirmDialog({ open: true, type: "delete", user });
  };

  const handleConfirmAction = () => {
    if (!confirmDialog.user || !confirmDialog.type) return;

    if (confirmDialog.type === "toggleRole") {
      updateUserMutation.mutate({
        userId: confirmDialog.user.id,
        data: {
          role: confirmDialog.user.role === "ADMIN" ? "USER" : "ADMIN",
        },
      });
    } else if (confirmDialog.type === "delete") {
      deleteUserMutation.mutate(confirmDialog.user.id);
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
            <h1 className="text-3xl font-bold bg-gradient-to-r from-pink-600 to-purple-600 bg-clip-text text-transparent">
              Quản lý Người dùng
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
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
      ) : (
        <>
          <Card className="card-glass overflow-hidden border-2">
            <CardContent className="p-0">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="p-4 text-left">User</th>
                    <th className="p-4 text-left">Email</th>
                    <th className="p-4 text-left">Role</th>
                    <th className="p-4 text-left">Stats</th>
                    <th className="p-4 text-left">Created</th>
                    <th className="p-4 text-left">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {data?.users.map((user) => (
                    <tr key={user.id} className="border-b hover:bg-muted/50">
                      <td className="p-4">
                        <Link
                          href={`/users/${user.username}`}
                          className="font-medium hover:underline"
                        >
                          {user.displayName}
                        </Link>
                        <div className="text-sm text-muted-foreground">
                          @{user.username}
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          {user.email}
                          {user.emailVerified ? (
                            <MailCheck className="h-4 w-4 text-green-500" />
                          ) : (
                            <Mail className="h-4 w-4 text-muted-foreground" />
                          )}
                        </div>
                      </td>
                      <td className="p-4">
                        <Badge
                          variant="outline"
                          className={cn(
                            "rounded-full font-semibold",
                            user.role === "ADMIN"
                              ? "border-purple-300 bg-purple-100 text-purple-700 dark:border-purple-700 dark:bg-purple-950/30 dark:text-purple-300"
                              : "border-blue-300 bg-blue-100 text-blue-700 dark:border-blue-700 dark:bg-blue-950/30 dark:text-blue-300"
                          )}
                        >
                          {user.role}
                        </Badge>
                      </td>
                      <td className="p-4 text-sm">
                        <div>Posts: {user._count.posts}</div>
                        <div>Followers: {user._count.followers}</div>
                        <div>Following: {user._count.following}</div>
                      </td>
                      <td className="p-4 text-sm text-muted-foreground">
                        {formatRelativeDate(user.createdAt)}
                      </td>
                      <td className="p-4">
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              setEmotionDialog({
                                open: true,
                                userId: user.id,
                                userName: user.displayName,
                              })
                            }
                            title="Xem biểu đồ cảm xúc"
                          >
                            <Heart className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleToggleRole(user)}
                            disabled={updateUserMutation.isPending}
                          >
                            <Shield className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => handleDeleteUser(user)}
                            disabled={deleteUserMutation.isPending}
                          >
                            <UserX className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
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
              {confirmDialog.type === "toggleRole"
                ? "Thay đổi vai trò"
                : "Xóa người dùng"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmDialog.type === "toggleRole" ? (
                <>
                  Bạn có chắc chắn muốn thay đổi vai trò của{" "}
                  <strong>{confirmDialog.user?.displayName}</strong> thành{" "}
                  <strong>
                    {confirmDialog.user?.role === "ADMIN" ? "USER" : "ADMIN"}
                  </strong>
                  ?
                </>
              ) : (
                <>
                  Bạn có chắc chắn muốn xóa người dùng{" "}
                  <strong>{confirmDialog.user?.displayName}</strong>? Hành động
                  này không thể hoàn tác.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Hủy</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmAction}
              className={
                confirmDialog.type === "delete"
                  ? "bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  : ""
              }
            >
              Xác nhận
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Emotion Chart Dialog */}
      <UserEmotionChartDialog
        open={emotionDialog.open}
        userId={emotionDialog.userId}
        userName={emotionDialog.userName}
        onClose={() =>
          setEmotionDialog({ open: false, userId: null, userName: null })
        }
      />
    </div>
  );
}

function UserEmotionChartDialog({
  open,
  userId,
  userName,
  onClose,
}: {
  open: boolean;
  userId: string | null;
  userName: string | null;
  onClose: () => void;
}) {
  const { data, isLoading } = useQuery({
    queryKey: ["user-emotion-chart", userId],
    queryFn: async () => {
      if (!userId) return null;
      try {
        const res = await kyInstance
          .get(`/api/admin/users/${userId}/mental-health`)
          .json<{
            currentEmotion: string | null;
            currentScore: number | null;
            chartData: Array<{
              date: string;
              avgScore: number;
              emotion: string;
            }>;
            alerts: Array<{
              type: "harmful" | "low-emotion";
              date: Date;
              message: string;
              postId: string;
            }>;
            recentPostsCount: number;
          }>();
        return res;
      } catch (error) {
        console.error("Error fetching user emotion data:", error);
        return null;
      }
    },
    enabled: open && !!userId,
  });

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-h-[95vh] max-w-5xl overflow-y-auto p-0">
        <DialogHeader className="px-6 pb-4 pt-6">
          <DialogTitle className="text-2xl">
            Biểu Đồ Cảm Xúc - {userName}
          </DialogTitle>
          <DialogDescription>
            Xu hướng cảm xúc trong 30 ngày qua
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex h-[500px] items-center justify-center px-6 pb-6">
            <Skeleton className="h-full w-full" />
          </div>
        ) : data && data.chartData.length > 0 ? (
          <div className="space-y-4 px-6 pb-6">
            {/* Chart - Main Focus */}
            <div className="rounded-lg border bg-card p-6">
              <div className="mb-6 flex items-center justify-between">
                <h3 className="text-xl font-semibold">
                  Emotion Trend (Last 30 Days)
                </h3>
                <div className="flex gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Cảm xúc: </span>
                    <span className="font-semibold">
                      {data.currentEmotion || "N/A"}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Điểm: </span>
                    <span className="font-semibold">
                      {data.currentScore
                        ? `${(data.currentScore * 100).toFixed(1)}%`
                        : "N/A"}
                    </span>
                  </div>
                </div>
              </div>
              <ResponsiveContainer width="100%" height={400}>
                <LineChart data={data.chartData}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 11 }}
                    tickFormatter={(date) => {
                      const d = new Date(date);
                      return `${d.getMonth() + 1}/${d.getDate()}`;
                    }}
                  />
                  <YAxis
                    domain={[0, 1]}
                    tick={{ fontSize: 11 }}
                    tickFormatter={(value) => `${(value * 100).toFixed(0)}%`}
                  />
                  <Tooltip
                    labelFormatter={(date) =>
                      new Date(date).toLocaleDateString("vi-VN", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })
                    }
                    formatter={(value: number) => [
                      `${(value * 100).toFixed(1)}%`,
                      "Emotion Score",
                    ]}
                    contentStyle={{
                      backgroundColor: "hsl(var(--background))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                      boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
                    }}
                  />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="avgScore"
                    stroke="#8884d8"
                    strokeWidth={3}
                    name="Emotion Score"
                    dot={{ r: 5, fill: "#8884d8", strokeWidth: 2 }}
                    activeDot={{ r: 7, fill: "#8884d8", strokeWidth: 2 }}
                  />
                </LineChart>
              </ResponsiveContainer>
              <div className="mt-6 flex flex-wrap justify-center gap-3">
                <span className="inline-flex items-center gap-2 rounded-md border border-green-200 bg-green-50 px-3 py-1.5 text-xs font-semibold text-green-800">
                  Above 60%: Positive
                </span>
                <span className="inline-flex items-center gap-2 rounded-md border border-gray-200 bg-gray-50 px-3 py-1.5 text-xs font-semibold text-gray-800">
                  40-60%: Neutral
                </span>
                <span className="inline-flex items-center gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-800">
                  Below 40%: Negative
                </span>
              </div>
            </div>
          </div>
        ) : (
          <div className="px-6 py-12 pb-6 text-center text-sm text-muted-foreground">
            Không có dữ liệu cảm xúc trong 30 ngày qua
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
