"use client";

import useFollowerInfo from "@/hooks/useFollowerInfo";
import { FollowerInfo } from "@/lib/types";
import { formatNumber } from "@/lib/utils";
import Link from "next/link";

interface FollowerCountProps {
  userId: string;
  username: string;
  initialState: FollowerInfo;
  followingCount?: number;
}

export default function FollowerCount({
  userId,
  username,
  initialState,
  followingCount,
}: FollowerCountProps) {
  const { data } = useFollowerInfo(userId, initialState);

  return (
    <div className="flex items-center gap-3">
      <Link href={`/users/${username}/followers`} className="hover:underline">
        <span>
          Followers:{" "}
          <span className="font-semibold">{formatNumber(data.followers)}</span>
        </span>
      </Link>
      {followingCount !== undefined && (
        <Link href={`/users/${username}/following`} className="hover:underline">
          <span>
            Following:{" "}
            <span className="font-semibold">
              {formatNumber(followingCount)}
            </span>
          </span>
        </Link>
      )}
    </div>
  );
}
