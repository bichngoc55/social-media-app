"use client";

import { useSocket } from "@/hooks/useSocket";

interface SocketProviderProps {
  children: React.ReactNode;
}

export default function SocketProvider({ children }: SocketProviderProps) {
  useSocket();
  return <>{children}</>;
}
