"use client";

import { formatSize } from "@/lib/attachments";
import { AttachIcon } from "@/components/ui/icons";
import type { Attachment } from "@/lib/types";

/**
 * Attachments inside a bubble.
 *
 * Images render inline; everything else becomes a download chip. The bytes are
 * already in hand as a data URI, so both are instant and neither needs a
 * network round trip.
 */
export function AttachmentView({
  attachments,
  outgoing,
  hasCaption,
}: {
  attachments: Attachment[];
  outgoing: boolean;
  hasCaption: boolean;
}) {
  if (attachments.length === 0) return null;

  return (
    <ul
      data-testid="bubble-attachments"
      // Two up when there are several, so a pair of photos does not stack into
      // a tall column.
      className={`grid gap-1 ${attachments.length > 1 ? "grid-cols-2" : "grid-cols-1"} ${
        hasCaption ? "mb-1.5" : ""
      }`}
    >
      {attachments.map((file) =>
        file.is_image ? (
          <li key={file.id}>
            <a href={file.data_url} download={file.name} title={file.name}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={file.data_url}
                alt={file.name}
                width={file.width ?? undefined}
                height={file.height ?? undefined}
                // Capped so a tall photo cannot push the whole thread down.
                className="max-h-72 w-full rounded-lg object-cover"
              />
            </a>
          </li>
        ) : (
          <li key={file.id}>
            <a
              href={file.data_url}
              download={file.name}
              className={`flex items-center gap-2 rounded-lg px-2 py-1.5 ${
                // Darken on a light bubble, lighten on a dark one: a fixed
                // black wash is nearly invisible against dark grey.
                outgoing
                  ? "bg-black/15 hover:bg-black/25"
                  : "bg-black/10 hover:bg-black/20 dark:bg-white/10 dark:hover:bg-white/20"
              }`}
            >
              <AttachIcon className="h-5 w-5 shrink-0 opacity-70" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-body2">{file.name}</span>
                <span className="block text-caption opacity-70">{formatSize(file.size)}</span>
              </span>
            </a>
          </li>
        )
      )}
    </ul>
  );
}
