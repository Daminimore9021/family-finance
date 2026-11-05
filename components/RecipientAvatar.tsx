import { RECIPIENT_META } from "@/lib/constants";
import type { Recipient } from "@/lib/types";
import { cn } from "@/lib/api-client";

export function RecipientAvatar({ recipient, size = "md" }: { recipient: Recipient; size?: "sm" | "md" }) {
  const meta = RECIPIENT_META[recipient];
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full font-semibold",
        meta.soft,
        meta.text,
        size === "md" ? "size-10 text-sm" : "size-8 text-xs",
      )}
      aria-hidden
    >
      {recipient.charAt(0)}
    </span>
  );
}

export function RecipientBadge({ recipient }: { recipient: Recipient }) {
  const meta = RECIPIENT_META[recipient];
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium", meta.soft, meta.text)}>
      <span className="size-1.5 rounded-full" style={{ backgroundColor: meta.color }} />
      {meta.label}
    </span>
  );
}
