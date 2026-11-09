import Phaser from 'phaser';
import { PLAYER } from '../config';
import type { Direction } from '../assets/manifest';
import type { Player } from '../characters/Player';
import type { TrainingDummy } from '../characters/TrainingDummy';

/** 플레이어의 베기 판정을 허수아비들에 적용한다. */
export class CombatSystem {
  /** true 면 판정 영역을 화면에 표시 (디버그) */
  debug = false;
  private debugGfx?: Phaser.GameObjects.Graphics;

  constructor(private scene: Phaser.Scene, private player: Player, private targets: TrainingDummy[]) {}

  resolvePlayerAttack(hitbox: Phaser.Geom.Rectangle, facing: Direction): void {
    const dir = facing === 'right' ? 1 : -1;
    let hitAny = false;
    for (const t of this.targets) {
      if (!t.alive) continue;
      // 바라보는 방향 앞쪽에 있는 대상만 (등 뒤 판정 방지)
      if ((t.x - this.player.x) * dir < -20) continue;
      if (Phaser.Geom.Rectangle.Overlaps(hitbox, t.getHurtBox())) {
        t.takeHit(PLAYER.attackDamage, dir);
        hitAny = true;
      }
    }
    if (hitAny) this.hitStop(60);
    if (this.debug) this.drawDebug(hitbox);
  }

  /** 타격감을 위한 짧은 정지 */
  private hitStop(ms: number): void {
    this.player.anims.pause();
    this.scene.time.delayedCall(ms, () => this.player.anims.resume());
  }

  private drawDebug(r: Phaser.Geom.Rectangle): void {
    this.debugGfx ??= this.scene.add.graphics().setDepth(999);
    const g = this.debugGfx.clear();
    g.lineStyle(2, 0xff3355).strokeRectShape(r);
    g.lineStyle(2, 0x33ff88);
    for (const t of this.targets) g.strokeRectShape(t.getHurtBox());
    this.scene.time.delayedCall(250, () => g.clear());
  }
}
