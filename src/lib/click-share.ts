// Share links keep the whole click track in the URL hash, so nothing leaves the device.
const PARAM = "t";
const MAX_LENGTH = 200_000;

const toBase64Url = (bytes: Uint8Array) => {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};

const fromBase64Url = (value: string) => {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(padded + "=".repeat((4 - (padded.length % 4)) % 4));
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
};

async function pipe(bytes: Uint8Array, stream: CompressionStream | DecompressionStream) {
  const writer = stream.writable.getWriter();
  void writer.write(bytes as BufferSource).catch(() => undefined);
  void writer.close().catch(() => undefined);
  return new Uint8Array(await new Response(stream.readable).arrayBuffer());
}

// "z" values are deflated, "p" values are plain UTF-8 for browsers without CompressionStream.
export async function encodeShare(text: string): Promise<string> {
  const bytes = new TextEncoder().encode(text);
  if (typeof CompressionStream === "undefined") return `p${toBase64Url(bytes)}`;
  return `z${toBase64Url(await pipe(bytes, new CompressionStream("deflate-raw")))}`;
}

export async function decodeShare(value: string): Promise<string | null> {
  if (value.length > MAX_LENGTH) return null;
  try {
    const bytes = fromBase64Url(value.slice(1));
    if (value[0] === "p") return new TextDecoder().decode(bytes);
    if (value[0] === "z" && typeof DecompressionStream !== "undefined")
      return new TextDecoder().decode(await pipe(bytes, new DecompressionStream("deflate-raw")));
  } catch {
    return null;
  }
  return null;
}

export async function shareUrl(text: string, location: Pick<Location, "origin" | "pathname">) {
  return `${location.origin}${location.pathname}#${PARAM}=${await encodeShare(text)}`;
}

export function sharedValue(hash: string): string | null {
  const match = new RegExp(`^#?${PARAM}=([\\w-]+)$`).exec(hash);
  return match ? match[1] : null;
}
