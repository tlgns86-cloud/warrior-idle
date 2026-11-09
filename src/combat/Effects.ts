import Phaser from 'phaser';
import { DEPTH } from '../config';

/** 타격/파괴 시각 효과 모음 */
export class Effects {
  private sparks: Phaser.GameObjects.Particles.ParticleEmitter;
  private straw: Phaser.GameObjects.Particles.ParticleEmitter;
  private chips: Phaser.GameObjects.Particles.ParticleEmitter;
  private dustFx: Phaser.GameObjects.Particles.ParticleEmitter;

  constructor(private scene: Phaser.Scene) {
    this.sparks = scene.add.particles(0, 0, 'fx_spark', {
      emitting: false, lifespan: { min: 160, max: 300 }, speed: { min: 180, max: 420 },
      scale: { start: 1.2, end: 0 }, blendMode: 'ADD', tint: [0xfff2c2, 0xffc85a, 0xffffff],
    }).setDepth(DEPTH.effects);
    this.straw = scene.add.particles(0, 0, 'fx_straw', {
      emitting: false, lifespan: { min: 500, max: 900 }, speed: { min: 120, max: 360 },
      angle: { min: 200, max: 340 }, gravityY: 900, rotate: { min: 0, max: 360 },
      scale: { min: 0.8, max: 1.6 }, tint: [0xe0c06a, 0xc9a24a, 0xa8843a],
    }).setDepth(DEPTH.effects);
    this.chips = scene.add.particles(0, 0, 'fx_chip', {
      emitting: false, lifespan: { min: 600, max: 1000 }, speed: { min: 160, max: 380 },
      angle: { min: 210, max: 330 }, gravityY: 1100, rotate: { min: 0, max: 360 },
      scale: { min: 0.8, max: 1.5 }, tint: [0x7a5232, 0x5c3b22, 0xa8322a],
    }).setDepth(DEPTH.effects);
    this.dustFx = scene.add.particles(0, 0, 'fx_dust', {
      emitting: false, lifespan: 600, speedX: { min: -90, max: 90 }, speedY: { min: -40, max: -10 },
      scale: { start: 1.4, end: 2.6 }, alpha: { start: 0.45, end: 0 }, tint: 0xb9a588,
    }).setDepth(DEPTH.effects);
  }

  hitSpark(x: number, y: number, dir: 1 | -1): void {
    this.sparks.explode(10, x, y);
    // 짧은 베기 섬광
    const slash = this.scene.add.image(x, y, 'fx_slash').setDepth(DEPTH.effects).setBlendMode(Phaser.BlendModes.ADD)
      .setFlipX(dir < 0).setAngle(dir * -18).setScale(0.6);
    this.scene.tweens.add({ targets: slash, scaleX: 1.3, scaleY: 1.1, alpha: 0, duration: 160, onComplete: () => slash.destroy() });
    this.straw.explode(6, x, y);
    this.scene.cameras.main.shake(70, 0.003);
  }

  destroyBurst(x: number, y: number): void {
    this.straw.explode(28, x, y);
    this.chips.explode(10, x, y + 20);
    this.sparks.explode(16, x, y);
    this.dust(x, y + 90);
    this.scene.cameras.main.shake(140, 0.006);
    const ring = this.scene.add.circle(x, y, 20, 0xfff2c2, 0.6).setDepth(DEPTH.effects).setBlendMode(Phaser.BlendModes.ADD);
    this.scene.tweens.add({ targets: ring, radius: 90, alpha: 0, duration: 260, onComplete: () => ring.destroy() });
  }

  dust(x: number, y: number): void {
    this.dustFx.explode(8, x, y - 6);
  }

  damageNumber(x: number, y: number, value: number): void {
    const t = this.scene.add.text(x + Phaser.Math.Between(-12, 12), y, `${value}`, {
      fontFamily: '"Noto Serif KR", serif', fontSize: '30px', fontStyle: 'bold',
      color: '#fff1c9', stroke: '#5a1a12', strokeThickness: 5,
    }).setOrigin(0.5).setDepth(DEPTH.effects + 1);
    this.scene.tweens.add({ targets: t, y: y - 50, alpha: 0, duration: 650, ease: 'Cubic.easeOut', onComplete: () => t.destroy() });
  }
}
