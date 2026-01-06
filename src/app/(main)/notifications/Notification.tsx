import UserAvatar from "@/components/UserAvatar";
import { NotificationData } from "@/lib/types";
import { cn } from "@/lib/utils";
import { NotificationType } from "@prisma/client";
import {
  Heart,
  MessageCircle,
  User2,
  UserPlus,
  Tag,
  MessageSquare,
  AtSign,
  Reply,
  CheckCircle,
  Shield,
  AlertCircle,
  AlertTriangle,
  Ban,
} from "lucide-react";

import Link from "next/link";

interface NotificationProps {
  notification: NotificationData;
}

export default function Notification({ notification }: NotificationProps) {
  const notificationTypeMap = {
    FOLLOW: {
      message: "followed you",
      icon: <User2 className="size-7 text-primary" />,
      href: `/users/${notification.issuer.username}`,
    },
    COMMENT: {
      message: "commented on your post",
      icon: <MessageCircle className="size-7 fill-primary text-primary" />,
      href: `/posts/${notification.postId}`,
    },
    LIKE: {
      message: "liked your post",
      icon: <Heart className="size-7 fill-red-500 text-red-500" />,
      href: `/posts/${notification.postId}`,
    },
    TAG: {
      message: `${notification.issuer.displayName} tagged you in a post`,
      icon: <Tag className="size-7 text-blue-500" />,
      href: `/posts/${notification.postId}`,
    },
    TAG_REQUEST: {
      message: `${notification.issuer.displayName} wants to tag you in a post`,
      icon: <UserPlus className="size-7 text-orange-500" />,
      href: `/posts/${notification.postId}`,
    },
    MENTION: {
      message: "mentioned you in a post",
      icon: <AtSign className="size-7 text-primary" />,
      href: `/posts/${notification.postId}`,
    },
    MESSAGE: {
      message: "sent you a message",
      icon: <MessageSquare className="size-7 text-blue-500" />,
      href: `/messages`,
    },
    REPLY: {
      message: "replied to your comment",
      icon: <Reply className="size-7 text-purple-500" />,
      href: `/posts/${notification.postId}`,
    },
    APPEAL_RESPONSE: {
      message: "responded to your appeal",
      icon: <CheckCircle className="size-7 text-green-500" />,
      href: `/posts/${notification.postId || ""}`,
    },
    RESOLVED_REPORT: {
      message: "resolved your report",
      icon: <Shield className="size-7 text-blue-500" />,
      href: `/posts/${notification.postId || ""}`,
    },
    VIOLATE_COUNTS_RESPONSE: {
      message: "responded to your violation report",
      icon: <AlertCircle className="size-7 text-orange-500" />,
      href: `/posts/${notification.postId || ""}`,
    },
    WARNING: {
      message: "sent you a warning",
      icon: (
        <AlertTriangle className="size-7 fill-orange-500 text-orange-500" />
      ),
      href: `/warnings`,
    },
    BAN_NOTICE: {
      message: "banned your account",
      icon: <Ban className="size-7 fill-red-500 text-red-500" />,
      href: `/warnings`,
    },
  } as Record<
    NotificationType,
    { message: string; icon: JSX.Element; href: string }
  >;

  const { message, icon, href } = notificationTypeMap[notification.type];
  const isAdmin = notification.issuer.username === "sam.white";

  // Check if notification has customMessage (for warnings and bans)
  const customMessage = (notification as any).customMessage;
  const showCustomMessage =
    customMessage &&
    (notification.type === "WARNING" || notification.type === "BAN_NOTICE");

  return (
    <Link href={href} className="block">
      <article
        className={cn(
          "flex gap-3 rounded-2xl bg-card p-5 shadow-sm transition-colors hover:bg-card/70",
          !notification.read && "bg-primary/10",
          (notification.type === "WARNING" ||
            notification.type === "BAN_NOTICE") &&
            "border-l-4 border-orange-500"
        )}
      >
        <div className="my-1">{icon}</div>
        <div className="flex-1 space-y-2">
          <div className="inline-flex gap-2">
            <UserAvatar avatarUrl={notification.issuer.avatarUrl} size={33} />
            <div>
              <span className="font-bold">
                {isAdmin ? "Admin" : notification.issuer.displayName}
              </span>{" "}
              <span>{message}</span>
            </div>
          </div>
          {showCustomMessage && (
            <div className="ml-11 whitespace-pre-line rounded-lg bg-muted/50 p-3 text-sm">
              {customMessage}
            </div>
          )}
        </div>
      </article>
    </Link>
  );
}
