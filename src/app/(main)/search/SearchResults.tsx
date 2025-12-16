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

  // 1. Posts Query (Used for 'All' and 'Posts' tabs)
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
    enabled: !!query,
    gcTime: 0,
    staleTime: 0,
  });

  // 2. Users Query (Used for 'All' and 'Users' tabs)
  const usersQuery = useQuery({
    queryKey: ["search", "users", query],
    queryFn: () =>
      kyInstance
        .get("/api/search/users", {
          searchParams: { q: query },
        })
        .json<UsersResponse>(),
    enabled: !!query,
  });

  // 3. Derived Data
  const posts =
    postsQuery.data?.pages.flatMap((page) => page.posts || []) || [];
  const users = usersQuery.data?.users || [];

  // Get emotion analysis from the first page of results
  const emotionAnalysis = postsQuery.data?.pages[0]?.emotionAnalysis;

  const isPostsLoading = postsQuery.isLoading;
  const isUsersLoading = usersQuery.isLoading;
  const isPostsError = postsQuery.isError;
  const isUsersError = usersQuery.isError;

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
          Posts {posts.length > 0 && `(${posts.length})`}
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

      {/* --- TAB VIEW: ALL --- */}
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

            {isPostsLoading ? (
              <PostsLoadingSkeleton />
            ) : isPostsError ? (
              <p className="text-center text-destructive">
                Error loading posts.
              </p>
            ) : posts.length === 0 ? (
              <p className="text-center text-muted-foreground">
                No posts found.
              </p>
            ) : (
              <div className="space-y-5">
                {/* Limit to first 3 posts for the summary view */}
                {posts.slice(0, 3).map((post) => (
                  <Post key={post.id} post={post} />
                ))}
              </div>
            )}
          </div>

          <div>
            <h2 className="mb-3 text-lg font-semibold">Users</h2>
            {isUsersLoading ? (
              <div className="flex justify-center py-4">
                <Loader2 className="animate-spin" />
              </div>
            ) : users.length === 0 ? (
              <p className="text-center text-muted-foreground">
                No users found.
              </p>
            ) : (
              <div className="space-y-3">
                {users.slice(0, 3).map((user) => (
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

      {/* --- TAB VIEW: POSTS --- */}
      {activeTab === "posts" && (
        <>
          {isPostsLoading && <PostsLoadingSkeleton />}

          {!isPostsLoading && posts.length === 0 && !isPostsError && (
            <p className="text-center text-muted-foreground">No posts found.</p>
          )}

          {isPostsError && (
            <p className="text-center text-destructive">
              An error occurred while loading results.
            </p>
          )}

          {posts.length > 0 && (
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

      {/* --- TAB VIEW: USERS --- */}
      {activeTab === "users" && (
        <div className="space-y-3">
          {isUsersLoading && (
            <div className="flex justify-center py-4">
              <Loader2 className="animate-spin" />
            </div>
          )}

          {!isUsersLoading && users.length === 0 && (
            <p className="text-center text-muted-foreground">No users found.</p>
          )}

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
