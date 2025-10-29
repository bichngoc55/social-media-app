"use client";

import { useSession } from "@/app/(main)/SessionProvider";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import toast from "react-hot-toast";
import { PostData } from "@/lib/types";
import {
  Bookmark,
  Edit,
  MoreHorizontal,
  Repeat,
  Share,
  Trash2,
  Users,
  Globe,
  Lock,
} from "lucide-react";
import { useState, useCallback } from "react";
import {
  useDeletePost,
  useToggleBookmark,
  useUpdatePostPrivacy,
} from "./mutations";

interface PostMenuProps {
  post: PostData;
  onEdit?: () => void;
  className?: string;
}

export default function PostMenu({ post, onEdit, className }: PostMenuProps) {
  const { user } = useSession();
  const [isOpen, setIsOpen] = useState(false);

  const deletePost = useDeletePost();
  const toggleBookmark = useToggleBookmark();
  const updatePrivacy = useUpdatePostPrivacy();

  const isOwnPost = user?.id === post.userId;
  const isBookmarked = post.bookmarks.some((b) => b.userId === user?.id);

  const handleDelete = useCallback(async () => {
    const confirmed = window.confirm(
      "Bạn có chắc chắn muốn xóa bài đăng này không? Hành động này không thể hoàn tác."
    );

    if (!confirmed) return;

    try {
      await deletePost.mutateAsync(post.id);
      toast.success("Bài đăng đã được xóa");
    } catch (error) {
      toast.error("Không thể xóa bài đăng");
    }
  }, [deletePost, post.id]);

  const handleBookmark = useCallback(async () => {
    try {
      await toggleBookmark.mutateAsync(post.id);
      toast.success(isBookmarked ? "Đã bỏ bookmark" : "Đã bookmark");
    } catch (error) {
      toast.error("Không thể thay đổi bookmark");
    }
  }, [toggleBookmark, post.id, isBookmarked]);

  const handleRepost = async () => {
    try {
      const response = await fetch(`/api/posts/${post.id}/repost`, {
        method: "POST",
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to repost");
      }

      toast.success("Đã repost bài đăng");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Không thể repost");
    }
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Bài đăng từ ${post.user.displayName}`,
          text: post.content,
          url: `${window.location.origin}/posts/${post.id}`,
        });
      } catch (error) {
        // User cancelled or error
      }
    } else {
      // Fallback: copy to clipboard
      const url = `${window.location.origin}/posts/${post.id}`;
      await navigator.clipboard.writeText(url);
      toast.success("Link bài đăng đã được copy vào clipboard");
    }
  };

  const handlePrivacyChange = async (
    newPrivacy: "DRAFT" | "FOLLOWERS" | "PUBLIC"
  ) => {
    if (newPrivacy === post.privacy) return;

    try {
      await updatePrivacy.mutateAsync({
        postId: post.id,
        privacy: newPrivacy,
      });
      toast.success(`Đã đổi quyền thành ${getPrivacyText(newPrivacy)}`);
    } catch (error) {
      toast.error("Không thể thay đổi quyền");
    }
  };

  const getPrivacyIcon = (privacy: string) => {
    switch (privacy) {
      case "DRAFT":
        return <Lock className="h-4 w-4" />;
      case "FOLLOWERS":
        return <Users className="h-4 w-4" />;
      case "PUBLIC":
        return <Globe className="h-4 w-4" />;
      default:
        return <Globe className="h-4 w-4" />;
    }
  };

  const getPrivacyText = (privacy: string) => {
    switch (privacy) {
      case "DRAFT":
        return "Nháp";
      case "FOLLOWERS":
        return "Người theo dõi";
      case "PUBLIC":
        return "Công khai";
      default:
        return "Công khai";
    }
  };

  return (
    <>
      <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className={`h-8 w-8 text-muted-foreground hover:text-foreground ${className || ""}`}
          >
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          {/* Bookmark */}
          <DropdownMenuItem
            onClick={handleBookmark}
            disabled={toggleBookmark.isPending}
          >
            <Bookmark className="mr-2 h-4 w-4" />
            {isBookmarked ? "Bỏ bookmark" : "Bookmark"}
          </DropdownMenuItem>

          {/* Repost - Only show for other users' posts */}
          {!isOwnPost && (
            <DropdownMenuItem onClick={handleRepost}>
              <Repeat className="mr-2 h-4 w-4" />
              Repost
            </DropdownMenuItem>
          )}

          {/* Share */}
          <DropdownMenuItem onClick={handleShare}>
            <Share className="mr-2 h-4 w-4" />
            Chia sẻ
          </DropdownMenuItem>

          {/* Owner actions */}
          {isOwnPost && (
            <>
              <DropdownMenuSeparator />

              {/* Edit */}
              <DropdownMenuItem onClick={onEdit}>
                <Edit className="mr-2 h-4 w-4" />
                Chỉnh sửa
              </DropdownMenuItem>

              {/* Change Privacy */}
              <DropdownMenuItem asChild>
                <div className="flex items-center justify-between">
                  <span className="flex items-center">
                    {getPrivacyIcon(post.privacy)}
                    <span className="ml-2">Đổi quyền</span>
                  </span>
                  <div className="flex gap-1">
                    {["PUBLIC", "FOLLOWERS", "DRAFT"].map((privacy) => (
                      <Button
                        key={privacy}
                        variant={post.privacy === privacy ? "default" : "ghost"}
                        size="sm"
                        className="h-6 w-6 p-0"
                        onClick={() => handlePrivacyChange(privacy as any)}
                        disabled={updatePrivacy.isPending}
                      >
                        {getPrivacyIcon(privacy)}
                      </Button>
                    ))}
                  </div>
                </div>
              </DropdownMenuItem>

              {/* Delete */}
              <DropdownMenuItem
                onClick={handleDelete}
                disabled={deletePost.isPending}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                {deletePost.isPending ? "Đang xóa..." : "Xóa"}
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
}
