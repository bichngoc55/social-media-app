import { requireAdmin } from "@/lib/admin";
import prisma from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";

export async function GET(req: NextRequest) {
  try {
    const admin = await requireAdmin();

    // Parse search params first (before any Prisma checks)
    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
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

    // Debug: Check if ModerationCase exists in Prisma client
    if (!prisma.moderationCase) {
      const availableModels = Object.keys(prisma).filter(
        (key) => !key.startsWith("_") && !key.startsWith("$")
      );
      console.error("Prisma client debug:", {
        hasModerationCase: !!prisma.moderationCase,
        availableModels,
        prismaType: typeof prisma,
      });

      // Try to reload Prisma client
      if (
        process.env.NODE_ENV !== "production" &&
        typeof globalThis !== "undefined"
      ) {
        delete (globalThis as any).prismaGlobal;
        const { default: newPrisma } = await import("@/lib/prisma");
        if (newPrisma.moderationCase) {
          // Use the new instance
          const [cases, total] = await Promise.all([
            newPrisma.moderationCase.findMany({
              where,
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
                _count: {
                  select: {
                    auditTrail: true,
                  },
                },
              },
              orderBy,
              skip,
              take: limit,
            }),
            newPrisma.moderationCase.count({ where }),
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
        }
      }

      return NextResponse.json(
        {
          error: "ModerationCase model not found in Prisma client",
          debug: {
            availableModels,
            message:
              "Please run 'npx prisma generate' and restart the dev server",
          },
        },
        { status: 503 }
      );
    }

    const [cases, total] = await Promise.all([
      prisma.moderationCase.findMany({
        where,
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
          _count: {
            select: {
              auditTrail: true,
            },
          },
        },
        orderBy,
        skip,
        take: limit,
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
    console.error("Error details:", {
      message: error instanceof Error ? error.message : "Unknown error",
      stack: error instanceof Error ? error.stack : undefined,
      name: error instanceof Error ? error.name : undefined,
    });
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Internal server error",
        details:
          process.env.NODE_ENV === "development"
            ? error instanceof Error
              ? error.stack
              : String(error)
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
