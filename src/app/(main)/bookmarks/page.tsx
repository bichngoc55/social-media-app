"use client";

import { useSession } from "@/app/(main)/SessionProvider";
import { PostData } from "@/lib/types";
import { Bookmark, Filter, Search, SortAsc, Sparkles, Clock, User } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import Post from "@/components/posts/Post";
import { Loader2 } from "lucide-react";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
  const filteredBookmarks = bookmarks?.filter((post) =>
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
        <div className="text-center space-y-4">
          <div className="w-20 h-20 mx-auto bg-muted rounded-full flex items-center justify-center">
            <Bookmark className="h-10 w-10 text-muted-foreground" />
          </div>
          <div>
            <h2 className="text-xl font-semibold">Vui lòng đăng nhập</h2>
            <p className="text-muted-foreground">Đăng nhập để xem bookmarks của bạn</p>
          </div>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
        <div className="flex w-full min-w-0 gap-5 max-w-7xl mx-auto px-4 py-8">
          <div className="w-full min-w-0 space-y-6">
          {/* Header Skeleton */}
          <div className="mb-8">
            <div className="flex items-center gap-4 mb-6">
              <div className="w-12 h-12 bg-gradient-to-br from-primary/20 to-primary/10 rounded-xl animate-pulse" />
              <div className="space-y-2">
                <div className="h-8 w-32 bg-muted rounded-lg animate-pulse" />
                <div className="h-4 w-24 bg-muted/60 rounded animate-pulse" />
              </div>
            </div>
            <div className="flex gap-4 mb-6">
              <div className="flex-1 h-10 bg-muted rounded-lg animate-pulse" />
              <div className="w-32 h-10 bg-muted rounded-lg animate-pulse" />
              <div className="w-10 h-10 bg-muted rounded-lg animate-pulse" />
            </div>
          </div>
          
          {/* Content Skeleton */}
          <div className="space-y-6">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="border-0 bg-card/50 backdrop-blur-sm">
                <CardContent className="p-6">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 bg-muted rounded-full animate-pulse" />
                    <div className="flex-1 space-y-3">
                      <div className="flex items-center gap-2">
                        <div className="h-4 w-24 bg-muted rounded animate-pulse" />
                        <div className="h-3 w-16 bg-muted/60 rounded animate-pulse" />
                      </div>
                      <div className="space-y-2">
                        <div className="h-4 w-full bg-muted rounded animate-pulse" />
                        <div className="h-4 w-3/4 bg-muted rounded animate-pulse" />
                      </div>
                      <div className="flex items-center gap-4 pt-2">
                        <div className="h-4 w-16 bg-muted/60 rounded animate-pulse" />
                        <div className="h-4 w-20 bg-muted/60 rounded animate-pulse" />
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
        <div className="flex w-full min-w-0 gap-5 max-w-7xl mx-auto px-4 py-16">
          <div className="w-full min-w-0">
          <div className="text-center space-y-8 max-w-2xl mx-auto">
            <div className="relative">
              <div className="w-32 h-32 mx-auto bg-gradient-to-br from-primary/20 via-primary/10 to-primary/5 rounded-3xl flex items-center justify-center shadow-2xl">
                <Bookmark className="h-16 w-16 text-primary" />
              </div>
              <div className="absolute -top-2 -right-2 w-8 h-8 bg-primary/20 rounded-full flex items-center justify-center">
                <Sparkles className="h-4 w-4 text-primary" />
              </div>
            </div>
            
            <div className="space-y-4">
              <h2 className="text-4xl font-bold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
                Chưa có bookmark nào
              </h2>
              <p className="text-lg text-muted-foreground leading-relaxed max-w-lg mx-auto">
                Lưu bài đăng yêu thích để xem lại sau. Chỉ cần click vào icon bookmark trên bất kỳ bài đăng nào!
              </p>
            </div>
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button size="lg" className="bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70">
                <Bookmark className="h-4 w-4 mr-2" />
                Khám phá bài đăng
              </Button>
              <Button variant="outline" size="lg">
                <User className="h-4 w-4 mr-2" />
                Theo dõi người dùng
              </Button>
            </div>
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
      <div className="flex w-full min-w-0 gap-5 max-w-7xl mx-auto px-4 py-8">
        {/* Main Content */}
        <div className="w-full min-w-0 space-y-6">
        {/* Header Section */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-4">
              <div className="relative">
                <div className="w-14 h-14 bg-gradient-to-br from-primary via-primary/90 to-primary/80 rounded-2xl flex items-center justify-center shadow-lg">
                  <Bookmark className="h-7 w-7 text-white" />
                </div>
                <div className="absolute -top-1 -right-1 w-6 h-6 bg-background rounded-full flex items-center justify-center">
                  <Badge variant="secondary" className="text-xs px-2 py-0.5">
                    {bookmarks.length}
                  </Badge>
                </div>
              </div>
              <div>
                <h1 className="text-4xl font-bold bg-gradient-to-r from-foreground to-foreground/80 bg-clip-text text-transparent">
                  Bookmarks
                </h1>
                <p className="text-muted-foreground text-lg">
                  {bookmarks.length} bài đăng đã lưu
                </p>
              </div>
            </div>
            <div className="hidden sm:flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">
                Cập nhật lần cuối: {new Date().toLocaleTimeString('vi-VN')}
              </span>
            </div>
          </div>

          {/* Search and Filter Bar */}
          <Card className="border-0 bg-card/50 backdrop-blur-sm">
            <CardContent className="p-6">
              <div className="flex flex-col lg:flex-row gap-4">
                <div className="relative flex-1">
                  <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                  <Input
                    placeholder="Tìm kiếm trong bookmarks..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-12 h-12 text-base border-0 bg-muted/50 focus:bg-muted/80 transition-colors"
                  />
                </div>
                <div className="flex gap-3">
                  <Select value={sortBy} onValueChange={(value: "newest" | "oldest") => setSortBy(value)}>
                    <SelectTrigger className="w-[160px] h-12 border-0 bg-muted/50">
                      <SortAsc className="h-4 w-4 mr-2" />
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="newest">Mới nhất</SelectItem>
                      <SelectItem value="oldest">Cũ nhất</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button variant="outline" size="icon" className="h-12 w-12 border-0 bg-muted/50 hover:bg-muted/80">
                    <Filter className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Bookmarks Grid */}
        {sortedBookmarks.length === 0 ? (
          <Card className="border-0 bg-card/30 backdrop-blur-sm">
            <CardContent className="p-12 text-center">
              <div className="w-20 h-20 mx-auto bg-muted/50 rounded-full flex items-center justify-center mb-6">
                <Search className="h-10 w-10 text-muted-foreground" />
              </div>
              <h3 className="text-2xl font-semibold mb-3">Không tìm thấy kết quả</h3>
              <p className="text-muted-foreground text-lg mb-6 max-w-md mx-auto">
                Thử thay đổi từ khóa tìm kiếm hoặc xóa bộ lọc để xem tất cả bookmarks
              </p>
              <Button 
                variant="outline" 
                onClick={() => setSearchQuery("")}
                className="bg-gradient-to-r from-primary/10 to-primary/5 border-primary/20 hover:from-primary/20 hover:to-primary/10"
              >
                <Search className="h-4 w-4 mr-2" />
                Xóa bộ lọc
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {sortedBookmarks.map((post, index) => (
              <div key={post.id} className="group relative">
                <Card className="border-0 bg-card/40 backdrop-blur-sm hover:bg-card/60 transition-all duration-300 hover:shadow-lg hover:shadow-primary/5">
                  <CardContent className="p-0">
                    <Post post={post} />
                    <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-all duration-300 transform translate-y-2 group-hover:translate-y-0">
                      <Badge variant="secondary" className="bg-primary/20 text-primary border-primary/30 shadow-lg">
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