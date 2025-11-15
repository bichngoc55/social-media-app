import dynamic from "next/dynamic";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Messages",
};

// Lazy load Chat component - stream-chat rất nặng (5000+ modules)
const Chat = dynamic(() => import("./Chat"), {
  ssr: false,
  loading: () => (
    <div
      className="flex w-full min-w-0 items-center justify-center"
      style={{ minHeight: "calc(100vh - 250px)" }}
    >
      <div className="flex flex-col items-center gap-3">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        <p className="text-muted-foreground">Loading messages...</p>
      </div>
    </div>
  ),
});

export default function Page() {
  return (
    <div className="flex w-full min-w-0">
      <Chat />
    </div>
  );
}
