"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { FileText, Search, Trash2, Eye, ArrowLeft } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import kyInstance from "@/lib/ky";
import { formatRelativeDate } from "@/lib/utils";
import Link from "next/link";
import Image from "next/image";
import { useToast } from "@/components/ui/use-toast";
import { Skeleton } from "@/components/ui/skeleton";

interface Post {
  id: string;
  content: string;
  privacy: "PUBLIC" | "FOLLOWERS" | "DRAFT";
  createdAt: Date;
  user: {
    id: string;
    username: string;
    displayName: string;
    avatarUrl: string | null;
  };
  attachments?: {
    id: string;
    url: string;
    type: "IMAGE" | "VIDEO";
  }[];
  _count: {
    likes: number;
    comments: number;
    bookmarks: number;
  };
}

export default function AdminPostsPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [privacyFilter, setPrivacyFilter] = useState<string>("all");
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["admin-posts", page, search, privacyFilter],
    queryFn: () =>
      kyInstance
        .get("/api/admin/posts", {
          searchParams: {
            page,
            limit: 20,
            ...(search && { search }),
            ...(privacyFilter !== "all" && { privacy: privacyFilter }),
          },
        })
        .json<{ posts: Post[]; pagination: any }>(),
  });

  const deletePostMutation = useMutation({
    mutationFn: async (postId: string) => {
      return kyInstance.delete(`/api/admin/posts/${postId}`).json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-posts"] });
      toast({ description: "Post deleted successfully" });
    },
  });

  const handleDeletePost = (post: Post) => {
    if (
      confirm(
        `Are you sure you want to delete this post? This action cannot be undone.`
      )
    ) {
      deletePostMutation.mutate(post.id);
    }
  };

  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const openPreview = async (post: Post) => {
    setIsPreviewOpen(true);
    setIsLoadingPreview(true);
    try {
      const full = await kyInstance
        .get(`/api/posts/${post.id}`)
        .json<{ post: Post }>();
      setSelectedPost(full.post);
    } catch {
      setSelectedPost(post);
    } finally {
      setIsLoadingPreview(false);
    }
  };

  const getPrivacyBadge = (privacy: string) => {
    switch (privacy) {
      case "PUBLIC":
        return <Badge variant="default">Public</Badge>;
      case "FOLLOWERS":
        return <Badge variant="secondary">Followers</Badge>;
      case "DRAFT":
        return <Badge variant="outline">Draft</Badge>;
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="flex items-center gap-2 text-3xl font-bold">
          <FileText className="h-8 w-8" />
          Quản lý Bài viết
        </h1>
      </div>

      <Card className="card-glass">
        <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex w-full items-center gap-4 sm:w-auto">
            <Input
              placeholder="Search posts..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="max-w-sm"
            />
            <Select value={privacyFilter} onValueChange={setPrivacyFilter}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="All privacy" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All privacy</SelectItem>
                <SelectItem value="PUBLIC">Public</SelectItem>
                <SelectItem value="FOLLOWERS">Followers</SelectItem>
                <SelectItem value="DRAFT">Draft</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="space-y-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="space-y-3 p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-2">
                      <Skeleton className="h-4 w-32" />
                      <Skeleton className="h-4 w-20" />
                      <Skeleton className="h-5 w-16 rounded-full" />
                      <Skeleton className="h-4 w-24" />
                    </div>
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-4 w-2/3" />
                  </div>
                  <div className="flex gap-2">
                    <Skeleton className="h-8 w-8 rounded" />
                    <Skeleton className="h-8 w-8 rounded" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <>
          <div className="space-y-4">
            {data?.posts.map((post) => (
              <Card key={post.id}>
                <CardContent className="space-y-3 p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="mb-2 flex items-center gap-2">
                        <Link
                          href={`/users/${post.user.username}`}
                          className="font-medium hover:underline"
                        >
                          {post.user.displayName}
                        </Link>
                        <span className="text-sm text-muted-foreground">
                          @{post.user.username}
                        </span>
                        {getPrivacyBadge(post.privacy)}
                        <span className="text-sm text-muted-foreground">
                          {formatRelativeDate(post.createdAt)}
                        </span>
                      </div>
                      <p className="whitespace-pre-line text-sm">
                        {post.content}
                      </p>
                      <div className="mt-2 flex gap-4 text-sm text-muted-foreground">
                        <span>👍 {post._count.likes} likes</span>
                        <span>💬 {post._count.comments} comments</span>
                        <span>🔖 {post._count.bookmarks} bookmarks</span>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          openPreview(post);
                        }}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => handleDeletePost(post)}
                        disabled={deletePostMutation.isPending}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Post preview dialog */}
          <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Xem chi tiết bài viết</DialogTitle>
                {selectedPost && (
                  <DialogDescription>
                    {selectedPost.user.displayName} · @
                    {selectedPost.user.username}
                  </DialogDescription>
                )}
              </DialogHeader>
              {selectedPost ? (
                <div className="space-y-3">
                  <div className="text-sm text-muted-foreground">
                    {formatRelativeDate(selectedPost.createdAt)} ·{" "}
                    <span className="inline-flex items-center gap-1">
                      {getPrivacyBadge(selectedPost.privacy)}
                    </span>
                  </div>
                  <p className="whitespace-pre-wrap">{selectedPost.content}</p>
                  {isLoadingPreview ? (
                    <div className="grid gap-2 sm:grid-cols-2">
                      <div className="h-40 w-full animate-pulse rounded bg-muted" />
                      <div className="h-40 w-full animate-pulse rounded bg-muted" />
                    </div>
                  ) : selectedPost.attachments &&
                    selectedPost.attachments.length > 0 ? (
                    <div className="grid gap-2 sm:grid-cols-2">
                      {selectedPost.attachments.map((m) => (
                        <div
                          key={m.id}
                          className="relative overflow-hidden rounded-lg border"
                        >
                          {m.type === "IMAGE" ? (
                            <Image
                              src={m.url}
                              alt="Attachment"
                              width={800}
                              height={600}
                              className="h-auto w-full object-cover"
                            />
                          ) : m.type === "VIDEO" ? (
                            <video
                              controls
                              className="h-auto w-full"
                              src={m.url}
                            />
                          ) : null}
                        </div>
                      ))}
                    </div>
                  ) : null}
                  <div className="mt-2 flex gap-4 text-sm text-muted-foreground">
                    <span>👍 {selectedPost._count.likes} likes</span>
                    <span>💬 {selectedPost._count.comments} comments</span>
                    <span>🔖 {selectedPost._count.bookmarks} bookmarks</span>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="h-4 w-32 animate-pulse rounded bg-muted" />
                  <div className="h-20 w-full animate-pulse rounded bg-muted" />
                </div>
              )}
            </DialogContent>
          </Dialog>

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
    </div>
  );
}
