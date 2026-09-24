// Genera le icone della PWA (quadrato blu con la "M" del logo) senza
// dipendenze: i pixel si disegnano a mano e il PNG si impacchetta con zlib.
// Uso: node scripts/genera-icone-pwa.mjs
import { deflateSync } from "node:zlib";
import { writeFileSync } from "node:fs";

// Il blu primario dell'app (--primary in globals.css, convertito in sRGB).
const BLU = [37, 99, 235];
const BIANCO = [255, 255, 255];

function crc32(buf) {
  let c, table = [];
  for (let n = 0; n < 256; n++) {
    c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  let crc = 0xffffffff;
  for (const b of buf) crc = table[(crc ^ b) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(tipo, dati) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(dati.length);
  const corpo = Buffer.concat([Buffer.from(tipo, "ascii"), dati]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(corpo));
  return Buffer.concat([len, corpo, crc]);
}

function scriviPng(percorso, size, pixels) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  const righe = [];
  for (let y = 0; y < size; y++) {
    righe.push(Buffer.from([0]), pixels.subarray(y * size * 4, (y + 1) * size * 4));
  }
  const png = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(Buffer.concat(righe), { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
  writeFileSync(percorso, png);
  console.log(`${percorso} (${size}x${size}, ${png.length} byte)`);
}

// Distanza di un punto dal segmento ab (per il tratto della "M").
function distSegmento(px, py, ax, ay, bx, by) {
  const abx = bx - ax, aby = by - ay;
  const t = Math.max(0, Math.min(1, ((px - ax) * abx + (py - ay) * aby) / (abx * abx + aby * aby)));
  const dx = px - (ax + t * abx), dy = py - (ay + t * aby);
  return Math.hypot(dx, dy);
}

// SDF di un rettangolo con angoli arrotondati centrato in (c, c).
function distRettArrotondato(px, py, c, half, r) {
  const qx = Math.abs(px - c) - (half - r);
  const qy = Math.abs(py - c) - (half - r);
  return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - r;
}

function disegna(size, { angoliArrotondati }) {
  const px = new Uint8Array(size * size * 4);
  const s = size / 512; // coordinate pensate su 512
  const c = size / 2;
  const half = angoliArrotondati ? size * 0.5 : size; // pieno = nessun bordo visibile
  const raggio = angoliArrotondati ? size * 0.224 : 0;
  // La "M": quattro tratti con estremi tondi.
  const spessore = 60 * s;
  const punti = [
    [150, 356], [150, 164], [256, 286], [362, 164], [362, 356],
  ].map(([x, y]) => [x * s, y * s]);

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const cx = x + 0.5, cy = y + 0.5;
      const dSfondo = distRettArrotondato(cx, cy, c, half, raggio);
      const aSfondo = Math.max(0, Math.min(1, 0.5 - dSfondo));
      let dM = Infinity;
      for (let i = 0; i < punti.length - 1; i++) {
        dM = Math.min(dM, distSegmento(cx, cy, ...punti[i], ...punti[i + 1]));
      }
      const aM = Math.max(0, Math.min(1, spessore / 2 + 0.5 - dM));
      const r = BLU[0] + (BIANCO[0] - BLU[0]) * aM;
      const g = BLU[1] + (BIANCO[1] - BLU[1]) * aM;
      const b = BLU[2] + (BIANCO[2] - BLU[2]) * aM;
      const i = (y * size + x) * 4;
      px[i] = Math.round(r);
      px[i + 1] = Math.round(g);
      px[i + 2] = Math.round(b);
      px[i + 3] = Math.round(aSfondo * 255);
    }
  }
  return px;
}

scriviPng("public/icona-192.png", 192, disegna(192, { angoliArrotondati: true }));
scriviPng("public/icona-512.png", 512, disegna(512, { angoliArrotondati: true }));
scriviPng("public/icona-maskable-512.png", 512, disegna(512, { angoliArrotondati: false }));
scriviPng("app/apple-icon.png", 180, disegna(180, { angoliArrotondati: false }));
