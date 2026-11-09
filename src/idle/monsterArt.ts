import Phaser from 'phaser';
import type { MonsterKind } from './model';

// 몬스터 픽셀아트 (16칸 격자 → PX 배율로 확대). '.' 은 투명. 모두 왼쪽(전사 쪽)을 바라본다.
const PX = 10;

interface Art { rows: string[]; pal: Record<string, number> }

const ARTS: Record<MonsterKind, Art> = {
  bandit: {
    pal: { o: 0x22140f, h: 0x2a1a1a, b: 0xc83a2a, s: 0xd9a070, k: 0x120808, c: 0x6a5a3a, C: 0x4a3e28,
      p: 0x3a3a4a, m: 0xc8d0d8, M: 0x6a4020 },
    rows: [
      '.....oooooo.....',
      '....ohhhhhhho...',
      '...obbbbbbbbbo..',
      '...oskssksshho..',
      '...osssssssho...',
      '...ohhhsshhho...',
      '....ohhhhhho....',
      '...occccccccco..',
      '..occCccccCccco.',
      'mosocCccccCcocso',
      'mMs.occccccco.ss',
      '.M..obbbbbbbo...',
      '....opppppppo...',
      '....oppo.oppo...',
      '....oppo.oppo...',
      '...ooooo.ooooo..',
    ],
  },
  wisp: {
    pal: { o: 0x14244e, b: 0x3a7bd5, c: 0x7fc8ff, d: 0xe0f6ff, e: 0x1a1030 },
    rows: [
      '......o.........',
      '.....obo....o...',
      '.....obbo..obo..',
      '....obcbo.obbo..',
      '...obccbbobcbo..',
      '...obcccbbccbo..',
      '..obccddccccbbo.',
      '..obcddddddccbo.',
      '.obcdddddddddcbo',
      '.obcdeedddeedcbo',
      '.obcdeedddeedcbo',
      '.obccddddddddcbo',
      '..obccddeeddccbo',
      '..obbccccccccbo.',
      '...oobbbbbbbboo.',
      '.....oooooooo...',
    ],
  },
  goblin: {
    pal: { o: 0x2a0e0e, h: 0xf0e0b0, r: 0xc8392b, R: 0xe8604a, w: 0xffffff, k: 0x111111, t: 0xfff6dc,
      l: 0xe0a030, s: 0x2a1a10, c: 0x6a4a2a, C: 0xb8b8b8 },
    rows: [
      '...oh......ho...',
      '...ohho..ohho...',
      '....ooooooooo...',
      '...orrrrrrrrro..',
      '..orRRrrrrRRro..',
      '..orwkkrrwkkro..',
      '..orwwkrrwwkro..',
      '..orrrrRRrrrro..',
      '..orttrttrttro..',
      'C..orrrrrrrro...',
      'cCooorrrrrrooo..',
      '.corrorrrrrrorro',
      '..corollllllorro',
      '..ooo.lslsls.ooo',
      '....orro.orro...',
      '....ooo...ooo...',
    ],
  },
  ghost: {
    pal: { o: 0x1a1428, b: 0x1a1420, w: 0xe8eef8, W: 0xb8c4dc, k: 0x401830 },
    rows: [
      '.....oooooo.....',
      '....obbbbbbo....',
      '...obbbbbbbbo...',
      '..obbwwwwwwbbo..',
      '..obwkwwwwkwbo..',
      '..obwkwwwwkwbo..',
      '..obwwwwwwwwbo..',
      '..obwwwkkwwwbo..',
      '..obbwwkkwwbbo..',
      '.obbwwwwwwwwbbo.',
      '.obwwwwwwwwwwbo.',
      '.owwWwwwwwwWwwo.',
      '.owwWwwwwwwWwwo.',
      '.owWwwWwwWwwWwo.',
      '.owowwowwowwowo.',
      '.o.o.oo.oo.oo.o.',
    ],
  },
  fox: {
    pal: { o: 0x2a1840, w: 0xf4f0ff, s: 0xb8a8e0, k: 0x8a1030, g: 0xffd27a },
    rows: [
      '..o...o.......g.',
      '.owo.owo....gog.',
      '.owwowwwo..owo..',
      '.owwwwwwo.owwo.g',
      'owkwwwkwwoowwoog',
      'owwwwwwwwowwwwo.',
      'ooowwwwwwowwwo.g',
      '.oooowwwwwwwwoog',
      '....owwwwwwwwwo.',
      '....owwswwwwswo.',
      '....owwwwwwwwwo.',
      '....owsswwwsswo.',
      '....owo.owo.owo.',
      '....oo..oo..oo..',
    ],
  },
};

export const monsterKey = (k: MonsterKind) => `mon_${k}`;

export function generateIdleTextures(scene: Phaser.Scene): void {
  for (const [kind, art] of Object.entries(ARTS) as [MonsterKind, Art][]) {
    const key = monsterKey(kind);
    if (scene.textures.exists(key)) continue;
    const w = Math.max(...art.rows.map((r) => r.length));
    const g = scene.make.graphics({ x: 0, y: 0 }, false);
    art.rows.forEach((row, y) => {
      for (let x = 0; x < row.length; x++) {
        const c = art.pal[row[x]];
        if (c === undefined) continue;
        g.fillStyle(c, 1).fillRect(x * PX, y * PX, PX, PX);
      }
    });
    g.generateTexture(key, w * PX, art.rows.length * PX);
    g.destroy();
  }

  if (!scene.textures.exists('coin')) {
    const g = scene.make.graphics({ x: 0, y: 0 }, false);
    const P = 3;
    const rows = ['..oooo..', '.oyyyyo.', 'oyYyyyyo', 'oyYoyyyo', 'oyYoyyyo', 'oyyyyyyo', '.oyyyyo.', '..oooo..'];
    const pal: Record<string, number> = { o: 0x7a4a10, y: 0xf2c040, Y: 0xfff0a0 };
    rows.forEach((r, y) => [...r].forEach((ch, x) => { if (pal[ch] !== undefined) g.fillStyle(pal[ch], 1).fillRect(x * P, y * P, P, P); }));
    g.generateTexture('coin', 8 * P, 8 * P);
    g.destroy();
  }

  if (!scene.textures.exists('shadow')) {
    const g = scene.make.graphics({ x: 0, y: 0 }, false);
    g.fillStyle(0x000000, 0.35).fillEllipse(60, 12, 120, 24);
    g.generateTexture('shadow', 120, 24);
    g.destroy();
  }
}
