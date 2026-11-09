import Phaser from 'phaser';

/** 화면 좌상단 플레이어 체력바 (단청 느낌 테두리) */
export class HealthBar extends Phaser.GameObjects.Container {
  private gfx: Phaser.GameObjects.Graphics;
  private label: Phaser.GameObjects.Text;
  private value: Phaser.GameObjects.Text;
  private shown = 1;
  private target = 1;
  private readonly barW = 260;
  private readonly barH = 18;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y);
    this.gfx = scene.add.graphics();
    this.label = scene.add.text(0, -2, '체력', {
      fontFamily: '"Noto Serif KR", "Malgun Gothic", serif', fontSize: '20px', fontStyle: 'bold', color: '#f0d9a6', stroke: '#1a1018', strokeThickness: 4,
    }).setOrigin(0, 0.5);
    this.value = scene.add.text(56 + this.barW - 6, -2, '', {
      fontFamily: 'sans-serif', fontSize: '14px', color: '#fff4dc', stroke: '#1a1018', strokeThickness: 3,
    }).setOrigin(1, 0.5);
    this.add([this.gfx, this.label, this.value]);
    scene.add.existing(this);
    scene.events.on(Phaser.Scenes.Events.UPDATE, this.tick, this);
  }

  setHp(hp: number, max: number): void {
    this.target = hp / max;
    this.value.setText(`${hp} / ${max}`);
  }

  private tick(): void {
    // 잔상 게이지가 천천히 따라옴
    this.shown += (this.target - this.shown) * (this.target < this.shown ? 0.06 : 0.3);
    this.draw();
  }

  private draw(): void {
    const g = this.gfx.clear();
    const x = 56, y = -this.barH / 2, w = this.barW, h = this.barH;
    g.fillStyle(0x1a1018, 0.85).fillRect(x - 6, y - 6, w + 12, h + 12);
    g.lineStyle(2, 0xc9a45c, 1).strokeRect(x - 4, y - 4, w + 8, h + 8);
    g.fillStyle(0x3a1c22).fillRect(x, y, w, h);
    g.fillStyle(0xf2e2b8, 0.8).fillRect(x, y, Math.round(w * this.shown), h);
    const c = this.target > 0.5 ? 0xb8322a : this.target > 0.25 ? 0xd06a2a : 0xe0402e;
    g.fillStyle(c).fillRect(x, y, Math.round(w * this.target), h);
    g.fillStyle(0xffffff, 0.2).fillRect(x, y, Math.round(w * this.target), 4);
    // 모서리 장식
    g.fillStyle(0x2f6b5c).fillRect(x - 8, y - 8, 8, 8).fillRect(x + w, y - 8, 8, 8).fillRect(x - 8, y + h, 8, 8).fillRect(x + w, y + h, 8, 8);
  }
}
