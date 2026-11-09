// assets/hero/warrior_source.png(고해상도 원본) → assets/hero/warrior.png(게임용 176x240, 발 중앙 = (88, 232))
// 박스 필터(면적 평균, 알파 가중)로 축소해 선명도를 유지한다.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PNG } from 'pngjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = PNG.sync.read(fs.readFileSync(path.join(ROOT, 'assets/hero/warrior_source.png')));
const { width: W, height: H, data: D } = src;

// 불투명 영역 경계
let minX = W, minY = H, maxX = 0, maxY = 0;
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
  if (D[(y * W + x) * 4 + 3] > 24) { minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y); }
}
// 발 중앙: 맨 아래 4% 높이(칼끝 제외)에 있는 불투명 픽셀들의 가로 범위 중앙
let fMin = W, fMax = 0;
for (let y = Math.round(maxY - (maxY - minY) * 0.04); y <= maxY; y++) for (let x = 0; x < W; x++) {
  if (D[(y * W + x) * 4 + 3] > 24) { fMin = Math.min(fMin, x); fMax = Math.max(fMax, x); }
}
const footX = (fMin + fMax) / 2;

const OUT_W = 176, OUT_H = 240, FOOT = { x: 88, y: 232 }, CHAR_H = 220;
const s = CHAR_H / (maxY - minY + 1); // 축소 배율
const out = new PNG({ width: OUT_W, height: OUT_H });
for (let oy = 0; oy < OUT_H; oy++) for (let ox = 0; ox < OUT_W; ox++) {
  // 출력 픽셀이 덮는 원본 영역
  const sx0 = footX + (ox - FOOT.x) / s, sx1 = footX + (ox + 1 - FOOT.x) / s;
  const sy0 = maxY + 1 + (oy - FOOT.y) / s, sy1 = maxY + 1 + (oy + 1 - FOOT.y) / s;
  let r = 0, g = 0, b = 0, a = 0, n = 0;
  for (let y = Math.floor(sy0); y < Math.ceil(sy1); y++) for (let x = Math.floor(sx0); x < Math.ceil(sx1); x++) {
    const wy = Math.min(y + 1, sy1) - Math.max(y, sy0), wx = Math.min(x + 1, sx1) - Math.max(x, sx0);
    const w = wx * wy; n += w;
    if (x < 0 || y < 0 || x >= W || y >= H) continue;
    const i = (y * W + x) * 4, al = D[i + 3] / 255;
    r += D[i] * al * w; g += D[i + 1] * al * w; b += D[i + 2] * al * w; a += al * w;
  }
  const j = (oy * OUT_W + ox) * 4;
  if (a > 0) { out.data[j] = r / a; out.data[j + 1] = g / a; out.data[j + 2] = b / a; }
  const alpha = n ? a / n : 0;
  out.data[j + 3] = alpha < 0.08 ? 0 : Math.round(Math.min(1, alpha) * 255);
}
fs.writeFileSync(path.join(ROOT, 'assets/hero/warrior.png'), PNG.sync.write(out));
console.log(`hero: bbox ${minX},${minY}-${maxX},${maxY} foot ${footX} scale ${s.toFixed(4)} → ${OUT_W}x${OUT_H}`);
