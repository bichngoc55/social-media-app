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
  _count: {
    posts: number;
    followers: number;
    following: number;
    reportsReceived: number; // Count of reports against this user
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
    type: "delete" | null;
    user: User | null;
  }>({ open: false, type: null, user: null });

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

  const deleteUserMutation = useMutation({
    mutationFn: async (userId: string) => {
      return kyInstance.delete(`/api/admin/users/${userId}`).json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      toast({ description: "User deleted successfully" });
    },
  });

  const handleDeleteUser = (user: User) => {
    setConfirmDialog({ open: true, type: "delete", user });
  };

  const handleConfirmAction = () => {
    if (!confirmDialog.user || !confirmDialog.type) return;

    if (confirmDialog.type === "delete") {
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
            <h1 className="bg-gradient-to-r from-pink-600 to-purple-600 bg-clip-text text-3xl font-bold text-transparent">
              Quản lý Người dùng
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
                        <div className="mt-1">
                          <Link
                            href={`/admin/posts?tab=reports&reportedUser=${user.id}`}
                            className="inline-flex items-center gap-1 text-orange-600 hover:text-orange-700 hover:underline dark:text-orange-400"
                          >
                            <Flag className="h-3.5 w-3.5" />
                            Reports: {user._count.reportsReceived}
                            <ExternalLink className="h-3 w-3" />
                          </Link>
                        </div>
                      </td>
                      <td className="p-4 text-sm text-muted-foreground">
                        {formatRelativeDate(user.createdAt)}
                      </td>
                      <td className="p-4">
                        <div className="flex gap-2">
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
            <AlertDialogTitle>Xóa người dùng</AlertDialogTitle>
            <AlertDialogDescription>
              Bạn có chắc chắn muốn xóa người dùng{" "}
              <strong>{confirmDialog.user?.displayName}</strong>? Hành động này
              không thể hoàn tác.
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
    </div>
  );
}
