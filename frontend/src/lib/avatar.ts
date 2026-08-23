/**
 * Turning a chosen photo into something we can store.
 *
 * There is no object storage in this build, so the image is cropped square,
 * shrunk, and carried inline as a data URI. Doing it in the browser means the
 * server never handles uploads and the result stays small enough for a row.
 */

/** The square we store. Enough for a 96px avatar on a retina screen. */
export const AVATAR_PX = 256;

/** Refuse anything huge before spending time decoding it. */
export const MAX_AVATAR_BYTES = 8 * 1024 * 1024;

const ALLOWED = ["image/jpeg", "image/png", "image/webp", "image/gif"];

export function isAcceptableImage(file: File): boolean {
  return ALLOWED.includes(file.type) && file.size <= MAX_AVATAR_BYTES;
}

/** The largest centred square that fits, so nothing is stretched. */
export function centreSquare(width: number, height: number) {
  const size = Math.min(width, height);
  return {
    sx: Math.round((width - size) / 2),
    sy: Math.round((height - size) / 2),
    size,
  };
}

/**
 * Decode, centre-crop, shrink, and encode as a JPEG data URI.
 *
 * Rejects rather than resolving on failure, so the caller can say something
 * useful instead of silently keeping the old photo.
 */
export async function fileToAvatar(file: File): Promise<string> {
  if (!isAcceptableImage(file)) {
    throw new Error("Choose an image under 8MB");
  }

  const bitmap = await createImageBitmap(file);
  const { sx, sy, size } = centreSquare(bitmap.width, bitmap.height);

  const canvas = document.createElement("canvas");
  canvas.width = AVATAR_PX;
  canvas.height = AVATAR_PX;

  const context = canvas.getContext("2d");
  if (!context) throw new Error("Could not process that image");

  context.drawImage(bitmap, sx, sy, size, size, 0, 0, AVATAR_PX, AVATAR_PX);
  bitmap.close?.();

  return canvas.toDataURL("image/jpeg", 0.85);
}
