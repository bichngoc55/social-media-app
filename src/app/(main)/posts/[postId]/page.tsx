import { validateRequest } from "@/auth";
import FollowButton from "@/components/FollowButton";
import Linkify from "@/components/Linkify";
import Post from "@/components/posts/Post";
import UserAvatar from "@/components/UserAvatar";
import UserTooltip from "@/components/UserTooltip";
import prisma from "@/lib/prisma";
import { getPostDataInclude, PostData, UserData } from "@/lib/types";
import { cn } from "@/lib/utils";
import { AlertCircle, CheckCircle, Loader2 } from "lucide-react";
import { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache, Suspense } from "react";

interface PageProps {
  params: Promise<{ postId: string }>;
}
function AppealStatusBanner({ appeal }: { appeal: any }) {
  const isApproved = appeal.status === "APPROVED";

  return (
    <div
      className={cn(
        "flex flex-col gap-1 rounded-lg border-l-2 p-2 text-xs",
        isApproved
          ? "border-green-500 bg-green-500/10 text-green-700 dark:text-green-400"
          : "border-destructive bg-destructive/10 text-destructive"
      )}
    >
      <div className="flex items-center gap-1 font-semibold">
        {isApproved ? (
          <CheckCircle className="size-4" />
        ) : (
          <AlertCircle className="size-4" />
        )}
        <span>Appeal {isApproved ? "Approved" : "Rejected"}</span>
      </div>

      <p className="leading-snug">
        {isApproved
          ? "Post restored and no longer flagged."
          : "Appeal reviewed. Decision upheld."}
      </p>

      {appeal.adminNotes && (
        <div className="mt-0.5 italic opacity-80">
          <span className="font-medium not-italic">Reason:</span>{" "}
          {appeal.adminNotes}
        </div>
      )}
    </div>
  );
}

const getPost = cache(
  async (postId: string, loggedInUserId: string): Promise<PostData> => {
    const post = await prisma.post.findUnique({
      where: {
        id: postId,
      },
      include: getPostDataInclude(loggedInUserId, false),
    });

    if (!post) notFound();

    return post as unknown as PostData;
  }
);

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { postId } = await params;
  const { user } = await validateRequest();

  if (!user) return {};

  const post = await getPost(postId, user.id);

  return {
    title: `${post.user.displayName}: ${post.content.slice(0, 50)}...`,
  };
}

export default async function Page({ params }: PageProps) {
  const { postId } = await params;
  const { user } = await validateRequest();

  if (!user) {
    return (
      <p className="text-destructive">
        You&apos;re not authorized to view this page.
      </p>
    );
  }

  const [post, appeal] = await Promise.all([
    getPost(postId, user.id),
    prisma.appealUserReport.findFirst({
      where: {
        postId: postId,
        userId: user.id,
      },
      orderBy: { createdAt: "desc" },
    }),
  ]);
  return (
    <main className="flex w-full min-w-0 gap-5">
      <div className="w-full min-w-0 space-y-5">
        {appeal &&
          (appeal.status === "APPROVED" || appeal.status === "REJECTED") && (
            <AppealStatusBanner appeal={appeal} />
          )}
        <Post post={post} />
      </div>
      <div className="sticky top-[5.25rem] hidden h-fit w-80 flex-none lg:block">
        <Suspense fallback={<Loader2 className="mx-auto animate-spin" />}>
          <UserInfoSidebar user={post.user} />
        </Suspense>
      </div>
    </main>
  );
}

interface UserInfoSidebarProps {
  user: UserData;
}

async function UserInfoSidebar({ user }: UserInfoSidebarProps) {
  const { user: loggedInUser } = await validateRequest();

  if (!loggedInUser) return null;

  return (
    <div className="space-y-5 rounded-2xl bg-card p-5 shadow-sm">
      <div className="text-xl font-bold">About this user</div>
      <UserTooltip user={user}>
        <Link
          href={`/users/${user.username}`}
          className="flex items-center gap-3"
        >
          <UserAvatar avatarUrl={user.avatarUrl} className="flex-none" />
          <div>
            <p className="line-clamp-1 break-all font-semibold hover:underline">
              {user.displayName}
            </p>
            <p className="line-clamp-1 break-all text-muted-foreground">
              @{user.username}
            </p>
          </div>
        </Link>
      </UserTooltip>
      <Linkify>
        <div className="line-clamp-6 whitespace-pre-line break-words text-muted-foreground">
          {user.bio}
        </div>
      </Linkify>
      {user.id !== loggedInUser.id && (
        <FollowButton
          userId={user.id}
          initialState={{
            followers: user._count.followers,
            isFollowedByUser: user.followers.some(
              ({ followerId }) => followerId === loggedInUser.id
            ),
          }}
        />
      )}
    </div>
  );
}
