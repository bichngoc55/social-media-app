import { useEffect, useRef } from "react";
import { io, Socket } from "socket.io-client";
import { useSession } from "@/app/(main)/SessionProvider";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

export function useSocket() {
  const { user } = useSession();
  const queryClient = useQueryClient();
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    if (!user) return;

    socketRef.current = io(
      process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"
    );
    const socket = socketRef.current;

    socket.emit("join", user.id);

    socket.on("notification", (notification) => {
      queryClient.invalidateQueries({
        queryKey: ["unread-notification-count"],
      });
      queryClient.invalidateQueries({ queryKey: ["notifications"] });

      if (notification.issuerId === user.id) return;

      const { type, issuer } = notification;
      const messages = {
        LIKE: `${issuer.displayName} liked your post`,
        FOLLOW: `${issuer.displayName} started following you`,
        COMMENT: `${issuer.displayName} commented on your post`,
        MENTION: `${issuer.displayName} mentioned you in a post`,
        MESSAGE: `${issuer.displayName} sent you a message`,
      };

      const message = messages[type as keyof typeof messages];
      if (message) {
        toast.success(message);
      }
    });

    return () => {
      socket.disconnect();
    };
  }, [user, queryClient]);

  return socketRef.current;
}
