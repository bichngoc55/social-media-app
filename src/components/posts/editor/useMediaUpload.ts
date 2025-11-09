import { useToast } from "@/components/ui/use-toast";
import { useUploadThing } from "@/lib/uploadthing";
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

  const { startUpload, isUploading } = useUploadThing("attachment", {
    onBeforeUploadBegin: async (files) => {
      // Preserve exact bytes to avoid filesize mismatch by copying via arrayBuffer
      const renamedFiles = await Promise.all(
        files.map(async (file) => {
          const extension = file.name.split(".").pop();
          const buffer = await file.arrayBuffer();
          return new File(
            [buffer],
            `attachment_${crypto.randomUUID()}.${extension}`,
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

          // Nếu callback fail, mediaId có thể null
          // Nhưng file vẫn upload thành công lên S3
          const mediaId = uploadResult.serverData?.mediaId;

          if (!mediaId) {
            console.warn(
              "⚠️ Upload succeeded but callback failed. File URL:",
              uploadResult.url,
              "Error:",
              uploadResult.serverData?.error
            );
            // Vẫn giữ file để user có thể thấy preview
            // Nhưng sẽ không thể đăng bài (vì không có mediaId)
          }

          return {
            ...a,
            mediaId: mediaId || undefined,
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
