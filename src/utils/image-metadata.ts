import { MikaCliError } from "../errors.js";

export interface ImageMetadata {
  width: number;
  height: number;
}

export function readImageMetadata(bytes: Buffer, mimeType: string): ImageMetadata {
  switch (mimeType) {
    case "image/png":
      return readPngMetadata(bytes);
    case "image/gif":
      return readGifMetadata(bytes);
    case "image/webp":
      return readWebpMetadata(bytes);
    case "image/jpeg":
      return readJpegMetadata(bytes);
    default:
      throw new MikaCliError("UNSUPPORTED_MEDIA_TYPE", `Unsupported image type: ${mimeType}`, {
        details: {
          mimeType,
          supportedTypes: ["image/png", "image/jpeg", "image/gif", "image/webp"],
        },
      });
  }
}

function readPngMetadata(bytes: Buffer): ImageMetadata {
  if (bytes.byteLength < 24 || bytes.toString("ascii", 1, 4) !== "PNG") {
    throw invalidImage("PNG");
  }

  return {
    width: bytes.readUInt32BE(16),
    height: bytes.readUInt32BE(20),
  };
}

function readGifMetadata(bytes: Buffer): ImageMetadata {
  if (bytes.byteLength < 10 || bytes.toString("ascii", 0, 3) !== "GIF") {
    throw invalidImage("GIF");
  }

  return {
    width: bytes.readUInt16LE(6),
    height: bytes.readUInt16LE(8),
  };
}

function readWebpMetadata(bytes: Buffer): ImageMetadata {
  if (bytes.byteLength < 30 || bytes.toString("ascii", 0, 4) !== "RIFF" || bytes.toString("ascii", 8, 12) !== "WEBP") {
    throw invalidImage("WebP");
  }

  const chunkType = bytes.toString("ascii", 12, 16);

  if (chunkType === "VP8X") {
    return {
      width: 1 + bytes.readUIntLE(24, 3),
      height: 1 + bytes.readUIntLE(27, 3),
    };
  }

  if (chunkType === "VP8 ") {
    if (bytes.byteLength < 30) {
      throw invalidImage("WebP");
    }
    return {
      width: bytes.readUInt16LE(26) & 0x3fff,
      height: bytes.readUInt16LE(28) & 0x3fff,
    };
  }

  if (chunkType === "VP8L") {
    if (bytes.byteLength < 25) {
      throw invalidImage("WebP");
    }
    const bits = bytes.readUInt32LE(21);
    return {
      width: (bits & 0x3fff) + 1,
      height: ((bits >> 14) & 0x3fff) + 1,
    };
  }

  throw invalidImage("WebP");
}

function readJpegMetadata(bytes: Buffer): ImageMetadata {
  if (bytes.byteLength < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) {
    throw invalidImage("JPEG");
  }

  let offset = 2;
  while (offset < bytes.byteLength) {
    if (bytes[offset] !== 0xff) {
      offset += 1;
      continue;
    }

    const marker = bytes[offset + 1];
    if (marker === undefined) {
      break;
    }

    if (marker === 0xd8 || marker === 0xd9) {
      offset += 2;
      continue;
    }

    const segmentLength = bytes.readUInt16BE(offset + 2);
    if (segmentLength < 2 || offset + 2 + segmentLength > bytes.byteLength) {
      break;
    }

    if (isSofMarker(marker)) {
      return {
        height: bytes.readUInt16BE(offset + 5),
        width: bytes.readUInt16BE(offset + 7),
      };
    }

    offset += 2 + segmentLength;
  }

  throw invalidImage("JPEG");
}

function isSofMarker(marker: number): boolean {
  return [
    0xc0, 0xc1, 0xc2, 0xc3,
    0xc5, 0xc6, 0xc7,
    0xc9, 0xca, 0xcb,
    0xcd, 0xce, 0xcf,
  ].includes(marker);
}

function invalidImage(kind: string): MikaCliError {
  return new MikaCliError("INVALID_IMAGE_METADATA", `Failed to read ${kind} image metadata.`);
}
