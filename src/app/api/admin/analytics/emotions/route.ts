import { requireAdmin } from "@/lib/admin";
import prisma from "@/lib/prisma";
import { Prisma, EMOTION } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  try {
    await requireAdmin();

    const { searchParams } = new URL(req.url);
    const month = searchParams.get("month");
    const year = searchParams.get("year");

    // Build date filter
    const currentYear = new Date().getFullYear();
    const minYear = currentYear - 100; // Allow up to 100 years in the past
    const maxYear = currentYear + 10; // Allow up to 10 years in the future

    let dateFilter: { gte?: Date; lte?: Date } = {};
    if (year) {
      const yearNum = parseInt(year);
      if (isNaN(yearNum) || yearNum < minYear || yearNum > maxYear) {
        return NextResponse.json(
          {
            error: `Invalid year parameter. Year must be between ${minYear} and ${maxYear}`,
          },
          { status: 400 }
        );
      }

      if (month) {
        const monthNum = parseInt(month);
        if (isNaN(monthNum) || monthNum < 1 || monthNum > 12) {
          return NextResponse.json(
            { error: "Invalid month parameter (must be 1-12)" },
            { status: 400 }
          );
        }

        // Filter by specific month and year
        const startDate = new Date(yearNum, monthNum - 1, 1);
        const endDate = new Date(yearNum, monthNum, 0, 23, 59, 59, 999);
        dateFilter = {
          gte: startDate,
          lte: endDate,
        };
      } else {
        // Filter by entire year
        const startDate = new Date(yearNum, 0, 1);
        const endDate = new Date(yearNum, 11, 31, 23, 59, 59, 999);
        dateFilter = {
          gte: startDate,
          lte: endDate,
        };
      }
    } else if (month) {
      // If only month is provided without year, use current year
      const currentYear = new Date().getFullYear();
      const monthNum = parseInt(month);
      if (isNaN(monthNum) || monthNum < 1 || monthNum > 12) {
        return NextResponse.json(
          { error: "Invalid month parameter (must be 1-12)" },
          { status: 400 }
        );
      }
      const startDate = new Date(currentYear, monthNum - 1, 1);
      const endDate = new Date(currentYear, monthNum, 0, 23, 59, 59, 999);
      dateFilter = {
        gte: startDate,
        lte: endDate,
      };
    }

    // Build raw query with dynamic date filter
    let query = Prisma.sql`
      SELECT emotions as emotion, COUNT(*)::bigint as count
      FROM "posts"
      WHERE emotions IS NOT NULL
    `;

    if (dateFilter.gte && dateFilter.lte) {
      query = Prisma.sql`
        SELECT emotions as emotion, COUNT(*)::bigint as count
        FROM "posts"
        WHERE emotions IS NOT NULL
          AND "createdAt" >= ${dateFilter.gte}::timestamp
          AND "createdAt" <= ${dateFilter.lte}::timestamp
        GROUP BY emotions
        ORDER BY count DESC
      `;
    } else {
      query = Prisma.sql`
        SELECT emotions as emotion, COUNT(*)::bigint as count
        FROM "posts"
        WHERE emotions IS NOT NULL
        GROUP BY emotions
        ORDER BY count DESC
      `;
    }

    // Get emotion statistics with date filter
    const emotionStats =
      await prisma.$queryRaw<Array<{ emotion: string; count: bigint }>>(query);

    // Calculate total posts with emotions
    const total = emotionStats.reduce(
      (sum, stat) => sum + Number(stat.count),
      0
    );

    // Get all possible emotion values from enum
    const emotionEnumValues = Object.values(EMOTION);

    // Initialize emotion counts dynamically from enum
    const emotions: Record<string, number> = {};
    emotionEnumValues.forEach((emotion) => {
      emotions[emotion.toLowerCase()] = 0;
    });

    // Map database enum values to lowercase keys
    emotionStats.forEach((stat) => {
      const emotionKey = stat.emotion.toLowerCase();
      // Only include valid enum values
      if (emotionEnumValues.some((e) => e.toLowerCase() === emotionKey)) {
        emotions[emotionKey] = Number(stat.count);
      }
    });

    // Calculate percentages dynamically
    const percentages: Record<string, number> = {};
    Object.keys(emotions).forEach((emotionKey) => {
      percentages[emotionKey] =
        total > 0 ? (emotions[emotionKey] / total) * 100 : 0;
    });

    return NextResponse.json({
      emotions,
      percentages,
      total,
      period: {
        month: month ? parseInt(month) : null,
        year: year ? parseInt(year) : null,
      },
    });
  } catch (error) {
    console.error("Error fetching emotion analytics:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Internal server error",
      },
      {
        status:
          error instanceof Error && error.message === "Unauthorized"
            ? 401
            : error instanceof Error && error.message.includes("Forbidden")
              ? 403
              : 500,
      }
    );
  }
}
