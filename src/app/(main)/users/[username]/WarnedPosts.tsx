"use client";

import { useInfiniteQuery } from "@tanstack/react-query";
import kyInstance from "@/lib/ky";
import InfiniteScrollContainer from "@/components/InfiniteScrollContainer";
import Post from "@/components/posts/Post";
import PostsLoadingSkeleton from "@/components/posts/PostsLoadingSkeleton";
import { Loader2, AlertTriangle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { PostsPage } from "@/lib/types";

interface WarnedPostsProps {
  userId: string;
}

export default function WarnedPosts({ userId }: WarnedPostsProps) {
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetching,
    isFetchingNextPage,
    status,
  } = useInfiniteQuery({
    queryKey: ["warned-posts", userId],
    queryFn: ({ pageParam }) =>
      kyInstance
        .get(
          `/api/users/warned-posts`,
          pageParam
            ? { searchParams: { cursor: pageParam, userId } }
            : { searchParams: { userId } }
        )
        .json<PostsPage>(),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
  });

  const posts = data?.pages.flatMap((page) => page.posts) || [];

  if (status === "pending") {
    return <PostsLoadingSkeleton />;
  }

  if (status === "error") {
    return (
      <Card>
        <CardContent className="p-6">
          <p className="text-center text-destructive">
            Có lỗi xảy ra khi tải bài viết bị cảnh báo
          </p>
        </CardContent>
      </Card>
    );
  }

  if (status === "success" && !posts.length && !hasNextPage) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col items-center justify-center gap-3 text-center">
            <AlertTriangle className="h-12 w-12 text-orange-500" />
            <p className="text-muted-foreground">
              Bạn chưa có bài viết nào bị cảnh báo
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <InfiniteScrollContainer
      className="space-y-5"
      onBottomReached={() => hasNextPage && !isFetching && fetchNextPage()}
    >
      {posts.map((post) => (
        <div key={post.id} className="relative">
          <div className="absolute -left-2 top-2 z-10 rounded-full bg-orange-500 p-1.5 shadow-lg">
            <AlertTriangle className="h-4 w-4 text-white" />
          </div>
          <div className="border-l-4 border-orange-500 pl-4">
            <Post post={post} />
          </div>
        </div>
      ))}
      {isFetchingNextPage && <Loader2 className="mx-auto my-3 animate-spin" />}
    </InfiniteScrollContainer>
  );
}

