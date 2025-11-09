import { PostDataLightweight, CommentData } from "@/lib/types";
import { Loader2, SendHorizonal, X, ImageIcon, Smile } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { useSubmitCommentMutation, useSubmitReplyMutation } from "./mutations";
import MentionDropdown from "../Mention";
import useCommentMediaUpload from "@/hooks/useCommentMediaUpload";
import Image from "next/image";
import { cn } from "@/lib/utils";
import EmojiPicker, { EmojiClickData } from "emoji-picker-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
interface CommentInputProps {
  post: PostDataLightweight;
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
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  const {
    startUpload,
    attachments,
    isUploading,
    uploadProgress,
    removeAttachment,
    reset: resetMediaUploads,
  } = useCommentMediaUpload();

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
    const lastAtIndex = textBeforeCursor.lastIndexOf("@");

    if (lastAtIndex !== -1) {
      const textAfterAt = textBeforeCursor.slice(lastAtIndex + 1);
      if (!textAfterAt.includes(" ")) {
        setMentionQuery(textAfterAt);
        setMentionStart(lastAtIndex);
        setShowMentions(true);
        return;
      }
    }

    setShowMentions(false);
  };

  const handleSelectUser = (user: any) => {
    const beforeMention = input.slice(0, mentionStart);
    const afterMention = input.slice(inputRef.current?.selectionStart || 0);
    const newInput = `${beforeMention}@${user.username} ${afterMention}`;

    setInput(newInput);
    setShowMentions(false);

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

    if (!input.trim() && attachments.length === 0) return;

    const mediaIds: string[] = attachments
      .map((a) => a.mediaId)
      .filter((id): id is string => typeof id === "string");

    if (parentComment) {
      replyMutation.mutate(
        {
          commentId: String(parentComment.id),
          content: input,
          mediaIds,
        },
        {
          onSuccess: () => {
            setInput("");
            resetMediaUploads();
            onSuccess?.();
          },
        }
      );
    } else {
      // Ensure we pass only plain serializable values to the server action
      commentMutation.mutate(
        {
          postId: String(post.id),
          content: input,
          mediaIds,
        },
        {
          onSuccess: () => {
            setInput("");
            resetMediaUploads();
            onSuccess?.();
          },
        }
      );
    }
  }
  const handleEmojiClick = (emojiData: EmojiClickData) => {
    const cursorPosition = inputRef.current?.selectionStart || input.length;
    const textBefore = input.slice(0, cursorPosition);
    const textAfter = input.slice(cursorPosition);
    const newInput = textBefore + emojiData.emoji + textAfter;

    setInput(newInput);
    setShowEmojiPicker(false);

    // Focus back on input and set cursor position after emoji
    setTimeout(() => {
      if (inputRef.current) {
        const newPosition = cursorPosition + emojiData.emoji.length;
        inputRef.current.focus();
        inputRef.current.setSelectionRange(newPosition, newPosition);
      }
    }, 0);
  };

  return (
    <div className="relative space-y-2">
      {/* Image Previews */}
      {attachments.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {attachments.map((attachment) => (
            <div
              key={attachment.file.name}
              className={cn(
                "relative h-20 w-20 overflow-hidden rounded-lg border",
                attachment.isUploading && "opacity-50"
              )}
            >
              <Image
                src={URL.createObjectURL(attachment.file)}
                alt="Preview"
                fill
                className="object-cover"
              />
              {!attachment.isUploading && (
                <button
                  type="button"
                  onClick={() => removeAttachment(attachment.file.name)}
                  className="absolute right-1 top-1 rounded-full bg-black/60 p-1 hover:bg-black/80"
                >
                  <X className="h-3 w-3 text-white" />
                </button>
              )}
              {attachment.isUploading && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                  <Loader2 className="h-4 w-4 animate-spin text-white" />
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <form className="flex w-full items-center gap-2" onSubmit={onSubmit}>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => {
            const files = Array.from(e.target.files || []);
            if (files.length) {
              startUpload(files);
              e.target.value = "";
            }
          }}
        />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading || attachments.length >= 3}
          className="shrink-0"
        >
          <ImageIcon className="h-5 w-5" />
        </Button>

        {/* Emoji Picker */}
        <Popover open={showEmojiPicker} onOpenChange={setShowEmojiPicker}>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="shrink-0"
            >
              <Smile className="h-5 w-5" />
            </Button>
          </PopoverTrigger>
          <PopoverContent
            className="w-full border-0 p-0"
            align="start"
            side="top"
          >
            <EmojiPicker
              onEmojiClick={handleEmojiClick}
              width="100%"
              height={400}
              searchDisabled={false}
              skinTonesDisabled
              previewConfig={{ showPreview: false }}
            />
          </PopoverContent>
        </Popover>

        {/* Input Field */}
        <Input
          ref={inputRef}
          placeholder={
            parentComment
              ? `Reply to ${parentComment.user.displayName}...`
              : "Write a comment..."
          }
          value={input}
          onChange={handleInputChange}
          disabled={isUploading}
        />

        <Button
          type="submit"
          variant="ghost"
          size="icon"
          disabled={
            (!input.trim() && attachments.length === 0) ||
            commentMutation.isPending ||
            replyMutation.isPending ||
            isUploading
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
