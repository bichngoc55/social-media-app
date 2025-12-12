"use client";
import { cn } from "@/lib/utils";
import { ShieldOff } from "lucide-react";
import { QueryKey, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/components/ui/use-toast";
import { useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";

interface BlockPostButtonProps {
  postId: string;
}

import kyInstance from "@/lib/ky";

export default function BlockPostButton({ postId }: BlockPostButtonProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const queryKey: QueryKey = ["blocked-post-ids"];
  const [showModal, setShowModal] = useState(false);

  const { mutate, isPending } = useMutation({
    mutationFn: async () => {
      // Call API to block post
      return kyInstance.post(`/api/posts/${postId}/block`).json();
    },
    onMutate: async () => {
      toast({
        title: "Post Blocked",
        description: "We'll show you fewer posts like this.",
      });
      await queryClient.cancelQueries({ queryKey });
      // Optimistically update blockedPostIds in cache
      const previous = queryClient.getQueryData<string[]>(queryKey) || [];
      queryClient.setQueryData<string[]>(queryKey, () => [...previous, postId]);
      return { previous };
    },
    onError: (error, _variables, context) => {
      queryClient.setQueryData(queryKey, context?.previous);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to block post.",
      });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });

  return (
    <>
      <button
        onClick={() => setShowModal(true)}
        disabled={isPending}
        title="Block this post"
        className="btn-glow flex items-center gap-2 rounded-full px-3 py-2 transition-all duration-300 hover:bg-red-500/10"
      >
        <ShieldOff
          className={cn(
            "size-5 text-muted-foreground transition-all duration-300 hover:text-red-500",
            isPending && "animate-pulse opacity-50"
          )}
        />
      </button>
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="max-w-sm">
          <div className="space-y-4 text-center">
            <ShieldOff className="mx-auto mb-2 size-8 text-red-500" />
            <h2 className="text-lg font-semibold">Block similar content?</h2>
            <p className="text-sm text-muted-foreground">
              Are you sure you want to block this post and see fewer posts with
              similar topics and content?
            </p>
            <div className="mt-4 flex justify-center gap-3">
              <button
                className="btn-glow rounded-full bg-red-500 px-4 py-2 text-white hover:bg-red-600"
                onClick={() => {
                  setShowModal(false);
                  mutate();
                }}
                disabled={isPending}
              >
                Yes, block similar
              </button>
              <button
                className="rounded-full bg-muted px-4 py-2 text-muted-foreground hover:bg-gray-200"
                onClick={() => setShowModal(false)}
                disabled={isPending}
              >
                Cancel
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
