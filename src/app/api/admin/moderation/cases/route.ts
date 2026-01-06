import { requireAdmin } from "@/lib/admin";
import prisma from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";

export async function GET(req: NextRequest) {
  try {
    await requireAdmin();

    const { searchParams } = new URL(req.url);

    const page = Math.max(parseInt(searchParams.get("page") || "1"), 1);
    const limit = Math.max(parseInt(searchParams.get("limit") || "20"), 1);

    const status = searchParams.get("status");
    const severity = searchParams.get("severity");
    const source = searchParams.get("source");
    const policyArea = searchParams.get("policyArea");
    const assignedTo = searchParams.get("assignedTo");
    const sortBy = searchParams.get("sortBy") || "priorityScore"; // priorityScore | slaDueAt | createdAt

    const skip = (page - 1) * limit;

    const where: Prisma.ModerationCaseWhereInput = {
      ...(status && { status: status as any }),
      ...(severity && { severity: severity as any }),
      ...(source && { source: source as any }),
      ...(policyArea && { policyAreaPredicted: policyArea as any }),
      ...(assignedTo && { assignedTo }),
    };

    const orderBy: Prisma.ModerationCaseOrderByWithRelationInput =
      sortBy === "slaDueAt"
        ? { slaDueAt: "asc" }
        : sortBy === "createdAt"
          ? { createdAt: "desc" }
          : { priorityScore: "desc" };

    const [cases, total] = await Promise.all([
      prisma.moderationCase.findMany({
        where,
        orderBy,
        skip,
        take: limit,
        include: {
          post: {
            select: {
              id: true,
              content: true,
              createdAt: true,
              harmful: true,
              harmfulTypes: true,
              user: {
                select: {
                  id: true,
                  username: true,
                  displayName: true,
                  avatarUrl: true,
                },
              },
              attachments: {
                select: {
                  id: true,
                  url: true,
                  type: true,
                },
              },
            },
          },
          user: {
            select: {
              id: true,
              username: true,
              displayName: true,
              avatarUrl: true,
            },
          },
          assignedAdmin: {
            select: {
              id: true,
              username: true,
              displayName: true,
            },
          },
          decisionAdmin: {
            select: {
              id: true,
              username: true,
              displayName: true,
            },
          },
        },
      }),
      prisma.moderationCase.count({ where }),
    ]);

    return NextResponse.json({
      cases,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Error fetching moderation cases:", error);

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Internal server error",
        details:
          process.env.NODE_ENV === "development" && error instanceof Error
            ? error.stack
            : undefined,
      },
      {
        status:
          error instanceof Error && error.message === "Unauthorized"
            ? 401
            : 500,
      }
    );
  }
}
