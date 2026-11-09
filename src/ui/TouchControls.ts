import Phaser from 'phaser';
import { touchState } from '../input/Controls';

type ButtonId = 'left' | 'right' | 'attack';

interface Button {
  id: ButtonId;
  x: number;
  y: number;
  r: number;
  gfx: Phaser.GameObjects.Graphics;
  label: Phaser.GameObjects.Text;
}

/**
 * 모바일 터치 버튼. 멀티터치 지원:
 * 각 포인터가 어떤 버튼 위에 있는지 매 이벤트마다 다시 계산해서
 * 이동 버튼을 누른 채로 공격 버튼을 함께 누를 수 있다.
 * 공격은 '새로 누른 순간'에만 1회 발동 (누르고 있어도 반복 안 됨).
 */
export class TouchControls {
  private buttons: Button[] = [];
  /** 포인터 id → 현재 누르고 있는 버튼 */
  private held = new Map<number, ButtonId | null>();
  private visible = false;

  constructor(private scene: Phaser.Scene) {
    this.buttons = (['left', 'right', 'attack'] as ButtonId[]).map((id) => ({
      id, x: 0, y: 0, r: 0,
      gfx: scene.add.graphics(),
      label: scene.add.text(0, 0, id === 'left' ? '◀' : id === 'right' ? '▶' : '斬', {
        fontFamily: '"Noto Serif KR", serif', fontSize: '32px', color: '#f3e3bd',
      }).setOrigin(0.5),
    }));

    const input = scene.input;
    input.addPointer(3); // 기본 포함 총 4개 동시 터치
    input.on(Phaser.Input.Events.POINTER_DOWN, this.onDown, this);
    input.on(Phaser.Input.Events.POINTER_MOVE, this.onMove, this);
    input.on(Phaser.Input.Events.POINTER_UP, this.onUp, this);
    input.on(Phaser.Input.Events.POINTER_UP_OUTSIDE, this.onUp, this);
    input.on(Phaser.Input.Events.GAME_OUT, () => this.releaseAll());

    this.setVisible(scene.sys.game.device.input.touch);
    this.layout();
    scene.scale.on(Phaser.Scale.Events.RESIZE, this.layout, this);
  }

  private setVisible(v: boolean): void {
    this.visible = v;
    for (const b of this.buttons) {
      b.gfx.setVisible(v);
      b.label.setVisible(v);
    }
  }

  /** 화면 크기에 맞춰 버튼 크기·위치 자동 배치 */
  layout(): void {
    const { width: w, height: h } = this.scene.scale;
    const r = Phaser.Math.Clamp(h * 0.085, 44, 68);
    const R = r * 1.3;
    const pad = Math.max(28, w * 0.03);
    const by = h - pad - R;
    const pos: Record<ButtonId, [number, number, number]> = {
      left: [pad + r, by + (R - r), r],
      right: [pad + r * 3 + 18, by + (R - r), r],
      attack: [w - pad - R, by, R],
    };
    for (const b of this.buttons) {
      [b.x, b.y, b.r] = pos[b.id];
      b.label.setPosition(b.x, b.y).setFontSize(Math.round(b.r * (b.id === 'attack' ? 0.62 : 0.55)));
    }
    this.redraw();
  }

  private hit(px: number, py: number): ButtonId | null {
    for (const b of this.buttons) {
      // 터치 판정은 보이는 원보다 약간 넓게
      if (Phaser.Math.Distance.Between(px, py, b.x, b.y) <= b.r * 1.3) return b.id;
    }
    return null;
  }

  private onDown(p: Phaser.Input.Pointer): void {
    if (p.wasTouch && !this.visible) this.setVisible(true);
    if (!this.visible) return;
    const id = this.hit(p.x, p.y);
    this.held.set(p.id, id);
    if (id === 'attack') touchState.attackQueued = true;
    this.sync();
  }

  private onMove(p: Phaser.Input.Pointer): void {
    if (!p.isDown || !this.held.has(p.id)) return;
    const id = this.hit(p.x, p.y);
    const prev = this.held.get(p.id);
    // 이동 버튼끼리는 미끄러지듯 전환 가능, 공격은 새 터치로만 발동
    if (id === 'attack' && prev !== 'attack') {
      this.held.set(p.id, null);
    } else if (prev !== 'attack') {
      this.held.set(p.id, id);
    } else if (id !== 'attack') {
      this.held.set(p.id, null);
    }
    this.sync();
  }

  private onUp(p: Phaser.Input.Pointer): void {
    this.held.delete(p.id);
    this.sync();
  }

  private releaseAll(): void {
    this.held.clear();
    this.sync();
  }

  private sync(): void {
    const ids = new Set(this.held.values());
    touchState.left = ids.has('left');
    touchState.right = ids.has('right');
    this.redraw(ids);
  }

  private redraw(active: Set<ButtonId | null> = new Set()): void {
    for (const b of this.buttons) {
      const on = active.has(b.id);
      const g = b.gfx.clear();
      const accent = b.id === 'attack' ? 0xb8322a : 0xc9a45c;
      g.fillStyle(0x140e18, on ? 0.55 : 0.32).fillCircle(b.x, b.y, b.r);
      g.lineStyle(3, accent, on ? 1 : 0.7).strokeCircle(b.x, b.y, b.r);
      g.lineStyle(1, 0xf3e3bd, on ? 0.6 : 0.25).strokeCircle(b.x, b.y, b.r - 6);
      if (on) g.fillStyle(accent, 0.3).fillCircle(b.x, b.y, b.r - 6);
      b.label.setAlpha(on ? 1 : 0.8);
    }
  }
}
