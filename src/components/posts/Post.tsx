"use client";

import { useSession } from "@/app/(main)/SessionProvider";
import { PostDataLightweight } from "@/lib/types";
import { cn, formatRelativeDate } from "@/lib/utils";
import { Media } from "@prisma/client";
import {
  ChevronLeft,
  ChevronRight,
  MessageSquare,
  X,
  Eye,
  EyeOff,
  AlertTriangle,
  Flag,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useState, useEffect } from "react";
import { Dialog, DialogContent } from "../ui/dialog";
import Comments from "../comments/Comments";
import Linkify from "../Linkify";
import UserAvatar from "../UserAvatar";
import UserTooltip from "../UserTooltip";
import BookmarkButton from "./BookmarkButton";
import LikeButton from "./LikeButton";
import PostMoreButton from "./PostMoreButton";
import UserTagging from "./UserTagging";
import TagRequestBanner from "./TagRequestBanner";
import MediaSlider from "./MediaSlider";
import PostDetailModal from "./PostDetailModal";
import { Button } from "../ui/button";
import BlockPostButton from "./BlockPostButton";
import ReportPostDialog from "./ReportPostDialog";
const privacyBadgeColors = {
  PUBLIC: "bg-green-100 text-green-800",
  FOLLOWERS: "bg-blue-100 text-blue-800",
  DRAFT: "bg-gray-100 text-gray-800",
};

interface PostProps {
  post: PostDataLightweight;
}

export default function Post({ post }: PostProps) {
  const { user } = useSession();

  const [showComments, setShowComments] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [isHarmfulContentRevealed, setIsHarmfulContentRevealed] =
    useState(false);

  return (
    <article className="group/post card-glass post-hover-lift space-y-3 rounded-2xl p-6 fade-in">
      <TagRequestBanner
        postId={post.id}
        currentUserId={user.id}
        onUpdate={() => {
          setRefreshKey((prev) => prev + 1);
          // Reload page to refresh post data
          window.location.reload();
        }}
      />
      <div className="flex justify-between gap-3">
        <div className="flex flex-wrap gap-3">
          <UserTooltip user={post.user}>
            <Link href={`/users/${post.user.username}`}>
              <UserAvatar avatarUrl={post.user.avatarUrl} />
            </Link>
          </UserTooltip>
          <div>
            <div className="flex flex-wrap items-center gap-1">
              <UserTooltip user={post.user}>
                <Link
                  href={`/users/${post.user.username}`}
                  className="font-medium hover:underline"
                >
                  {post.user.displayName}
                </Link>
              </UserTooltip>
              {/* Tagged users - hiển thị ngay bên cạnh tên user */}
              {(post as any).post_tags &&
                (post as any).post_tags.length > 0 && (
                  <span className="text-sm text-muted-foreground">
                    {" is with "}
                    {(
                      (post as any).post_tags as Array<{
                        users: { displayName: string };
                      }>
                    )
                      .map((tag) => tag.users.displayName)
                      .join(", ")}
                  </span>
                )}
              <span
                className={`${privacyBadgeColors[post.privacy] || "bg-gray-100 text-gray-800"} rounded-full px-2 py-1 text-xs font-semibold`}
              >
                {post.privacy.replace(/_/g, " ")}
              </span>
            </div>
            <Link
              href={`/posts/${post.id}`}
              className="block text-sm text-muted-foreground hover:underline"
              suppressHydrationWarning
            >
              {formatRelativeDate(post.createdAt)}
            </Link>
          </div>
        </div>
        {post.user.id === user.id && (
          <PostMoreButton
            post={post}
            className="opacity-0 transition-opacity group-hover/post:opacity-100"
          />
        )}
      </div>
      <div onClick={() => setShowDetailModal(true)} className="cursor-pointer">
        {post.harmful &&
        !isHarmfulContentRevealed &&
        user.id !== post.userId ? (
          <div
            className="relative flex min-h-[200px] flex-col items-center justify-center space-y-4 rounded-xl border-2 border-destructive/20 bg-muted/50 p-8 backdrop-blur-sm"
            onClick={(e) => {
              e.stopPropagation();
              setIsHarmfulContentRevealed(true);
            }}
          >
            <div className="flex flex-col items-center gap-3 text-center">
              <div className="rounded-full bg-destructive/10 p-4">
                <EyeOff className="h-8 w-8 text-destructive" />
              </div>
              <div className="space-y-2">
                <h3 className="text-lg font-semibold">Sensitive Content</h3>
                <p className="max-w-md text-sm text-muted-foreground">
                  This post may contain sensitive or potentially harmful
                  content. Click to reveal if you wish to continue.
                </p>
                {post.harmfulTypes && post.harmfulTypes.length > 0 && (
                  <div className="mt-2 flex flex-wrap justify-center gap-2">
                    {post.harmfulTypes.map((type: string) => (
                      <span
                        key={type}
                        className="rounded-full bg-destructive/20 px-2 py-1 text-xs text-destructive"
                      >
                        {type.replace(/_/g, " ")}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <Button
                variant="outline"
                size="sm"
                className="mt-2"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsHarmfulContentRevealed(true);
                }}
              >
                <Eye className="mr-2 h-4 w-4" />
                Show Content
              </Button>
            </div>
          </div>
        ) : (
          <>
            {post.content && (
              <Linkify>
                <div className="whitespace-pre-line break-words">
                  {post.content}
                </div>
              </Linkify>
            )}
            {!!post.attachments.length && (
              <MediaSlider attachments={post.attachments} />
            )}
          </>
        )}
      </div>
      <hr className="text-muted-foreground" />
      <div className="flex justify-between gap-5">
        <div className="flex items-center gap-5">
          <LikeButton
            postId={post.id}
            initialState={{
              likes: post._count.likes,
              isLikedByUser: post.likes.some((like) => like.userId === user.id),
            }}
          />
          <CommentButton
            post={post}
            onClick={() => setShowComments(!showComments)}
          />
        </div>
        <div className="flex items-center gap-2">
          <BlockPostButton postId={post.id} />
          
          {user.id !== post.userId && (
            <ReportPostDialog postId={post.id}>
              <button
                title="Report this post"
                className="btn-glow flex items-center gap-2 rounded-full px-3 py-2 transition-all duration-300 hover:bg-orange-500/10"
              >
                <Flag
                  className="size-5 text-muted-foreground transition-all duration-300 hover:text-orange-500"
                />
              </button>
            </ReportPostDialog>
          )}

          <BookmarkButton
            postId={post.id}
            initialState={{
              isBookmarkedByUser: post.bookmarks.some(
                (bookmark) => bookmark.userId === user.id
              ),
            }}
          />
        </div>
      </div>
      {showComments && <Comments post={post} />}
      <PostDetailModal
        post={post}
        open={showDetailModal}
        onClose={() => setShowDetailModal(false)}
      />
    </article>
  );
}

interface MediaPreviewProps {
  media: Media;
  layout: "GRID" | "CAROUSEL" | "COLUMNS" | "FRAME";
  showOverlay?: boolean;
  overlayCount?: number;
  onClick?: () => void;
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

interface ImageViewerProps {
  images: Media[];
  initialIndex: number;
  onClose: () => void;
}

function ImageViewer({ images, initialIndex, onClose }: ImageViewerProps) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);

  useEffect(() => {
    setCurrentIndex(initialIndex);
  }, [initialIndex]);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "ArrowLeft") {
        setCurrentIndex((prev) => (prev > 0 ? prev - 1 : images.length - 1));
      } else if (e.key === "ArrowRight") {
        setCurrentIndex((prev) => (prev < images.length - 1 ? prev + 1 : 0));
      } else if (e.key === "Escape") {
        onClose();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [images.length, onClose]);

  const currentImage = images[currentIndex];

  if (!currentImage) return null;

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="h-auto max-h-[95vh] w-auto max-w-[95vw] border-none bg-black/95 p-0 [&>button]:hidden">
        <div className="relative flex h-full w-full items-center justify-center">
          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute right-4 top-4 z-50 rounded-full bg-black/50 p-2 text-white transition-colors hover:bg-black/70"
          >
            <X className="h-6 w-6" />
          </button>

          {/* Previous button */}
          {images.length > 1 && (
            <button
              onClick={() =>
                setCurrentIndex((prev) =>
                  prev > 0 ? prev - 1 : images.length - 1
                )
              }
              className="absolute left-4 top-1/2 z-50 -translate-y-1/2 rounded-full bg-black/50 p-2 text-white transition-colors hover:bg-black/70"
            >
              <ChevronLeft className="h-8 w-8" />
            </button>
          )}

          {/* Image */}
          <div className="relative flex h-full w-full items-center justify-center p-4">
            <Image
              src={currentImage.url}
              alt={`Image ${currentIndex + 1} of ${images.length}`}
              width={1200}
              height={1200}
              className="max-h-[90vh] max-w-full object-contain"
              unoptimized
            />
          </div>

          {/* Next button */}
          {images.length > 1 && (
            <button
              onClick={() =>
                setCurrentIndex((prev) =>
                  prev < images.length - 1 ? prev + 1 : 0
                )
              }
              className="absolute right-4 top-1/2 z-50 -translate-y-1/2 rounded-full bg-black/50 p-2 text-white transition-colors hover:bg-black/70"
            >
              <ChevronRight className="h-8 w-8" />
            </button>
          )}

          {/* Image counter */}
          {images.length > 1 && (
            <div className="absolute bottom-4 left-1/2 z-50 -translate-x-1/2 rounded-full bg-black/50 px-4 py-2 text-sm text-white">
              {currentIndex + 1} / {images.length}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

interface CommentButtonProps {
  post: PostDataLightweight;
  onClick: () => void;
}

function CommentButton({ post, onClick }: CommentButtonProps) {
  return (
    <button
      onClick={onClick}
      className="btn-glow flex items-center gap-2 rounded-full px-3 py-2 transition-all duration-300 hover:bg-white/20"
    >
      <MessageSquare className="size-5 transition-all duration-300" />
      <span className="text-sm font-medium tabular-nums">
        {post._count.comments}{" "}
        <span className="hidden sm:inline">comments</span>
      </span>
    </button>
  );
}
