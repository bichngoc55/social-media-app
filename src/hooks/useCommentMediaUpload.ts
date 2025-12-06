import { useToast } from "@/components/ui/use-toast";
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
  const [isUploading, setIsUploading] = useState(false);

  async function uploadFile(
    file: File
  ): Promise<{ mediaId: string; url: string } | null> {
    const signedUrlResponse = await fetch("/api/upload/comment-attachment", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contentType: file.type,
        fileSize: file.size,
      }),
    });

    if (!signedUrlResponse.ok) {
      const error = await signedUrlResponse.json();
      throw new Error(error.error || "Failed to get upload URL");
    }

    const { uploadUrl, fileName } = await signedUrlResponse.json();

    await fetch(uploadUrl, {
      method: "PUT",
      body: file,
    });

    const completeResponse = await fetch(
      "/api/upload/comment-attachment/complete",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileName }),
      }
    );

    if (!completeResponse.ok) {
      throw new Error("Failed to complete upload");
    }

    const { mediaId, url } = await completeResponse.json();
    return { mediaId, url };
  }

  async function handleStartUpload(files: File[]) {
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

    setIsUploading(true);
    setAttachments((prev) => [
      ...prev,
      ...files.map((file) => ({ file, isUploading: true })),
    ]);

    try {
      const total = files.length;
      let completed = 0;

      const results = await Promise.allSettled(
        files.map(async (file) => {
          const result = await uploadFile(file);
          completed++;
          setUploadProgress((completed / total) * 100);
          return { file, ...result };
        })
      );

      setAttachments((prev) =>
        prev.map((a) => {
          const result = results.find(
            (r) => r.status === "fulfilled" && r.value.file === a.file
          );
          if (result && result.status === "fulfilled") {
            return {
              ...a,
              mediaId: result.value.mediaId,
              url: result.value.url,
              isUploading: false,
            };
          }
          return a;
        })
      );

      const failedUploads = results.filter((r) => r.status === "rejected");
      if (failedUploads.length > 0) {
        toast({
          variant: "destructive",
          description: `${failedUploads.length} file(s) failed to upload`,
        });
      }
    } catch (error) {
      setAttachments((prev) => prev.filter((a) => !a.isUploading));
      toast({
        variant: "destructive",
        description: error instanceof Error ? error.message : "Upload failed",
      });
    } finally {
      setIsUploading(false);
      setUploadProgress(undefined);
    }
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
