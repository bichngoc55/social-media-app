import { useSession } from "@/app/(main)/SessionProvider";
import { CommentData } from "@/lib/types";
import { formatRelativeDate } from "@/lib/utils";
import Link from "next/link";
import { useState } from "react";
import { Reply, ChevronDown, ChevronRight } from "lucide-react";
import { Button } from "../ui/button";
import UserAvatar from "../UserAvatar";
import UserTooltip from "../UserTooltip";
import CommentMoreButton from "./CommentMoreButton";
import CommentInput from "./CommentInput";

interface CommentProps {
  comment: CommentData;
  post: any; // PostData type
  showReplies?: boolean;
}

export default function Comment({ comment, post, showReplies = true }: CommentProps) {
  const { user } = useSession();
  const [showReplyInput, setShowReplyInput] = useState(false);
  const [showRepliesList, setShowRepliesList] = useState(false);

  const hasReplies = comment.replies && comment.replies.length > 0;

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
          <div className="mt-1">{comment.content}</div>
          
          {/* Reply button - only show for top-level comments */}
          {showReplies && !comment.parentId && (
            <div className="mt-2 flex items-center gap-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowReplyInput(!showReplyInput)}
                className="h-8 px-2 text-muted-foreground hover:text-foreground"
              >
                <Reply className="h-4 w-4 mr-1" />
                Reply
              </Button>
              
              {/* Show replies toggle */}
              {hasReplies && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowRepliesList(!showRepliesList)}
                  className="h-8 px-2 text-muted-foreground hover:text-foreground"
                >
                  {showRepliesList ? (
                    <ChevronDown className="h-4 w-4 mr-1" />
                  ) : (
                    <ChevronRight className="h-4 w-4 mr-1" />
                  )}
                  {comment.replies?.length} {comment.replies?.length === 1 ? 'reply' : 'replies'}
                </Button>
              )}
            </div>
          )}

          {/* Reply input */}
          {showReplyInput && (
            <div className="mt-3 ml-8">
              <CommentInput 
                post={post} 
                parentComment={comment}
                onSuccess={() => setShowReplyInput(false)}
              />
            </div>
          )}

          {/* Replies list */}
          {showRepliesList && hasReplies && (
            <div className="mt-3 ml-8 space-y-2 border-l-2 border-muted pl-4">
              {comment.replies?.map((reply) => (
                <Comment 
                  key={reply.id} 
                  comment={{
                    ...reply,
                    replies: [] // Replies don't have nested replies
                  }} 
                  post={post}
                  showReplies={false} // Replies don't have nested replies
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
