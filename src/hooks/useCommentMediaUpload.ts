import { useToast } from "@/components/ui/use-toast";
import { useUploadThing } from "@/lib/uploadthing";
import { useState } from "react";

export interface CommentAttachment {
  file: File;
  mediaId?: string;
  url?: string;
  isUploading: boolean;
}

export default function useCommentMediaUpload() {
  const { toast } = useToast();
  const [attachments, setAttachments] = useState<CommentAttachment[]>([]);
  const [uploadProgress, setUploadProgress] = useState<number>();

  const { startUpload, isUploading } = useUploadThing("commentAttachment", {
    onBeforeUploadBegin: async (files) => {
      const renamedFiles = await Promise.all(
        files.map(async (file) => {
          const extension = file.name.split(".").pop();
          const buffer = await file.arrayBuffer();
          return new File(
            [buffer],
            `comment_${crypto.randomUUID()}.${extension}`,
            {
              type: file.type,
            }
          );
        })
      );

      setAttachments((prev) => [
        ...prev,
        ...renamedFiles.map((file) => ({ file, isUploading: true })),
      ]);

      return renamedFiles;
    },
    onUploadProgress: setUploadProgress,
    onClientUploadComplete(res) {
      setAttachments((prev) =>
        prev.map((a) => {
          const uploadResult = res.find((r) => r.name === a.file.name);
          if (!uploadResult) return a;

          return {
            ...a,
            mediaId: uploadResult.serverData.mediaId,
            url: uploadResult.serverData.url,
            isUploading: false,
          };
        })
      );
    },
    onUploadError(e) {
      setAttachments((prev) => prev.filter((a) => !a.isUploading));
      toast({
        variant: "destructive",
        description: e.message,
      });
    },
  });

  function handleStartUpload(files: File[]) {
    if (isUploading) {
      toast({
        variant: "destructive",
        description: "Please wait for the current upload to finish.",
      });
      return;
    }

    if (attachments.length + files.length > 3) {
      toast({
        variant: "destructive",
        description: "You can only upload up to 3 images per comment.",
      });
      return;
    }

    startUpload(files);
  }

  function removeAttachment(fileName: string) {
    setAttachments((prev) => prev.filter((a) => a.file.name !== fileName));
  }

  function reset() {
    setAttachments([]);
    setUploadProgress(undefined);
  }

  return {
    startUpload: handleStartUpload,
    attachments,
    isUploading,
    uploadProgress,
    removeAttachment,
    reset,
  };
}
