"use client";

import InfiniteScrollContainer from "@/components/InfiniteScrollContainer";
import Post from "@/components/posts/Post";
import PostsLoadingSkeleton from "@/components/posts/PostsLoadingSkeleton";
import { Button } from "@/components/ui/button";
import kyInstance from "@/lib/ky";
import { PostsPage } from "@/lib/types";
import { useInfiniteQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";

export const SEEN_POSTS_KEY = "seen_posts_v1";

export default function ForYouFeed() {
  const [initialCursor, setInitialCursor] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem(SEEN_POSTS_KEY);
      console.log("Loaded initial cursor from localStorage:", saved);
      if (saved) {
        setInitialCursor(saved);
      }
      setIsReady(true);
    }
  }, []);

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetching,
    isFetchingNextPage,
    status,
  } = useInfiniteQuery({
    queryKey: ["post-feed", "for-you"],
    // Only run query when we have checked localStorage
    enabled: isReady,
    queryFn: async ({ pageParam }) => {
      const cursorToSend = pageParam ?? initialCursor;

      const response = await kyInstance.get("/api/posts/for-you", {
        searchParams: cursorToSend ? { cursor: cursorToSend } : {},
        timeout: 60000,
      });
      return response.json<PostsPage>();
    },
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
  });

  useEffect(() => {
    if (data?.pages) {
      const lastPage = data.pages[data.pages.length - 1];
      if (lastPage.nextCursor) {
        localStorage.setItem(SEEN_POSTS_KEY, lastPage.nextCursor);
      }
    }
  }, [data]);

  const posts = data?.pages.flatMap((page) => page.posts) || [];

  if (!isReady || status === "pending") {
    return <PostsLoadingSkeleton />;
  }

  if (status === "success" && !posts.length && !hasNextPage) {
    return (
      <div className="flex flex-col items-center gap-2">
        <p className="text-center text-muted-foreground">
          No new posts found right now.
        </p>
        <Button
          variant="outline"
          onClick={() => {
            // Clear history to restart
            localStorage.removeItem(SEEN_POSTS_KEY);
            window.location.reload();
          }}
        >
          Reset Feed History
        </Button>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="space-y-2 text-center">
        <p className="text-destructive">An error occurred.</p>
        <Button onClick={() => window.location.reload()} variant="outline">
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <InfiniteScrollContainer
        className="space-y-5"
        onBottomReached={() => {
          if (hasNextPage && !isFetching && !isFetchingNextPage) {
            fetchNextPage();
          }
        }}
      >
        {posts.map((post) => (
          <Post key={post.id} post={post} />
        ))}
        {isFetchingNextPage && (
          <Loader2 className="mx-auto my-3 animate-spin" />
        )}
      </InfiniteScrollContainer>
    </div>
  );
}
