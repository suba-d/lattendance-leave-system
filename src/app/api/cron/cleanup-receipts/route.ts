import { NextRequest, NextResponse } from "next/server";
import { purgeExpiredReceipts } from "@/lib/receipt-cleanup";

// Idempotent receipt-retention sweep. Authenticated by a shared secret so
// it can be invoked from external schedulers (cron-job.org / EventBridge /
// pg_cron with pg_net).
//
// If CRON_SECRET is not set, the endpoint refuses every call. This is a
// safer default than allowing unauthenticated cleanup.
export async function GET(req: NextRequest) {
  const expected = process.env.CRON_SECRET;
  if (!expected) {
    return NextResponse.json(
      { error: "CRON_SECRET not configured" },
      { status: 503 },
    );
  }
  const provided = new URL(req.url).searchParams.get("secret");
  if (!provided || provided !== expected) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const cleared = await purgeExpiredReceipts();
  return NextResponse.json({ ok: true, cleared });
}

// Same handler for POST so curl -X POST works with secret in body.
export async function POST(req: NextRequest) {
  return GET(req);
}
