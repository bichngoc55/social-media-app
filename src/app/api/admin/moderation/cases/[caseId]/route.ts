import { requireAdmin } from "@/lib/admin";
import prisma from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import {
  ModerationDecision,
  ModerationStatus,
  ModerationPolicyArea,
  UserRole,
} from "@prisma/client";
import crypto from "crypto";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ caseId: string }> }
) {
  try {
    await requireAdmin();
    const { caseId } = await params;

    const case_ = await prisma.moderationCase.findUnique({
      where: { id: caseId },
      include: {
        post: {
          include: {
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
        supervisor: {
          select: {
            id: true,
            username: true,
            displayName: true,
          },
        },
        auditTrail: {
          orderBy: { createdAt: "desc" },
          include: {
            case: {
              select: {
                id: true,
                status: true,
              },
            },
          },
        },
      },
    });

    if (!case_) {
      return NextResponse.json(
        { error: "Moderation case not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ case: case_ });
  } catch (error) {
    console.error("Error fetching moderation case:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Internal server error",
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

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ caseId: string }> }
) {
  try {
    const admin = await requireAdmin();
    const { caseId } = await params;

    const body = await req.json();
    const {
      status,
      decision,
      policyArea,
      reasonCode,
      adminNotes,
      assignedTo,
      supervisorApproved,
    } = body;

    // Handle assignment - if assignedTo is "current", set to current admin
    let finalAssignedTo = assignedTo;
    if (assignedTo === "current" || assignedTo === admin.id) {
      finalAssignedTo = admin.id;
    } else if (assignedTo === null || assignedTo === "") {
      finalAssignedTo = null;
    }

    // Get current case state
    const currentCase = await prisma.moderationCase.findUnique({
      where: { id: caseId },
    });

    if (!currentCase) {
      return NextResponse.json(
        { error: "Moderation case not found" },
        { status: 404 }
      );
    }

    // Prepare update data
    const updateData: any = {};
    const auditLogs: any[] = [];

    // Handle status change
    if (status && status !== currentCase.status) {
      updateData.status = status;
      auditLogs.push({
        action: "STATUS_CHANGED",
        previousState: { status: currentCase.status },
        newState: { status },
        reason: `Status changed from ${currentCase.status} to ${status}`,
      });
    }

    // Handle assignment
    if (assignedTo !== undefined) {
      if (finalAssignedTo && finalAssignedTo !== currentCase.assignedTo) {
        updateData.assignedTo = finalAssignedTo;
        if (
          currentCase.status === "QUEUED" ||
          currentCase.status === "DETECTED"
        ) {
          updateData.status = ModerationStatus.IN_REVIEW;
        }
        auditLogs.push({
          action: "CASE_ASSIGNED",
          previousState: {
            assignedTo: currentCase.assignedTo,
            status: currentCase.status,
          },
          newState: {
            assignedTo: finalAssignedTo,
            status: updateData.status || currentCase.status,
          },
          reason: `Case assigned to admin`,
        });
      } else if (!finalAssignedTo && currentCase.assignedTo) {
        updateData.assignedTo = null;
        if (currentCase.status === "IN_REVIEW") {
          updateData.status = ModerationStatus.QUEUED;
        }
        auditLogs.push({
          action: "CASE_UNASSIGNED",
          previousState: {
            assignedTo: currentCase.assignedTo,
            status: currentCase.status,
          },
          newState: {
            assignedTo: null,
            status: updateData.status || currentCase.status,
          },
          reason: `Case unassigned`,
        });
      }
    }

    // Handle decision
    if (decision) {
      if (!policyArea) {
        return NextResponse.json(
          { error: "Policy area is required when making a decision" },
          { status: 400 }
        );
      }

      updateData.decision = decision;
      updateData.decisionAt = new Date();
      updateData.decisionBy = admin.id;
      updateData.policyArea = policyArea;
      updateData.reasonCode = reasonCode || null;
      updateData.adminNotes = adminNotes || null;

      // Determine new status based on decision
      let newStatus: ModerationStatus;

      switch (decision) {
        case ModerationDecision.CONFIRM_VIOLATION:
          // Always confirm and delete post (no supervisor approval needed)
          newStatus = ModerationStatus.CONFIRMED;
          break;
        case ModerationDecision.RESTORE:
          newStatus = ModerationStatus.RESTORED;
          // Remove blur from post
          if (currentCase.postId) {
            await prisma.post.update({
              where: { id: currentCase.postId },
              data: { harmful: false },
            });
          }
          break;
        case ModerationDecision.DISMISS:
          newStatus = ModerationStatus.DISMISSED;
          break;
        case ModerationDecision.NEED_MORE_CONTEXT:
          newStatus = ModerationStatus.IN_REVIEW;
          break;
        default:
          newStatus = currentCase.status;
      }

      updateData.status = newStatus;

      auditLogs.push({
        action: "DECISION_MADE",
        previousState: {
          status: currentCase.status,
          decision: currentCase.decision,
        },
        newState: {
          status: newStatus,
          decision,
          policyArea,
          reasonCode,
        },
        reason: `Decision: ${decision}`,
        policyArea,
      });

      // If CONFIRM_VIOLATION, delete post immediately
      if (
        decision === ModerationDecision.CONFIRM_VIOLATION &&
        currentCase.postId
      ) {
        try {
          await prisma.post.delete({
            where: { id: currentCase.postId },
          });
        } catch (error) {
          console.error("Error deleting post:", error);
        }
      }
    }

    // Supervisor approval disabled - no SUPERVISOR role in system
    // All decisions are made directly by admins
    // if (
    //   supervisorApproved !== undefined &&
    //   admin.role === UserRole.SUPERVISOR
    // ) {
    //   ...
    // }

    // Update case
    const updatedCase = await prisma.moderationCase.update({
      where: { id: caseId },
      data: updateData,
      include: {
        post: {
          include: {
            user: {
              select: {
                id: true,
                username: true,
                displayName: true,
                avatarUrl: true,
              },
            },
          },
        },
        user: {
          select: {
            id: true,
            username: true,
            displayName: true,
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
    });

    // Create audit logs
    for (const log of auditLogs) {
      const evidenceHash = currentCase.evidence
        ? crypto
            .createHash("sha256")
            .update(JSON.stringify(currentCase.evidence))
            .digest("hex")
        : null;

      await prisma.moderationAuditLog.create({
        data: {
          caseId,
          actorId: admin.id,
          actorRole: admin.role,
          action: log.action,
          previousState: log.previousState as any,
          newState: log.newState as any,
          reason: log.reason,
          policyArea: log.policyArea,
          modelVersion: currentCase.modelVersion,
          confidence: currentCase.confidence,
          evidenceHash,
        },
      });
    }

    return NextResponse.json({ case: updatedCase });
  } catch (error) {
    console.error("Error updating moderation case:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Internal server error",
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
