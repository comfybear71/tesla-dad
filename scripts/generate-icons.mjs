// Generates PWA icons (no external deps) — black bg with a red Tesla-style "T".
import { deflateSync } from "node:zlib";
import { writeFileSync, mkdirSync } from "node:fs";

const BG = [10, 10, 10];
const RED = [227, 25, 55];

function crc32(buf) {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) c = c & 1 ? (c >>> 1) ^ 0xedb88320 : c >>> 1;
  }
  return (~c) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, "ascii");
  const body = Buffer.concat([typeBuf, data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}

function png(size) {
  const S = size;
  // Build RGBA pixels.
  const rows = [];
  const barTop = Math.round(S * 0.3),
    barBot = Math.round(S * 0.42),
    barL = Math.round(S * 0.18),
    barR = Math.round(S * 0.82),
    stemL = Math.round(S * 0.435),
    stemR = Math.round(S * 0.565),
    stemBot = Math.round(S * 0.78);
  for (let y = 0; y < S; y++) {
    const row = Buffer.alloc(1 + S * 4); // filter byte + pixels
    row[0] = 0;
    for (let x = 0; x < S; x++) {
      const inBar = y >= barTop && y < barBot && x >= barL && x < barR;
      const inStem = y >= barTop && y < stemBot && x >= stemL && x < stemR;
      const c = inBar || inStem ? RED : BG;
      const o = 1 + x * 4;
      row[o] = c[0];
      row[o + 1] = c[1];
      row[o + 2] = c[2];
      row[o + 3] = 255;
    }
    rows.push(row);
  }
  const raw = Buffer.concat(rows);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(S, 0);
  ihdr.writeUInt32BE(S, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  return Buffer.concat([
    sig,
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

mkdirSync("public", { recursive: true });
for (const s of [192, 512]) {
  writeFileSync(`public/icon-${s}.png`, png(s));
  console.log(`wrote public/icon-${s}.png`);
}
writeFileSync("public/apple-touch-icon.png", png(180));
console.log("wrote public/apple-touch-icon.png");
