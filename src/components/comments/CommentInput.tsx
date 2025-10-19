import { PostData, CommentData } from "@/lib/types";
import { Loader2, SendHorizonal } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { useSubmitCommentMutation, useSubmitReplyMutation } from "./mutations";
import MentionDropdown from "../Mention";

interface CommentInputProps {
  post: PostData;
  parentComment?: CommentData;
  onSuccess?: () => void;
}

export default function CommentInput({
  post,
  parentComment,
  onSuccess,
}: CommentInputProps) {
  const [input, setInput] = useState("");
  const [showMentions, setShowMentions] = useState(false);
  const [mentionQuery, setMentionQuery] = useState("");
  const [mentionStart, setMentionStart] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const commentMutation = useSubmitCommentMutation(post.id);
  const replyMutation = useSubmitReplyMutation(post.id);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        !inputRef.current?.contains(event.target as Node)
      ) {
        setShowMentions(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setInput(value);

    const cursorPosition = e.target.selectionStart || 0;
    const textBeforeCursor = value.slice(0, cursorPosition);
    const mentionMatch = textBeforeCursor.match(/@(\w*)$/);

    if (mentionMatch) {
      setShowMentions(true);
      setMentionQuery(mentionMatch[1]);
      setMentionStart(cursorPosition - mentionMatch[0].length);
    } else {
      setShowMentions(false);
      setMentionQuery("");
    }
  };

  const handleSelectUser = (user: any) => {
    const beforeMention = input.slice(0, mentionStart);
    const afterMention = input.slice(mentionStart + mentionQuery.length + 1);
    const newInput = `${beforeMention}@${user.username} ${afterMention}`;

    setInput(newInput);
    setShowMentions(false);
    setMentionQuery("");

    setTimeout(() => {
      if (inputRef.current) {
        const newPosition = beforeMention.length + user.username.length + 2;
        inputRef.current.focus();
        inputRef.current.setSelectionRange(newPosition, newPosition);
      }
    }, 0);
  };

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!input.trim()) return;

    if (parentComment) {
      // Submit reply
      replyMutation.mutate(
        {
          commentId: parentComment.id,
          content: input,
        },
        {
          onSuccess: () => {
            setInput("");
            onSuccess?.();
          },
        }
      );
    } else {
      // Submit comment
      commentMutation.mutate(
        {
          post,
          content: input,
        },
        {
          onSuccess: () => {
            setInput("");
            onSuccess?.();
          },
        }
      );
    }
  }
  return (
    <div className="relative">
      <form className="flex w-full items-center gap-2" onSubmit={onSubmit}>
        <Input
          ref={inputRef}
          placeholder={
            parentComment
              ? `Reply to ${parentComment.user.displayName}...`
              : "Write a comment..."
          }
          value={input}
          onChange={handleInputChange}
          autoFocus
        />
        <Button
          type="submit"
          variant="ghost"
          size="icon"
          disabled={
            !input.trim() ||
            commentMutation.isPending ||
            replyMutation.isPending
          }
        >
          {!(commentMutation.isPending || replyMutation.isPending) ? (
            <SendHorizonal />
          ) : (
            <Loader2 className="animate-spin" />
          )}
        </Button>
      </form>
      {showMentions && (
        <MentionDropdown
          ref={dropdownRef}
          searchQuery={mentionQuery}
          onSelectUser={handleSelectUser}
          onClose={() => setShowMentions(false)}
        />
      )}
    </div>
  );
}
