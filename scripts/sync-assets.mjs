// 원본 assets/ 폴더를 읽어 public/assets/ 로 복사하고 PNG를 검증한다.
// 원본은 절대 수정하지 않는다. 왼쪽/오른쪽 방향만 사용한다.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PNG } from 'pngjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(ROOT, 'assets');
const OUT = path.join(ROOT, 'public', 'assets');
const FRAME = 256;
const PIVOT = { x: 128, y: 240 };
const DIRS = ['left', 'right'];

const errors = [];
const warnings = [];

function readJson(rel) {
  const p = path.join(SRC, rel);
  if (!fs.existsSync(p)) return null;
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

/** PNG 하나를 검사하고 public/assets 로 복사한다. 복사된 상대 경로를 반환. */
function checkAndCopy(rel) {
  const src = path.join(SRC, rel);
  if (!fs.existsSync(src)) {
    errors.push(`파일 없음: assets/${rel}`);
    return null;
  }
  const png = PNG.sync.read(fs.readFileSync(src));
  const { width, height, data } = png;
  if (width !== FRAME || height !== FRAME) {
    errors.push(`크기 오류 ${width}x${height} (256x256 필요): assets/${rel}`);
  }
  let minX = width, minY = height, maxX = -1, maxY = -1, opaque = 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (data[(y * width + x) * 4 + 3] > 16) {
        opaque++;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  const info = { file: rel, bounds: null };
  if (opaque === 0) {
    errors.push(`완전히 투명한 프레임(캐릭터 사라짐): assets/${rel}`);
  } else {
    info.bounds = { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 };
    if (minX === 0 || minY === 0 || maxX === width - 1 || maxY === height - 1) {
      warnings.push(`캔버스 가장자리에 닿음(잘렸을 수 있음): assets/${rel} bounds=${JSON.stringify(info.bounds)}`);
    }
    if (Math.abs(maxY - PIVOT.y) > 4) {
      warnings.push(`발 위치 y=${maxY} 가 기준점 y=${PIVOT.y} 와 다름: assets/${rel}`);
    }
  }
  const dst = path.join(OUT, rel);
  fs.mkdirSync(path.dirname(dst), { recursive: true });
  fs.copyFileSync(src, dst);
  return info;
}

function listPngs(dir) {
  const p = path.join(SRC, dir);
  if (!fs.existsSync(p)) return [];
  return fs.readdirSync(p).filter((f) => f.toLowerCase().endsWith('.png')).sort().map((f) => `${dir}/${f}`);
}

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });

const manifest = { frameSize: FRAME, pivot: PIVOT, animations: {}, notes: [] };

// --- walk ---
const walk = readJson('walk/walk.json');
if (!walk) errors.push('assets/walk/walk.json 없음');
else {
  manifest.animations.walk = { fps: 10, loop: true, frames: {} };
  for (const d of DIRS) {
    const list = walk.directions?.[d];
    if (!list?.length) { errors.push(`walk.json 에 '${d}' 방향 없음`); continue; }
    manifest.animations.walk.frames[d] = list.map((f) => checkAndCopy(`walk/${f}`)).filter(Boolean);
  }
}

// --- attack ---
const attack = readJson('attack/animations.json');
if (!attack) errors.push('assets/attack/animations.json 없음');
else {
  manifest.animations.attack = { fps: 10, loop: false, frames: {} };
  for (const d of DIRS) {
    const list = attack.animations?.[d];
    if (!list?.length) { errors.push(`animations.json 에 '${d}' 방향 없음`); continue; }
    manifest.animations.attack.frames[d] = list.map((f) => checkAndCopy(`attack/${f}`)).filter(Boolean);
  }
  if (attack.note) manifest.notes.push(`attack: ${attack.note}`);
}

// --- idle (없으면 base 1프레임으로 대체) ---
manifest.animations.idle = { fps: 6, loop: true, frames: {} };
const idleJson = readJson('idle/idle.json') ?? readJson('idle/animations.json');
let idleFound = false;
for (const d of DIRS) {
  let list = idleJson?.directions?.[d] ?? idleJson?.animations?.[d];
  list = list ? list.map((f) => `idle/${f}`) : listPngs(`idle/${d}`);
  if (list.length) {
    idleFound = true;
    manifest.animations.idle.frames[d] = list.map((f) => checkAndCopy(f)).filter(Boolean);
  }
}
const base = readJson('base/sprites.json');
if (!base) errors.push('assets/base/sprites.json 없음');
if (!idleFound) {
  warnings.push('idle 폴더가 비어 있음 → base 좌/우 이미지를 1프레임 대기 동작으로 사용');
  manifest.notes.push('idle: assets/idle 비어 있음, base 이미지 1프레임으로 대체');
  for (const d of DIRS) {
    const file = base?.directions?.[d]?.file;
    if (!file) { errors.push(`sprites.json 에 '${d}' 없음`); continue; }
    const info = checkAndCopy(`base/${file}`);
    if (info) manifest.animations.idle.frames[d] = [info];
  }
}

// --- 키우기 모드 주인공 (단일 이미지, 크기 자유) ---
const heroSrc = path.join(SRC, 'hero', 'warrior.png');
if (fs.existsSync(heroSrc)) {
  fs.mkdirSync(path.join(OUT, 'hero'), { recursive: true });
  fs.copyFileSync(heroSrc, path.join(OUT, 'hero', 'warrior.png'));
} else {
  errors.push('assets/hero/warrior.png 없음 (키우기 모드 주인공 이미지)');
}

manifest.warnings = warnings;
fs.writeFileSync(path.join(OUT, 'manifest.json'), JSON.stringify(manifest, null, 2));

for (const w of warnings) console.warn('⚠ ' + w);
for (const e of errors) console.error('✖ ' + e);
if (errors.length) {
  console.error(`\n에셋 검증 실패 (${errors.length}개 오류). 위 파일을 확인해주세요.`);
  process.exit(1);
}
const count = Object.values(manifest.animations).reduce((n, a) => n + Object.values(a.frames).reduce((m, f) => m + f.length, 0), 0);
console.log(`✔ 에셋 ${count}개 프레임 복사 및 검증 완료 → public/assets/manifest.json`);
