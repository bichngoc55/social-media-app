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
  } as Record<
    NotificationType,
    { message: string; icon: JSX.Element; href: string }
  >;

  const { message, icon, href } = notificationTypeMap[notification.type];

  return (
    <Link href={href} className="block">
      <article
        className={cn(
          "flex gap-3 rounded-2xl bg-card p-5 shadow-sm transition-colors hover:bg-card/70",
          !notification.read && "bg-primary/10"
        )}
      >
        <div className="my-1">{icon}</div>
        <div className="inline-flex gap-2 space-y-3">
          <UserAvatar avatarUrl={notification.issuer.avatarUrl} size={33} />
          <div className="mb-3">
            <span className="font-bold">{notification.issuer.displayName}</span>{" "}
            <span>{message}</span>
          </div>
        </div>
      </article>
    </Link>
  );
}
