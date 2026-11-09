import Phaser from 'phaser';
import { DEPTH, GROUND_Y, VIEW_H } from '../config';

interface ZoneLook { sky: number[]; far: number; mid: number; village: number; ground: number; villageAlpha: number; mote: number }

// 지역별 하늘색 + 레이어 색조 (기존 수련장 배경 텍스처를 색만 바꿔 재사용)
const LOOKS: ZoneLook[] = [
  { sky: [0x1b1730, 0x2a2142, 0x3d2a4f, 0x5a3554, 0x834552, 0xb0604f, 0xd98e5c], far: 0xffffff, mid: 0xffffff, village: 0xffffff, ground: 0xffffff, villageAlpha: 1, mote: 0xffd27a },
  { sky: [0x0f2a24, 0x18382c, 0x234a36, 0x335e3e, 0x4a7446, 0x6a8c50, 0x93a860], far: 0x9fd8a8, mid: 0x7ac08a, village: 0x6fa070, ground: 0xb8d0a0, villageAlpha: 0.0, mote: 0xb8ffb0 },
  { sky: [0x26303e, 0x34404e, 0x46525e, 0x5a6670, 0x707c84, 0x8a959a, 0xa4aeb0], far: 0xc8d4e0, mid: 0x9aa8b8, village: 0x8a98a8, ground: 0xa8b0b8, villageAlpha: 0.0, mote: 0xe8f0ff },
  { sky: [0x1a0c10, 0x2a1016, 0x3e141a, 0x56181e, 0x6e2022, 0x8a3028, 0xa8482e], far: 0xd08880, mid: 0xb06060, village: 0xa05858, ground: 0xc09080, villageAlpha: 0.85, mote: 0xff9a6a },
  { sky: [0x07060e, 0x100c1e, 0x1a122e, 0x24183e, 0x2e1e4a, 0x3a2458, 0x482c66], far: 0x8a78c8, mid: 0x6a5aa8, village: 0x5a4a90, ground: 0x8878b0, villageAlpha: 0.6, mote: 0xb890ff },
];

/** 무한히 흘러가는 시차 배경. scroll(dx) 로 전진한다. */
export class IdleBackground {
  private sky: Phaser.GameObjects.Graphics;
  private far: Phaser.GameObjects.TileSprite;
  private mid: Phaser.GameObjects.TileSprite;
  private village: Phaser.GameObjects.TileSprite;
  private ground: Phaser.GameObjects.TileSprite;
  private props: { obj: Phaser.GameObjects.Image; glow?: Phaser.GameObjects.Image }[] = [];
  private motes: Phaser.GameObjects.Particles.ParticleEmitter;
  private zone = 0;
  private propSpan = 0;

  constructor(private scene: Phaser.Scene) {
    const w = scene.scale.width;
    this.sky = scene.add.graphics().setDepth(DEPTH.sky);
    this.far = scene.add.tileSprite(0, 0, w, VIEW_H, 'bg_far').setOrigin(0).setDepth(DEPTH.far);
    this.mid = scene.add.tileSprite(0, 0, w, VIEW_H, 'bg_mid').setOrigin(0).setDepth(DEPTH.mid);
    this.village = scene.add.tileSprite(0, 0, w, VIEW_H, 'bg_village').setOrigin(0).setDepth(DEPTH.village);
    this.ground = scene.add.tileSprite(0, GROUND_Y - 14, w, VIEW_H - GROUND_Y + 14, 'ground').setOrigin(0).setDepth(DEPTH.ground);

    // 길가 소품: 소나무와 석등이 지나간다
    const kinds = ['pine', 'lantern', 'pine', 'pine', 'lantern'];
    kinds.forEach((k, i) => {
      const obj = scene.add.image(i * 420 + 200, GROUND_Y + 4, k).setOrigin(0.5, 1).setDepth(DEPTH.propsBack)
        .setScale(k === 'pine' ? 0.8 + (i % 3) * 0.12 : 1).setTint(0xb8b0c8);
      let glow: Phaser.GameObjects.Image | undefined;
      if (k === 'lantern') {
        glow = scene.add.image(obj.x, GROUND_Y - 80, 'fx_glow').setTint(0xffb050).setScale(2.2).setAlpha(0.45)
          .setBlendMode(Phaser.BlendModes.ADD).setDepth(DEPTH.propsBack + 1);
      }
      this.props.push({ obj, glow });
    });
    this.propSpan = kinds.length * 420;

    this.motes = scene.add.particles(0, 0, 'fx_mote', {
      x: { min: 0, max: w }, y: { min: 260, max: 600 }, lifespan: 5000, frequency: 180,
      speedX: { min: -30, max: -6 }, speedY: { min: -18, max: -4 },
      alpha: { values: [0, 0.8, 0.8, 0], interpolation: 'linear' }, scale: { min: 0.5, max: 1.1 },
      tint: 0xffd27a, blendMode: 'ADD',
    }).setDepth(DEPTH.effects - 1);

    this.setZone(0, true);
  }

  resize(w: number): void {
    for (const t of [this.far, this.mid, this.village, this.ground]) t.width = w;
    this.drawSky(w);
  }

  scroll(dx: number): void {
    this.far.tilePositionX += dx * 0.06;
    this.mid.tilePositionX += dx * 0.2;
    this.village.tilePositionX += dx * 0.5;
    this.ground.tilePositionX += dx;
    for (const p of this.props) {
      p.obj.x -= dx * 0.85;
      if (p.obj.x < -160) p.obj.x += this.propSpan;
      if (p.glow) p.glow.x = p.obj.x;
    }
  }

  setZone(i: number, instant = false): void {
    this.zone = i % LOOKS.length;
    const apply = () => {
      const l = LOOKS[this.zone];
      this.drawSky(this.scene.scale.width);
      this.far.setTint(l.far);
      this.mid.setTint(l.mid);
      this.village.setTint(l.village).setAlpha(l.villageAlpha);
      this.ground.setTint(l.ground);
      this.motes.particleTint = l.mote;
    };
    if (instant) return apply();
    const cam = this.scene.cameras.main;
    cam.fadeOut(350, 0, 0, 0);
    cam.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      apply();
      cam.fadeIn(450, 0, 0, 0);
    });
  }

  private drawSky(w: number): void {
    const bands = LOOKS[this.zone].sky;
    const g = this.sky.clear();
    const bh = 480 / bands.length;
    bands.forEach((c, i) => g.fillStyle(c, 1).fillRect(0, Math.floor(i * bh), w, Math.ceil(bh) + 1));
    g.fillStyle(bands[bands.length - 1], 1).fillRect(0, 480, w, VIEW_H - 480);
  }
}
