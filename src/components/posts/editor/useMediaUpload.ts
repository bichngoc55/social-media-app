import { useToast } from "@/components/ui/use-toast";
import { useState } from "react";

export interface Attachment {
  file: File;
  mediaId?: string;
  isUploading: boolean;
}

export default function useMediaUpload() {
  const { toast } = useToast();
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [uploadProgress, setUploadProgress] = useState<number>();
  const [isUploading, setIsUploading] = useState(false);

  async function uploadFile(file: File): Promise<string | null> {
    const signedUrlResponse = await fetch("/api/upload/attachment", {
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
    try {
      await fetch(uploadUrl, {
        method: "PUT",
        body: file,
        mode: "cors",
      });
    } catch (err) {
      console.log("Error uploading file to signed URL:", err);
      throw err;
    }

    const completeResponse = await fetch("/api/upload/attachment/complete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fileName, contentType: file.type }),
    });

    if (!completeResponse.ok) {
      throw new Error("Failed to complete upload");
    }

    const { mediaId } = await completeResponse.json();
    return mediaId;
  }

  async function handleStartUpload(files: File[]) {
    if (isUploading) {
      toast({
        variant: "destructive",
        description: "Please wait for the current upload to finish.",
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
          const mediaId = await uploadFile(file);
          completed++;
          setUploadProgress((completed / total) * 100);
          return { file, mediaId };
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
              mediaId: result.value.mediaId || undefined,
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
