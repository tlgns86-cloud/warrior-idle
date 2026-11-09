import Phaser from 'phaser';
import { HealthBar } from '../ui/HealthBar';
import { TouchControls } from '../ui/TouchControls';
import { GAME_EVENTS } from './GameScene';

/** 게임 화면 위에 겹쳐지는 UI 전용 씬 (카메라 이동 영향 없음) */
export class UIScene extends Phaser.Scene {
  constructor() {
    super('UI');
  }

  create(): void {
    const hp = new HealthBar(this, 24, 34);
    const onHp = (v: number, max: number) => hp.setHp(v, max);
    this.game.events.on(GAME_EVENTS.PLAYER_HP, onHp);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.game.events.off(GAME_EVENTS.PLAYER_HP, onHp));

    new TouchControls(this);

    // PC 조작 안내 (잠시 후 사라짐)
    if (!this.sys.game.device.input.touch) {
      const hint = this.add.text(this.scale.width / 2, this.scale.height - 28, 'A / D · ← / → 이동    Space 공격', {
        fontFamily: '"Noto Serif KR", serif', fontSize: '18px', color: '#f3e3bd', stroke: '#1a1018', strokeThickness: 4,
      }).setOrigin(0.5);
      this.tweens.add({ targets: hint, alpha: 0, delay: 6000, duration: 1200 });
      this.scale.on(Phaser.Scale.Events.RESIZE, () => hint.setPosition(this.scale.width / 2, this.scale.height - 28));
    }

    this.createFullscreenButton();
  }

  /** 모바일: 전체화면 + 가로 고정 시도 */
  private createFullscreenButton(): void {
    if (!this.sys.game.device.input.touch || !this.scale.fullscreen.available) return;
    const btn = this.add.text(this.scale.width - 20, 20, '⛶', {
      fontSize: '30px', color: '#f3e3bd', backgroundColor: '#140e1888', padding: { x: 8, y: 2 },
    }).setOrigin(1, 0).setInteractive();
    btn.on('pointerup', async () => {
      if (this.scale.isFullscreen) {
        this.scale.stopFullscreen();
        return;
      }
      this.scale.startFullscreen();
      try {
        await (screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> }).lock?.('landscape');
      } catch {
        /* 지원하지 않는 브라우저는 무시 */
      }
    });
    this.scale.on(Phaser.Scale.Events.RESIZE, () => btn.setPosition(this.scale.width - 20, 20));
  }
}
