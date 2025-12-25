"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useToast } from "@/components/ui/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { AlertTriangle } from "lucide-react";
import kyInstance from "@/lib/ky";

interface AppealPostButtonProps {
  postId: string;
  children: React.ReactNode;
}

export default function AppealPostButton({
  postId,
  children,
}: AppealPostButtonProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [appealReason, setAppealReason] = useState("");

  // Check if post has harmful = true and can be appealed
  const { data: flagStatus, isLoading } = useQuery({
    queryKey: ["post-ai-flag-status", postId],
    queryFn: async () => {
      const response = await kyInstance
        .get(`/api/posts/${postId}/ai-flag-status`)
        .json<{
          hasAIFlag: boolean;
          hasHarmful: boolean;
          hasActiveWarning: boolean;
          hasPendingAppeal: boolean;
        }>();
      return response;
    },
    enabled: !!postId,
  });

  const appealMutation = useMutation({
    mutationFn: async (reason: string) => {
      return kyInstance
        .post(`/api/posts/${postId}/appeal`, {
          json: { appealReason: reason },
        })
        .json();
    },
    onSuccess: () => {
      toast({
        title: "Kháng cáo đã được gửi",
        description: "Kháng cáo của bạn đã được gửi thành công và đang chờ xem xét.",
      });
      setOpen(false);
      setAppealReason("");
      queryClient.invalidateQueries({ queryKey: ["post-ai-flag-status", postId] });
    },
    onError: (error: any) => {
      const message =
        error?.response?.json?.then?.((e: any) => e.error) ||
        error?.message ||
        "Không thể gửi kháng cáo";
      toast({
        title: "Lỗi",
        description: message,
        variant: "destructive",
      });
    },
  });

  const handleSubmit = () => {
    if (!appealReason.trim()) {
      toast({
        title: "Vui lòng nhập lý do kháng cáo",
        variant: "destructive",
      });
      return;
    }

    appealMutation.mutate(appealReason.trim());
  };

  // Only show button if post has harmful = true and no pending appeal
  if (isLoading) {
    return null;
  }

  if (!flagStatus?.hasHarmful || flagStatus?.hasPendingAppeal) {
    return null;
  }

  return (
    <>
      <div onClick={() => setOpen(true)}>{children}</div>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-orange-500" />
              Kháng cáo bài viết
            </DialogTitle>
            <DialogDescription>
              Bài viết này đã bị AI cảnh báo (Sensitive Content). Bạn có thể gửi kháng cáo
              nếu bạn cho rằng đây là nhầm lẫn. Vui lòng cung cấp lý do chi tiết.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="appeal-reason">Lý do kháng cáo *</Label>
              <Textarea
                id="appeal-reason"
                placeholder="Vui lòng giải thích tại sao bạn cho rằng bài viết này không vi phạm..."
                value={appealReason}
                onChange={(e) => setAppealReason(e.target.value)}
                rows={5}
                className="resize-none"
              />
            </div>
            {flagStatus?.hasActiveWarning && (
              <div className="rounded-lg bg-orange-50 dark:bg-orange-900/20 p-3 text-sm text-orange-800 dark:text-orange-200">
                <p className="font-semibold">Lưu ý:</p>
                <p>
                  Bạn có một cảnh báo đang hoạt động cho bài viết này. Kháng cáo
                  sẽ được xem xét trong vòng 72 giờ.
                </p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Hủy
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={appealMutation.isPending || !appealReason.trim()}
            >
              {appealMutation.isPending ? "Đang gửi..." : "Gửi kháng cáo"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

