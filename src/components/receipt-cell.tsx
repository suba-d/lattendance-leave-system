// Small server component used in leave-record tables. New (bytea) receipts
// render as an inline thumbnail that links to the full image; legacy Google
// Drive URLs render as a text link. No receipt → em dash.

export default function ReceiptCell({
  leaveId,
  hasBlob,
  legacyUrl,
}: {
  leaveId: string;
  hasBlob: boolean;
  legacyUrl: string | null;
}) {
  if (hasBlob) {
    return (
      <a
        href={`/api/receipt/${leaveId}`}
        target="_blank"
        rel="noopener noreferrer"
        title="點擊看原圖"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={`/api/receipt/${leaveId}`}
          alt="收據"
          className="h-16 w-16 object-cover rounded border border-[var(--color-border)]"
        />
      </a>
    );
  }
  if (legacyUrl) {
    return (
      <a
        href={legacyUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="text-xs text-blue-600 hover:underline"
      >
        📎 舊單據
      </a>
    );
  }
  return <span className="muted text-xs">—</span>;
}
