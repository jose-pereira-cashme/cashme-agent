import { inflateRawSync } from "node:zlib";

const EOCD_SIGNATURE = 0x06054b50;
const CENTRAL_SIGNATURE = 0x02014b50;
const LOCAL_SIGNATURE = 0x04034b50;
const EOCD_MIN_SIZE = 22;
const ZIP64_MARKER = 0xffffffff;

export function extractDocxText(buffer: Buffer): string {
  const xml = readZipEntry(buffer, "word/document.xml");
  if (!xml) throw new Error("not a .docx (word/document.xml not found)");
  return documentXmlToText(xml.toString("utf8"));
}

function readZipEntry(zip: Buffer, wanted: string): Buffer | null {
  const eocd = findEocd(zip);
  if (eocd < 0) throw new Error("invalid zip: end-of-central-directory not found");

  const entryCount = zip.readUInt16LE(eocd + 10);
  let offset = zip.readUInt32LE(eocd + 16);
  if (offset === ZIP64_MARKER) throw new Error("zip64 archives are not supported");

  for (let i = 0; i < entryCount; i++) {
    if (offset + 46 > zip.length || zip.readUInt32LE(offset) !== CENTRAL_SIGNATURE) {
      throw new Error("invalid zip: bad central directory entry");
    }
    const method = zip.readUInt16LE(offset + 10);

    const compressedSize = zip.readUInt32LE(offset + 20);
    const nameLength = zip.readUInt16LE(offset + 28);
    const extraLength = zip.readUInt16LE(offset + 30);
    const commentLength = zip.readUInt16LE(offset + 32);
    const localOffset = zip.readUInt32LE(offset + 42);
    const name = zip.toString("utf8", offset + 46, offset + 46 + nameLength);

    if (name === wanted) {
      if (compressedSize === ZIP64_MARKER || localOffset === ZIP64_MARKER) {
        throw new Error("zip64 archives are not supported");
      }
      return inflateEntry(zip, localOffset, method, compressedSize);
    }
    offset += 46 + nameLength + extraLength + commentLength;
  }
  return null;
}

function findEocd(zip: Buffer): number {
  if (zip.length < EOCD_MIN_SIZE) return -1;
  const min = Math.max(0, zip.length - EOCD_MIN_SIZE - 0xffff);
  for (let i = zip.length - EOCD_MIN_SIZE; i >= min; i--) {
    if (zip.readUInt32LE(i) === EOCD_SIGNATURE) return i;
  }
  return -1;
}

function inflateEntry(zip: Buffer, localOffset: number, method: number, compressedSize: number): Buffer {
  if (localOffset + 30 > zip.length || zip.readUInt32LE(localOffset) !== LOCAL_SIGNATURE) {
    throw new Error("invalid zip: bad local file header");
  }
  const nameLength = zip.readUInt16LE(localOffset + 26);
  const extraLength = zip.readUInt16LE(localOffset + 28);
  const start = localOffset + 30 + nameLength + extraLength;
  const data = zip.subarray(start, start + compressedSize);

  if (method === 0) return Buffer.from(data); // stored
  if (method === 8) return inflateRawSync(data); // deflate
  throw new Error(`unsupported zip compression method ${method}`);
}

function documentXmlToText(xml: string): string {
  return decodeXmlEntities(
    xml
      .replace(/<w:instrText[\s\S]*?<\/w:instrText>/g, "")
      .replace(/<w:tab\b[^>]*>/g, "\t")
      .replace(/<w:br\b[^>]*>/g, "\n")
      .replace(/<\/w:tc>/g, " ")
      .replace(/<\/(w:p|w:tr)>/g, "\n")
      .replace(/<[^>]+>/g, ""),
  )
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function decodeXmlEntities(text: string): string {
  return text
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(parseInt(code, 16)))
    .replace(/&amp;/g, "&");
}
