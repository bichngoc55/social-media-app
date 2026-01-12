"use client";

import kyInstance from "@/lib/ky";
import { useToast } from "@/components/ui/use-toast";
import { Check, X } from "lucide-react";
import { useState, useEffect } from "react";
import { Button } from "../ui/button";

interface TagRequest {
  id: string;
  userId: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  user: {
    id: string;
    displayName: string;
    username: string;
    avatarUrl: string | null;
  };
}

interface TagRequestBannerProps {
  postId: string;
  currentUserId: string;
  onUpdate?: () => void;
}

export default function TagRequestBanner({
  postId,
  currentUserId,
  onUpdate,
}: TagRequestBannerProps) {
  const [pendingTag, setPendingTag] = useState<TagRequest | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    async function fetchPendingTag() {
      try {
        const response = await kyInstance.get(`/api/posts/${postId}/tag`);
        const data = (await response.json()) as {
          taggedUsers: TagRequest[];
        };

        // Tìm tag request PENDING cho current user
        const pending = data.taggedUsers.find(
          (tag) => tag.userId === currentUserId && tag.status === "PENDING"
        );

        setPendingTag(pending || null);
      } catch (error: any) {
        // Silently handle 401 errors (user not authenticated yet)
        if (error?.response?.status !== 401) {
          console.error("Error fetching tag requests:", error);
        }
      } finally {
        setIsLoading(false);
      }
    }

    fetchPendingTag();
  }, [postId, currentUserId]);

  const handleAction = async (action: "approve" | "reject") => {
    if (!pendingTag) return;

    setIsProcessing(true);
    try {
      const response = await kyInstance.post(
        `/api/tag-requests/${pendingTag.id}/approve`,
        {
          json: { action },
        }
      );

      const data = (await response.json()) as {
        success: boolean;
        message?: string;
        error?: string;
      };

      if (data.success) {
        toast({
          description:
            action === "approve"
              ? "Đã chấp nhận tag request"
              : "Đã từ chối tag request",
        });
        setPendingTag(null);
        onUpdate?.();
      } else {
        throw new Error(data.error || "Failed to process tag request");
      }
    } catch (error) {
      console.error("Error processing tag request:", error);
      toast({
        variant: "destructive",
        description: "Có lỗi xảy ra. Vui lòng thử lại.",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  if (isLoading || !pendingTag) return null;

  return (
    <div className="rounded-lg border-2 border-orange-500/50 bg-orange-500/10 p-4">
      <div className="flex items-center justify-between gap-4">
        <div className="flex-1">
          <p className="text-sm font-medium text-orange-600">
            Bạn đã được tag trong bài viết này
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Bạn có muốn chấp nhận tag này không?
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => handleAction("reject")}
            disabled={isProcessing}
            className="border-red-500/50 text-red-600 hover:bg-red-500/10"
          >
            <X className="mr-1 h-4 w-4" />
            Từ chối
          </Button>
          <Button
            size="sm"
            onClick={() => handleAction("approve")}
            disabled={isProcessing}
            className="bg-green-600 hover:bg-green-700"
          >
            <Check className="mr-1 h-4 w-4" />
            Chấp nhận
          </Button>
        </div>
      </div>
    </div>
  );
}
