import dynamic from "next/dynamic";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

// Lazy load heavy components để giảm initial bundle size
const PostEditor = dynamic(
  () => import("@/components/posts/editor/PostEditor"),
  {
    ssr: false,
    loading: () => <div className="h-32 animate-pulse rounded-2xl bg-muted" />,
  }
);

const TrendsSidebar = dynamic(() => import("@/components/TrendsSidebar"), {
  ssr: false,
});

// Lazy load feeds để giảm bundle size
const ForYouFeed = dynamic(() => import("./ForYouFeed"), {
  loading: () => <div className="space-y-5" />,
});

const FollowingFeed = dynamic(() => import("./FollowingFeed"), {
  loading: () => <div className="space-y-5" />,
});

export default function Home() {
  return (
    <main className="flex w-full min-w-0 gap-5">
      <div className="w-full min-w-0 space-y-5">
        <PostEditor />
        <Tabs defaultValue="for-you">
          <TabsList className="card-glass">
            <TabsTrigger value="for-you">For you</TabsTrigger>
            <TabsTrigger value="following">Following</TabsTrigger>
          </TabsList>
          <TabsContent value="for-you">
            <ForYouFeed />
          </TabsContent>
          <TabsContent value="following">
            <FollowingFeed />
          </TabsContent>
        </Tabs>
      </div>
      <TrendsSidebar />
    </main>
  );
}
