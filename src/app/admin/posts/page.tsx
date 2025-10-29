"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { FileText, Search, Trash2, Eye, ArrowLeft } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
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
import { useToast } from "@/components/ui/use-toast";

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
        <Button variant="outline" asChild>
          <Link href="/admin/dashboard">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Quay lại
          </Link>
        </Button>
      </div>

      <div className="flex gap-4">
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

      {isLoading ? (
        <div>Loading...</div>
      ) : (
        <>
          <div className="space-y-4">
            {data?.posts.map((post) => (
              <div key={post.id} className="space-y-3 rounded-lg border p-4">
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
                    <Link href={`/posts/${post.id}`}>
                      <Button variant="outline" size="sm">
                        <Eye className="h-4 w-4" />
                      </Button>
                    </Link>
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
              </div>
            ))}
          </div>

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
