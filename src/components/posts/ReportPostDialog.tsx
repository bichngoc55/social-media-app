"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Flag,
  AlertTriangle,
  Ban,
  ShieldAlert,
  Zap,
  EyeOff,
  Copyright,
  UserX,
  MessageSquare,
} from "lucide-react";
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

import { cn } from "@/lib/utils";
const REPORT_TYPES = [
  {
    value: "SPAM",
    label: "Spam",
    icon: AlertTriangle,
    color: "text-yellow-600",
  },
  {
    value: "HARASSMENT",
    label: "Harassment",
    icon: Ban,
    color: "text-red-600",
  },
  {
    value: "HATE_SPEECH",
    label: "Hate Speech",
    icon: ShieldAlert,
    color: "text-red-700",
  },
  { value: "VIOLENCE", label: "Violence", icon: Zap, color: "text-orange-600" },
  { value: "NUDITY", label: "Nudity", icon: EyeOff, color: "text-pink-600" },
  {
    value: "COPYRIGHT",
    label: "Copyright",
    icon: Copyright,
    color: "text-blue-600",
  },
  {
    value: "IMPERSONATION",
    label: "Impersonation",
    icon: UserX,
    color: "text-purple-600",
  },
  {
    value: "OTHER",
    label: "Other",
    icon: MessageSquare,
    color: "text-gray-600",
  },
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

    if (selectedType === "OTHER" && !reason.trim()) {
      toast({
        title: "Additional details required",
        description: "Please provide details for 'Other' reason",
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
    <Dialog
      open={open}
      onOpenChange={(isOpen) => {
        setOpen(isOpen);
        if (!isOpen) {
          // Reset form when dialog closes
          setSelectedType("");
          setReason("");
        }
      }}
    >
      {children ? (
        <div onClick={() => setOpen(true)}>{children}</div>
      ) : (
        <DialogTrigger asChild>
          <Button variant="ghost" size="sm">
            <Flag className="h-4 w-4" />
          </Button>
        </DialogTrigger>
      )}
      <DialogContent className="max-w-2xl border-[rgba(195,199,244,0.4)] bg-[rgba(244,231,248,0.95)] shadow-[0_8px_32px_0_rgba(227,170,221,0.25)] backdrop-blur-[20px]">
        <DialogHeader className="space-y-3">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-pink-500/20 to-purple-500/20">
              <Flag className="h-6 w-6 text-pink-600 dark:text-pink-400" />
            </div>
            <div>
              <DialogTitle className="text-2xl font-bold">
                Report Post
              </DialogTitle>
              <DialogDescription className="mt-1 text-sm text-muted-foreground">
                Help us keep the community safe by reporting inappropriate
                content
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>
        <div className="space-y-6 py-4">
          <div className="space-y-3">
            <Label className="text-base font-semibold">Select a reason</Label>
            <RadioGroup
              value={selectedType}
              onValueChange={setSelectedType}
              className="grid grid-cols-2 gap-3"
            >
              {REPORT_TYPES.map((type) => {
                const Icon = type.icon;
                const isSelected = selectedType === type.value;
                return (
                  <Label
                    key={type.value}
                    htmlFor={type.value}
                    className={cn(
                      "group relative flex cursor-pointer flex-col items-start gap-2 rounded-xl border-2 p-4",
                      "box-border", // Ensure box-sizing
                      isSelected
                        ? "border-pink-500 bg-gradient-to-br from-pink-50 to-purple-50 dark:from-pink-950/30 dark:to-purple-950/30"
                        : "border-border bg-card"
                    )}
                    style={{
                      // Ensure consistent sizing - no changes on hover
                      minHeight: "72px",
                      boxShadow: "0 1px 2px 0 rgba(0, 0, 0, 0.05)",
                    }}
                  >
                    <div className="flex w-full items-center gap-3">
                      <RadioGroupItem
                        value={type.value}
                        id={type.value}
                        className="mt-0.5 flex-shrink-0"
                      />
                      <Icon
                        className={cn(
                          "h-5 w-5 flex-shrink-0",
                          isSelected ? type.color : "text-muted-foreground"
                        )}
                      />
                      <span
                        className={cn(
                          "flex-1 font-medium",
                          isSelected && "text-pink-700 dark:text-pink-300"
                        )}
                      >
                        {type.label}
                      </span>
                    </div>
                  </Label>
                );
              })}
            </RadioGroup>
          </div>
          <div className="space-y-2">
            <Label htmlFor="reason" className="text-base font-semibold">
              Additional details
              {selectedType === "OTHER" && (
                <span className="ml-2 text-sm font-normal text-destructive">
                  (required)
                </span>
              )}
            </Label>
            <Textarea
              id="reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={
                selectedType === "OTHER"
                  ? "Please provide more details about why you're reporting this post..."
                  : "Add any additional context that might help us review this report (optional)..."
              }
              rows={4}
              className="resize-none border-2 focus:border-pink-400 focus:ring-pink-400/20"
            />
          </div>
        </div>
        <div className="rounded-lg border border-orange-200 bg-orange-50/50 p-3 dark:border-orange-900 dark:bg-orange-950/20">
          <p className="flex items-start gap-2 text-sm text-orange-800 dark:text-orange-200">
            <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
            <span>
              This post will be hidden from your feed immediately after you
              submit the report.
            </span>
          </p>
        </div>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="outline"
            onClick={() => {
              setOpen(false);
              setSelectedType("");
              setReason("");
            }}
            className="rounded-full"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={
              reportMutation.isPending ||
              !selectedType ||
              (selectedType === "OTHER" && !reason.trim())
            }
            className="rounded-full bg-gradient-to-r from-pink-500 to-purple-500 hover:from-pink-600 hover:to-purple-600"
          >
            {reportMutation.isPending ? (
              <>
                <span className="mr-2 inline-block h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                Submitting...
              </>
            ) : (
              <>
                <Flag className="mr-2 h-4 w-4" />
                Submit Report
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
