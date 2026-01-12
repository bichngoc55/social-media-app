import { useSession } from "@/app/(main)/SessionProvider";
import { CommentData } from "@/lib/types";
import { formatRelativeDate } from "@/lib/utils";
import Link from "next/link";
import { useState } from "react";
import { Reply, ChevronDown, ChevronRight } from "lucide-react";
import Image from "next/image";
import { Button } from "../ui/button";
import UserAvatar from "../UserAvatar";
import UserTooltip from "../UserTooltip";
import Linkify from "../Linkify";
import CommentMoreButton from "./CommentMoreButton";
import CommentInput from "./CommentInput";

interface CommentProps {
  comment: CommentData;
  post: any;
  showReplies?: boolean;
}

export default function Comment({
  comment,
  post,
  showReplies = true,
}: CommentProps) {
  const { user } = useSession();
  const [showReplyInput, setShowReplyInput] = useState(false);
  const [showRepliesList, setShowRepliesList] = useState(false);

  const hasReplies = comment.replies && comment.replies.length > 0;
  const hasAttachments = comment.attachments && comment.attachments.length > 0;

  return (
    <div className="group/comment">
      <div className="flex gap-3 py-3">
        <span className="hidden sm:inline">
          <UserTooltip user={comment.user}>
            <Link href={`/users/${comment.user.username}`}>
              <UserAvatar avatarUrl={comment.user.avatarUrl} size={40} />
            </Link>
          </UserTooltip>
        </span>
        <div className="flex-1">
          <div className="flex items-center gap-1 text-sm">
            <UserTooltip user={comment.user}>
              <Link
                href={`/users/${comment.user.username}`}
                className="font-medium hover:underline"
              >
                {comment.user.displayName}
              </Link>
            </UserTooltip>
            <span className="text-muted-foreground">
              {formatRelativeDate(comment.createdAt)}
            </span>
          </div>
          <div className="mt-1">
            <Linkify>{comment.content}</Linkify>
          </div>
          {/* Display comment attachments for both parent comments and replies */}
          {hasAttachments && (
            <div className="mt-2 flex flex-wrap gap-2">
              {comment.attachments.map((media) => (
                <div
                  key={media.id}
                  className="relative h-32 w-32 overflow-hidden rounded-lg border"
                >
                  {media.type === "IMAGE" ? (
                    <Image
                      src={media.url}
                      alt="Comment attachment"
                      fill
                      className="cursor-pointer object-cover hover:opacity-90"
                      onClick={() => window.open(media.url, "_blank")}
                    />
                  ) : (
                    <video
                      src={media.url}
                      className="h-full w-full cursor-pointer object-cover"
                      controls
                    />
                  )}
                </div>
              ))}
            </div>
          )}
          {showReplies && !comment.parentId && (
            <div className="mt-2 flex items-center gap-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowReplyInput(!showReplyInput)}
                className="h-8 px-2 text-muted-foreground hover:text-foreground"
              >
                <Reply className="mr-1 h-4 w-4" />
                Reply
              </Button>

              {hasReplies && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowRepliesList(!showRepliesList)}
                  className="h-8 px-2 text-muted-foreground hover:text-foreground"
                >
                  {showRepliesList ? (
                    <ChevronDown className="mr-1 h-4 w-4" />
                  ) : (
                    <ChevronRight className="mr-1 h-4 w-4" />
                  )}
                  {comment.replies?.length}{" "}
                  {comment.replies?.length === 1 ? "reply" : "replies"}
                </Button>
              )}
            </div>
          )}

          {showReplyInput && (
            <div className="ml-8 mt-3">
              <CommentInput
                post={post}
                parentComment={comment}
                onSuccess={() => setShowReplyInput(false)}
              />
            </div>
          )}

          {showRepliesList && hasReplies && (
            <div className="ml-8 mt-3 space-y-2 border-l-2 border-muted pl-4">
              {comment.replies?.map((reply) => (
                <Comment
                  key={reply.id}
                  comment={{
                    ...reply,
                    replies: [],
                  }}
                  post={post}
                  showReplies={false}
                />
              ))}
            </div>
          )}
        </div>

        {comment.user.id === user.id && (
          <CommentMoreButton
            comment={comment}
            className="ms-auto opacity-0 transition-opacity group-hover/comment:opacity-100"
          />
        )}
      </div>
    </div>
  );
}
