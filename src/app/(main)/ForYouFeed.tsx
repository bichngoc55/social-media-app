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
      if (saved) setInitialCursor(saved);
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
    enabled: isReady,
    queryFn: async ({ pageParam }) => {
      const cursorToSend = pageParam ?? initialCursor;

      const response = await kyInstance.post("/api/posts/for-you", {
        json: { cursor: cursorToSend },
        timeout: 60000,
      });
      return response.json<PostsPage>();
    },
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    staleTime: 60 * 100, // 5 minutes
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
        <p className="text-center text-muted-foreground">No new posts found.</p>
        <Button
          variant="outline"
          onClick={() => {
            localStorage.removeItem(SEEN_POSTS_KEY);
            window.location.reload();
          }}
        >
          Reset Feed
        </Button>
      </div>
    );
  }

  return (
    <InfiniteScrollContainer
      className="space-y-5"
      onBottomReached={() => {
        if (hasNextPage && !isFetching && !isFetchingNextPage) fetchNextPage();
      }}
    >
      {posts.map((post) => (
        <Post key={post.id} post={post} />
      ))}
      {isFetchingNextPage && <Loader2 className="mx-auto my-3 animate-spin" />}
    </InfiniteScrollContainer>
  );
}
