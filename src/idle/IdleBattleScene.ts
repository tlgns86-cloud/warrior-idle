import Phaser from 'phaser';
import { DEPTH, GROUND_Y } from '../config';
import {
  IdleGame, dashMult, fmtNum, whirlMult, zoneIndex, zoneOf, type SkillId,
} from './model';
import { IdleBackground } from './IdleBackground';
import { monsterKey } from './monsterArt';

interface Mon {
  c: Phaser.GameObjects.Container;
  body: Phaser.GameObjects.Image;
  bar: Phaser.GameObjects.Graphics;
  hp: number;
  maxHp: number;
  atk: number;
  boss: boolean;
  half: number;
  nextAtk: number;
  dead: boolean;
}

const FONT = '"Noto Serif KR", "Nanum Myeongjo", serif';
const WALK_SPEED = 230; // 배경 흐르는 속도(px/s)
const MON_SPEED = 170;
const MAX_ON_FIELD = 3;
/** 주인공 이미지(128x128)를 2배 정수 배율로 그린다. 발 기준점은 원본 (64, 118) */
const HERO_SCALE = 2;
const HERO_ORIGIN = { x: 63.5 / 128, y: 117.5 / 128 };
/** 기본 공격 1회 시간(초). 공격 속도 배율로 나눈다 */
const ATTACK_TIME = 0.8;

const easeOut = (k: number) => 1 - (1 - k) * (1 - k);
const easeInOut = (k: number) => (k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2);

/** 자동 전투 화면. 수치는 IdleGame(model) 이 담당하고 여기서는 연출과 전투 흐름만 처리 */
export class IdleBattleScene extends Phaser.Scene {
  private g!: IdleGame;
  private bg!: IdleBackground;
  private hero!: Phaser.GameObjects.Image;
  /** 단일 이미지에 코드로 입히는 동작(걷기 흔들림 / 베기 자세 / 돌진) */
  private pose = { t: 0, walk: 0, dash: 0, hitDone: false };
  private heroShadow!: Phaser.GameObjects.Image;
  private aura!: Phaser.GameObjects.Image;
  private heroX = 300;
  private heroState: 'ready' | 'attack' | 'dash' | 'dead' = 'ready';
  private mons: Mon[] = [];
  /** 사라지는 연출 중인 몬스터 (전투 대상 아님) */
  private dying: Mon[] = [];
  private spawnTimer = 0;
  private zone = -1;
  private unsubs: (() => void)[] = [];
  private sparks!: Phaser.GameObjects.Particles.ParticleEmitter;

  constructor() {
    super('IdleBattle');
  }

  preload(): void {
    this.load.image('hero', 'assets/hero/warrior.png');
  }

  create(): void {
    this.g = this.registry.get('idle') as IdleGame;
    this.bg = new IdleBackground(this);
    this.zone = zoneIndex(this.g.s.stage);
    this.bg.setZone(this.zone, true);

    this.heroShadow = this.add.image(0, GROUND_Y + 2, 'shadow').setDepth(DEPTH.player - 1).setScale(1.1, 1);
    this.aura = this.add.image(0, GROUND_Y - 110, 'fx_glow').setScale(5).setAlpha(0).setBlendMode(Phaser.BlendModes.ADD)
      .setDepth(DEPTH.player - 1);
        this.hero = this.add.image(0, GROUND_Y, 'hero').setOrigin(HERO_ORIGIN.x, HERO_ORIGIN.y).setScale(HERO_SCALE)
      .setDepth(DEPTH.player);

    this.sparks = this.add.particles(0, 0, 'fx_spark', {
      emitting: false, lifespan: { min: 160, max: 320 }, speed: { min: 180, max: 460 },
      scale: { start: 1.3, end: 0 }, blendMode: 'ADD', tint: [0xfff2c2, 0xffc85a, 0xffffff],
    }).setDepth(DEPTH.effects);

    this.layout();
    this.scale.on(Phaser.Scale.Events.RESIZE, this.layout, this);

    const g = this.g;
    this.unsubs.push(
      g.on('death', () => this.onHeroDeath()),
      g.on('boss-start', () => this.spawnBoss()),
      g.on('boss-fail', (reason: string) => this.onBossFail(reason)),
      g.on('stage', () => this.checkZone()),
      g.on('reset', () => { this.clearMonsters(true); this.checkZone(); this.reviveHero(); }),
      g.on('skill-request', (id: SkillId) => this.castSkill(id, true)),
    );
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.unsubs.forEach((u) => u());
      this.scale.off(Phaser.Scale.Events.RESIZE, this.layout, this);
    });
  }

  private layout(): void {
    const w = this.scale.width;
    this.heroX = Math.round(w * 0.26);
    this.heroShadow.x = this.heroX;
    this.aura.x = this.heroX;
    this.bg.resize(w);
  }

  // ---------------- 메인 루프 ----------------
  update(_t: number, deltaMs: number): void {
    const dt = Math.min(deltaMs, 100) / 1000;
    const g = this.g;
    g.tick(dt);

    // 버프 오라
    if (g.rageTime > 0) this.aura.setTint(0xff4030).setAlpha(0.35 + Math.sin(this.time.now / 90) * 0.1);
    else if (g.guardTime > 0) this.aura.setTint(0xffd060).setAlpha(0.3 + Math.sin(this.time.now / 140) * 0.08);
    else this.aura.setAlpha(0);

    if (this.heroState === 'dead') return;

    // 보스 도전
    if (g.shouldStartBoss() && !this.mons.some((m) => m.boss && !m.dead)) {
      this.clearMonsters(false);
      g.startBoss();
    }
    // 일반 몬스터 생성
    this.spawnTimer -= dt;
    if (!g.inBoss && this.spawnTimer <= 0 && this.aliveMons().length < MAX_ON_FIELD) {
      this.spawnMonster();
      this.spawnTimer = 0.55;
    }

    const alive = this.aliveMons().sort((a, b) => a.c.x - b.c.x);
    const front = alive[0];
    const inRange = !!front && front.c.x - front.half - this.heroX <= 95;
    const walking = !inRange && this.heroState === 'ready';
    const scroll = walking ? WALK_SPEED * dt : 0;
    this.bg.scroll(scroll);

    // 몬스터 이동 (앞 몬스터 뒤에 줄을 선다)
    let wall = this.heroX + 70;
    for (const m of alive) {
      const stopX = wall + m.half;
      if (m.c.x > stopX) m.c.x = Math.max(stopX, m.c.x - (MON_SPEED * dt + scroll));
      wall = m.c.x + m.half + 6;
    }
    // 죽는 중인 몬스터도 배경과 함께 흘러간다
    for (const m of this.dying) m.c.x -= scroll;

    // 전사 행동
    if (this.heroState === 'ready' && inRange) {
      this.heroState = 'attack';
      this.pose.t = 0;
      this.pose.hitDone = false;
    }
    this.animateHero(dt, walking);

    // 몬스터 공격 (맨 앞 1마리 + 보스)
    const now = this.time.now;
    alive.forEach((m, i) => {
      const touching = i === 0 && inRange;
      if (!touching) { m.nextAtk = Math.max(m.nextAtk, now + 400); return; }
      if (now >= m.nextAtk) {
        m.nextAtk = now + (m.boss ? 1300 : 1500);
        this.monsterAttack(m);
      }
    });

    // 자동 스킬
    if (g.s.autoSkill && front && front.c.x - this.heroX < 520) {
      for (const id of ['rage', 'guard', 'whirl', 'dash'] as SkillId[]) {
        if (id === 'guard' && g.hp / g.stats().maxHp > 0.6) continue;
        if (g.skillReady(id)) { this.castSkill(id, false); break; }
      }
    }
  }

  /** 공격: 뒤로 젖히며 준비 → 앞으로 내지르며 베기(판정) → 복귀. 걷기: 통통 튀는 흔들림 */
  private animateHero(dt: number, walking: boolean): void {
    const p = this.pose;
    let x = 0, y = 0, ang = 0, sx = 1, sy = 1;
    if (this.heroState === 'attack') {
      p.t += (dt * this.g.attackSpeed()) / ATTACK_TIME;
      const t = Math.min(1, p.t);
      if (t < 0.35) {
        const k = easeOut(t / 0.35);
        ang = -10 * k; x = -12 * k; sx = 1 + 0.05 * k; sy = 1 - 0.05 * k;
      } else if (t < 0.5) {
        const k = (t - 0.35) / 0.15;
        ang = -10 + 24 * k; x = -12 + 42 * k; sx = 1.05 - 0.08 * k; sy = 0.95 + 0.08 * k;
        if (!p.hitDone && t >= 0.42) { p.hitDone = true; this.heroHit(); }
      } else {
        const k = easeInOut((t - 0.5) / 0.5);
        ang = 14 * (1 - k); x = 30 * (1 - k); sx = 0.97 + 0.03 * k; sy = 1.03 - 0.03 * k;
      }
      if (p.t >= 1) { this.heroState = 'ready'; p.t = 0; }
    } else if (this.heroState === 'dash') {
      ang = 12; sx = 1.06; sy = 0.95;
    } else if (walking) {
      p.walk += dt * 11;
      const b = Math.abs(Math.sin(p.walk));
      y = -b * 10; ang = Math.sin(p.walk) * 3; sy = 1 + b * 0.03; sx = 1 - b * 0.02;
    } else {
      p.walk += dt * 3;
      sy = 1 + Math.sin(p.walk) * 0.015;
    }
    this.hero.setPosition(this.heroX + x + p.dash, GROUND_Y + y).setAngle(ang).setScale(HERO_SCALE * sx, HERO_SCALE * sy);
    this.heroShadow.setPosition(this.heroX + x * 0.6 + p.dash, GROUND_Y + 2).setScale(1.1 + y / 120, 1 + y / 120);
  }

  private aliveMons(): Mon[] {
    return this.mons.filter((m) => !m.dead);
  }

  // ---------------- 몬스터 ----------------
  private makeMon(boss: boolean): Mon {
    const kind = zoneOf(this.g.s.stage).monster;
    const st = this.g.currentMonster(boss);
    const scale = boss ? 1.6 : 1;
    const tex = this.textures.get(monsterKey(kind)).getSourceImage();
    const shadow = this.add.image(0, 2, 'shadow').setScale(scale * 1.1, scale);
    const body = this.add.image(0, 0, monsterKey(kind)).setOrigin(0.5, 1).setScale(scale);
    const bar = this.add.graphics();
    const c = this.add.container(this.scale.width + 100 + (boss ? 80 : 0), GROUND_Y + 2, [shadow, body, bar])
      .setDepth(DEPTH.dummy);
    const m: Mon = { c, body, bar, hp: st.hp, maxHp: st.hp, atk: st.atk, boss, half: (tex.width * scale) / 2 - 8,
      nextAtk: 0, dead: false };
    this.tweens.add({ targets: body, scaleY: scale * 0.94, scaleX: scale * 1.04, duration: 380 + Math.random() * 120,
      yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    if (boss) body.setTint(0xffd0c0);
    this.drawBar(m);
    this.mons.push(m);
    return m;
  }

  private spawnMonster(): void {
    this.makeMon(false);
  }

  private spawnBoss(): void {
    const m = this.makeMon(true);
    const z = zoneOf(this.g.s.stage);
    this.banner(`${z.boss} 출현!`, '#ff8a6a');
    this.cameras.main.shake(300, 0.006);
    m.c.x = this.scale.width + 200;
  }

  private drawBar(m: Mon): void {
    const b = m.bar.clear();
    const w = m.boss ? 180 : 90, h = m.boss ? 12 : 8;
    const y = -(m.body.displayHeight + 22);
    b.fillStyle(0x140c0c, 0.85).fillRect(-w / 2 - 2, y - 2, w + 4, h + 4);
    b.fillStyle(0x4a2222, 1).fillRect(-w / 2, y, w, h);
    const r = Math.max(0, m.hp / m.maxHp);
    b.fillStyle(m.boss ? 0xe04030 : 0xd9b54a, 1).fillRect(-w / 2, y, Math.round(w * r), h);
    b.fillStyle(0xffffff, 0.25).fillRect(-w / 2, y, Math.round(w * r), 2);
  }

  private monsterAttack(m: Mon): void {
    const dir = -1;
    this.tweens.add({ targets: m.body, x: dir * 34, duration: 90, yoyo: true, ease: 'Quad.easeOut' });
    this.time.delayedCall(90, () => {
      if (m.dead || this.heroState === 'dead') return;
      const dmg = this.g.damagePlayer(m.atk * (0.9 + Math.random() * 0.2));
      this.floatText(this.heroX + Phaser.Math.Between(-20, 20), GROUND_Y - 230, `-${fmtNum(dmg)}`, '#ff6b5a', 24);
      this.hero.setTintFill(0xff5040);
      this.time.delayedCall(70, () => this.heroState !== 'dead' && this.applyHeroTint());
    });
  }

  private applyHeroTint(): void {
    if (this.g.rageTime > 0) this.hero.setTint(0xffc0b0);
    else this.hero.clearTint();
  }

  private damageMon(m: Mon, dmg: number, crit: boolean): void {
    if (m.dead) return;
    m.hp -= dmg;
    this.drawBar(m);
    const top = m.c.y - m.body.displayHeight;
    this.floatText(m.c.x + Phaser.Math.Between(-24, 24), top - 10, fmtNum(dmg), crit ? '#ffdd44' : '#fff1c9',
      crit ? 34 : 26, crit);
    this.sparks.explode(crit ? 16 : 8, m.c.x - m.half * 0.6, m.c.y - m.body.displayHeight * 0.5);
    m.body.setTintFill(0xffffff);
    this.time.delayedCall(60, () => (m.boss ? m.body.setTint(0xffd0c0) : m.body.clearTint()));
    if (m.hp <= 0) this.killMon(m);
  }

  private killMon(m: Mon): void {
    m.dead = true;
    const gold = this.g.onKill(m.boss);
    this.tweens.killTweensOf(m.body);
    m.bar.clear();
    this.tweens.add({ targets: m.body, alpha: 0, y: -30, scaleX: m.body.scaleX * 1.2, scaleY: 0.2, duration: 320,
      ease: 'Quad.easeIn', onComplete: () => { m.c.destroy(); this.dying = this.dying.filter((x) => x !== m); } });
    this.mons = this.mons.filter((x) => x !== m);
    this.dying.push(m);
    this.sparks.explode(m.boss ? 40 : 14, m.c.x, m.c.y - m.body.displayHeight / 2);
    this.coinBurst(m.c.x, m.c.y - 40, m.boss ? 14 : 4, gold);
    if (m.boss) {
      this.cameras.main.flash(250, 255, 230, 180);
      this.banner('STAGE CLEAR', '#ffe28a');
    }
  }

  private clearMonsters(instant: boolean): void {
    for (const m of this.mons) {
      m.dead = true;
      this.tweens.killTweensOf(m.body);
      if (instant) m.c.destroy();
      else this.tweens.add({ targets: m.c, alpha: 0, duration: 250, onComplete: () => m.c.destroy() });
    }
    this.mons = [];
  }

  // ---------------- 전사 ----------------
  private heroHit(): void {
    const front = this.aliveMons().sort((a, b) => a.c.x - b.c.x)[0];
    if (!front || front.c.x - front.half - this.heroX > 110) return;
    const { dmg, crit } = this.g.rollDamage();
    this.slashFx(front.c.x - front.half * 0.5, front.c.y - front.body.displayHeight * 0.55, crit ? 1.3 : 1);
    this.damageMon(front, dmg, crit);
    if (crit) this.cameras.main.shake(60, 0.004);
  }

  private onHeroDeath(): void {
    if (this.heroState === 'dead') return;
    this.heroState = 'dead';
    this.hero.setTint(0x666677);
    this.tweens.add({ targets: this.hero, angle: -80, alpha: 0.6, duration: 400, ease: 'Quad.easeIn' });
    this.banner('패배…', '#c8c8d8');
    this.time.delayedCall(1600, () => {
      this.clearMonsters(false);
      this.g.onDeathResolved();
      this.reviveHero();
    });
  }

  private reviveHero(): void {
    this.tweens.killTweensOf(this.hero);
    this.pose.dash = 0;
    this.hero.setAngle(0).setAlpha(1).setPosition(this.heroX, GROUND_Y).setScale(HERO_SCALE);
    this.applyHeroTint();
    this.heroState = 'ready';
  }

  private onBossFail(reason: string): void {
    if (reason === 'time') this.banner('시간 초과', '#ff9a8a');
    if (this.heroState !== 'dead') this.clearMonsters(false);
  }

  private checkZone(): void {
    const z = zoneIndex(this.g.s.stage);
    if (z !== this.zone) {
      this.zone = z;
      this.bg.setZone(z);
      this.clearMonsters(false);
      this.time.delayedCall(500, () => this.banner(zoneOf(this.g.s.stage).name, '#e9d9b4'));
    }
  }

  // ---------------- 스킬 ----------------
  castSkill(id: SkillId, manual: boolean): void {
    const g = this.g;
    if (this.heroState === 'dead' || !g.skillReady(id)) return;
    const alive = this.aliveMons().sort((a, b) => a.c.x - b.c.x);
    const visible = alive.filter((m) => m.c.x < this.scale.width + 40);
    if ((id === 'dash' || id === 'whirl') && !visible.length) {
      if (manual) g.emit('toast', '공격할 대상이 없습니다');
      return;
    }
    if (!g.useSkill(id)) return;
    const name = g.skillDef(id);
    this.floatText(this.heroX, GROUND_Y - 280, name.hanja, '#ffe7a8', 30, true);

    if (id === 'dash') this.skillDash(visible[0]);
    else if (id === 'whirl') this.skillWhirl(visible);
    else if (id === 'guard') {
      this.ring(this.heroX, GROUND_Y - 110, 0xffd060);
      this.floatText(this.heroX, GROUND_Y - 250, '회복', '#8aff9a', 26);
    } else if (id === 'rage') {
      this.ring(this.heroX, GROUND_Y - 110, 0xff4030);
      this.applyHeroTint();
      this.time.delayedCall(8000, () => this.heroState !== 'dead' && this.applyHeroTint());
    }
  }

  private skillDash(target: Mon): void {
    const lv = this.g.s.skills.dash;
    this.heroState = 'dash';
    const ghost = this.add.image(this.hero.x, this.hero.y, 'hero').setOrigin(HERO_ORIGIN.x, HERO_ORIGIN.y).setScale(HERO_SCALE).setAlpha(0.5)
      .setTint(0x80c0ff).setDepth(DEPTH.player - 1);
    this.tweens.add({ targets: ghost, alpha: 0, duration: 300, onComplete: () => ghost.destroy() });
    this.tweens.add({ targets: this.pose, dash: 70, duration: 90, yoyo: true, hold: 260, ease: 'Quad.easeOut' });
    for (let i = 0; i < 3; i++) {
      this.time.delayedCall(80 + i * 110, () => {
        if (target.dead) return;
        const { dmg, crit } = this.g.rollDamage(dashMult(lv));
        this.slashFx(target.c.x - target.half * 0.3, target.c.y - target.body.displayHeight * (0.35 + i * 0.15), 1.5, i % 2 ? 30 : -20);
        this.damageMon(target, dmg, crit);
        this.cameras.main.shake(50, 0.004);
      });
    }
    this.time.delayedCall(520, () => {
      if (this.heroState === 'dash') this.heroState = 'ready';
    });
  }

  private skillWhirl(targets: Mon[]): void {
    const lv = this.g.s.skills.whirl;
    const y = GROUND_Y - 110;
    const ring = this.add.image(this.heroX, y, 'fx_slash').setBlendMode(Phaser.BlendModes.ADD).setDepth(DEPTH.effects)
      .setScale(1).setTint(0x9ad8ff);
    this.tweens.add({ targets: ring, angle: 720, scale: 6, alpha: 0, duration: 600, ease: 'Cubic.easeOut', onComplete: () => ring.destroy() });
    this.ring(this.heroX, y, 0x9ad8ff, 900);
    this.cameras.main.shake(200, 0.008);
    targets.forEach((m, i) => this.time.delayedCall(120 + i * 60, () => {
      const { dmg, crit } = this.g.rollDamage(whirlMult(lv));
      this.slashFx(m.c.x, m.c.y - m.body.displayHeight * 0.5, 1.6, Phaser.Math.Between(-40, 40));
      this.damageMon(m, dmg, crit);
    }));
  }

  // ---------------- 연출 ----------------
  private slashFx(x: number, y: number, scale = 1, angle = -18): void {
    const s = this.add.image(x, y, 'fx_slash').setDepth(DEPTH.effects).setBlendMode(Phaser.BlendModes.ADD)
      .setAngle(angle).setScale(0.6 * scale);
    this.tweens.add({ targets: s, scaleX: 1.3 * scale, scaleY: 1.1 * scale, alpha: 0, duration: 170, onComplete: () => s.destroy() });
  }

  private ring(x: number, y: number, color: number, radius = 200): void {
    const r = this.add.circle(x, y, 30, color, 0).setStrokeStyle(6, color, 0.9).setDepth(DEPTH.effects)
      .setBlendMode(Phaser.BlendModes.ADD);
    this.tweens.add({ targets: r, radius, alpha: 0, duration: 500, ease: 'Cubic.easeOut', onComplete: () => r.destroy() });
  }

  private floatText(x: number, y: number, text: string, color: string, size: number, bold = false): void {
    const t = this.add.text(x, y, text, {
      fontFamily: FONT, fontSize: `${size}px`, fontStyle: bold ? 'bold' : 'normal', color, stroke: '#2a0e0a', strokeThickness: 5,
    }).setOrigin(0.5).setDepth(DEPTH.effects + 2);
    if (bold) t.setScale(1.4);
    this.tweens.add({ targets: t, y: y - 60, alpha: 0, scale: 1, duration: 800, ease: 'Cubic.easeOut', onComplete: () => t.destroy() });
  }

  private coinBurst(x: number, y: number, n: number, gold: number): void {
    for (let i = 0; i < n; i++) {
      const c = this.add.image(x, y, 'coin').setDepth(DEPTH.effects);
      const tx = x + Phaser.Math.Between(-70, 70);
      this.tweens.add({ targets: c, x: tx, duration: 380, ease: 'Linear' });
      this.tweens.add({ targets: c, y: y - Phaser.Math.Between(60, 120), duration: 190, ease: 'Quad.easeOut', yoyo: true,
        onComplete: () => {
          this.tweens.add({ targets: c, x: this.heroX, y: GROUND_Y - 120, scale: 0.5, duration: 280, delay: 120 + i * 25,
            ease: 'Quad.easeIn', onComplete: () => c.destroy() });
        } });
    }
    this.time.delayedCall(700, () => this.floatText(this.heroX + 40, GROUND_Y - 200, `+${fmtNum(gold)}`, '#ffd34a', 22));
  }

  private banner(text: string, color: string): void {
    const w = this.scale.width;
    const t = this.add.text(w / 2, 200, text, {
      fontFamily: FONT, fontSize: '54px', fontStyle: 'bold', color, stroke: '#1a0e0a', strokeThickness: 8,
    }).setOrigin(0.5).setDepth(DEPTH.foreground + 5).setAlpha(0).setScale(1.6);
    this.tweens.add({ targets: t, alpha: 1, scale: 1, duration: 260, ease: 'Back.easeOut' });
    this.tweens.add({ targets: t, alpha: 0, y: 170, delay: 1100, duration: 400, onComplete: () => t.destroy() });
  }
}
