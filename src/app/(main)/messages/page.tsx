import dynamic from "next/dynamic";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Messages",
};

// Lazy load Chat component - stream-chat rất nặng (5000+ modules)
const Chat = dynamic(() => import("./Chat"), {
  ssr: false,
  loading: () => (
    <div className="flex h-screen items-center justify-center">
      <div className="animate-pulse text-muted-foreground">
        Loading messages...
      </div>
    </div>
  ),
});

export default function Page() {
  return <Chat />;
}
