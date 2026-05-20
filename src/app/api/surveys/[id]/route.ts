import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

const VALID_STATUSES = ["NEW", "IN_PROGRESS", "RESOLVED"] as const;
type ComplaintStatus = (typeof VALID_STATUSES)[number];

/**
 * Update the complaint-handling state of a single survey response
 * (close-the-loop on negatives). Session-gated.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await req.json();
    const status = body.complaintStatus as ComplaintStatus | undefined;
    const resolutionNote =
      typeof body.resolutionNote === "string"
        ? body.resolutionNote.slice(0, 2000)
        : undefined;

    if (!status || !VALID_STATUSES.includes(status)) {
      return NextResponse.json(
        { error: "complaintStatus must be NEW | IN_PROGRESS | RESOLVED" },
        { status: 400 }
      );
    }

    const updated = await prisma.surveyResponse.update({
      where: { id },
      data: {
        complaintStatus: status,
        // Stamp the resolution time only when moving to RESOLVED; clear it
        // if the complaint is re-opened.
        resolvedAt: status === "RESOLVED" ? new Date() : null,
        ...(resolutionNote !== undefined ? { resolutionNote } : {}),
      },
      select: { id: true, complaintStatus: true, resolvedAt: true, resolutionNote: true },
    });

    return NextResponse.json({ success: true, response: updated });
  } catch (error) {
    console.error("Failed to update complaint status:", error);
    return NextResponse.json({ error: "Failed to update" }, { status: 500 });
  }
}
