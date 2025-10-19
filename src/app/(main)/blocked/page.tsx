"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import UserAvatar from "@/components/UserAvatar";
import { useToast } from "@/hooks/use-toast";
import { formatDate } from "date-fns";
import { UserX, Shield, Calendar, MessageSquare } from "lucide-react";
import Link from "next/link";

interface BlockedUser {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  bio: string | null;
  blockedAt: string;
  blockReason: string | null;
}

interface BlockedUsersResponse {
  blockedUsers: BlockedUser[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export default function BlockedUsersPage() {
  const [blockedUsers, setBlockedUsers] = useState<BlockedUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUnblocking, setIsUnblocking] = useState<string | null>(null);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 0,
  });
  const { toast } = useToast();

  const fetchBlockedUsers = useCallback(
    async (page = 1) => {
      try {
        const response = await fetch(
          `/api/users/blocked?page=${page}&limit=10`
        );
        const data: BlockedUsersResponse = await response.json();

        if (!response.ok) {
          throw new Error((data as any).error || "Có lỗi xảy ra");
        }

        setBlockedUsers(data.blockedUsers);
        setPagination(data.pagination);
      } catch (error) {
        toast({
          title: "Lỗi",
          description: error instanceof Error ? error.message : "Có lỗi xảy ra",
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
      }
    },
    [toast]
  );

  const handleUnblockUser = async (userId: string, username: string) => {
    setIsUnblocking(userId);
    try {
      const response = await fetch(`/api/users/${userId}/block`, {
        method: "DELETE",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Có lỗi xảy ra");
      }

      setBlockedUsers((prev) => prev.filter((user) => user.id !== userId));
      setPagination((prev) => ({
        ...prev,
        total: prev.total - 1,
      }));

      toast({
        title: "Thành công",
        description: `Đã bỏ chặn ${username}`,
      });
    } catch (error) {
      toast({
        title: "Lỗi",
        description: error instanceof Error ? error.message : "Có lỗi xảy ra",
        variant: "destructive",
      });
    } finally {
      setIsUnblocking(null);
    }
  };

  useEffect(() => {
    fetchBlockedUsers();
  }, [fetchBlockedUsers]);

  if (isLoading) {
    return (
      <main className="flex w-full min-w-0 gap-5">
        <div className="w-full min-w-0 space-y-5">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Người dùng đã chặn
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-4 rounded-lg border p-4"
                  >
                    <Skeleton className="h-12 w-12 rounded-full" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-32" />
                      <Skeleton className="h-3 w-24" />
                      <Skeleton className="h-3 w-40" />
                    </div>
                    <Skeleton className="h-8 w-20" />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    );
  }

  return (
    <main className="flex w-full min-w-0 gap-5">
      <div className="w-full min-w-0 space-y-5">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Người dùng đã chặn
            </CardTitle>
            <p className="text-muted-foreground">
              Quản lý danh sách người dùng bạn đã chặn
            </p>
          </CardHeader>
          <CardContent>
            {blockedUsers.length === 0 ? (
              <div className="py-8 text-center">
                <UserX className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
                <h3 className="mb-2 text-lg font-semibold">
                  Chưa có người dùng nào bị chặn
                </h3>
                <p className="text-muted-foreground">
                  Khi bạn chặn ai đó, họ sẽ xuất hiện ở đây.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {blockedUsers.map((user) => (
                  <div
                    key={user.id}
                    className="flex items-center gap-4 rounded-lg border p-4 transition-colors hover:bg-muted/50"
                  >
                    <UserAvatar
                      avatarUrl={user.avatarUrl}
                      size={48}
                      className="rounded-full"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="mb-1 flex items-center gap-2">
                        <Link
                          href={`/users/${user.username}`}
                          className="truncate font-semibold hover:underline"
                        >
                          {user.displayName}
                        </Link>
                        <span className="text-sm text-muted-foreground">
                          @{user.username}
                        </span>
                      </div>
                      {user.bio && (
                        <p className="mb-2 truncate text-sm text-muted-foreground">
                          {user.bio}
                        </p>
                      )}
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          Chặn ngày{" "}
                          {formatDate(new Date(user.blockedAt), "dd/MM/yyyy")}
                        </div>
                        {user.blockReason && (
                          <div className="flex items-center gap-1">
                            <MessageSquare className="h-3 w-3" />
                            {user.blockReason}
                          </div>
                        )}
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleUnblockUser(user.id, user.username)}
                      disabled={isUnblocking === user.id}
                      className="text-green-600 hover:bg-green-50 hover:text-green-700"
                    >
                      {isUnblocking === user.id ? (
                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                      ) : (
                        <Shield className="h-4 w-4" />
                      )}
                      Bỏ chặn
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
