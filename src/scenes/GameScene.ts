import Phaser from 'phaser';
import { DUMMY, PLAYER, VIEW_H, WORLD_W } from '../config';
import type { Direction } from '../assets/manifest';
import { Background } from '../world/Background';
import { Player } from '../characters/Player';
import { TrainingDummy } from '../characters/TrainingDummy';
import { Health } from '../characters/Health';
import { Effects } from '../combat/Effects';
import { CombatSystem } from '../combat/CombatSystem';
import { Controls } from '../input/Controls';

export const GAME_EVENTS = {
  PLAYER_HP: 'player-hp',
} as const;

export class GameScene extends Phaser.Scene {
  private background!: Background;
  private player!: Player;
  private controls!: Controls;
  private combat!: CombatSystem;

  constructor() {
    super('Game');
  }

  create(): void {
    this.background = new Background(this);
    const effects = new Effects(this);

    this.player = new Player(this, PLAYER.startX);
    const dummies = DUMMY.positions.map((x) => new TrainingDummy(this, x, effects));
    this.combat = new CombatSystem(this, this.player, dummies);
    this.controls = new Controls(this);

    this.player.on(Player.ATTACK_HIT, (hitbox: Phaser.Geom.Rectangle, facing: Direction) =>
      this.combat.resolvePlayerAttack(hitbox, facing));

    // 체력 변화를 UI 씬에 전달
    const emitHp = () => this.game.events.emit(GAME_EVENTS.PLAYER_HP, this.player.health.hp, this.player.health.max);
    this.player.health.on(Health.CHANGED, emitHp);
    this.time.delayedCall(0, emitHp);

    // 카메라: 플레이어를 부드럽게 따라가며 앞쪽을 조금 더 보여준다
    const cam = this.cameras.main;
    cam.setBounds(0, 0, WORLD_W, VIEW_H);
    cam.startFollow(this.player, true, 0.09, 0.09, 0, 0);
    cam.setRoundPixels(true);

    // 디버그 키: H = 체력 테스트(10 감소), B = 공격 판정 표시
    const kb = this.input.keyboard!;
    kb.on('keydown-H', () => this.player.health.damage(10));
    kb.on('keydown-B', () => (this.combat.debug = !this.combat.debug));

    // 체력 자연 회복 (테스트용)
    this.time.addEvent({ delay: 1000, loop: true, callback: () => this.player.health.alive && this.player.health.heal(2) });
  }

  update(_time: number, deltaMs: number): void {
    const dt = Math.min(deltaMs, 50) / 1000;
    this.player.update(dt, this.controls.read());
    const lead = this.player.facing === 'right' ? -90 : 90;
    const cam = this.cameras.main;
    cam.followOffset.x += (lead - cam.followOffset.x) * 0.04;
    this.background.update();
  }
}
