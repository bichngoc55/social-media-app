import { useToast } from "@/components/ui/use-toast";
import { useState } from "react";

function getVideoDuration(file: File): Promise<number> {
  return new Promise((resolve, reject) => {
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
}

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

  async function uploadFile(
    file: File,
    onProgress?: (progress: number) => void
  ): Promise<string | null> {
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

    // Use XMLHttpRequest to track upload progress
    await new Promise<void>((resolve, reject) => {
      const xhr = new XMLHttpRequest();

      xhr.upload.addEventListener("progress", (e) => {
        if (e.lengthComputable && onProgress) {
          const percentComplete = (e.loaded / e.total) * 100;
          onProgress(percentComplete);
        }
      });

      xhr.addEventListener("load", () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve();
        } else {
          reject(new Error(`Upload failed with status ${xhr.status}`));
        }
      });

      xhr.addEventListener("error", () => {
        reject(new Error("Upload failed"));
      });

      xhr.addEventListener("abort", () => {
        reject(new Error("Upload aborted"));
      });

      xhr.open("PUT", uploadUrl);
      xhr.send(file);
    });

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

    const currentImages = attachments.filter((a) =>
      a.file.type.startsWith("image/")
    ).length;
    const currentVideos = attachments.filter((a) =>
      a.file.type.startsWith("video/")
    ).length;

    const newImages = files.filter((f) => f.type.startsWith("image/")).length;
    const newVideos = files.filter((f) => f.type.startsWith("video/")).length;

    if (currentImages + newImages > 4) {
      toast({
        variant: "destructive",
        description: "You can only upload up to 4 images per post.",
      });
      return;
    }

    if (currentVideos + newVideos > 2) {
      toast({
        variant: "destructive",
        description: "You can only upload up to 2 videos per post.",
      });
      return;
    }

    const ALLOWED_IMAGE_TYPES = [
      "image/bmp",
      "image/gif",
      "image/jpeg",
      "image/png",
    ];

    for (const file of files) {
      if (
        !ALLOWED_IMAGE_TYPES.includes(file.type) &&
        !file.type.startsWith("video/")
      ) {
        toast({
          title: "Unsupported file format",
          description: "Only BMP, GIF, JPG, PNG images and videos are allowed.",
          variant: "destructive",
        });
        return;
      }

      if (file.type.startsWith("video/")) {
        try {
          const duration = await getVideoDuration(file);
          if (duration > 120) {
            toast({
              variant: "destructive",
              description: `Video "${file.name}" exceeds the 2-minute limit.`,
            });
            return;
          }
        } catch (error) {
          toast({
            variant: "destructive",
            description: `Failed to check video duration for "${file.name}".`,
          });
          return;
        }
      }
    }

    setIsUploading(true);
    setUploadProgress(0);
    setAttachments((prev) => [
      ...prev,
      ...files.map((file) => ({ file, isUploading: true })),
    ]);

    try {
      const total = files.length;
      let completed = 0;
      const fileProgress: Record<string, number> = {};

      // Initialize progress for each file
      files.forEach((file) => {
        fileProgress[file.name] = 0;
      });

      const results = await Promise.allSettled(
        files.map(async (file) => {
          const mediaId = await uploadFile(file, (progress) => {
            // Update individual file progress
            fileProgress[file.name] = progress;

            // Calculate total progress: completed files + current file progress
            const totalProgress =
              ((completed * 100 +
                Object.values(fileProgress).reduce((sum, p) => sum + p, 0)) /
                (total * 100)) *
              100;

            setUploadProgress(Math.round(totalProgress));
          });

          completed++;
          fileProgress[file.name] = 100;

          // Update progress for completed files
          setUploadProgress(Math.round((completed / total) * 100));

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
