import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

// Serves a receipt image from the LeaveRequest table. Access is restricted
// to either the leave's owner or any ADMIN. The image bytes themselves are
// stored as bytea, so we read them out and return raw with the recorded
// MIME type. No-store cache so signed views aren't kept around.
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const leave = await prisma.leaveRequest.findUnique({
    where: { id },
    select: {
      userId: true,
      receiptData: true,
      receiptMimeType: true,
    },
  });
  if (!leave) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const isOwner = leave.userId === session.user.id;
  const isAdmin = session.user.role === "ADMIN";
  if (!isOwner && !isAdmin) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  if (!leave.receiptData || !leave.receiptMimeType) {
    return NextResponse.json({ error: "no_receipt" }, { status: 404 });
  }

  return new NextResponse(new Uint8Array(leave.receiptData), {
    status: 200,
    headers: {
      "Content-Type": leave.receiptMimeType,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
