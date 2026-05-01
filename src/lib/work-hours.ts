// Pair-up IN/OUT clock events and sum the work intervals.
//
//   IN 09:00, OUT 12:00, IN 13:00, OUT 18:00
//     → (12-9) + (18-13) = 8 hours
//
// Lone INs at the end (still working / forgot to clock out) are ignored
// — they'd otherwise count an open-ended interval.

export type ClockKind = "IN" | "OUT";

export type ClockSlim = {
  kind: ClockKind;
  occurredAt: Date;
};

export function workMillis(events: ClockSlim[]): number {
  if (events.length === 0) return 0;
  const ordered = [...events].sort(
    (a, b) => a.occurredAt.getTime() - b.occurredAt.getTime(),
  );
  let total = 0;
  let openIn: Date | null = null;
  for (const e of ordered) {
    if (e.kind === "IN") {
      // Multiple INs in a row — keep the earliest as the open interval start.
      if (!openIn) openIn = e.occurredAt;
    } else {
      if (openIn) {
        total += e.occurredAt.getTime() - openIn.getTime();
        openIn = null;
      }
      // Stray OUT without preceding IN: ignore.
    }
  }
  return total;
}

export function formatWorkHours(ms: number): string {
  if (ms <= 0) return "—";
  const hours = ms / 3_600_000;
  return `${hours.toFixed(2)} 小時`;
}
