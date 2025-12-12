"use client";

import { PostDataLightweight } from "@/lib/types";
import { formatRelativeDate } from "@/lib/utils";
import Link from "next/link";
import { Dialog, DialogContent } from "../ui/dialog";
import Linkify from "../Linkify";
import UserAvatar from "../UserAvatar";
import UserTooltip from "../UserTooltip";
import MediaSlider from "./MediaSlider";
import LikeButton from "./LikeButton";
import BookmarkButton from "./BookmarkButton";
import Comments from "../comments/Comments";
import { useSession } from "@/app/(main)/SessionProvider";

interface PostDetailModalProps {
  post: PostDataLightweight;
  open: boolean;
  onClose: () => void;
}

export default function PostDetailModal({
  post,
  open,
  onClose,
}: PostDetailModalProps) {
  const { user } = useSession();

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto p-0">
        <div className="space-y-4 p-6">
          {/* Header */}
          <div className="flex items-start gap-3">
            <UserTooltip user={post.user}>
              <Link href={`/users/${post.user.username}`}>
                <UserAvatar avatarUrl={post.user.avatarUrl} />
              </Link>
            </UserTooltip>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <UserTooltip user={post.user}>
                  <Link
                    href={`/users/${post.user.username}`}
                    className="font-semibold hover:underline"
                  >
                    {post.user.displayName}
                  </Link>
                </UserTooltip>
                {(post as any).post_tags &&
                  (post as any).post_tags.length > 0 && (
                    <span className="text-sm text-muted-foreground">
                      {" đang cùng với "}
                      {(
                        (post as any).post_tags as Array<{
                          users: { displayName: string };
                        }>
                      )
                        .map((tag) => tag.users.displayName)
                        .join(", ")}
                    </span>
                  )}
              </div>
              <Link
                href={`/posts/${post.id}`}
                className="text-sm text-muted-foreground hover:underline"
                suppressHydrationWarning
              >
                {formatRelativeDate(post.createdAt)}
              </Link>
            </div>
          </div>

          {/* Content */}
          {post.content && (
            <Linkify>
              <div className="whitespace-pre-line break-words text-base">
                {post.content}
              </div>
            </Linkify>
          )}

          {/* Media Slider */}
          {!!post.attachments.length && (
            <MediaSlider attachments={post.attachments} />
          )}

          {/* Actions */}
          <div className="flex items-center justify-between border-t pt-4">
            <div className="flex items-center gap-4">
              <LikeButton
                postId={post.id}
                initialState={{
                  likes: post._count.likes,
                  isLikedByUser: post.likes.some(
                    (like) => like.userId === user.id
                  ),
                }}
              />
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span>💬</span>
                <span>{post._count.comments} comments</span>
              </div>
            </div>
            <BookmarkButton
              postId={post.id}
              initialState={{
                isBookmarkedByUser: post.bookmarks.some(
                  (bookmark) => bookmark.userId === user.id
                ),
              }}
            />
          </div>

          {/* Comments */}
          <div className="border-t pt-4">
            <Comments post={post} />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
