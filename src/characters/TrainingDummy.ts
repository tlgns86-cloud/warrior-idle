import Phaser from 'phaser';
import { DEPTH, DUMMY, GROUND_Y } from '../config';
import { Health } from './Health';
import { Effects } from '../combat/Effects';

/** 훈련용 짚 허수아비. 맞으면 점멸·흔들림, 체력 0 이면 부서지고 일정 시간 후 재생성 */
export class TrainingDummy extends Phaser.GameObjects.Container {
  readonly health = new Health(DUMMY.maxHp);
  private body_: Phaser.GameObjects.Image;
  private hpBar: Phaser.GameObjects.Graphics;
  private flashTimer?: Phaser.Time.TimerEvent;

  constructor(scene: Phaser.Scene, x: number, private effects: Effects) {
    super(scene, x, GROUND_Y);
    this.body_ = scene.add.image(0, 0, 'dummy').setOrigin(0.5, 1);
    this.hpBar = scene.add.graphics();
    this.add([this.body_, this.hpBar]);
    this.setDepth(DEPTH.dummy);
    scene.add.existing(this);

    this.health.on(Health.CHANGED, () => this.drawHpBar());
    this.health.on(Health.DEPLETED, () => this.breakApart());
    this.drawHpBar();
  }

  get alive(): boolean {
    return this.health.alive;
  }

  getHurtBox(): Phaser.Geom.Rectangle {
    return new Phaser.Geom.Rectangle(this.x - DUMMY.hurtWidth / 2, this.y - DUMMY.hurtHeight, DUMMY.hurtWidth, DUMMY.hurtHeight);
  }

  takeHit(damage: number, fromDir: 1 | -1): void {
    if (!this.alive) return;
    this.health.damage(damage);
    this.effects.damageNumber(this.x, this.y - 190, damage);
    this.effects.hitSpark(this.x - fromDir * 8, this.y - 110, fromDir);
    if (!this.alive) return;

    // 짧은 흰색 점멸 2회
    this.flashTimer?.remove();
    let n = 0;
    this.body_.setTintFill(0xffffff);
    this.flashTimer = this.scene.time.addEvent({
      delay: 55, repeat: 3,
      callback: () => {
        n++;
        if (n % 2 === 1) this.body_.clearTint();
        else this.body_.setTintFill(0xffffff);
      },
    });
    // 맞은 방향으로 흔들림
    this.scene.tweens.killTweensOf(this.body_);
    this.body_.angle = 0;
    this.scene.tweens.add({
      targets: this.body_, angle: fromDir * 9, duration: 70, yoyo: true, repeat: 1, ease: 'Sine.easeOut',
      onComplete: () => (this.body_.angle = 0),
    });
  }

  private breakApart(): void {
    this.flashTimer?.remove();
    this.body_.clearTint();
    this.effects.destroyBurst(this.x, this.y - 90);
    this.scene.tweens.killTweensOf(this.body_);
    this.body_.setVisible(false);
    this.hpBar.setVisible(false);

    this.scene.time.delayedCall(DUMMY.respawnMs, () => this.respawn());
  }

  private respawn(): void {
    this.health.reset();
    this.body_.setVisible(true).setAlpha(0).setScale(1, 0.2).setAngle(0);
    this.hpBar.setVisible(true);
    this.effects.dust(this.x, this.y);
    this.scene.tweens.add({ targets: this.body_, alpha: 1, scaleY: 1, duration: 380, ease: 'Back.easeOut' });
  }

  private drawHpBar(): void {
    const g = this.hpBar;
    const w = 72, h = 8, y = -205;
    g.clear();
    g.fillStyle(0x1a1410, 0.85).fillRect(-w / 2 - 2, y - 2, w + 4, h + 4);
    g.fillStyle(0x4a2a22, 1).fillRect(-w / 2, y, w, h);
    const r = this.health.ratio;
    const color = r > 0.5 ? 0xd9b54a : r > 0.25 ? 0xd9802f : 0xc8392b;
    g.fillStyle(color, 1).fillRect(-w / 2, y, Math.round(w * r), h);
    g.fillStyle(0xffffff, 0.25).fillRect(-w / 2, y, Math.round(w * r), 2);
  }
}
