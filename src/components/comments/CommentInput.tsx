import { PostData, CommentData } from "@/lib/types";
import { Loader2, SendHorizonal } from "lucide-react";
import { useState } from "react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { useSubmitCommentMutation, useSubmitReplyMutation } from "./mutations";

interface CommentInputProps {
  post: PostData;
  parentComment?: CommentData;
  onSuccess?: () => void;
}

export default function CommentInput({ post, parentComment, onSuccess }: CommentInputProps) {
  const [input, setInput] = useState("");

  const commentMutation = useSubmitCommentMutation(post.id);
  const replyMutation = useSubmitReplyMutation(post.id);

  const mutation = parentComment ? replyMutation : commentMutation;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!input) return;

    if (parentComment) {
      // Submit reply
      mutation.mutate(
        {
          postId: post.id,
          commentId: parentComment.id,
          content: input,
        },
        {
          onSuccess: () => {
            setInput("");
            onSuccess?.();
          },
        },
      );
    } else {
      // Submit comment
      mutation.mutate(
        {
          post,
          content: input,
        },
        {
          onSuccess: () => {
            setInput("");
            onSuccess?.();
          },
        },
      );
    }
  }

  return (
    <form className="flex w-full items-center gap-2" onSubmit={onSubmit}>
      <Input
        placeholder={parentComment ? `Reply to ${parentComment.user.displayName}...` : "Write a comment..."}
        value={input}
        onChange={(e) => setInput(e.target.value)}
        autoFocus
      />
      <Button
        type="submit"
        variant="ghost"
        size="icon"
        disabled={!input.trim() || mutation.isPending}
      >
        {!mutation.isPending ? (
          <SendHorizonal />
        ) : (
          <Loader2 className="animate-spin" />
        )}
      </Button>
    </form>
  );
}
