import { validateRequest } from "@/auth";
import { Button } from "@/components/ui/button";
import prisma from "@/lib/prisma";
import streamServerClient from "@/lib/stream";
import { Bookmark, Home, Shield } from "lucide-react";
import Link from "next/link";
import MessagesButton from "./MessagesButton";
import NotificationsButton from "./NotificationsButton";

interface MenuBarProps {
  className?: string;
}

export default async function MenuBar({ className }: MenuBarProps) {
  const { user } = await validateRequest();

  if (!user) return null;

  const [unreadNotificationsCount, unreadMessagesCount] = await Promise.all([
    prisma.notification.count({
      where: {
        recipientId: user.id,
        read: false,
      },
    }),
    (async () => {
      try {
        // Ensure user exists in Stream Chat before getting unread count
        await streamServerClient.upsertUser({
          id: user.id,
          username: user.username,
          name: user.displayName,
          image: user.avatarUrl,
        });
        const result = await streamServerClient.getUnreadCount(user.id);
        return result.total_unread_count;
      } catch (error) {
        console.error("Error getting unread count:", error);
        return 0;
      }
    })(),
  ]);

  return (
    <div className={className}>
      <Button
        variant="ghost"
        className="flex items-center justify-start gap-3"
        title="Home"
        asChild
      >
        <Link href="/">
          <Home />
          <span className="hidden lg:inline">Home</span>
        </Link>
      </Button>
      <NotificationsButton
        initialState={{ unreadCount: unreadNotificationsCount }}
      />
      <MessagesButton initialState={{ unreadCount: unreadMessagesCount }} />
      <Button
        variant="ghost"
        className="flex items-center justify-start gap-3"
        title="Bookmarks"
        asChild
      >
        <Link href="/bookmarks">
          <Bookmark />
          <span className="hidden lg:inline">Bookmarks</span>
        </Link>
      </Button>
      <Button
        variant="ghost"
        className="flex items-center justify-start gap-3"
        title="Blocked Users"
        asChild
      >
        <Link href="/blocked">
          <Shield />
          <span className="hidden lg:inline">Blocked</span>
        </Link>
      </Button>
    </div>
  );
}
