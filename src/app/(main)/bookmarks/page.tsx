"use client";

import { useSession } from "@/app/(main)/SessionProvider";
import { PostData } from "@/lib/types";
import {
  Bookmark,
  Filter,
  Search,
  SortAsc,
  Sparkles,
  Clock,
  User,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import Post from "@/components/posts/Post";
import { Loader2 } from "lucide-react";
import { useState } from "react";
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
import { Card, CardContent } from "@/components/ui/card";
import TrendsSidebarClient from "@/components/TrendsSidebarClient";

export default function BookmarksPage() {
  const { user } = useSession();
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<"newest" | "oldest">("newest");

  const { data: bookmarks, isLoading } = useQuery({
    queryKey: ["bookmarks"],
    queryFn: async () => {
      const response = await fetch("/api/bookmarks");
      if (!response.ok) throw new Error("Failed to fetch bookmarks");
      return response.json() as Promise<PostData[]>;
    },
    enabled: !!user,
  });

  // Filter and sort bookmarks
  const filteredBookmarks =
    bookmarks?.filter(
      (post) =>
        post.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
        post.user.displayName.toLowerCase().includes(searchQuery.toLowerCase())
    ) || [];

  const sortedBookmarks = [...filteredBookmarks].sort((a, b) => {
    if (sortBy === "newest") {
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    } else {
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    }
  });

  if (!user) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="space-y-4 text-center">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-muted">
            <Bookmark className="h-10 w-10 text-muted-foreground" />
          </div>
          <div>
            <h2 className="text-xl font-semibold">Vui lòng đăng nhập</h2>
            <p className="text-muted-foreground">
              Đăng nhập để xem bookmarks của bạn
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
        <div className="mx-auto flex w-full min-w-0 max-w-7xl gap-5 px-4 py-8">
          <div className="w-full min-w-0 space-y-6">
            {/* Header Skeleton */}
            <div className="mb-8">
              <div className="mb-6 flex items-center gap-4">
                <div className="h-12 w-12 animate-pulse rounded-xl bg-gradient-to-br from-primary/20 to-primary/10" />
                <div className="space-y-2">
                  <div className="h-8 w-32 animate-pulse rounded-lg bg-muted" />
                  <div className="h-4 w-24 animate-pulse rounded bg-muted/60" />
                </div>
              </div>
              <div className="mb-6 flex gap-4">
                <div className="h-10 flex-1 animate-pulse rounded-lg bg-muted" />
                <div className="h-10 w-32 animate-pulse rounded-lg bg-muted" />
                <div className="h-10 w-10 animate-pulse rounded-lg bg-muted" />
              </div>
            </div>

            {/* Content Skeleton */}
            <div className="space-y-6">
              {[1, 2, 3].map((i) => (
                <Card key={i} className="border-0 bg-card/50 backdrop-blur-sm">
                  <CardContent className="p-6">
                    <div className="flex items-start gap-4">
                      <div className="h-12 w-12 animate-pulse rounded-full bg-muted" />
                      <div className="flex-1 space-y-3">
                        <div className="flex items-center gap-2">
                          <div className="h-4 w-24 animate-pulse rounded bg-muted" />
                          <div className="h-3 w-16 animate-pulse rounded bg-muted/60" />
                        </div>
                        <div className="space-y-2">
                          <div className="h-4 w-full animate-pulse rounded bg-muted" />
                          <div className="h-4 w-3/4 animate-pulse rounded bg-muted" />
                        </div>
                        <div className="flex items-center gap-4 pt-2">
                          <div className="h-4 w-16 animate-pulse rounded bg-muted/60" />
                          <div className="h-4 w-20 animate-pulse rounded bg-muted/60" />
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          {/* Right Sidebar */}
          <TrendsSidebarClient />
        </div>
      </div>
    );
  }

  if (!bookmarks?.length) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
        <div className="mx-auto flex w-full min-w-0 max-w-7xl gap-5 px-4 py-16">
          <div className="w-full min-w-0">
            <div className="mx-auto max-w-2xl space-y-8 text-center">
              <div className="relative">
                <div className="mx-auto flex h-32 w-32 items-center justify-center rounded-3xl bg-gradient-to-br from-primary/20 via-primary/10 to-primary/5 shadow-2xl">
                  <Bookmark className="h-16 w-16 text-primary" />
                </div>
                <div className="absolute -right-2 -top-2 flex h-8 w-8 items-center justify-center rounded-full bg-primary/20">
                  <Sparkles className="h-4 w-4 text-primary" />
                </div>
              </div>

              <div className="space-y-4">
                <h2 className="bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-4xl font-bold text-transparent">
                  No bookmarks yet
                </h2>
                <p className="mx-auto max-w-lg text-lg leading-relaxed text-muted-foreground">
                  Save your favorite posts to view them later. Just click the
                  bookmark icon on any post!
                </p>
              </div>

              {/* <div className="flex flex-col justify-center gap-4 sm:flex-row">
                <Button
                  size="lg"
                  className="bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70"
                >
                  <Bookmark className="mr-2 h-4 w-4" />
                  Khám phá bài đăng
                </Button>
                <Button variant="outline" size="lg">
                  <User className="mr-2 h-4 w-4" />
                  Theo dõi người dùng
                </Button>
              </div> */}
            </div>
          </div>

          {/* Right Sidebar */}
          <TrendsSidebarClient />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
      <div className="mx-auto flex w-full min-w-0 max-w-7xl gap-5 px-4 py-8">
        {/* Main Content */}
        <div className="w-full min-w-0 space-y-6">
          {/* Header Section */}
          <div className="mb-8">
            <div className="mb-6 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="relative">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-primary via-primary/90 to-primary/80 shadow-lg">
                    <Bookmark className="h-7 w-7 text-white" />
                  </div>
                  <div className="absolute -right-1 -top-1 flex h-6 w-6 items-center justify-center rounded-full bg-background">
                    <Badge variant="secondary" className="px-2 py-0.5 text-xs">
                      {bookmarks.length}
                    </Badge>
                  </div>
                </div>
                <div>
                  <h1 className="bg-gradient-to-r from-foreground to-foreground/80 bg-clip-text text-4xl font-bold text-transparent">
                    Bookmarks
                  </h1>
                  <p className="text-lg text-muted-foreground">
                    {bookmarks.length} bài đăng đã lưu
                  </p>
                </div>
              </div>
              <div className="hidden items-center gap-2 sm:flex">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span
                  className="text-sm text-muted-foreground"
                  suppressHydrationWarning
                >
                  Cập nhật lần cuối: {new Date().toLocaleTimeString("vi-VN")}
                </span>
              </div>
            </div>

            {/* Search and Filter Bar */}
            <Card className="border-0 bg-card/50 backdrop-blur-sm">
              <CardContent className="p-6">
                <div className="flex flex-col gap-4 lg:flex-row">
                  <div className="relative flex-1">
                    <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 transform text-muted-foreground" />
                    <Input
                      placeholder="Tìm kiếm trong bookmarks..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="h-12 border-0 bg-muted/50 pl-12 text-base transition-colors focus:bg-muted/80"
                    />
                  </div>
                  <div className="flex gap-3">
                    <Select
                      value={sortBy}
                      onValueChange={(value: "newest" | "oldest") =>
                        setSortBy(value)
                      }
                    >
                      <SelectTrigger className="h-12 w-[160px] border-0 bg-muted/50">
                        <SortAsc className="mr-2 h-4 w-4" />
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="newest">Mới nhất</SelectItem>
                        <SelectItem value="oldest">Cũ nhất</SelectItem>
                      </SelectContent>
                    </Select>
                    {/* <Button
                      variant="outline"
                      size="icon"
                      className="h-12 w-12 border-0 bg-muted/50 hover:bg-muted/80"
                    >
                      <Filter className="h-4 w-4" />
                    </Button> */}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Bookmarks Grid */}
          {sortedBookmarks.length === 0 ? (
            <Card className="border-0 bg-card/30 backdrop-blur-sm">
              <CardContent className="p-12 text-center">
                <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-muted/50">
                  <Search className="h-10 w-10 text-muted-foreground" />
                </div>
                <h3 className="mb-3 text-2xl font-semibold">
                  Không tìm thấy kết quả
                </h3>
                <p className="mx-auto mb-6 max-w-md text-lg text-muted-foreground">
                  Thử thay đổi từ khóa tìm kiếm hoặc xóa bộ lọc để xem tất cả
                  bookmarks
                </p>
                <Button
                  variant="outline"
                  onClick={() => setSearchQuery("")}
                  className="border-primary/20 bg-gradient-to-r from-primary/10 to-primary/5 hover:from-primary/20 hover:to-primary/10"
                >
                  <Search className="mr-2 h-4 w-4" />
                  Xóa bộ lọc
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-6">
              {sortedBookmarks.map((post, index) => (
                <div key={post.id} className="group relative">
                  <Card className="border-0 bg-card/40 backdrop-blur-sm transition-all duration-300 hover:bg-card/60 hover:shadow-lg hover:shadow-primary/5">
                    <CardContent className="p-0">
                      <Post post={post} />
                      <div className="absolute right-4 top-4 translate-y-2 transform opacity-0 transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100">
                        <Badge
                          variant="secondary"
                          className="border-primary/30 bg-primary/20 text-primary shadow-lg"
                        >
                          #{index + 1}
                        </Badge>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right Sidebar */}
        <TrendsSidebarClient />
      </div>
    </div>
  );
}
