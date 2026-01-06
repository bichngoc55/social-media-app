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
        title: "Appeal Submitted",
        description:
          "Your appeal has been successfully submitted and is pending review.",
      });
      setOpen(false);
      setAppealReason("");
      queryClient.invalidateQueries({
        queryKey: ["post-ai-flag-status", postId],
      });
    },
    onError: (error: any) => {
      const message =
        error?.response?.json?.then?.((e: any) => e.error) ||
        error?.message ||
        "Unable to submit appeal";
      toast({
        title: "Error",
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
              Appeal form
            </DialogTitle>
            <DialogDescription>
              This post has been flagged by AI (Sensitive Content). You can
              submit an appeal if you believe this is a mistake. Please provide
              a detailed reason.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="appeal-reason">Appeal Reason *</Label>
              <Textarea
                id="appeal-reason"
                placeholder="Please explain why you believe this post does not violate the guidelines..."
                value={appealReason}
                onChange={(e) => setAppealReason(e.target.value)}
                rows={5}
                className="resize-none"
              />
            </div>
            {flagStatus?.hasActiveWarning && (
              <div className="rounded-lg bg-orange-50 p-3 text-sm text-orange-800 dark:bg-orange-900/20 dark:text-orange-200">
                <p className="font-semibold">Note:</p>
                <p>
                  You have an active warning for this post. Appeals will be
                  reviewed within 72 hours.
                </p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={appealMutation.isPending || !appealReason.trim()}
            >
              {appealMutation.isPending ? "Sending..." : "Submit Appeal"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
