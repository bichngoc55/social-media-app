import { validateRequest } from "@/auth";
import BlockReportButtons from "@/components/BlockReportButtons";
import FollowButton from "@/components/FollowButton";
import FollowerCount from "@/components/FollowerCount";
import Linkify from "@/components/Linkify";
import TrendsSidebarClient from "@/components/TrendsSidebarClient";
import UserAvatar from "@/components/UserAvatar";
import UserLocation from "@/components/UserLocation";
import { Badge } from "@/components/ui/badge";
import prisma from "@/lib/prisma";
import { FollowerInfo, getUserDataSelect, UserData } from "@/lib/types";
import { formatNumber } from "@/lib/utils";
import { formatDate } from "date-fns";
import { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";
import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import EditProfileButton from "./EditProfileButton";
import UserPosts from "./UserPosts";
import WarnedPosts from "./WarnedPosts";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface PageProps {
  params: Promise<{ username: string }>;
}

const getUser = cache(
  async (username: string, loggedInUserId: string): Promise<UserData> => {
    const user = await prisma.user.findFirst({
      where: {
        username: {
          equals: username,
          mode: "insensitive",
        },
      },
      select: getUserDataSelect(loggedInUserId, false), // Full mode - need _count for profile
    });

    if (!user) notFound();

    return user as UserData;
  }
);

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { username } = await params;
  const { user: loggedInUser } = await validateRequest();

  if (!loggedInUser) return {};

  const user = await getUser(username, loggedInUser.id);

  return {
    title: `${user.displayName} (@${user.username})`,
  };
}

export default async function Page({ params }: PageProps) {
  const { username } = await params;
  const { user: loggedInUser } = await validateRequest();

  if (!loggedInUser) {
    return (
      <p className="text-destructive">
        You&apos;re not authorized to view this page.
      </p>
    );
  }

  const user = await getUser(username, loggedInUser.id);

  return (
    <main className="flex w-full min-w-0 gap-5">
      <div className="w-full min-w-0 space-y-5">
        <UserProfile user={user} loggedInUserId={loggedInUser.id} />
        {user.id === loggedInUser.id ? (
          <Tabs defaultValue="all-posts" className="space-y-5">
            <TabsList className="card-glass w-full">
              <TabsTrigger value="all-posts" className="flex-1">
                Tất cả bài viết
              </TabsTrigger>
              <TabsTrigger value="warned-posts" className="flex-1">
                <AlertTriangle className="h-4 w-4 mr-2" />
                Bài viết bị cảnh báo
              </TabsTrigger>
            </TabsList>
            <TabsContent value="all-posts">
              <div className="rounded-2xl bg-card p-5 shadow-sm">
                <h2 className="text-center text-2xl font-bold">
                  {user.displayName}&apos;s posts
                </h2>
              </div>
              <UserPosts userId={user.id} />
            </TabsContent>
            <TabsContent value="warned-posts">
              <div className="rounded-2xl bg-card p-5 shadow-sm">
                <h2 className="text-center text-2xl font-bold flex items-center justify-center gap-2">
                  <AlertTriangle className="h-6 w-6 text-orange-500" />
                  Bài viết bị cảnh báo
                </h2>
              </div>
              <WarnedPosts userId={user.id} />
            </TabsContent>
          </Tabs>
        ) : (
          <>
        <div className="rounded-2xl bg-card p-5 shadow-sm">
          <h2 className="text-center text-2xl font-bold">
            {user.displayName}&apos;s posts
          </h2>
        </div>
        <UserPosts userId={user.id} />
          </>
        )}
      </div>
      <TrendsSidebarClient />
    </main>
  );
}

interface UserProfileProps {
  user: UserData;
  loggedInUserId: string;
}

async function UserProfile({ user, loggedInUserId }: UserProfileProps) {
  const followerInfo: FollowerInfo = {
    followers: user._count.followers,
    isFollowedByUser: user.followers.some(
      ({ followerId }) => followerId === loggedInUserId
    ),
  };

  return (
    <div className="h-fit w-full space-y-5 rounded-2xl bg-card p-5 shadow-sm">
      <UserAvatar
        avatarUrl={user.avatarUrl}
        size={250}
        className="mx-auto size-full max-h-60 max-w-60 rounded-full"
      />
      <div className="flex flex-wrap gap-3 sm:flex-nowrap">
        <div className="me-auto space-y-3">
          <div>
            <h1 className="text-3xl font-bold">{user.displayName}</h1>
            <div className="text-muted-foreground">@{user.username}</div>
          </div>
          <div>Member since {formatDate(user.createdAt, "MMM d, yyyy")}</div>
          <UserLocation
            countryCode={user.countryCode}
            provinceCode={user.provinceCode}
            districtCode={user.districtCode}
          />
          <div className="flex items-center gap-3">
            <span>
              Posts:{" "}
              <span className="font-semibold">
                {formatNumber(user._count.posts)}
              </span>
            </span>
            <FollowerCount
              userId={user.id}
              username={user.username}
              initialState={followerInfo}
              followingCount={user._count.following}
            />
          </div>
        </div>
        {user.id === loggedInUserId ? (
          <div className="flex flex-col gap-2">
          <EditProfileButton user={user} />
            <Link href="/warnings">
              <Button variant="outline" className="w-full">
                <AlertTriangle className="h-4 w-4 mr-2" />
                Xem cảnh báo
              </Button>
            </Link>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <FollowButton userId={user.id} initialState={followerInfo} />
            <BlockReportButtons
              userId={user.id}
              username={user.username}
              isBlocked={user.blockedByUsers.length > 0}
            />
          </div>
        )}
      </div>
      {user.bio && (
        <>
          <hr />
          <Linkify>
            <div className="overflow-hidden whitespace-pre-line break-words">
              {user.bio}
            </div>
          </Linkify>
        </>
      )}
      {user.interests && user.interests.length > 0 && (
        <>
          <hr />
          <div className="space-y-2">
            <div className="text-sm font-semibold text-muted-foreground">
              Interests
            </div>
            <div className="flex flex-wrap gap-2">
              {user.interests.map((interest) => (
                <Badge key={interest} variant="secondary">
                  {interest}
                </Badge>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
