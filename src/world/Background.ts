import Phaser from 'phaser';
import { DEPTH, GROUND_Y, VIEW_H, WORLD_W } from '../config';

interface ParallaxLayer {
  sprite: Phaser.GameObjects.TileSprite;
  factor: number;
}

/**
 * 해질녘 한옥 마을 수련장 배경.
 * 하늘/먼 산/가까운 산/마을은 화면 고정 TileSprite 로 시차 스크롤,
 * 지면·소품은 월드 좌표에 배치해 캐릭터와 레이어를 분리한다.
 */
export class Background {
  private sky: Phaser.GameObjects.Graphics;
  private moon: Phaser.GameObjects.Container;
  private layers: ParallaxLayer[] = [];

  constructor(private scene: Phaser.Scene) {
    this.sky = scene.add.graphics().setScrollFactor(0).setDepth(DEPTH.sky);
    this.moon = this.createMoon();

    const add = (key: string, factor: number, depth: number) => {
      const s = scene.add.tileSprite(0, 0, scene.scale.width, VIEW_H, key).setOrigin(0).setScrollFactor(0).setDepth(depth);
      this.layers.push({ sprite: s, factor });
    };
    add('bg_far', 0.08, DEPTH.far);
    add('bg_mid', 0.22, DEPTH.mid);
    add('bg_village', 0.5, DEPTH.village);

    this.createWorldLayer();
    this.createAmbience();

    this.layout();
    scene.scale.on(Phaser.Scale.Events.RESIZE, this.layout, this);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => scene.scale.off(Phaser.Scale.Events.RESIZE, this.layout, this));
  }

  update(): void {
    const sx = this.scene.cameras.main.scrollX;
    for (const l of this.layers) l.sprite.tilePositionX = sx * l.factor;
  }

  private layout(): void {
    const w = this.scene.scale.width;
    this.sky.clear();
    // 남보라 → 자주 → 노을빛 그라데이션
    const bands = [0x1b1730, 0x2a2142, 0x3d2a4f, 0x5a3554, 0x834552, 0xb0604f, 0xd98e5c];
    const bh = 480 / bands.length;
    bands.forEach((c, i) => this.sky.fillStyle(c, 1).fillRect(0, Math.floor(i * bh), w, Math.ceil(bh) + 1));
    this.sky.fillStyle(0xe8a868, 1).fillRect(0, 480, w, VIEW_H - 480);
    this.moon.setPosition(w * 0.78, 120);
    for (const l of this.layers) l.sprite.setSize(w, VIEW_H);
  }

  private createMoon(): Phaser.GameObjects.Container {
    const s = this.scene;
    const glow = s.add.image(0, 0, 'fx_glow').setScale(4).setTint(0xffe2b0).setAlpha(0.35).setBlendMode(Phaser.BlendModes.ADD);
    const disc = s.add.circle(0, 0, 38, 0xf6e6c4);
    const shade = s.add.circle(10, -6, 9, 0xe4cfa6);
    return s.add.container(0, 0, [glow, disc, shade]).setScrollFactor(0.02).setDepth(DEPTH.sky + 1);
  }

  private createWorldLayer(): void {
    const s = this.scene;
    s.add.tileSprite(0, GROUND_Y - 14, WORLD_W, VIEW_H - GROUND_Y + 14, 'ground').setOrigin(0).setDepth(DEPTH.ground);

    // 뒤쪽 소나무 (월드 좌표, 캐릭터 뒤)
    for (const [x, sc] of [[120, 1.0], [760, 0.85], [1720, 1.05], [2350, 0.9], [3050, 1.0]] as const) {
      s.add.image(x, GROUND_Y + 2, 'pine').setOrigin(0.5, 1).setScale(sc).setDepth(DEPTH.propsBack).setTint(0xb8b0c8);
    }
    // 수련장 깃발
    for (const x of [760, 1520]) s.add.image(x, GROUND_Y + 2, 'banner').setOrigin(0.1, 1).setDepth(DEPTH.propsBack + 1);
    s.add.text(1130, GROUND_Y - 300, '修 鍊 場', {
      fontFamily: '"Noto Serif KR", serif', fontSize: '26px', color: '#e9d2a0', stroke: '#2a1a12', strokeThickness: 4,
    }).setOrigin(0.5).setDepth(DEPTH.propsBack).setAlpha(0.9);

    // 석등 + 불빛 깜빡임
    for (const x of [560, 1700, 2200, 2800]) {
      s.add.image(x, GROUND_Y + 4, 'lantern').setOrigin(0.5, 1).setDepth(DEPTH.propsBack + 1);
      const glow = s.add.image(x, GROUND_Y - 84, 'fx_glow').setTint(0xffb050).setScale(2.2).setAlpha(0.5)
        .setBlendMode(Phaser.BlendModes.ADD).setDepth(DEPTH.propsBack + 2);
      s.tweens.add({ targets: glow, alpha: 0.3, scale: 2.0, duration: 900 + (x % 400), yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    }

    // 전경 풀숲 (캐릭터 앞, 화면 하단만 살짝)
    for (let x = 60; x < WORLD_W; x += 340 + (x % 130)) {
      s.add.ellipse(x, VIEW_H + 6, 180, 44, 0x1f2b1c).setDepth(DEPTH.foreground);
      s.add.ellipse(x + 50, VIEW_H + 10, 120, 36, 0x26361f).setDepth(DEPTH.foreground);
    }
  }

  private createAmbience(): void {
    // 떠다니는 반딧불/꽃가루
    this.scene.add.particles(0, 0, 'fx_mote', {
      x: { min: 0, max: WORLD_W }, y: { min: 300, max: 600 },
      lifespan: 5000, frequency: 160, speedX: { min: -12, max: 12 }, speedY: { min: -18, max: -4 },
      alpha: { values: [0, 0.8, 0.8, 0], interpolation: 'linear' },
      scale: { min: 0.5, max: 1 }, tint: [0xffd27a, 0xffe9b8], blendMode: 'ADD',
    }).setDepth(DEPTH.effects - 1);
  }
}
