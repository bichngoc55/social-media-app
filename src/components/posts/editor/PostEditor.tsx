"use client";

import { useSession } from "@/app/(main)/SessionProvider";
import LoadingButton from "@/components/LoadingButton";
import { Button } from "@/components/ui/button";
import { UserDataLightweight } from "@/lib/types";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import UserAvatar from "@/components/UserAvatar";
import { cn } from "@/lib/utils";
import Placeholder from "@tiptap/extension-placeholder";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { useDropzone } from "react-dropzone";
import {
  Globe,
  ImageIcon,
  LayoutGrid,
  Lock,
  Loader2,
  Users,
  X,
  Grid3x3,
  Columns,
  Frame,
  Smile,
  AlertCircle,
} from "lucide-react";
import Image from "next/image";
import { ClipboardEvent, useRef, useState } from "react";
import EmojiPicker, { EmojiClickData } from "emoji-picker-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useSubmitPostMutation } from "./mutations";
import "./styles.css";
import useMediaUpload, { Attachment } from "./useMediaUpload";
import UserTaggingEditor from "./UserTaggingEditor";
const MAX_CHARACTER_LIMIT = 1024;
export default function PostEditor() {
  const { user } = useSession();
  const [privacy, setPrivacy] = useState<"DRAFT" | "FOLLOWERS" | "PUBLIC">(
    "PUBLIC"
  );
  const [mediaLayout, setMediaLayout] = useState<
    "GRID" | "CAROUSEL" | "COLUMNS" | "FRAME" | null
  >(null);
  const [taggedUsers, setTaggedUsers] = useState<UserDataLightweight[]>([]);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  const mutation = useSubmitPostMutation();

  const {
    startUpload,
    attachments,
    isUploading,
    uploadProgress,
    removeAttachment,
    reset: resetMediaUploads,
  } = useMediaUpload();

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: startUpload,
  });

  const { onClick, ...rootProps } = getRootProps();

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        bold: false,
        italic: false,
      }),
      Placeholder.configure({
        placeholder: "What's on your mind?",
      }),
    ],
    immediatelyRender: false,
  });

  const input =
    editor?.getText({
      blockSeparator: "\n",
    }) || "";
  const isTooLong = input.length > MAX_CHARACTER_LIMIT;

  function onSubmit() {
    if (isTooLong) return;

    const storedValue = localStorage.getItem("isAnalyzedPostWithGemini");
    const isAnalyzed = storedValue !== "false";

    mutation.mutate(
      {
        content: input,
        mediaIds: attachments.map((a) => a.mediaId).filter(Boolean) as string[],
        privacy,
        mediaLayout: mediaLayout || undefined,
        taggedUserIds: taggedUsers.map((u) => u.id),
        isAnalyzed,
      },
      {
        onSuccess: () => {
          editor?.commands.clearContent();
          resetMediaUploads();
          setPrivacy("PUBLIC");
          setMediaLayout(null);
          setTaggedUsers([]);
        },
      }
    );
  }

  function onPaste(e: ClipboardEvent<HTMLInputElement>) {
    const files = Array.from(e.clipboardData.items)
      .filter((item) => item.kind === "file")
      .map((item) => item.getAsFile()) as File[];
    startUpload(files);
  }

  const handleEmojiClick = (emojiData: EmojiClickData) => {
    if (!editor) return;
    editor.commands.insertContent(emojiData.emoji);
    setShowEmojiPicker(false);
    editor.commands.focus();
  };

  return (
    <div className="card-glass post-hover-lift flex min-h-fit flex-col gap-5 rounded-2xl p-6 pb-20 sm:pb-6">
      <div className="flex gap-5">
        <UserAvatar avatarUrl={user.avatarUrl} className="hidden sm:inline" />
        <div {...rootProps} className="w-full">
          <EditorContent
            editor={editor}
            className={cn(
              "max-h-[20rem] w-full overflow-y-auto rounded-2xl bg-background px-5 py-3",
              isDragActive && "outline-dashed",
              isTooLong && "outline outline-1 outline-destructive"
            )}
            onPaste={onPaste}
          />
          <input {...getInputProps()} />
        </div>
      </div>
      {isTooLong && (
        <div className="flex items-center gap-2 text-sm font-medium text-destructive animate-in fade-in slide-in-from-top-1">
          <AlertCircle className="size-4" />
          <span>
            Post is too long ({input.length}/{MAX_CHARACTER_LIMIT} characters).
            Please shorten it to post.
          </span>
        </div>
      )}
      {!!attachments.length && (
        <>
          <LayoutSelector
            layout={mediaLayout}
            onLayoutChange={setMediaLayout}
            imageCount={
              attachments.filter((a) => a.file.type.startsWith("image")).length
            }
          />
          <AttachmentPreviews
            attachments={attachments}
            removeAttachment={removeAttachment}
            layout={mediaLayout}
          />
        </>
      )}
      <div className="flex flex-col-reverse justify-between gap-3 sm:flex-row sm:items-center">
        <div className="flex items-center gap-3">
          <PrivacySelector privacy={privacy} onPrivacyChange={setPrivacy} />
          <UserTaggingEditor
            taggedUsers={taggedUsers}
            onTaggedUsersChange={setTaggedUsers}
          />
        </div>

        <div className="flex items-center justify-end gap-3">
          <span
            className={cn(
              "text-xs font-medium",
              isTooLong ? "text-destructive" : "text-muted-foreground"
            )}
          >
            {input.length}/{MAX_CHARACTER_LIMIT}
          </span>
          {isUploading && (
            <>
              <span className="text-sm">{uploadProgress ?? 0}%</span>
              <Loader2 className="size-5 animate-spin text-primary" />
            </>
          )}
          {attachments.length === 0 && (
            <AddAttachmentsButton
              onFilesSelected={startUpload}
              disabled={isUploading || attachments.length >= 6}
            />
          )}
          <Popover open={showEmojiPicker} onOpenChange={setShowEmojiPicker}>
            <PopoverTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="btn-glow rounded-full text-primary transition-all duration-300 hover:bg-black/5 hover:text-primary dark:hover:bg-white/5"
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
          <LoadingButton
            onClick={onSubmit}
            loading={mutation.isPending}
            disabled={!input.trim() || isUploading || isTooLong} // Added isTooLong to disabled state
            className="btn-glow min-w-20 border-0 bg-gradient-to-r from-pink-400 to-purple-500 text-white shadow-lg transition-all duration-300 hover:from-pink-500 hover:to-purple-600 hover:shadow-xl disabled:opacity-50"
          >
            Post
          </LoadingButton>
        </div>
      </div>
    </div>
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
                Everyone can see this
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
                Only followers can see this
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
                Only you can see this
              </div>
            </div>
          </div>
        </SelectItem>
      </SelectContent>
    </Select>
  );
}

interface AddAttachmentsButtonProps {
  onFilesSelected: (files: File[]) => void;
  disabled: boolean;
}

function AddAttachmentsButton({
  onFilesSelected,
  disabled,
}: AddAttachmentsButtonProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        className="btn-glow rounded-full text-primary transition-all duration-300 hover:bg-black/5 hover:text-primary dark:hover:bg-white/5"
        disabled={disabled}
        onClick={() => fileInputRef.current?.click()}
      >
        <ImageIcon size={20} />
      </Button>
      <input
        type="file"
        accept="image/*, video/*"
        multiple
        ref={fileInputRef}
        className="hidden"
        onChange={(e) => {
          const files = Array.from(e.target.files || []);
          if (files.length) {
            onFilesSelected(files);
            e.target.value = "";
          }
        }}
      />
    </>
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
      description: "2x2, 3x3 layout",
    },
    {
      value: "CAROUSEL" as const,
      icon: LayoutGrid,
      label: "Carousel",
      description: "Horizontal sliding",
    },
    {
      value: "COLUMNS" as const,
      icon: Columns,
      label: "Columns",
      description: "Multiple vertical columns",
    },
    {
      value: "FRAME" as const,
      icon: Frame,
      label: "Frame",
      description: "With border frame",
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

interface AttachmentPreviewsProps {
  attachments: Attachment[];
  removeAttachment: (fileName: string) => void;
  layout: "GRID" | "CAROUSEL" | "COLUMNS" | "FRAME" | null;
}

function AttachmentPreviews({
  attachments,
  removeAttachment,
  layout,
}: AttachmentPreviewsProps) {
  const imageAttachments = attachments.filter((a) =>
    a.file.type.startsWith("image")
  );
  const videoAttachments = attachments.filter((a) =>
    a.file.type.startsWith("video")
  );
  const MAX_DISPLAY = 6;
  const remainingCount = imageAttachments.length - MAX_DISPLAY;

  const effectiveLayout = layout || "GRID";

  const getLayoutClasses = () => {
    switch (effectiveLayout) {
      case "GRID":
        if (imageAttachments.length === 1) return "flex flex-col gap-3";
        if (imageAttachments.length === 2) return "grid grid-cols-2 gap-3";
        if (imageAttachments.length === 3) return "grid grid-cols-3 gap-3";
        if (imageAttachments.length === 4) return "grid grid-cols-2 gap-3";
        return "grid grid-cols-3 gap-3";
      case "CAROUSEL":
        return "flex gap-2 overflow-x-auto snap-x snap-mandatory pb-2";
      case "COLUMNS":
        return "flex gap-2 overflow-x-auto snap-x snap-mandatory pb-2";
      case "FRAME":
        if (imageAttachments.length === 1) return "flex flex-col gap-3";
        if (imageAttachments.length === 2) return "grid grid-cols-2 gap-3";
        if (imageAttachments.length === 3) return "grid grid-cols-3 gap-3";
        if (imageAttachments.length === 4) return "grid grid-cols-2 gap-3";
        return "grid grid-cols-3 gap-3";
      default:
        return "grid grid-cols-3 gap-3";
    }
  };

  const displayImages = imageAttachments.slice(0, MAX_DISPLAY);

  return (
    <div className="space-y-3">
      {imageAttachments.length > 0 && (
        <div
          className={cn(
            getLayoutClasses(),
            effectiveLayout === "FRAME" &&
              "rounded-2xl border-4 border-primary/20 bg-primary/5 p-4"
          )}
        >
          {displayImages.map((attachment, index) => {
            const isLast = index === displayImages.length - 1;
            const showOverlay = remainingCount > 0 && isLast;

            return (
              <AttachmentPreview
                key={attachment.file.name}
                attachment={attachment}
                onRemoveClick={() => removeAttachment(attachment.file.name)}
                layout={effectiveLayout}
                showOverlay={showOverlay}
                overlayCount={remainingCount}
              />
            );
          })}
        </div>
      )}
      {videoAttachments.length > 0 && (
        <div className="flex flex-col gap-3">
          {videoAttachments.map((attachment) => (
            <AttachmentPreview
              key={attachment.file.name}
              attachment={attachment}
              onRemoveClick={() => removeAttachment(attachment.file.name)}
              layout={effectiveLayout}
            />
          ))}
        </div>
      )}
    </div>
  );
}

interface AttachmentPreviewProps {
  attachment: Attachment;
  onRemoveClick: () => void;
  layout: "GRID" | "CAROUSEL" | "COLUMNS" | "FRAME";
  showOverlay?: boolean;
  overlayCount?: number;
}

function AttachmentPreview({
  attachment: { file, mediaId, isUploading },
  onRemoveClick,
  layout,
  showOverlay = false,
  overlayCount = 0,
}: AttachmentPreviewProps) {
  const src = URL.createObjectURL(file);

  const getImageClasses = () => {
    switch (layout) {
      case "GRID":
        return "w-full h-full object-cover rounded-2xl";
      case "CAROUSEL":
        return "w-[60vw] sm:w-[35vw] max-h-[25rem] object-contain rounded-xl snap-center flex-shrink-0";
      case "COLUMNS":
        return "w-full h-full object-cover rounded-lg snap-center";
      case "FRAME":
        return "w-full h-full object-cover rounded-xl";
      default:
        return "w-full h-full object-cover rounded-2xl";
    }
  };

  const getContainerClasses = () => {
    const base = cn(
      "relative",
      layout === "GRID" && "aspect-square",
      layout === "CAROUSEL" && "flex-shrink-0",
      layout === "COLUMNS" && "w-[150px] h-[400px] flex-shrink-0",
      layout === "FRAME" && "aspect-square",
      isUploading && "opacity-50"
    );
    return base;
  };

  return (
    <div className={getContainerClasses()}>
      {file.type.startsWith("image") ? (
        <Image
          src={src}
          alt="Attachment preview"
          width={500}
          height={500}
          unoptimized
          className={getImageClasses()}
        />
      ) : (
        <video controls className={getImageClasses()}>
          <source src={src} type={file.type} />
        </video>
      )}
      {showOverlay && (
        <div className="absolute inset-0 flex items-center justify-center rounded-2xl bg-black/70">
          <div className="text-center">
            <span className="text-4xl font-bold text-white">
              +{overlayCount}
            </span>
          </div>
        </div>
      )}
      {!isUploading && (
        <button
          onClick={onRemoveClick}
          className="absolute right-3 top-3 z-10 rounded-full bg-foreground p-1.5 text-background transition-colors hover:bg-foreground/60"
        >
          <X size={20} />
        </button>
      )}
    </div>
  );
}
