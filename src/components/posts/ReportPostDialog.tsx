"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Flag } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import kyInstance from "@/lib/ky";
import { useToast } from "@/components/ui/use-toast";

const REPORT_TYPES = [
  { value: "SPAM", label: "Spam" },
  { value: "HARASSMENT", label: "Harassment" },
  { value: "HATE_SPEECH", label: "Hate Speech" },
  { value: "VIOLENCE", label: "Violence" },
  { value: "NUDITY", label: "Nudity" },
  { value: "COPYRIGHT", label: "Copyright" },
  { value: "IMPERSONATION", label: "Impersonation" },
  { value: "OTHER", label: "Other" },
];

interface ReportPostDialogProps {
  postId: string;
  children?: React.ReactNode;
}

export default function ReportPostDialog({
  postId,
  children,
}: ReportPostDialogProps) {
  const [open, setOpen] = useState(false);
  const [selectedType, setSelectedType] = useState<string>("");
  const [reason, setReason] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const reportMutation = useMutation({
    mutationFn: async (data: { type: string; reason: string }) => {
      return kyInstance
        .post(`/api/posts/${postId}/report`, { json: data })
        .json();
    },
    onSuccess: () => {
      toast({
        title: "Report submitted",
        description:
          "Thank you for your report. This post will be hidden from your feed.",
      });
      setOpen(false);
      setSelectedType("");
      setReason("");
      // Invalidate posts to refresh feed
      queryClient.invalidateQueries({ queryKey: ["posts"] });
    },
    onError: (error: any) => {
      const message =
        error?.response?.json?.then?.((e: any) => e.error) ||
        error?.message ||
        "Failed to submit report";
      toast({
        title: "Error",
        description: message,
        variant: "destructive",
      });
    },
  });

  const handleSubmit = () => {
    if (!selectedType) {
      toast({
        title: "Please select a reason",
        variant: "destructive",
      });
      return;
    }
    // Combine type label with additional details
    const selectedTypeLabel =
      REPORT_TYPES.find((t) => t.value === selectedType)?.label || selectedType;
    const fullReason = reason.trim()
      ? `${selectedTypeLabel}: ${reason.trim()}`
      : selectedTypeLabel;

    reportMutation.mutate({ type: selectedType, reason: fullReason });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {children ? (
        <div onClick={() => setOpen(true)}>{children}</div>
      ) : (
        <DialogTrigger asChild>
          <Button variant="ghost" size="sm">
            <Flag className="h-4 w-4" />
          </Button>
        </DialogTrigger>
      )}
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Report Post</DialogTitle>
          <DialogDescription>
            Please select a reason for reporting this post. This post will be
            hidden from your feed.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Reason</Label>
            <RadioGroup
              value={selectedType}
              onValueChange={setSelectedType}
              className="mt-2"
            >
              {REPORT_TYPES.map((type) => (
                <div key={type.value} className="flex items-center space-x-2">
                  <RadioGroupItem value={type.value} id={type.value} />
                  <Label htmlFor={type.value} className="cursor-pointer">
                    {type.label}
                  </Label>
                </div>
              ))}
            </RadioGroup>
          </div>
          <div>
            <Label htmlFor="reason">Additional details</Label>
            <Textarea
              id="reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Please provide more details about why you're reporting this post (optional)..."
              rows={4}
              className="mt-2"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={reportMutation.isPending || !selectedType}
          >
            {reportMutation.isPending ? "Submitting..." : "Submit Report"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
