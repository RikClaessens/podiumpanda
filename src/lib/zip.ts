const decoder = new TextDecoder();

export type ZipEntry = { name: string; method: number; size: number; offset: number };

export function listZip(bytes: Uint8Array): ZipEntry[] {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let end = bytes.length - 22;
  while (end >= 0 && view.getUint32(end, true) !== 0x06054b50) end--;
  if (end < 0) throw new Error("This is not a valid zip file.");
  const count = view.getUint16(end + 10, true);
  let position = view.getUint32(end + 16, true);
  const entries: ZipEntry[] = [];
  for (let index = 0; index < count; index++) {
    if (view.getUint32(position, true) !== 0x02014b50) throw new Error("Corrupt zip file.");
    const nameLength = view.getUint16(position + 28, true);
    const extraLength = view.getUint16(position + 30, true);
    const commentLength = view.getUint16(position + 32, true);
    entries.push({
      name: decoder.decode(bytes.subarray(position + 46, position + 46 + nameLength)),
      method: view.getUint16(position + 10, true),
      size: view.getUint32(position + 20, true),
      offset: view.getUint32(position + 42, true),
    });
    position += 46 + nameLength + extraLength + commentLength;
  }
  return entries;
}

export async function readZipEntry(bytes: Uint8Array, entry: ZipEntry): Promise<Uint8Array> {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const start =
    entry.offset +
    30 +
    view.getUint16(entry.offset + 26, true) +
    view.getUint16(entry.offset + 28, true);
  const data = bytes.subarray(start, start + entry.size);
  if (entry.method === 0) return data;
  if (entry.method !== 8) throw new Error("Unsupported zip compression.");
  const stream = new Blob([data as BlobPart])
    .stream()
    .pipeThrough(new DecompressionStream("deflate-raw"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

export async function readZipText(bytes: Uint8Array, name: string) {
  const entry = listZip(bytes).find((item) => item.name === name);
  if (!entry) throw new Error(`${name} is missing from the archive.`);
  return decoder.decode(await readZipEntry(bytes, entry));
}
