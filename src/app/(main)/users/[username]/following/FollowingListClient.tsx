"use client";

import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import FollowButton from "@/components/FollowButton";
import UserAvatar from "@/components/UserAvatar";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import kyInstance from "@/lib/ky";
import { formatNumber } from "@/lib/utils";
import Link from "next/link";
import { Skeleton } from "@/components/ui/skeleton";

interface FollowingListClientProps {
  username: string;
}

interface User {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  bio: string | null;
  isFollowedByUser: boolean;
  _count: {
    posts: number;
    followers: number;
    following: number;
  };
}

export default function FollowingListClient({
  username,
}: FollowingListClientProps) {
  const [page, setPage] = useState(1);
  const { data, isLoading } = useQuery({
    queryKey: ["following", username, page],
    queryFn: () =>
      kyInstance
        .get(`/api/users/by-username/${username}/following`, {
          searchParams: { page, limit: 20 },
        })
        .json<{ users: User[]; pagination: any }>(),
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <Card key={i} className="card-glass">
            <CardContent className="p-4">
              <div className="flex items-center gap-4">
                <Skeleton className="h-12 w-12 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-24" />
                </div>
                <Skeleton className="h-9 w-20" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (!data || data.users.length === 0) {
    return (
      <Card className="card-glass">
        <CardContent className="p-8 text-center text-muted-foreground">
          Not following anyone yet.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {data.users.map((user) => (
        <Card key={user.id} className="card-glass">
          <CardContent className="p-4">
            <div className="flex items-center gap-4">
              <Link href={`/users/${user.username}`}>
                <UserAvatar
                  avatarUrl={user.avatarUrl}
                  size={48}
                  className="rounded-full"
                />
              </Link>
              <div className="min-w-0 flex-1">
                <Link
                  href={`/users/${user.username}`}
                  className="block hover:underline"
                >
                  <div className="truncate font-semibold">
                    {user.displayName}
                  </div>
                  <div className="truncate text-sm text-muted-foreground">
                    @{user.username}
                  </div>
                </Link>
                {user.bio && (
                  <div className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                    {user.bio}
                  </div>
                )}
                <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
                  <span>{formatNumber(user._count.posts)} posts</span>
                  <span>{formatNumber(user._count.followers)} followers</span>
                </div>
              </div>
              <FollowButton
                userId={user.id}
                initialState={{
                  followers: user._count.followers,
                  isFollowedByUser: user.isFollowedByUser,
                }}
              />
            </div>
          </CardContent>
        </Card>
      ))}

      {data.pagination && data.pagination.totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button
            variant="outline"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
          >
            Previous
          </Button>
          <span className="text-sm text-muted-foreground">
            Page {data.pagination.page} of {data.pagination.totalPages}
          </span>
          <Button
            variant="outline"
            onClick={() => setPage((p) => p + 1)}
            disabled={page >= data.pagination.totalPages}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  );
}
