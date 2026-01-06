"use client";

import { PostDataLightweight } from "@/lib/types";
import { formatRelativeDate } from "@/lib/utils";
import Link from "next/link";
import { Dialog, DialogContent, DialogTitle } from "../ui/dialog";
import Linkify from "../Linkify";
import UserAvatar from "../UserAvatar";
import UserTooltip from "../UserTooltip";
import LikeButton from "./LikeButton";
import BookmarkButton from "./BookmarkButton";
import Comments from "../comments/Comments";
import { useSession } from "@/app/(main)/SessionProvider";
import { Media } from "@prisma/client";
import { cn } from "@/lib/utils";
import Image from "next/image";
import { useState } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";

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
        <DialogTitle className="sr-only">
          Post by {post.user.displayName}
        </DialogTitle>
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
            <MediaDisplay
              attachments={post.attachments}
              layout={post.mediaLayout || "GRID"}
            />
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

interface MediaPreviewProps {
  media: Media;
  layout: "GRID" | "CAROUSEL" | "COLUMNS" | "FRAME";
  showOverlay?: boolean;
  overlayCount?: number;
  onClick?: (e: React.MouseEvent) => void;
}

function MediaPreview({
  media,
  layout,
  showOverlay = false,
  overlayCount = 0,
  onClick,
}: MediaPreviewProps) {
  const getImageClasses = () => {
    switch (layout) {
      case "GRID":
        return "w-full h-full object-cover rounded-2xl";
      case "CAROUSEL":
        // Fit ảnh vừa khung, không zoom, nhỏ lại
        return "w-[60vw] sm:w-[35vw] max-h-[25rem] object-contain rounded-xl snap-center flex-shrink-0";
      case "COLUMNS":
        // Mỗi ảnh là một cột, fit vừa khung, snap scroll
        return "w-full h-full object-cover rounded-lg snap-center";
      case "FRAME":
        return "w-full h-full object-cover rounded-xl";
      default:
        return "w-full h-full object-cover rounded-2xl";
    }
  };

  const getContainerClasses = () => {
    return cn(
      "relative",
      layout === "GRID" && "aspect-square",
      layout === "CAROUSEL" && "flex-shrink-0",
      layout === "COLUMNS" && "w-[150px] h-[400px] flex-shrink-0",
      layout === "FRAME" && "aspect-square"
    );
  };

  if (media.type === "IMAGE") {
    return (
      <div
        className={cn(getContainerClasses(), onClick && "cursor-pointer")}
        onClick={onClick}
      >
        <Image
          key={media.id}
          src={media.url}
          alt="Attachment"
          width={500}
          height={500}
          className={getImageClasses()}
          loading="lazy"
          sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 500px"
        />
        {showOverlay && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-2xl bg-black/70">
            <div className="text-center">
              <span className="text-4xl font-bold text-white">
                +{overlayCount}
              </span>
            </div>
          </div>
        )}
      </div>
    );
  }

  if (media.type === "VIDEO") {
    return (
      <div
        className={cn(
          layout === "GRID" && "aspect-square",
          layout === "CAROUSEL" && "flex-shrink-0",
          layout === "FRAME" &&
            "aspect-square rounded-2xl border-4 border-primary/20 p-1"
        )}
      >
        <video src={media.url} controls className={getImageClasses()} />
      </div>
    );
  }

  return <p className="text-destructive">Unsupported media type</p>;
}

interface MediaDisplayProps {
  attachments: Media[];
  layout: "GRID" | "CAROUSEL" | "COLUMNS" | "FRAME" | null;
}

function MediaDisplay({ attachments, layout }: MediaDisplayProps) {
  const effectiveLayout = layout || "GRID";
  const images = attachments.filter((m) => m.type === "IMAGE");
  const videos = attachments.filter((m) => m.type === "VIDEO");
  const [viewerOpen, setViewerOpen] = useState(false);
  const [initialIndex, setInitialIndex] = useState(0);

  const getLayoutClasses = () => {
    switch (effectiveLayout) {
      case "GRID":
        if (images.length === 1) return "flex flex-col gap-3";
        if (images.length === 2) return "grid grid-cols-2 gap-3";
        if (images.length === 3) return "grid grid-cols-3 gap-3";
        if (images.length === 4) return "grid grid-cols-2 gap-3";
        return "grid grid-cols-3 gap-3";
      case "CAROUSEL":
        return "flex gap-2 overflow-x-auto snap-x snap-mandatory pb-2";
      case "COLUMNS":
        return "flex gap-2 overflow-x-auto snap-x snap-mandatory pb-2";
      case "FRAME":
        if (images.length === 1) return "flex flex-col gap-3";
        if (images.length === 2) return "grid grid-cols-2 gap-3";
        if (images.length === 3) return "grid grid-cols-3 gap-3";
        if (images.length === 4) return "grid grid-cols-2 gap-3";
        return "grid grid-cols-3 gap-3";
      default:
        return "grid grid-cols-3 gap-3";
    }
  };

  return (
    <>
      {images.length > 0 && (
        <div
          className={cn(
            getLayoutClasses(),
            effectiveLayout === "FRAME" &&
              "rounded-2xl border-4 border-primary/20 bg-primary/5 p-4"
          )}
        >
          {images.map((media, index) => (
            <MediaPreview
              key={media.id}
              media={media}
              layout={effectiveLayout}
              onClick={(e) => {
                e.stopPropagation();
                setInitialIndex(index);
                setViewerOpen(true);
              }}
            />
          ))}
        </div>
      )}
      {videos.length > 0 && (
        <div className="flex flex-col gap-3">
          {videos.map((media) => (
            <MediaPreview
              key={media.id}
              media={media}
              layout={effectiveLayout}
            />
          ))}
        </div>
      )}
      {viewerOpen && (
        <Dialog open onOpenChange={() => setViewerOpen(false)}>
          <DialogContent className="h-auto max-h-[95vh] w-auto max-w-[95vw] border-none bg-black/95 p-0 [&>button]:hidden">
            <DialogTitle className="sr-only">
              Image {initialIndex + 1} of {images.length}
            </DialogTitle>
            <div className="relative flex h-full w-full items-center justify-center">
              <button
                onClick={() => setViewerOpen(false)}
                className="absolute right-4 top-4 z-50 rounded-full bg-black/50 p-2 text-white transition-colors hover:bg-black/70"
              >
                <X className="h-6 w-6" />
              </button>
              {images.length > 1 && (
                <button
                  onClick={() =>
                    setInitialIndex((prev) =>
                      prev > 0 ? prev - 1 : images.length - 1
                    )
                  }
                  className="absolute left-4 top-1/2 z-50 -translate-y-1/2 rounded-full bg-black/50 p-2 text-white transition-colors hover:bg-black/70"
                >
                  <ChevronLeft className="h-8 w-8" />
                </button>
              )}
              <div className="relative flex h-full w-full items-center justify-center p-4">
                <Image
                  src={images[initialIndex].url}
                  alt={`Image ${initialIndex + 1} of ${images.length}`}
                  width={1200}
                  height={1200}
                  className="max-h-[90vh] max-w-full object-contain"
                  unoptimized
                />
              </div>
              {images.length > 1 && (
                <button
                  onClick={() =>
                    setInitialIndex((prev) =>
                      prev < images.length - 1 ? prev + 1 : 0
                    )
                  }
                  className="absolute right-4 top-1/2 z-50 -translate-y-1/2 rounded-full bg-black/50 p-2 text-white transition-colors hover:bg-black/70"
                >
                  <ChevronRight className="h-8 w-8" />
                </button>
              )}
              {images.length > 1 && (
                <div className="absolute bottom-4 left-1/2 z-50 -translate-x-1/2 rounded-full bg-black/50 px-4 py-2 text-sm text-white">
                  {initialIndex + 1} / {images.length}
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
