import { validateRequest } from "@/auth";
import streamServerClient from "@/lib/stream";
import { MessageCountInfo } from "@/lib/types";

export async function GET() {
  try {
    const { user } = await validateRequest();

    if (!user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
      // Ensure user exists in Stream Chat before getting unread count
      await streamServerClient.upsertUser({
        id: user.id,
        username: user.username,
        name: user.displayName,
        image: user.avatarUrl,
      });
      
      const { total_unread_count } = await streamServerClient.getUnreadCount(
        user.id,
      );

      const data: MessageCountInfo = {
        unreadCount: total_unread_count,
      };

      return Response.json(data);
    } catch (streamError) {
      console.error("Stream Chat error:", streamError);
      // Return 0 unread count if Stream Chat fails
      const data: MessageCountInfo = {
        unreadCount: 0,
      };
      return Response.json(data);
    }
  } catch (error) {
    console.error(error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
