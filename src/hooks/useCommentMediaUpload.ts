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
        body: JSON.stringify({ fileName, contentType: file.type }),
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

    const currentImages = attachments.filter((a) =>
      a.file.type.startsWith("image/")
    ).length;
    const currentVideos = attachments.filter((a) =>
      a.file.type.startsWith("video/")
    ).length;

    const newImages = files.filter((f) => f.type.startsWith("image/"));
    const newVideos = files.filter((f) => f.type.startsWith("video/"));

    if (currentImages + newImages.length > 4) {
      toast({
        variant: "destructive",
        description: "You can only upload up to 4 images per comment.",
      });
      return;
    }

    if (currentVideos + newVideos.length > 2) {
      toast({
        variant: "destructive",
        description: "You can only upload up to 2 videos per comment.",
      });
      return;
    }

    // Video duration validation
    for (const file of newVideos) {
      try {
        const duration = await new Promise<number>((resolve, reject) => {
          const video = document.createElement("video");
          video.preload = "metadata";
          video.onloadedmetadata = () => {
            window.URL.revokeObjectURL(video.src);
            resolve(video.duration);
          };
          video.onerror = () => {
            window.URL.revokeObjectURL(video.src);
            reject("Cannot load video metadata");
          };
          video.src = window.URL.createObjectURL(file);
        });

        if (duration > 120) {
          toast({
            variant: "destructive",
            description: `Video "${file.name}" exceeds the 2-minute limit.`,
          });
          return;
        }
      } catch (error) {
        console.error(error);
        toast({
          variant: "destructive",
          description: `Failed to process video "${file.name}".`,
        });
        return;
      }
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
