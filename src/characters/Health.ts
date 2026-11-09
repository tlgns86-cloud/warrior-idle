import Phaser from 'phaser';

/** 체력 컴포넌트. 플레이어와 허수아비가 함께 사용한다. */
export class Health extends Phaser.Events.EventEmitter {
  static readonly CHANGED = 'changed';
  static readonly DEPLETED = 'depleted';

  private _hp: number;

  constructor(public readonly max: number) {
    super();
    this._hp = max;
  }

  get hp(): number {
    return this._hp;
  }

  get ratio(): number {
    return this._hp / this.max;
  }

  get alive(): boolean {
    return this._hp > 0;
  }

  damage(amount: number): void {
    if (!this.alive) return;
    this.set(this._hp - amount);
    if (!this.alive) this.emit(Health.DEPLETED);
  }

  heal(amount: number): void {
    this.set(this._hp + amount);
  }

  reset(): void {
    this.set(this.max);
  }

  private set(v: number): void {
    const next = Phaser.Math.Clamp(Math.round(v), 0, this.max);
    if (next === this._hp) return;
    this._hp = next;
    this.emit(Health.CHANGED, this._hp, this.max);
  }
}
