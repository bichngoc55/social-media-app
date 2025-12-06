"use client";

import { useState } from "react";
import InfiniteScrollContainer from "@/components/InfiniteScrollContainer";
import Post from "@/components/posts/Post";
import PostsLoadingSkeleton from "@/components/posts/PostsLoadingSkeleton";
import UserAvatar from "@/components/UserAvatar";
import kyInstance from "@/lib/ky";
import { PostData, UserData } from "@/lib/types";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import Link from "next/link";

interface SearchResultsProps {
  query: string;
}

interface PostsResponse {
  posts: PostData[];
  nextCursor: string | null;
}

interface UsersResponse {
  users: UserData[];
}

interface AllResponse {
  posts: PostData[];
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
            searchParams: { q: query, limit: "10" },
          })
          .json<{ posts: PostData[] }>(),
        kyInstance
          .get("/api/search/users", { searchParams: { q: query } })
          .json<UsersResponse>(),
      ]);
      return {
        posts: postsRes.posts || [],
        users: usersRes.users || [],
      };
    },
    enabled: activeTab === "all",
    gcTime: 0,
  });

  // Query for "Posts" tab with infinite scroll
  const postsQuery = useInfiniteQuery({
    queryKey: ["search", "posts", query],
    queryFn: ({ pageParam }) =>
      kyInstance
        .get("/api/search/semantic", {
          searchParams: {
            q: query,
            limit: "10",
          },
        })
        .json<{ posts: PostData[] }>(),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => {
      const posts = lastPage.posts || [];
      return posts.length === 10 ? posts[posts.length - 1]?.id : null;
    },
    enabled: activeTab === "posts",
    gcTime: 0,
  });

  // Query for "Users" tab
  const usersQuery = useQuery({
    queryKey: ["search", "users", query],
    queryFn: () =>
      kyInstance
        .get("/api/search/users", {
          searchParams: { q: query },
        })
        .json<UsersResponse>(),
    enabled: activeTab === "users",
    gcTime: 0,
  });

  const allPosts = allQuery.data?.posts || [];
  const allUsers = allQuery.data?.users || [];
  const posts =
    postsQuery.data?.pages.flatMap((page) => page.posts || []) || [];
  const users = usersQuery.data?.users || [];

  const isLoading =
    (activeTab === "all" && allQuery.isLoading) ||
    (activeTab === "posts" && postsQuery.isLoading) ||
    (activeTab === "users" && usersQuery.isLoading);

  const isError =
    (activeTab === "all" && allQuery.isError) ||
    (activeTab === "posts" && postsQuery.isError) ||
    (activeTab === "users" && usersQuery.isError);

  if (isLoading) {
    return <PostsLoadingSkeleton />;
  }

  if (isError) {
    return (
      <p className="text-center text-destructive">
        An error occurred while loading results.
      </p>
    );
  }

  return (
    <div className="space-y-5">
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
          Users {activeTab === "users" && `(${users.length})`}
        </button>
      </div>

      {activeTab === "all" && (
        <div className="space-y-8">
          <div>
            <h2 className="mb-3 text-lg font-semibold">Posts</h2>
            {allPosts.length === 0 ? (
              <p className="text-center text-muted-foreground">
                No posts found.
              </p>
            ) : (
              <div className="space-y-5">
                {allPosts.slice(0, 5).map((post) => (
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

      {activeTab === "posts" && (
        <>
          {posts.length === 0 ? (
            <p className="text-center text-muted-foreground">
              No posts found for this query.
            </p>
          ) : (
            <InfiniteScrollContainer
              className="space-y-5"
              onBottomReached={() =>
                postsQuery.hasNextPage &&
                !postsQuery.isFetching &&
                postsQuery.fetchNextPage()
              }
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

      {activeTab === "users" && (
        <div className="space-y-3">
          {users.length === 0 ? (
            <p className="text-center text-muted-foreground">
              No users found for this query.
            </p>
          ) : (
            users.map((user) => (
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
            ))
          )}
        </div>
      )}
    </div>
  );
}
