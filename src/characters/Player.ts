import Phaser from 'phaser';
import { DEPTH, GROUND_Y, PLAYER, SPRITE, WORLD_W } from '../config';
import { animKey, type Direction } from '../assets/manifest';
import type { InputFrame } from '../input/Controls';
import { Health } from './Health';

export type PlayerState = 'idle' | 'walk' | 'attack' | 'dead';

/**
 * 플레이어 무사.
 * 상태 머신: idle ⇄ walk → attack(1회 재생, 이동/다른 애니 잠금) → idle|walk
 */
export class Player extends Phaser.GameObjects.Sprite {
  static readonly ATTACK_HIT = 'attack-hit';

  readonly health = new Health(PLAYER.maxHp);
  state: PlayerState = 'idle';
  facing: Direction = 'right';

  private bufferedAttack = false;
  private lastInput: InputFrame = { left: false, right: false, attackPressed: false };

  constructor(scene: Phaser.Scene, x: number) {
    super(scene, x, GROUND_Y, 'warrior_idle_right_0');
    // 기준점 (128, 240) 을 스프라이트 원점으로
    this.setOrigin(SPRITE.pivotX / SPRITE.frameSize, SPRITE.pivotY / SPRITE.frameSize);
    this.setDepth(DEPTH.player);
    scene.add.existing(this);

    this.on(Phaser.Animations.Events.ANIMATION_UPDATE, this.onAnimUpdate, this);
    this.on(Phaser.Animations.Events.ANIMATION_COMPLETE, this.onAnimComplete, this);
    this.health.on(Health.DEPLETED, () => this.die());

    this.playLoop('idle');
  }

  update(dt: number, input: InputFrame): void {
    this.lastInput = input;
    if (this.state === 'dead') return;

    if (this.state === 'attack') {
      // 공격 후반부에 누른 입력만 1회 예약 (누르고 있기만 하면 반복되지 않음)
      if (input.attackPressed && this.attackFrameIndex() >= PLAYER.bufferFromFrame) {
        this.bufferedAttack = true;
      }
      return;
    }

    if (input.attackPressed) {
      this.startAttack(input);
      return;
    }

    const dir = (input.right ? 1 : 0) - (input.left ? 1 : 0);
    if (dir !== 0) {
      this.facing = dir > 0 ? 'right' : 'left';
      this.x = Phaser.Math.Clamp(this.x + dir * PLAYER.speed * dt, 80, WORLD_W - 80);
      this.playLoop('walk');
    } else {
      this.playLoop('idle');
    }
  }

  /** 바라보는 방향 앞쪽의 공격 판정 영역 */
  getAttackHitbox(): Phaser.Geom.Rectangle {
    const r = PLAYER.attackRange;
    const w = r.far - r.near;
    const x = this.facing === 'right' ? this.x + r.near : this.x - r.far;
    return new Phaser.Geom.Rectangle(x, this.y - r.top, w, r.top - r.bottom);
  }

  respawn(x: number): void {
    this.health.reset();
    this.x = x;
    this.state = 'idle';
    this.clearTint().setAlpha(1);
    this.playLoop('idle');
  }

  private startAttack(input: InputFrame): void {
    // 공격 직전 입력 방향으로 돌아선 뒤 그 방향으로만 공격
    if (input.left !== input.right) this.facing = input.right ? 'right' : 'left';
    this.state = 'attack';
    this.bufferedAttack = false;
    this.play(animKey('attack', this.facing));
  }

  private playLoop(name: 'idle' | 'walk'): void {
    this.state = name;
    this.play(animKey(name, this.facing), true);
  }

  private attackFrameIndex(): number {
    const anim = this.anims.currentAnim;
    const frame = this.anims.currentFrame;
    return anim && frame ? anim.frames.indexOf(frame) : -1;
  }

  private onAnimUpdate(anim: Phaser.Animations.Animation, frame: Phaser.Animations.AnimationFrame): void {
    if (this.state !== 'attack' || !anim.key.startsWith('warrior_attack')) return;
    if (anim.frames.indexOf(frame) === PLAYER.hitFrame) {
      this.emit(Player.ATTACK_HIT, this.getAttackHitbox(), this.facing);
    }
  }

  private onAnimComplete(anim: Phaser.Animations.Animation): void {
    if (this.state !== 'attack' || !anim.key.startsWith('warrior_attack')) return;
    if (this.bufferedAttack) {
      this.startAttack(this.lastInput);
      return;
    }
    const moving = this.lastInput.left !== this.lastInput.right;
    this.playLoop(moving ? 'walk' : 'idle');
  }

  private die(): void {
    this.state = 'dead';
    this.anims.stop();
    this.setTexture(`warrior_idle_${this.facing}_0`);
    this.setTint(0x777777);
    this.scene.tweens.add({ targets: this, alpha: 0.3, duration: 600 });
    this.scene.time.delayedCall(1800, () => this.respawn(PLAYER.startX));
  }
}
