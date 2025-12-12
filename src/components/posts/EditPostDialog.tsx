"use client";

import LoadingButton from "@/components/LoadingButton";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import Image from "next/image";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PostDataLightweight, UserDataLightweight } from "@/lib/types";
import { cn } from "@/lib/utils";
import Placeholder from "@tiptap/extension-placeholder";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import {
  Globe,
  Lock,
  Users,
  Smile,
  Grid3x3,
  LayoutGrid,
  Columns,
  Frame,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";
import EmojiPicker, { EmojiClickData } from "emoji-picker-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useEditPostMutation } from "./mutations";
import UserTaggingEditor from "./editor/UserTaggingEditor";

interface EditPostDialogProps {
  post: PostDataLightweight;
  open: boolean;
  onClose: () => void;
}

export default function EditPostDialog({
  post,
  open,
  onClose,
}: EditPostDialogProps) {
  const [privacy, setPrivacy] = useState<"DRAFT" | "FOLLOWERS" | "PUBLIC">(
    post.privacy as "DRAFT" | "FOLLOWERS" | "PUBLIC"
  );
  const [mediaLayout, setMediaLayout] = useState<
    "GRID" | "CAROUSEL" | "COLUMNS" | "FRAME" | null
  >((post.mediaLayout as any) || null);
  const [taggedUsers, setTaggedUsers] = useState<UserDataLightweight[]>([]);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [mediaIdsToDelete, setMediaIdsToDelete] = useState<string[]>([]);

  const mutation = useEditPostMutation();

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        bold: false,
        italic: false,
      }),
      Placeholder.configure({
        placeholder: "What's crack-a-lackin'?",
      }),
    ],
    immediatelyRender: false,
  });

  // Initialize editor content and tagged users when dialog opens
  useEffect(() => {
    if (open && editor) {
      editor.commands.setContent(post.content || "");
      setPrivacy(post.privacy as "DRAFT" | "FOLLOWERS" | "PUBLIC");
      setMediaLayout((post.mediaLayout as any) || null);
      setMediaIdsToDelete([]); // Reset deleted media

      // Load tagged users
      const tags = (post as any).post_tags || [];
      const users = tags
        .filter((tag: any) => tag.status === "APPROVED")
        .map((tag: any) => tag.users);
      setTaggedUsers(users);
    }
  }, [open, post, editor]);

  // Close dialog on success
  useEffect(() => {
    if (mutation.isSuccess) {
      onClose();
    }
  }, [mutation.isSuccess, onClose]);

  const input =
    editor?.getText({
      blockSeparator: "\n",
    }) || "";

  function onSubmit() {
    const updateData = {
      postId: post.id,
      content: input,
      privacy,
      taggedUserIds: taggedUsers.map((u) => u.id),
      mediaIdsToDelete,
      ...(mediaLayout && { mediaLayout }),
    };

    mutation.mutate(updateData);
  }

  const handleDeleteMedia = (mediaId: string) => {
    setMediaIdsToDelete((prev) => [...prev, mediaId]);
  };

  const remainingAttachments =
    post.attachments?.filter((a) => !mediaIdsToDelete.includes(a.id)) || [];

  const handleEmojiClick = (emojiData: EmojiClickData) => {
    if (!editor) return;
    editor.commands.insertContent(emojiData.emoji);
    setShowEmojiPicker(false);
    editor.commands.focus();
  };

  const imageAttachments = remainingAttachments.filter(
    (a) => a.type === "IMAGE"
  );

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Edit Post</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <EditorContent
            editor={editor}
            className={cn(
              "max-h-[20rem] w-full overflow-y-auto rounded-2xl border bg-background px-5 py-3"
            )}
          />

          {/* Show existing media with delete option */}
          {remainingAttachments.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Current media:</p>
              <div className="grid grid-cols-3 gap-2">
                {remainingAttachments.slice(0, 6).map((attachment) => (
                  <div
                    key={attachment.id}
                    className="group relative aspect-square"
                  >
                    {attachment.type === "IMAGE" ? (
                      <Image
                        src={attachment.url}
                        alt="attachment"
                        width={300}
                        height={300}
                        className="h-full w-full rounded-lg object-cover"
                      />
                    ) : (
                      <video
                        src={attachment.url}
                        className="h-full w-full rounded-lg object-cover"
                      />
                    )}
                    <button
                      onClick={() => handleDeleteMedia(attachment.id)}
                      className="absolute right-2 top-2 z-10 rounded-full bg-destructive/90 p-1.5 text-white opacity-0 transition-opacity hover:bg-destructive group-hover:opacity-100"
                      type="button"
                    >
                      <X size={16} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Layout selector for images */}
          {imageAttachments.length > 0 && imageAttachments.length <= 6 && (
            <LayoutSelector
              layout={mediaLayout}
              onLayoutChange={setMediaLayout}
              imageCount={imageAttachments.length}
            />
          )}

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <PrivacySelector privacy={privacy} onPrivacyChange={setPrivacy} />
              <UserTaggingEditor
                taggedUsers={taggedUsers}
                onTaggedUsersChange={setTaggedUsers}
              />
            </div>
            <Popover open={showEmojiPicker} onOpenChange={setShowEmojiPicker}>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="rounded-full text-primary transition-all duration-300 hover:bg-white/20"
                >
                  <Smile size={20} />
                </Button>
              </PopoverTrigger>
              <PopoverContent
                className="w-full border-0 p-0"
                align="end"
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
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={onClose}
            disabled={mutation.isPending}
          >
            Cancel
          </Button>
          <LoadingButton
            onClick={onSubmit}
            loading={mutation.isPending}
            disabled={!input.trim()}
            className="bg-gradient-to-r from-pink-400 to-purple-500 text-white hover:from-pink-500 hover:to-purple-600"
          >
            Save changes
          </LoadingButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface PrivacySelectorProps {
  privacy: "DRAFT" | "FOLLOWERS" | "PUBLIC";
  onPrivacyChange: (privacy: "DRAFT" | "FOLLOWERS" | "PUBLIC") => void;
}

function PrivacySelector({ privacy, onPrivacyChange }: PrivacySelectorProps) {
  const getPrivacyIcon = (privacyLevel: string) => {
    switch (privacyLevel) {
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

  const getPrivacyText = (privacyLevel: string) => {
    switch (privacyLevel) {
      case "DRAFT":
        return "Draft";
      case "FOLLOWERS":
        return "Followers";
      case "PUBLIC":
        return "Public";
      default:
        return "Public";
    }
  };

  return (
    <Select value={privacy} onValueChange={onPrivacyChange}>
      <SelectTrigger className="w-fit gap-2 border-0 bg-transparent transition-colors hover:bg-white/10">
        {getPrivacyIcon(privacy)}
        <span className="text-sm font-medium">{getPrivacyText(privacy)}</span>
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="PUBLIC">
          <div className="flex items-center gap-2">
            <Globe className="h-4 w-4" />
            <div>
              <div className="font-medium">Public</div>
              <div className="text-xs text-muted-foreground">
                Everyone can see
              </div>
            </div>
          </div>
        </SelectItem>
        <SelectItem value="FOLLOWERS">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            <div>
              <div className="font-medium">Followers</div>
              <div className="text-xs text-muted-foreground">
                Only followers can see
              </div>
            </div>
          </div>
        </SelectItem>
        <SelectItem value="DRAFT">
          <div className="flex items-center gap-2">
            <Lock className="h-4 w-4" />
            <div>
              <div className="font-medium">Draft</div>
              <div className="text-xs text-muted-foreground">
                Only you can see
              </div>
            </div>
          </div>
        </SelectItem>
      </SelectContent>
    </Select>
  );
}

interface LayoutSelectorProps {
  layout: "GRID" | "CAROUSEL" | "COLUMNS" | "FRAME" | null;
  onLayoutChange: (
    layout: "GRID" | "CAROUSEL" | "COLUMNS" | "FRAME" | null
  ) => void;
  imageCount: number;
}

function LayoutSelector({
  layout,
  onLayoutChange,
  imageCount,
}: LayoutSelectorProps) {
  if (imageCount === 0 || imageCount > 6) return null;

  const layouts = [
    {
      value: "GRID" as const,
      icon: Grid3x3,
      label: "Grid",
      description: "2x2, 3x3",
    },
    {
      value: "CAROUSEL" as const,
      icon: LayoutGrid,
      label: "Carousel",
      description: "Horizontal scroll",
    },
    {
      value: "COLUMNS" as const,
      icon: Columns,
      label: "Columns",
      description: "Multiple columns",
    },
    {
      value: "FRAME" as const,
      icon: Frame,
      label: "Frame",
      description: "With border",
    },
  ];

  return (
    <div className="flex items-center gap-2 rounded-lg bg-muted/50 p-2">
      <span className="text-sm font-medium text-muted-foreground">Layout:</span>
      <div className="flex gap-1">
        {layouts.map(({ value, icon: Icon, label, description }) => (
          <button
            key={value}
            onClick={() => onLayoutChange(layout === value ? null : value)}
            className={cn(
              "flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-all",
              layout === value
                ? "bg-primary text-primary-foreground shadow-sm"
                : "bg-background text-muted-foreground hover:bg-muted"
            )}
            title={description}
          >
            <Icon className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">{label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
