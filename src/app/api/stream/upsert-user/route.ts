import { validateRequest } from "@/auth";
import streamServerClient from "@/lib/stream";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { user: loggedInUser } = await validateRequest();

    if (!loggedInUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { userId, username, name, image } = await req.json();

    if (!userId) {
      return NextResponse.json(
        { error: "User ID is required" },
        { status: 400 }
      );
    }

    // Upsert user to Stream Chat
    await streamServerClient.upsertUser({
      id: userId,
      username: username || userId,
      name: name || userId,
      image: image || undefined,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error upserting user to Stream Chat:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
