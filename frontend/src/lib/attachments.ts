/**
 * Reading files for upload.
 *
 * The API takes base64 data URIs rather than multipart, because there is no
 * object storage in this build — see the backend's attachments service. That
 * makes the size cap a client concern too: rejecting a 40 MB video here saves
 * building a 53 MB request body only to have it refused.
 */

import type { Attachment } from "./types";

/** Must match MAX_ATTACHMENT_BYTES on the server. */
export const MAX_BYTES = 4 * 1024 * 1024;
export const MAX_FILES = 10;

/** Must match ALLOWED_MIME on the server. SVG is excluded: it runs script. */
export const ACCEPT = [
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
  "application/pdf",
  "text/plain",
  "application/zip",
  "audio/mpeg",
  "audio/ogg",
  "video/mp4",
].join(",");

export type PendingAttachment = {
  /** Local key for the React list and for removal before sending. */
  key: string;
  name: string;
  mime: string;
  size: number;
  data_url: string;
  width?: number;
  height?: number;
  is_image: boolean;
};

/** "1.4 MB" — the label on a file chip. */
export function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function readDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error(`Could not read ${file.name}`));
    reader.readAsDataURL(file);
  });
}

/** How long to wait for a decode before sending without dimensions. */
const DECODE_TIMEOUT_MS = 3000;

/**
 * Natural dimensions, so a thumbnail can reserve its space before loading.
 *
 * Races a timeout: dimensions are a nicety, and an image that neither loads
 * nor errors must not be able to wedge the send button forever.
 */
function readSize(dataUrl: string): Promise<{ width: number; height: number } | null> {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (value: { width: number; height: number } | null) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(value);
    };

    const timer = setTimeout(() => finish(null), DECODE_TIMEOUT_MS);
    const image = new Image();
    image.onload = () => finish({ width: image.naturalWidth, height: image.naturalHeight });
    // A corrupt image is still a valid attachment; it just has no dimensions.
    image.onerror = () => finish(null);
    image.src = dataUrl;
  });
}

/**
 * Turn picked files into upload-ready attachments.
 *
 * Returns what succeeded plus a message per rejection, so the caller can add
 * three files and be told about the one that was too big.
 */
export async function prepare(
  files: File[]
): Promise<{ ready: PendingAttachment[]; errors: string[] }> {
  const ready: PendingAttachment[] = [];
  const errors: string[] = [];
  const allowed = new Set(ACCEPT.split(","));

  for (const file of files) {
    if (!allowed.has(file.type)) {
      errors.push(`${file.name} is not a supported type`);
      continue;
    }
    if (file.size > MAX_BYTES) {
      errors.push(`${file.name} is over ${formatSize(MAX_BYTES)}`);
      continue;
    }
    try {
      const dataUrl = await readDataUrl(file);
      const isImage = file.type.startsWith("image/");
      const dimensions = isImage ? await readSize(dataUrl) : null;
      ready.push({
        key: `${file.name}:${file.size}:${file.lastModified}`,
        name: file.name,
        mime: file.type,
        size: file.size,
        data_url: dataUrl,
        width: dimensions?.width,
        height: dimensions?.height,
        is_image: isImage,
      });
    } catch {
      errors.push(`Could not read ${file.name}`);
    }
  }

  return { ready, errors };
}

/** The shape the send endpoint takes: no local key, no derived fields. */
export function toPayload(items: PendingAttachment[]) {
  return items.map(({ name, mime, data_url, width, height }) => ({
    name,
    mime,
    data_url,
    width,
    height,
  }));
}

/** A caption-less attachment message still needs sidebar preview text. */
export function attachmentSummary(attachments: Attachment[]): string {
  if (attachments.length === 0) return "";
  if (attachments.length > 1) return `${attachments.length} attachments`;
  return attachments[0].is_image ? "Photo" : attachments[0].name;
}
