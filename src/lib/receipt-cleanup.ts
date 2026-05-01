import { prisma } from "@/lib/db";
import { RECEIPT_RETENTION_MONTHS } from "@/lib/receipt";

// Clears receipt bytes from leave requests whose endAt is older than the
// retention window. Returns the number of rows updated.
//
// Called from:
//   - /admin/leave page load (lazy — runs whenever admin opens the page)
//   - /api/cron/cleanup-receipts (active — for external schedulers)
//
// Idempotent: rows already without receiptData are excluded.
export async function purgeExpiredReceipts(): Promise<number> {
  const cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() - RECEIPT_RETENTION_MONTHS);
  const result = await prisma.leaveRequest.updateMany({
    where: {
      endAt: { lt: cutoff },
      receiptData: { not: null },
    },
    data: {
      receiptData: null,
      receiptMimeType: null,
    },
  });
  return result.count;
}
