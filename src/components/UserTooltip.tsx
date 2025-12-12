"use client";

import { useSession } from "@/app/(main)/SessionProvider";
import { FollowerInfo, UserData, UserDataLightweight } from "@/lib/types";
import Link from "next/link";
import { PropsWithChildren } from "react";
import FollowButton from "./FollowButton";
import FollowerCount from "./FollowerCount";
import Linkify from "./Linkify";
import { Badge } from "./ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "./ui/tooltip";
import UserAvatar from "./UserAvatar";

interface UserTooltipProps extends PropsWithChildren {
  user: UserData | UserDataLightweight;
}

export default function UserTooltip({ children, user }: UserTooltipProps) {
  const { user: loggedInUser } = useSession();

  const followerState: FollowerInfo = {
    followers: "_count" in user ? user._count.followers : 0, // Fallback nếu không có _count
    isFollowedByUser: !!user.followers.some(
      ({ followerId }) => followerId === loggedInUser.id
    ),
  };

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>{children}</TooltipTrigger>
        <TooltipContent className="z-50">
          <div className="flex max-w-80 flex-col gap-3 break-words px-1 py-2.5 md:min-w-52">
            <div className="flex items-center justify-between gap-2">
              <Link href={`/users/${user.username}`}>
                <UserAvatar size={70} avatarUrl={user.avatarUrl} />
              </Link>
              {loggedInUser.id !== user.id && (
                <FollowButton userId={user.id} initialState={followerState} />
              )}
            </div>
            <div>
              <Link href={`/users/${user.username}`}>
                <div className="text-lg font-semibold hover:underline">
                  {user.displayName}
                </div>
                <div className="text-muted-foreground">@{user.username}</div>
              </Link>
            </div>
            {user.bio && (
              <Linkify>
                <div className="line-clamp-4 whitespace-pre-line">
                  {user.bio}
                </div>
              </Linkify>
            )}
            {user.interests && user.interests.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {user.interests.slice(0, 3).map((interest) => (
                  <Badge key={interest} variant="secondary" className="text-xs">
                    {interest}
                  </Badge>
                ))}
                {user.interests.length > 3 && (
                  <Badge variant="secondary" className="text-xs">
                    +{user.interests.length - 3}
                  </Badge>
                )}
              </div>
            )}
            <FollowerCount userId={user.id} initialState={followerState} />
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
