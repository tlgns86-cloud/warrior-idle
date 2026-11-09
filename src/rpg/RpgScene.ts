import Phaser from 'phaser';
import { monsterKey } from '../idle/monsterArt';
import { MANIFEST_KEY, heroUrl, type AssetManifest } from '../assets/manifest';
import type { MonsterKind } from '../idle/model';

// 탑다운 필드 RPG 미리보기: 주인공 이미지가 실제 필드 플레이에서 어떻게 보이는지 확인용 프로토타입.

const T = 64; // 타일 크기
const COLS = 48, ROWS = 36;
const WORLD_W = COLS * T, WORLD_H = ROWS * T;
const HERO_ORIGIN = { x: 88 / 176, y: 232 / 240 };
/** 필드에서는 주인공 이미지(캐릭터 키 220px)를 절반 크기로 표시 */
const HERO_SCALE = 0.5;
const FONT = '"Noto Serif KR", serif';
const HUD_DEPTH = 1_000_000;

interface Mob {
  kind: MonsterKind; name: string;
  c: Phaser.GameObjects.Container; body: Phaser.GameObjects.Image; bar: Phaser.GameObjects.Graphics;
  x: number; y: number; homeX: number; homeY: number; tx: number; ty: number;
  hp: number; maxHp: number; atk: number; exp: number;
  aggro: boolean; nextThink: number; nextAtk: number; dead: boolean; r: number;
}

interface Obstacle { x: number; y: number; r?: number; w?: number; h?: number }

const MOB_TYPES: Record<MonsterKind, { name: string; hp: number; atk: number; exp: number; scale: number }> = {
  bandit: { name: '산적', hp: 60, atk: 8, exp: 12, scale: 0.55 },
  wisp: { name: '도깨비불', hp: 45, atk: 6, exp: 9, scale: 0.45 },
  goblin: { name: '도깨비', hp: 110, atk: 13, exp: 22, scale: 0.6 },
  ghost: { name: '원귀', hp: 80, atk: 10, exp: 16, scale: 0.55 },
  fox: { name: '구미호', hp: 160, atk: 16, exp: 35, scale: 0.6 },
};

// 간단한 시드 난수 (매번 같은 지도)
let seed = 7;
const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

export class RpgScene extends Phaser.Scene {
  private hero!: Phaser.GameObjects.Image;
  private heroShadow!: Phaser.GameObjects.Image;
  private nameTag!: Phaser.GameObjects.Text;
  private hx = 0; private hy = 0;
  private facing = 1;
  private moveTo: { x: number; y: number } | null = null;
  private target: Mob | null = null;
  private attackT = -1; private hitDone = false; private atkCd = 0;
  private hp = 200; private maxHp = 200; private mp = 80; private maxMp = 80;
  private lv = 1; private exp = 0;
  private dead = false;
  private mobs: Mob[] = [];
  private obstacles: Obstacle[] = [];
  private keys!: Record<string, Phaser.Input.Keyboard.Key>;
  private marker!: Phaser.GameObjects.Image;
  private hud!: { g: Phaser.GameObjects.Graphics; lv: Phaser.GameObjects.Text; hpT: Phaser.GameObjects.Text; mpT: Phaser.GameObjects.Text;
    expT: Phaser.GameObjects.Text; btn: Phaser.GameObjects.Container; hint: Phaser.GameObjects.Text; area: Phaser.GameObjects.Text };
  private sparks!: Phaser.GameObjects.Particles.ParticleEmitter;

  constructor() { super('Rpg'); }

  preload(): void {
    this.load.image('hero', heroUrl(this.cache.json.get(MANIFEST_KEY) as AssetManifest | undefined));
  }

  create(): void {
    seed = 7;
    makeFieldTextures(this);
    // 절반 크기로 줄여 그리므로 부드럽게 보간 (나머지 픽셀아트는 nearest 유지)
    this.textures.get('hero').setFilter(Phaser.Textures.FilterMode.LINEAR);
    this.buildMap();

    this.hx = 9 * T; this.hy = 15 * T;
    this.heroShadow = this.add.image(0, 0, 'rg_shadow').setScale(0.9, 0.8);
    this.hero = this.add.image(0, 0, 'hero').setOrigin(HERO_ORIGIN.x, HERO_ORIGIN.y);
    this.nameTag = this.add.text(0, 0, '무사', { fontFamily: FONT, fontSize: '15px', color: '#ffffff', stroke: '#000', strokeThickness: 4 })
      .setOrigin(0.5, 1);
    this.marker = this.add.image(0, 0, 'rg_marker').setVisible(false).setDepth(1);

    this.spawnMobs();

    this.sparks = this.add.particles(0, 0, 'fx_spark', {
      emitting: false, lifespan: { min: 150, max: 300 }, speed: { min: 120, max: 320 },
      scale: { start: 1, end: 0 }, blendMode: 'ADD', tint: [0xfff2c2, 0xffc85a, 0xffffff],
    }).setDepth(HUD_DEPTH - 10);

    const cam = this.cameras.main;
    cam.setBounds(0, 0, WORLD_W, WORLD_H).setRoundPixels(true);
    cam.startFollow(this.heroShadow, true, 0.12, 0.12);
    cam.setBackgroundColor('#1c2a18');

    const kb = this.input.keyboard!;
    this.keys = kb.addKeys('W,A,S,D,UP,DOWN,LEFT,RIGHT,SPACE') as Record<string, Phaser.Input.Keyboard.Key>;
    kb.on('keydown-SPACE', () => this.attackNearest());

    this.input.on(Phaser.Input.Events.POINTER_DOWN, (p: Phaser.Input.Pointer, over: Phaser.GameObjects.GameObject[]) => {
      if (over.some((o) => o.getData('hud'))) return;
      const wx = p.worldX, wy = p.worldY;
      const mob = this.mobs.find((m) => !m.dead && Math.abs(wx - m.x) < 60 && wy < m.y + 25 && wy > m.y - 110);
      if (mob) { this.target = mob; this.moveTo = null; this.marker.setVisible(false); return; }
      this.target = null;
      this.moveTo = { x: wx, y: wy };
      this.marker.setPosition(wx, wy).setVisible(true).setScale(1.4).setAlpha(1);
      this.tweens.add({ targets: this.marker, scale: 0.8, alpha: 0.6, duration: 250 });
    });

    this.buildHud();
    this.scale.on(Phaser.Scale.Events.RESIZE, () => this.layoutHud());
    this.layoutHud();
    this.placeHero(0);
    this.time.addEvent({ delay: 1000, loop: true, callback: () => {
      if (this.dead) return;
      this.hp = Math.min(this.maxHp, this.hp + 2);
      this.mp = Math.min(this.maxMp, this.mp + 1);
    } });
  }

  // ---------------- 지도 ----------------
  private buildMap(): void {
    const rt = this.add.renderTexture(0, 0, WORLD_W, WORLD_H).setOrigin(0).setDepth(-100000);
    const isRoad = (c: number, r: number) => r === 15 || r === 16 || ((c === 20 || c === 21) && r > 3) || (c >= 20 && c <= 40 && (r === 27 || r === 28));
    const pond = { cx: 36 * T, cy: 9 * T, rx: 6 * T, ry: 4 * T };
    const inPond = (x: number, y: number) => ((x - pond.cx) / pond.rx) ** 2 + ((y - pond.cy) / pond.ry) ** 2 < 1;
    const village = new Phaser.Geom.Rectangle(2 * T, 4 * T, 15 * T, 10 * T);

    rt.beginDraw();
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const x = c * T, y = r * T;
        let key = `rg_grass${Math.floor(rnd() * 4)}`;
        if (c > 30 && r > 18) key = `rg_dark${Math.floor(rnd() * 2)}`;
        if (village.contains(x + 32, y + 32)) key = 'rg_yard';
        if (isRoad(c, r)) key = 'rg_dirt';
        rt.batchDraw(key, x, y);
        if (inPond(x + 32, y + 32)) rt.batchDraw('rg_water', x, y);
      }
    }
    rt.endDraw();
    this.blockedPond = inPond;

    // 마을: 기와집 + 담장
    for (const [c, r] of [[4, 6], [10, 6], [4, 10.5]] as const) this.addHouse(c * T, r * T);
    this.add.image(13 * T, 11.2 * T, 'rg_well').setOrigin(0.5, 0.85).setDepth(11.2 * T);
    this.obstacles.push({ x: 13 * T, y: 11.2 * T - 6, r: 26 });
    const sign = this.add.text(18 * T, 13.6 * T, '◀ 마을  |  사냥터 ▶', { fontFamily: FONT, fontSize: '14px', color: '#f3e3bd',
      backgroundColor: '#3a2614', padding: { x: 8, y: 4 } }).setOrigin(0.5, 1);
    sign.setDepth(sign.y);

    // 나무 / 바위 / 꽃
    let placed = 0;
    while (placed < 150) {
      const x = 40 + rnd() * (WORLD_W - 80), y = 60 + rnd() * (WORLD_H - 80);
      const c = Math.floor(x / T), r = Math.floor(y / T);
      if (isRoad(c, r) || isRoad(c, r + 1) || inPond(x, y + 30) || village.contains(x, y)) continue;
      if (Math.hypot(x - 9 * T, y - 15 * T) < 200) continue;
      const roll = rnd();
      if (roll < 0.62) {
        const dark = c > 30 && r > 18;
        const t = this.add.image(x, y, dark ? 'rg_pine' : 'rg_tree').setOrigin(0.5, 0.92).setDepth(y).setScale(0.85 + rnd() * 0.35);
        if (rnd() < 0.5) t.setFlipX(true);
        this.obstacles.push({ x, y: y - 6, r: 20 });
      } else if (roll < 0.75) {
        this.add.image(x, y, 'rg_rock').setOrigin(0.5, 0.8).setDepth(y).setScale(0.8 + rnd() * 0.5);
        this.obstacles.push({ x, y: y - 6, r: 18 });
      } else {
        this.add.image(x, y, rnd() < 0.5 ? 'rg_flower' : 'rg_tuft').setOrigin(0.5, 1).setDepth(y - 40);
      }
      placed++;
    }
  }

  private blockedPond: (x: number, y: number) => boolean = () => false;

  private addHouse(x: number, y: number): void {
    this.add.image(x + 96, y + 150, 'rg_house').setOrigin(0.5, 1).setDepth(y + 150);
    this.obstacles.push({ x: x + 96, y: y + 110, w: 190, h: 60 });
  }

  private blocked(x: number, y: number): boolean {
    if (x < 20 || y < 40 || x > WORLD_W - 20 || y > WORLD_H - 10) return true;
    if (this.blockedPond(x, y)) return true;
    for (const o of this.obstacles) {
      if (o.r && o.r > 0 && Math.hypot(x - o.x, (y - o.y) * 1.4) < o.r + 12) return true;
      if (o.w && Math.abs(x - o.x) < o.w / 2 && Math.abs(y - o.y) < o.h! / 2) return true;
    }
    return false;
  }

  // ---------------- 몬스터 ----------------
  private spawnMobs(): void {
    const zones: [MonsterKind, number, number, number][] = [
      ['bandit', 27, 13, 5], ['bandit', 14, 22, 4], ['wisp', 34, 9, 0], ['ghost', 8, 28, 4], ['goblin', 38, 22, 4], ['fox', 42, 31, 3],
    ];
    for (const [kind, c, r, n] of zones) {
      const count = kind === 'wisp' ? 5 : n;
      for (let i = 0; i < count; i++) {
        let x = 0, y = 0, tries = 0;
        do {
          if (kind === 'wisp') { const a = rnd() * Math.PI * 2; x = 36 * T + Math.cos(a) * 7 * T; y = 9 * T + Math.sin(a) * 5 * T; }
          else { x = c * T + (rnd() - 0.5) * 6 * T; y = r * T + (rnd() - 0.5) * 5 * T; }
        } while (this.blocked(x, y) && ++tries < 30);
        this.makeMob(kind, x, y);
      }
    }
  }

  private makeMob(kind: MonsterKind, x: number, y: number): Mob {
    const t = MOB_TYPES[kind];
    const shadow = this.add.image(0, 0, 'rg_shadow').setScale(t.scale * 1.3, t.scale * 1.1);
    const body = this.add.image(0, 0, monsterKey(kind)).setOrigin(0.5, 0.97).setScale(t.scale);
    const name = this.add.text(0, -body.displayHeight - 16, t.name, { fontFamily: FONT, fontSize: '13px', color: '#ffd0a0',
      stroke: '#000', strokeThickness: 3 }).setOrigin(0.5, 1);
    const bar = this.add.graphics();
    const c = this.add.container(x, y, [shadow, body, bar, name]);
    const m: Mob = { kind, name: t.name, c, body, bar, x, y, homeX: x, homeY: y, tx: x, ty: y, hp: t.hp, maxHp: t.hp, atk: t.atk,
      exp: t.exp, aggro: false, nextThink: 0, nextAtk: 0, dead: false, r: body.displayWidth / 2 };
    this.tweens.add({ targets: body, scaleY: t.scale * 0.95, scaleX: t.scale * 1.04, duration: 420 + rnd() * 200, yoyo: true, repeat: -1 });
    if (kind === 'wisp' || kind === 'ghost') this.tweens.add({ targets: body, y: -8, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    this.drawMobBar(m);
    this.mobs.push(m);
    return m;
  }

  private drawMobBar(m: Mob): void {
    const g = m.bar.clear();
    if (m.hp >= m.maxHp) return;
    const w = 50, y = -m.body.displayHeight - 12;
    g.fillStyle(0x000000, 0.7).fillRect(-w / 2 - 1, y - 1, w + 2, 6);
    g.fillStyle(0xd83a2a, 1).fillRect(-w / 2, y, w * Math.max(0, m.hp / m.maxHp), 4);
  }

  private updateMobs(dt: number, now: number): void {
    for (const m of this.mobs) {
      if (m.dead) continue;
      const dHero = Math.hypot(this.hx - m.x, this.hy - m.y);
      let speed = 45;
      if (m.aggro && !this.dead) {
        if (Math.hypot(m.x - m.homeX, m.y - m.homeY) > 500) { m.aggro = false; m.hp = m.maxHp; this.drawMobBar(m); }
        m.tx = this.hx + (m.x > this.hx ? 55 : -55); m.ty = this.hy;
        speed = 95;
        if (dHero < 75 && now > m.nextAtk) { m.nextAtk = now + 1300; this.mobAttack(m); }
      } else if (now > m.nextThink) {
        m.nextThink = now + 1800 + rnd() * 2500;
        m.tx = m.homeX + (rnd() - 0.5) * 220; m.ty = m.homeY + (rnd() - 0.5) * 160;
      }
      const dx = m.tx - m.x, dy = m.ty - m.y, d = Math.hypot(dx, dy);
      if (d > 4) {
        const step = Math.min(d, speed * dt);
        const nx = m.x + (dx / d) * step, ny = m.y + (dy / d) * step;
        if (!this.blocked(nx, ny) || m.kind === 'wisp' || m.kind === 'ghost') { m.x = nx; m.y = ny; }
        else m.nextThink = 0;
        m.body.setFlipX(dx > 0); // 몬스터 그림은 왼쪽을 본다
      }
      m.c.setPosition(Math.round(m.x), Math.round(m.y)).setDepth(m.y);
    }
  }

  private mobAttack(m: Mob): void {
    const dir = this.hx > m.x ? 1 : -1;
    this.tweens.add({ targets: m.body, x: dir * 16, duration: 90, yoyo: true });
    this.time.delayedCall(90, () => {
      if (m.dead || this.dead) return;
      const dmg = Math.round(m.atk * (0.8 + rnd() * 0.4));
      this.hp -= dmg;
      this.floatText(this.hx, this.hy - 120, `-${dmg}`, '#ff6b5a', 20);
      this.hero.setTintFill(0xff5040);
      this.time.delayedCall(80, () => this.hero.clearTint());
      if (this.hp <= 0) this.heroDie();
    });
  }

  // ---------------- 주인공 ----------------
  private attackNearest(): void {
    let best: Mob | null = null, bd = 260;
    for (const m of this.mobs) {
      if (m.dead) continue;
      const d = Math.hypot(m.x - this.hx, m.y - this.hy);
      if (d < bd) { bd = d; best = m; }
    }
    if (best) { this.target = best; this.moveTo = null; }
  }

  update(time: number, deltaMs: number): void {
    const dt = Math.min(deltaMs, 50) / 1000;
    this.updateMobs(dt, time);
    this.atkCd -= dt;
    if (this.dead) { this.updateHud(); return; }

    // 키보드 이동
    const k = this.keys;
    let vx = (k.D.isDown || k.RIGHT.isDown ? 1 : 0) - (k.A.isDown || k.LEFT.isDown ? 1 : 0);
    let vy = (k.S.isDown || k.DOWN.isDown ? 1 : 0) - (k.W.isDown || k.UP.isDown ? 1 : 0);
    if (vx || vy) { this.moveTo = null; this.target = null; this.marker.setVisible(false); }

    // 대상 추적 / 클릭 이동
    if (this.target && this.target.dead) this.target = null;
    let goal: { x: number; y: number } | null = this.moveTo;
    if (this.target) {
      const t = this.target;
      const d = Math.hypot(t.x - this.hx, t.y - this.hy);
      this.facing = t.x >= this.hx ? 1 : -1;
      if (d < 80) {
        goal = null;
        if (this.attackT < 0 && this.atkCd <= 0) { this.attackT = 0; this.hitDone = false; this.atkCd = 0.75; }
      } else goal = { x: t.x - this.facing * 60, y: t.y };
    }
    if (goal && this.attackT < 0) {
      const dx = goal.x - this.hx, dy = goal.y - this.hy, d = Math.hypot(dx, dy);
      if (d < 6) { if (goal === this.moveTo) { this.moveTo = null; this.marker.setVisible(false); } }
      else { vx = dx / d; vy = dy / d; }
    }

    let moving = false;
    if ((vx || vy) && this.attackT < 0) {
      const len = Math.hypot(vx, vy);
      const sp = 190 * dt;
      const nx = this.hx + (vx / len) * sp, ny = this.hy + (vy / len) * sp;
      if (!this.blocked(nx, ny)) { this.hx = nx; this.hy = ny; moving = true; }
      else if (!this.blocked(nx, this.hy)) { this.hx = nx; moving = true; }
      else if (!this.blocked(this.hx, ny)) { this.hy = ny; moving = true; }
      else if (this.moveTo) { this.moveTo = null; this.marker.setVisible(false); }
      if (Math.abs(vx) > 0.15) this.facing = vx > 0 ? 1 : -1;
    }
    this.placeHero(dt, moving);
    this.updateHud();
  }

  /** 단일 이미지에 코드로 베기 자세만 입힌다 (대기·이동 중에는 움직임 없음) */
  private placeHero(dt: number, _moving = false): void {
    let ox = 0, ang = 0;
    const oy = 0;
    if (this.attackT >= 0) {
      this.attackT += dt / 0.5;
      const t = Math.min(1, this.attackT);
      if (t < 0.35) { const k = t / 0.35; ang = -12 * k; ox = -8 * k; }
      else if (t < 0.5) {
        const k = (t - 0.35) / 0.15; ang = -12 + 28 * k; ox = -8 + 30 * k;
        if (!this.hitDone && t >= 0.42) { this.hitDone = true; this.heroHit(); }
      } else { const k = (t - 0.5) / 0.5; ang = 16 * (1 - k); ox = 22 * (1 - k); }
      if (this.attackT >= 1) this.attackT = -1;
    }
    const f = this.facing;
    const x = Math.round(this.hx), y = Math.round(this.hy);
    this.hero.setFlipX(f < 0).setPosition(x + ox * f, y + oy).setAngle(ang * f).setScale(HERO_SCALE).setDepth(y + 0.5);
    this.heroShadow.setPosition(x, y + 2).setDepth(y - 1);
    this.nameTag.setPosition(x, y - 118 + oy).setDepth(HUD_DEPTH - 20);
  }

  private heroHit(): void {
    const t = this.target;
    if (!t || t.dead || Math.hypot(t.x - this.hx, t.y - this.hy) > 95) return;
    const crit = rnd() < 0.15;
    const dmg = Math.round((16 + this.lv * 4 + rnd() * 8) * (crit ? 2 : 1));
    t.hp -= dmg; t.aggro = true;
    this.drawMobBar(t);
    const sx = t.x - this.facing * 10, sy = t.y - t.body.displayHeight * 0.5;
    const s = this.add.image(sx, sy, 'fx_slash').setBlendMode(Phaser.BlendModes.ADD).setDepth(HUD_DEPTH - 11)
      .setFlipX(this.facing < 0).setScale(0.45).setAngle(this.facing * -18);
    this.tweens.add({ targets: s, scaleX: 0.9, scaleY: 0.75, alpha: 0, duration: 160, onComplete: () => s.destroy() });
    this.sparks.explode(crit ? 14 : 7, sx, sy);
    this.floatText(t.x, t.y - t.body.displayHeight - 20, `${dmg}`, crit ? '#ffdd44' : '#ffffff', crit ? 24 : 18);
    t.body.setTintFill(0xffffff);
    this.time.delayedCall(60, () => t.body.clearTint());
    if (crit) this.cameras.main.shake(60, 0.003);
    if (t.hp <= 0) this.killMob(t);
  }

  private killMob(m: Mob): void {
    m.dead = true;
    this.target = null;
    this.tweens.killTweensOf(m.body);
    this.tweens.add({ targets: m.c, alpha: 0, duration: 400, onComplete: () => m.c.setVisible(false) });
    this.floatText(m.x, m.y - 70, `경험치 +${m.exp}`, '#9ad8ff', 15);
    this.exp += m.exp;
    const need = this.lv * 40;
    if (this.exp >= need) {
      this.exp -= need; this.lv++;
      this.maxHp += 30; this.hp = this.maxHp; this.mp = this.maxMp;
      this.floatText(this.hx, this.hy - 150, 'LEVEL UP!', '#ffe28a', 28);
      const ring = this.add.circle(this.hx, this.hy - 50, 20, 0xffe28a, 0).setStrokeStyle(4, 0xffe28a).setDepth(HUD_DEPTH - 12);
      this.tweens.add({ targets: ring, radius: 110, alpha: 0, duration: 600, onComplete: () => ring.destroy() });
    }
    // 잠시 후 제자리에서 다시 등장
    this.time.delayedCall(6000, () => {
      m.dead = false; m.aggro = false; m.hp = m.maxHp; m.x = m.homeX; m.y = m.homeY;
      m.body.setPosition(0, 0);
      m.c.setVisible(true).setAlpha(0).setPosition(m.x, m.y);
      this.drawMobBar(m);
      const t = MOB_TYPES[m.kind];
      this.tweens.add({ targets: m.c, alpha: 1, duration: 500 });
      this.tweens.add({ targets: m.body, scaleY: t.scale * 0.95, scaleX: t.scale * 1.04, duration: 450, yoyo: true, repeat: -1 });
    });
  }

  private heroDie(): void {
    this.dead = true; this.hp = 0; this.target = null; this.moveTo = null;
    this.hero.setTint(0x777788).setAngle(-80 * this.facing);
    this.floatText(this.hx, this.hy - 140, '사망… 마을에서 부활합니다', '#d0d0e0', 18);
    for (const m of this.mobs) m.aggro = false;
    this.time.delayedCall(2200, () => {
      this.dead = false; this.hp = this.maxHp; this.mp = this.maxMp;
      this.hx = 9 * T; this.hy = 15 * T;
      this.hero.clearTint();
      this.placeHero(0);
    });
  }

  private floatText(x: number, y: number, text: string, color: string, size: number): void {
    const t = this.add.text(x, y, text, { fontFamily: FONT, fontSize: `${size}px`, fontStyle: 'bold', color, stroke: '#000', strokeThickness: 4 })
      .setOrigin(0.5).setDepth(HUD_DEPTH - 5);
    this.tweens.add({ targets: t, y: y - 40, alpha: 0, duration: 900, ease: 'Cubic.easeOut', onComplete: () => t.destroy() });
  }

  // ---------------- HUD ----------------
  private buildHud(): void {
    const st = { fontFamily: FONT, fontSize: '13px', color: '#fff', stroke: '#000', strokeThickness: 3 };
    const g = this.add.graphics().setScrollFactor(0).setDepth(HUD_DEPTH);
    const mk = (s: Partial<Phaser.Types.GameObjects.Text.TextStyle> = {}) =>
      this.add.text(0, 0, '', { ...st, ...s }).setScrollFactor(0).setDepth(HUD_DEPTH + 1);
    const lv = mk({ fontSize: '16px', color: '#ffe28a' });
    const hpT = mk(), mpT = mk(), expT = mk({ fontSize: '12px' });
    const area = mk({ fontSize: '15px', color: '#f3e3bd' }).setOrigin(1, 0);
    const hint = mk({ fontSize: '13px', color: '#f3e3bd' }).setOrigin(0.5, 1).setAlpha(0.9);
    hint.setText('클릭/터치: 이동 · 몬스터 클릭: 공격 · WASD/방향키 이동 · Space 근처 몬스터 공격');
    this.tweens.add({ targets: hint, alpha: 0, delay: 9000, duration: 1500 });

    const circle = this.add.circle(0, 0, 38, 0x3a1a14, 0.85).setStrokeStyle(3, 0xc9a45c);
    const label = this.add.text(0, 0, '攻', { fontFamily: FONT, fontSize: '30px', color: '#ffe28a', fontStyle: 'bold' }).setOrigin(0.5);
    const btn = this.add.container(0, 0, [circle, label]).setScrollFactor(0).setDepth(HUD_DEPTH + 2).setSize(80, 80)
      .setInteractive({ useHandCursor: true });
    btn.setData('hud', true);
    btn.on('pointerdown', () => this.attackNearest());
    this.hud = { g, lv, hpT, mpT, expT, btn, hint, area };
  }

  private layoutHud(): void {
    const { width, height } = this.scale;
    this.hud.btn.setPosition(width - 64, height - 84);
    this.hud.hint.setPosition(width / 2, height - 22);
    this.hud.area.setPosition(width - 14, 12);
  }

  private updateHud(): void {
    const { width, height } = this.scale;
    const h = this.hud, g = h.g.clear();
    // 좌상단 상태창
    g.fillStyle(0x120c10, 0.78).fillRoundedRect(10, 10, 240, 74, 8).lineStyle(2, 0x8a6a3a).strokeRoundedRect(10, 10, 240, 74, 8);
    const bar = (y: number, r: number, c: number) => {
      g.fillStyle(0x000000, 0.8).fillRect(80, y, 160, 14);
      g.fillStyle(c, 1).fillRect(81, y + 1, 158 * Math.max(0, r), 12);
    };
    bar(34, this.hp / this.maxHp, 0xd83a2a);
    bar(56, this.mp / this.maxMp, 0x3a6ad8);
    h.lv.setText(`Lv.${this.lv}  무사`).setPosition(20, 14);
    h.hpT.setText(`체력 ${Math.max(0, this.hp)}/${this.maxHp}`).setPosition(86, 33);
    h.mpT.setText(`마력 ${this.mp}/${this.maxMp}`).setPosition(86, 55);
    h.lv.setPosition(84, 13);
    g.fillStyle(0x2a1a10, 1).fillCircle(44, 47, 28).lineStyle(2, 0xc9a45c).strokeCircle(44, 47, 28);
    // 하단 경험치 바
    const need = this.lv * 40;
    g.fillStyle(0x000000, 0.75).fillRect(0, height - 8, width, 8);
    g.fillStyle(0xe8c26a, 1).fillRect(0, height - 7, width * (this.exp / need), 6);
    h.expT.setText(`EXP ${this.exp}/${need}`).setPosition(8, height - 26);
    // 지역 이름
    const c = this.hx / T, r = this.hy / T;
    h.area.setText(c < 17 && r < 14 ? '산골 마을' : c > 30 && r > 18 ? '어두운 숲' : c > 29 && r < 14 ? '연못가' : '마을 외곽 들판');
    this.ensurePortrait();
    void width;
  }

  private portrait?: Phaser.GameObjects.Image;
  private ensurePortrait(): void {
    if (this.portrait) return;
    // 상태창 얼굴: 주인공 이미지의 머리 부분을 잘라서 표시
    this.portrait = this.add.image(44, 47, 'hero').setCrop(42, 22, 76, 70).setScale(0.62).setOrigin(80 / 176, 58 / 240)
      .setScrollFactor(0).setDepth(HUD_DEPTH + 1);
  }
}

// ---------------- 필드 텍스처 (코드로 그린 픽셀 타일) ----------------
function makeFieldTextures(scene: Phaser.Scene): void {
  if (scene.textures.exists('rg_grass0')) return;
  const make = (key: string, w: number, h: number, draw: (g: Phaser.GameObjects.Graphics) => void) => {
    const g = scene.make.graphics({ x: 0, y: 0 }, false);
    draw(g);
    g.generateTexture(key, w, h);
    g.destroy();
  };
  const speckle = (g: Phaser.GameObjects.Graphics, base: number, dots: number[], n: number, s = 4) => {
    g.fillStyle(base).fillRect(0, 0, T, T);
    for (let i = 0; i < n; i++) g.fillStyle(dots[i % dots.length]).fillRect(Math.floor(rnd() * 16) * 4, Math.floor(rnd() * 16) * 4, s, s);
  };
  for (let i = 0; i < 4; i++) make(`rg_grass${i}`, T, T, (g) => {
    speckle(g, 0x4f7a32, [0x5d8a3a, 0x436a2a, 0x6a9a44], 26);
    if (i === 0) { g.fillStyle(0x7aaa4a).fillRect(20, 28, 4, 8).fillRect(26, 24, 4, 12).fillRect(32, 30, 4, 6); }
  });
  for (let i = 0; i < 2; i++) make(`rg_dark${i}`, T, T, (g) => speckle(g, 0x2e4a26, [0x365a2c, 0x26401f, 0x3d6030], 24));
  make('rg_dirt', T, T, (g) => speckle(g, 0xa8885a, [0x9a7a4e, 0xb89868, 0x8a6c44], 22));
  make('rg_yard', T, T, (g) => speckle(g, 0xb8a078, [0xc4ae88, 0xa89068, 0xb09a72], 18));
  make('rg_water', T, T, (g) => {
    g.fillStyle(0x2f6a9a).fillRect(0, 0, T, T);
    for (let i = 0; i < 5; i++) g.fillStyle(0x5a9acc, 0.8).fillRect(Math.floor(rnd() * 12) * 4, Math.floor(rnd() * 15) * 4, 16, 4);
  });
  make('rg_shadow', 80, 28, (g) => g.fillStyle(0x000000, 0.32).fillEllipse(40, 14, 76, 24));
  make('rg_marker', 40, 20, (g) => { g.lineStyle(3, 0xffe28a, 1).strokeEllipse(20, 10, 34, 14); });
  make('rg_tree', 120, 150, (g) => {
    g.fillStyle(0x000000, 0.25).fillEllipse(62, 140, 90, 22);
    g.fillStyle(0x5a3a22).fillRect(52, 92, 16, 50);
    g.fillStyle(0x2f5a24).fillCircle(60, 60, 46).fillCircle(32, 80, 30).fillCircle(88, 80, 30);
    g.fillStyle(0x3f7a30).fillCircle(54, 52, 36).fillCircle(34, 74, 22).fillCircle(84, 72, 22);
    g.fillStyle(0x5a9a40).fillCircle(46, 40, 18).fillCircle(72, 50, 12);
  });
  make('rg_pine', 110, 170, (g) => {
    g.fillStyle(0x000000, 0.3).fillEllipse(55, 160, 80, 20);
    g.fillStyle(0x4a2e1a).fillRect(48, 120, 14, 42);
    for (let i = 0; i < 4; i++) {
      const y = 20 + i * 30, w = 30 + i * 14;
      g.fillStyle(0x1e3a22).fillTriangle(55, y - 14, 55 - w, y + 36, 55 + w, y + 36);
      g.fillStyle(0x2a4e2c).fillTriangle(52, y - 8, 55 - w + 10, y + 30, 50, y + 30);
    }
  });
  make('rg_rock', 64, 48, (g) => {
    g.fillStyle(0x000000, 0.25).fillEllipse(32, 40, 58, 14);
    g.fillStyle(0x6a6a72).fillEllipse(32, 26, 52, 34);
    g.fillStyle(0x8a8a94).fillEllipse(26, 20, 30, 18);
  });
  make('rg_flower', 24, 16, (g) => {
    g.fillStyle(0x3a6a2a).fillRect(4, 8, 16, 8);
    for (const [x, c] of [[4, 0xf06a8a], [12, 0xffffff], [18, 0xf0d04a]] as const) g.fillStyle(c).fillRect(x, 4, 4, 4);
  });
  make('rg_tuft', 24, 16, (g) => { g.fillStyle(0x6a9a40).fillRect(4, 4, 4, 12).fillRect(10, 0, 4, 16).fillRect(16, 6, 4, 10); });
  make('rg_well', 60, 60, (g) => {
    g.fillStyle(0x000000, 0.25).fillEllipse(30, 52, 56, 14);
    g.fillStyle(0x7a7a80).fillEllipse(30, 38, 52, 26);
    g.fillStyle(0x1a2a40).fillEllipse(30, 34, 36, 14);
    g.fillStyle(0x5a3a22).fillRect(6, 4, 6, 34).fillRect(48, 4, 6, 34).fillRect(4, 2, 52, 6);
  });
  make('rg_house', 200, 160, (g) => {
    g.fillStyle(0x000000, 0.25).fillEllipse(100, 150, 200, 22);
    // 벽 + 기둥 + 창호
    g.fillStyle(0xe8dcc0).fillRect(18, 92, 164, 56);
    g.fillStyle(0x6a4428).fillRect(18, 92, 8, 56).fillRect(96, 92, 8, 56).fillRect(174, 92, 8, 56).fillRect(18, 92, 164, 6);
    g.fillStyle(0xc8a878).fillRect(36, 106, 46, 32).fillRect(116, 106, 46, 32);
    g.lineStyle(2, 0x6a4428);
    for (const x0 of [36, 116]) { g.strokeRect(x0, 106, 46, 32); g.lineBetween(x0 + 23, 106, x0 + 23, 138); g.lineBetween(x0, 122, x0 + 46, 122); }
    g.fillStyle(0x8a7a6a).fillRect(10, 146, 180, 8);
    // 기와 지붕 (처마 끝이 살짝 올라간 모양)
    g.fillStyle(0x2e3440).fillTriangle(0, 92, 30, 40, 30, 92).fillTriangle(200, 92, 170, 40, 170, 92).fillRect(28, 30, 144, 62);
    g.fillStyle(0x3e4656);
    for (let y = 40; y < 90; y += 10) g.fillRect(24, y, 152, 4);
    g.fillStyle(0x1e222c).fillRect(20, 24, 160, 10);
    g.fillStyle(0x2e3440).fillTriangle(0, 96, 0, 82, 26, 90).fillTriangle(200, 96, 200, 82, 174, 90);
  });
}
