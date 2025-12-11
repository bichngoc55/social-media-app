"use client";

import { useState } from "react";
import InfiniteScrollContainer from "@/components/InfiniteScrollContainer";
import Post from "@/components/posts/Post";
import PostsLoadingSkeleton from "@/components/posts/PostsLoadingSkeleton";
import UserAvatar from "@/components/UserAvatar";
import kyInstance from "@/lib/ky";
import { PostData, UserData } from "@/lib/types";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { Heart, Loader2 } from "lucide-react";
import Link from "next/link";

interface SearchResultsProps {
  query: string;
}

interface EmotionAnalysis {
  isHarmful: boolean;
  isDepressive: boolean;
  isNegative: boolean;
  hasEmotionalConcern: boolean;
  supportiveMessage: string | null;
}

interface SemanticSearchResponse {
  posts: PostData[];
  nextCursor: number | null;
  emotionAnalysis?: EmotionAnalysis;
}

interface UsersResponse {
  users: UserData[];
}

export default function SearchResults({ query }: SearchResultsProps) {
  const [activeTab, setActiveTab] = useState<"all" | "posts" | "users">("all");

  // Query for "All" tab
  const allQuery = useQuery({
    queryKey: ["search", "all", query],
    queryFn: async () => {
      const [postsRes, usersRes] = await Promise.all([
        kyInstance
          .get("/api/search/semantic", {
            searchParams: { q: query, limit: "5" },
          })
          .json<SemanticSearchResponse>(),
        kyInstance
          .get("/api/search/users", { searchParams: { q: query } })
          .json<UsersResponse>(),
      ]);
      return {
        posts: postsRes.posts || [],
        users: usersRes.users || [],
        emotionAnalysis: postsRes.emotionAnalysis,
      };
    },
    enabled: activeTab === "all",
  });

  const postsQuery = useInfiniteQuery({
    queryKey: ["search", "posts", query],
    queryFn: ({ pageParam }) =>
      kyInstance
        .get("/api/search/semantic", {
          searchParams: {
            q: query,
            limit: "10",
            cursor: pageParam !== null ? pageParam.toString() : "0",
          },
        })
        .json<SemanticSearchResponse>(),
    initialPageParam: 0 as number | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    enabled: activeTab === "posts",
    gcTime: 0,
  });

  const usersQuery = useQuery({
    queryKey: ["search", "users", query],
    queryFn: () =>
      kyInstance
        .get("/api/search/users", {
          searchParams: { q: query },
        })
        .json<UsersResponse>(),
    enabled: activeTab === "users",
  });

  const allPosts = allQuery.data?.posts || [];
  const allUsers = allQuery.data?.users || [];
  const posts =
    postsQuery.data?.pages.flatMap((page) => page.posts || []) || [];
  const users = usersQuery.data?.users || [];

  const emotionAnalysis =
    allQuery.data?.emotionAnalysis ||
    postsQuery.data?.pages[0]?.emotionAnalysis;

  const isLoading =
    (activeTab === "all" && allQuery.isLoading) ||
    (activeTab === "posts" && postsQuery.isLoading) ||
    (activeTab === "users" && usersQuery.isLoading);

  if (isLoading) return <PostsLoadingSkeleton />;

  if (
    (activeTab === "all" && allQuery.isError) ||
    (activeTab === "posts" && postsQuery.isError)
  ) {
    return (
      <p className="text-center text-destructive">
        An error occurred while loading results.
      </p>
    );
  }

  return (
    <div className="space-y-5">
      {/* Emotion Banner */}
      {emotionAnalysis?.hasEmotionalConcern &&
        emotionAnalysis.supportiveMessage && (
          <div className="rounded-lg border border-pink-200 bg-gradient-to-r from-pink-50 to-purple-50 p-3 shadow-sm dark:border-pink-900/30 dark:from-pink-950/20 dark:to-purple-950/20">
            <div className="flex items-start gap-2">
              <Heart className="mt-0.5 h-4 w-4 flex-shrink-0 text-pink-500" />
              <p className="text-sm text-foreground/90">
                {emotionAnalysis.supportiveMessage}
              </p>
            </div>
          </div>
        )}

      {/* Tabs */}
      <div className="flex gap-2 border-b">
        <button
          onClick={() => setActiveTab("all")}
          className={`px-4 py-2 font-medium transition-colors ${
            activeTab === "all"
              ? "border-b-2 border-primary text-primary"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          All
        </button>
        <button
          onClick={() => setActiveTab("posts")}
          className={`px-4 py-2 font-medium transition-colors ${
            activeTab === "posts"
              ? "border-b-2 border-primary text-primary"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Posts {activeTab === "posts" && `(${posts.length})`}
        </button>
        <button
          onClick={() => setActiveTab("users")}
          className={`px-4 py-2 font-medium transition-colors ${
            activeTab === "users"
              ? "border-b-2 border-primary text-primary"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Users
        </button>
      </div>

      {/* "All" Tab View */}
      {activeTab === "all" && (
        <div className="space-y-8">
          <div>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Top Posts</h2>
              <button
                onClick={() => setActiveTab("posts")}
                className="text-sm text-primary hover:underline"
              >
                See all
              </button>
            </div>
            {allPosts.length === 0 ? (
              <p className="text-center text-muted-foreground">
                No posts found.
              </p>
            ) : (
              <div className="space-y-5">
                {/* REMOVED .slice(0, 5) - now shows whatever 'limit' returned */}
                {allPosts.map((post) => (
                  <Post key={post.id} post={post} />
                ))}
              </div>
            )}
          </div>

          <div>
            <h2 className="mb-3 text-lg font-semibold">Users</h2>
            {allUsers.length === 0 ? (
              <p className="text-center text-muted-foreground">
                No users found.
              </p>
            ) : (
              <div className="space-y-3">
                {allUsers.slice(0, 5).map((user) => (
                  <Link
                    key={user.id}
                    href={`/users/${user.username}`}
                    className="flex items-center gap-3 rounded-lg bg-card p-4 shadow-sm transition-colors hover:bg-accent"
                  >
                    <UserAvatar avatarUrl={user.avatarUrl} size={48} />
                    <div className="flex-1 overflow-hidden">
                      <p className="truncate font-semibold">
                        {user.displayName}
                      </p>
                      <p className="truncate text-sm text-muted-foreground">
                        @{user.username}
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* "Posts" Tab View (Infinite Scroll) */}
      {activeTab === "posts" && (
        <>
          {posts.length === 0 && !postsQuery.isFetching ? (
            <p className="text-center text-muted-foreground">
              No posts found for this query.
            </p>
          ) : (
            <InfiniteScrollContainer
              className="space-y-5"
              onBottomReached={() => {
                if (postsQuery.hasNextPage && !postsQuery.isFetching) {
                  postsQuery.fetchNextPage();
                }
              }}
            >
              {posts.map((post) => (
                <Post key={post.id} post={post} />
              ))}
              {postsQuery.isFetchingNextPage && (
                <Loader2 className="mx-auto my-3 animate-spin" />
              )}
            </InfiniteScrollContainer>
          )}
        </>
      )}

      {/* "Users" Tab View */}
      {activeTab === "users" && (
        <div className="space-y-3">
          {users.map((user) => (
            <Link
              key={user.id}
              href={`/users/${user.username}`}
              className="flex items-center gap-3 rounded-lg bg-card p-4 shadow-sm transition-colors hover:bg-accent"
            >
              <UserAvatar avatarUrl={user.avatarUrl} size={48} />
              <div className="flex-1 overflow-hidden">
                <p className="truncate font-semibold">{user.displayName}</p>
                <p className="truncate text-sm text-muted-foreground">
                  @{user.username}
                </p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
