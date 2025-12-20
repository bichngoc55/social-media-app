import { validateRequest } from "@/auth";
import FollowButton from "@/components/FollowButton";
import UserAvatar from "@/components/UserAvatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import prisma from "@/lib/prisma";
import { formatNumber } from "@/lib/utils";
import { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import FollowingListClient from "./FollowingListClient";

interface PageProps {
  params: Promise<{ username: string }>;
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { username } = await params;
  const { user: loggedInUser } = await validateRequest();

  if (!loggedInUser) return {};

  const user = await prisma.user.findFirst({
    where: {
      username: {
        equals: username,
        mode: "insensitive",
      },
    },
    select: { displayName: true, username: true },
  });

  if (!user) return {};

  return {
    title: `Following - ${user.displayName} (@${user.username})`,
  };
}

export default async function FollowingPage({ params }: PageProps) {
  const { username } = await params;
  const { user: loggedInUser } = await validateRequest();

  if (!loggedInUser) {
    return (
      <p className="text-destructive">
        You&apos;re not authorized to view this page.
      </p>
    );
  }

  const user = await prisma.user.findFirst({
    where: {
      username: {
        equals: username,
        mode: "insensitive",
      },
    },
    select: {
      id: true,
      username: true,
      displayName: true,
      avatarUrl: true,
      _count: {
        select: {
          following: true,
        },
      },
    },
  });

  if (!user) notFound();

  return (
    <main className="flex w-full min-w-0 gap-5">
      <div className="w-full min-w-0 space-y-5">
        <Card className="card-glass">
          <CardContent className="p-5">
            <div className="mb-4 flex items-center gap-3">
              <Link
                href={`/users/${user.username}`}
                className="text-muted-foreground hover:text-foreground"
              >
                ← Back to profile
              </Link>
            </div>
            <div className="flex items-center gap-3">
              <UserAvatar
                avatarUrl={user.avatarUrl}
                size={60}
                className="rounded-full"
              />
              <div>
                <h1 className="text-2xl font-bold">{user.displayName}</h1>
                <p className="text-muted-foreground">@{user.username}</p>
              </div>
            </div>
            <div className="mt-4 text-lg font-semibold">
              {formatNumber(user._count.following)} Following
            </div>
          </CardContent>
        </Card>
        <FollowingListClient username={username} />
      </div>
    </main>
  );
}
