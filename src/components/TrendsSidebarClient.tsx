"use client";

import { useQuery } from "@tanstack/react-query";
import { formatNumber } from "@/lib/utils";
import { Loader2 } from "lucide-react";
import Link from "next/link";
import FollowButton from "./FollowButton";
import UserAvatar from "./UserAvatar";
import UserTooltip from "./UserTooltip";

interface User {
  id: string;
  createdAt: Date;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  bio: string | null;
  followers: Array<{ followerId: string }>;
  blockedByUsers: Array<{ id: string }>;
  _count: {
    followers: number;
    following: number;
    posts: number;
  };
}

interface TrendingTopic {
  hashtag: string;
  count: number;
}

interface TrendsData {
  usersToFollow: User[];
  trendingTopics: TrendingTopic[];
}

export default function TrendsSidebarClient() {
  const { data, isLoading, error } = useQuery<TrendsData>({
    queryKey: ["trends"],
    queryFn: async () => {
      const response = await fetch("/api/trends");
      if (!response.ok) {
        throw new Error("Failed to fetch trends");
      }
      return response.json();
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  if (isLoading) {
    return (
      <div className="sticky top-[5.25rem] hidden h-fit w-72 flex-none space-y-6 md:block lg:w-80">
        <div className="card-glass sidebar-card space-y-5 rounded-2xl p-5 fade-in">
          <div className="gradient-text text-xl font-bold">Who to follow</div>
          <Loader2 className="mx-auto animate-spin" />
        </div>
        <div className="card-glass sidebar-card space-y-5 rounded-2xl p-5 fade-in">
          <div className="gradient-text text-xl font-bold">Trending topics</div>
          <Loader2 className="mx-auto animate-spin" />
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="sticky top-[5.25rem] hidden h-fit w-72 flex-none space-y-6 md:block lg:w-80">
        <div className="card-glass sidebar-card space-y-5 rounded-2xl p-5 fade-in">
          <div className="gradient-text text-xl font-bold">Who to follow</div>
          <p className="text-muted-foreground">Unable to load suggestions</p>
        </div>
        <div className="card-glass sidebar-card space-y-5 rounded-2xl p-5 fade-in">
          <div className="gradient-text text-xl font-bold">Trending topics</div>
          <p className="text-muted-foreground">Unable to load trends</p>
        </div>
      </div>
    );
  }

  return (
    <div className="sticky top-[5.25rem] hidden h-fit w-72 flex-none space-y-6 md:block lg:w-80">
      <WhoToFollow users={data.usersToFollow} />
      <TrendingTopics topics={data.trendingTopics} />
    </div>
  );
}

function WhoToFollow({ users }: { users: User[] }) {
  if (users.length === 0) {
    return (
      <div className="card-glass sidebar-card space-y-5 rounded-2xl p-5 fade-in">
        <div className="gradient-text text-xl font-bold">Who to follow</div>
        <p className="text-muted-foreground">No suggestions available</p>
      </div>
    );
  }

  return (
    <div className="card-glass sidebar-card space-y-5 rounded-2xl p-5 fade-in">
      <div className="gradient-text text-xl font-bold">Who to follow</div>
      {users.map((user) => (
        <div
          key={user.id}
          className="sidebar-item flex items-center justify-between gap-3"
        >
          <UserTooltip user={user}>
            <Link
              href={`/users/${user.username}`}
              className="flex items-center gap-3"
            >
              <UserAvatar avatarUrl={user.avatarUrl} className="flex-none" />
              <div>
                <p className="line-clamp-1 break-all font-semibold hover:underline">
                  {user.displayName}
                </p>
                <p className="line-clamp-1 break-all text-muted-foreground">
                  @{user.username}
                </p>
              </div>
            </Link>
          </UserTooltip>
          <FollowButton
            userId={user.id}
            initialState={{
              followers: user._count.followers,
              isFollowedByUser: user.followers.some(
                ({ followerId }) => followerId === user.id
              ),
            }}
          />
        </div>
      ))}
    </div>
  );
}

function TrendingTopics({ topics }: { topics: TrendingTopic[] }) {
  if (topics.length === 0) {
    return (
      <div className="card-glass sidebar-card space-y-5 rounded-2xl p-5 fade-in">
        <div className="gradient-text text-xl font-bold">Trending topics</div>
        <p className="text-muted-foreground">No trending topics</p>
      </div>
    );
  }

  return (
    <div className="card-glass sidebar-card space-y-5 rounded-2xl p-5 fade-in">
      <div className="gradient-text text-xl font-bold">Trending topics</div>
      {topics.map(({ hashtag, count }) => {
        const title = hashtag.split("#")[1];

        return (
          <Link
            key={title}
            href={`/hashtag/${title}`}
            className="sidebar-item block"
          >
            <p
              className="line-clamp-1 break-all font-semibold hover:underline"
              title={hashtag}
            >
              {hashtag}
            </p>
            <p className="text-sm text-muted-foreground">
              {formatNumber(count)} {count === 1 ? "post" : "posts"}
            </p>
          </Link>
        );
      })}
    </div>
  );
}
