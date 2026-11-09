import Phaser from 'phaser';
import { GROUND_Y } from '../config';

// 배경·소품·이펙트 텍스처를 코드로 생성한다 (외부 이미지 불필요).
// 캐릭터 스프라이트의 어두운 남보라·붉은 띠·황금 장식 색감에 맞춘 해질녘 팔레트.

type G = Phaser.GameObjects.Graphics;
type P = { x: number; y: number };

const PAL = {
  farMtn: 0x4b4468,
  farMist: 0x7d6f8e,
  midMtn: 0x2f2b48,
  pine: 0x1e2433,
  roof: 0x2a2d3a,
  roofLine: 0x3f4456,
  roofRidge: 0x181a22,
  wall: 0xcfc0a0,
  wood: 0x5a3a24,
  woodDark: 0x3b2516,
  stone: 0x6b6458,
  stoneDark: 0x4a453d,
  paperLit: 0xf0c46a,
  grass: 0x34482f,
  grassLight: 0x4d6a3e,
  dirt: 0x86694a,
  dirtDark: 0x5c4733,
};

function make(scene: Phaser.Scene, key: string, w: number, h: number, draw: (g: G) => void): void {
  if (scene.textures.exists(key)) scene.textures.remove(key);
  const g = scene.make.graphics({}, false);
  draw(g);
  g.generateTexture(key, w, h);
  g.destroy();
}

function quad(a: P, c: P, b: P, n = 16): P[] {
  const pts: P[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n, u = 1 - t;
    pts.push({ x: u * u * a.x + 2 * u * t * c.x + t * t * b.x, y: u * u * a.y + 2 * u * t * c.y + t * t * b.y });
  }
  return pts;
}

/** 폭 W 에서 이음새 없이 반복되는 능선 높이 */
function ridge(W: number, base: number, waves: [number, number, number][]) {
  return (x: number) => base + waves.reduce((s, [amp, k, ph]) => s + amp * Math.sin((2 * Math.PI * k * x) / W + ph), 0);
}

function fillRidge(g: G, W: number, H: number, h: (x: number) => number, color: number, alpha = 1): void {
  const pts: P[] = [{ x: 0, y: H }];
  for (let x = 0; x <= W; x += 4) pts.push({ x, y: Math.round(h(x)) });
  pts.push({ x: W, y: H });
  g.fillStyle(color, alpha).fillPoints(pts, true);
}

function pineSilhouette(g: G, x: number, baseY: number, s: number, color: number): void {
  g.fillStyle(color, 1);
  g.fillRect(x - 2 * s, baseY - 40 * s, 4 * s, 40 * s);
  for (let i = 0; i < 4; i++) {
    const y = baseY - 30 * s - i * 16 * s;
    const w = (34 - i * 6) * s;
    g.fillTriangle(x - w, y, x + w, y, x + (i % 2 ? 6 : -6) * s, y - 22 * s);
    g.fillEllipse(x, y - 4 * s, w * 1.7, 12 * s);
  }
}

function hanok(g: G, x: number, baseY: number, w: number, h: number): void {
  // 돌 기단
  g.fillStyle(PAL.stone).fillRect(x - 6, baseY - 16, w + 12, 16);
  g.fillStyle(PAL.stoneDark);
  for (let i = 0; i < w + 12; i += 22) g.fillRect(x - 6 + i, baseY - 16, 2, 16);
  // 벽과 기둥
  const top = baseY - 16 - h;
  g.fillStyle(PAL.wall).fillRect(x, top, w, h);
  g.fillStyle(PAL.wood);
  const cols = Math.max(3, Math.round(w / 60));
  for (let i = 0; i <= cols; i++) g.fillRect(x + (i * (w - 8)) / cols, top, 8, h);
  g.fillRect(x, top, w, 8);
  // 불 켜진 창호
  for (let i = 0; i < cols; i++) {
    if ((i + Math.round(x)) % 3 === 2) continue;
    const cx = x + (i * (w - 8)) / cols + 16;
    const cw = (w - 8) / cols - 24;
    const wy = top + 18, wh = h - 34;
    g.fillStyle(PAL.paperLit, 0.9).fillRect(cx, wy, cw, wh);
    g.fillStyle(PAL.wood, 0.85);
    for (let gx = cx + cw / 3; gx < cx + cw - 1; gx += cw / 3) g.fillRect(Math.round(gx), wy, 2, wh);
    for (let gy = wy + wh / 4; gy < wy + wh - 1; gy += wh / 4) g.fillRect(cx, Math.round(gy), cw, 2);
  }
  // 기와 지붕 (처마 곡선)
  const ov = 34;
  const eaveL = { x: x - ov, y: top - 18 }, eaveR = { x: x + w + ov, y: top - 18 };
  const lower = quad(eaveL, { x: x + w / 2, y: top + 14 }, eaveR);
  const upper = quad({ x: x + w + 6, y: top - 62 }, { x: x + w / 2, y: top - 50 }, { x: x - 6, y: top - 62 });
  g.fillStyle(PAL.roof).fillPoints([...lower, { x: eaveR.x + 4, y: eaveR.y - 8 }, ...upper, { x: eaveL.x - 4, y: eaveL.y - 8 }], true);
  g.lineStyle(2, PAL.roofLine, 1);
  for (let i = 1; i < lower.length - 1; i += 1) {
    const a = lower[i], b = upper[upper.length - 1 - i];
    g.lineBetween(a.x, a.y - 3, b.x, b.y + 4);
  }
  g.lineStyle(6, PAL.roofRidge, 1).strokePoints(upper, false);
  g.fillStyle(PAL.roofRidge).fillPoints(lower.map((p) => ({ x: p.x, y: p.y })).concat(lower.slice().reverse().map((p) => ({ x: p.x, y: p.y - 5 }))), true);
}

function stoneWall(g: G, x: number, baseY: number, w: number): void {
  g.fillStyle(PAL.stoneDark).fillRect(x, baseY - 46, w, 46);
  for (let row = 0; row < 3; row++) {
    for (let i = (row % 2) * 12; i < w - 6; i += 24) {
      g.fillStyle(row % 2 ? PAL.stone : 0x78705f).fillEllipse(x + i + 12, baseY - 8 - row * 15, 22, 14);
    }
  }
  g.fillStyle(PAL.roof).fillRect(x - 6, baseY - 54, w + 12, 10);
}

export function generateTextures(scene: Phaser.Scene): void {
  // --- 먼 산 (반복 1024) ---
  make(scene, 'bg_far', 1024, 720, (g) => {
    fillRidge(g, 1024, 720, ridge(1024, 330, [[60, 1, 0.3], [28, 3, 1.4], [12, 7, 2.2]]), PAL.farMtn, 0.75);
    fillRidge(g, 1024, 720, ridge(1024, 410, [[40, 2, 2.0], [20, 5, 0.6], [8, 11, 1.1]]), 0x5a4f72, 0.9);
    // 안개 띠
    for (let i = 0; i < 6; i++) g.fillStyle(PAL.farMist, 0.08).fillRect(0, 440 + i * 10, 1024, 60 - i * 8);
  });

  // --- 가까운 산 + 소나무 ---
  make(scene, 'bg_mid', 1024, 720, (g) => {
    const h = ridge(1024, 470, [[45, 1, 1.2], [22, 4, 0.2], [10, 9, 3.1]]);
    fillRidge(g, 1024, 720, h, PAL.midMtn);
    for (let x = 30; x < 1024; x += 58 + ((x * 7) % 40)) pineSilhouette(g, x, h(x) + 6, 0.8 + ((x * 13) % 10) / 25, PAL.pine);
  });

  // --- 한옥 마을 ---
  make(scene, 'bg_village', 1600, 720, (g) => {
    const by = GROUND_Y - 34;
    stoneWall(g, 0, by, 1600);
    hanok(g, 60, by - 40, 300, 92);
    pineSilhouette(g, 470, by - 30, 1.5, 0x26301f);
    hanok(g, 600, by - 40, 380, 104);
    hanok(g, 1120, by - 40, 260, 86);
    pineSilhouette(g, 1470, by - 30, 1.3, 0x26301f);
    pineSilhouette(g, 1540, by - 30, 1.0, 0x26301f);
  });

  // --- 지면 (반복 256) ---
  make(scene, 'ground', 256, 140, (g) => {
    g.fillStyle(PAL.dirt).fillRect(0, 0, 256, 140);
    for (let i = 0; i < 5; i++) g.fillStyle(PAL.dirtDark, 0.12 * (i + 1)).fillRect(0, 50 + i * 18, 256, 18);
    for (let i = 0; i < 26; i++) {
      const px = (i * 97) % 256, py = 26 + ((i * 53) % 100);
      g.fillStyle(i % 3 ? 0x9e8461 : 0x6e5840, 1).fillEllipse(px, py, 6 + (i % 4) * 2, 3 + (i % 3));
    }
    g.fillStyle(PAL.grass).fillRect(0, 0, 256, 14);
    for (let x = 0; x < 256; x += 6) {
      const h = 4 + ((x * 31) % 9);
      g.fillStyle(x % 12 ? PAL.grass : PAL.grassLight).fillTriangle(x, 14, x + 6, 14, x + 3, 14 + h);
    }
    g.fillStyle(PAL.grassLight).fillRect(0, 0, 256, 3);
  });

  // --- 석등 ---
  make(scene, 'lantern', 60, 130, (g) => {
    g.fillStyle(PAL.stoneDark).fillRect(12, 116, 36, 14);
    g.fillStyle(PAL.stone).fillRect(24, 64, 12, 52);
    g.fillRect(14, 58, 32, 8);
    g.fillStyle(PAL.stone).fillRect(16, 30, 28, 28);
    g.fillStyle(PAL.paperLit).fillRect(22, 36, 16, 16);
    g.fillStyle(PAL.stoneDark).fillTriangle(4, 32, 56, 32, 30, 10);
    g.fillRect(26, 2, 8, 10);
  });

  // --- 소나무 (전경) ---
  make(scene, 'pine', 260, 440, (g) => {
    g.fillStyle(PAL.woodDark);
    const trunk = quad({ x: 120, y: 440 }, { x: 160, y: 260 }, { x: 128, y: 90 }, 20);
    for (const p of trunk) g.fillRect(p.x - 9, p.y, 18, 24);
    g.fillStyle(0x6b4a33);
    for (const p of trunk) g.fillRect(p.x - 2, p.y, 3, 24);
    const clumps: [number, number, number][] = [[128, 90, 110], [70, 170, 80], [190, 150, 85], [110, 240, 70], [200, 260, 60]];
    for (const [cx, cy, w] of clumps) {
      g.fillStyle(0x1f3326).fillEllipse(cx, cy, w * 2, 46);
      g.fillStyle(0x2c4a33).fillEllipse(cx - 6, cy - 8, w * 1.6, 28);
      g.fillStyle(0x3d6142).fillEllipse(cx - 12, cy - 14, w * 0.9, 10);
    }
  });

  // --- 수련장 깃발 장대 ---
  make(scene, 'banner', 80, 260, (g) => {
    g.fillStyle(PAL.wood).fillRect(8, 0, 8, 260);
    g.fillStyle(0xa8322a).fillRect(16, 16, 54, 150);
    g.fillStyle(0xd9b54a).fillRect(16, 16, 54, 6).fillRect(16, 160, 54, 6);
    g.fillStyle(0x7a2019).fillTriangle(16, 166, 70, 166, 43, 190);
  });

  // --- 허수아비 ---
  make(scene, 'dummy', 100, 200, (g) => {
    g.fillStyle(PAL.woodDark).fillRect(45, 120, 10, 80);
    g.fillStyle(PAL.wood).fillRect(47, 120, 4, 80);
    g.fillStyle(PAL.wood).fillRect(4, 74, 92, 10);
    g.fillStyle(0xd8b45a).fillEllipse(50, 98, 56, 92);
    g.fillStyle(0xa8843a);
    for (let y = 60; y < 140; y += 8) g.fillRect(28 + ((y / 8) % 2) * 4, y, 44, 2);
    g.fillStyle(0xa8322a).fillRect(24, 84, 52, 6).fillRect(28, 120, 44, 6);
    g.fillStyle(0xe0c06a).fillTriangle(4, 84, 4, 70, -6, 90).fillTriangle(96, 84, 96, 70, 106, 90);
    g.fillStyle(0xcfb27a).fillCircle(50, 34, 24);
    g.fillStyle(0xa8843a).fillRect(26, 50, 48, 6);
    g.fillStyle(0x2a1d14).fillRect(40, 30, 6, 3).fillRect(54, 30, 6, 3).fillRect(44, 42, 12, 2);
    g.fillStyle(0xa8322a).fillRect(26, 18, 48, 5);
  });

  // --- 이펙트 ---
  make(scene, 'fx_spark', 8, 8, (g) => g.fillStyle(0xffffff).fillPoints([{ x: 4, y: 0 }, { x: 8, y: 4 }, { x: 4, y: 8 }, { x: 0, y: 4 }], true));
  make(scene, 'fx_straw', 10, 3, (g) => g.fillStyle(0xffffff).fillRect(0, 0, 10, 3));
  make(scene, 'fx_chip', 10, 6, (g) => g.fillStyle(0xffffff).fillRect(0, 0, 10, 6));
  make(scene, 'fx_dust', 12, 12, (g) => g.fillStyle(0xffffff).fillCircle(6, 6, 6));
  make(scene, 'fx_mote', 4, 4, (g) => g.fillStyle(0xffffff).fillRect(0, 0, 4, 4));
  make(scene, 'fx_glow', 64, 64, (g) => {
    for (let r = 32; r > 0; r -= 2) g.fillStyle(0xffffff, 0.05).fillCircle(32, 32, r);
  });
  make(scene, 'fx_slash', 120, 120, (g) => {
    const outer = quad({ x: 20, y: 10 }, { x: 130, y: 60 }, { x: 20, y: 110 });
    const inner = quad({ x: 20, y: 110 }, { x: 90, y: 60 }, { x: 20, y: 10 });
    g.fillStyle(0xffffff, 0.9).fillPoints([...outer, ...inner], true);
  });
}
