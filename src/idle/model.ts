// 방치형 키우기 게임의 수치/상태/저장. Phaser 에 의존하지 않는 순수 로직.

export type UpgradeId = 'atk' | 'hp' | 'regen' | 'crit' | 'critDmg' | 'speed' | 'gold';
export type GearId = 'weapon' | 'armor';
export type SkillId = 'dash' | 'whirl' | 'guard' | 'rage';

export interface UpgradeDef {
  id: UpgradeId;
  name: string;
  icon: string;
  max: number;
  baseCost: number;
  growth: number;
  value: (lv: number) => number;
  fmt: (v: number) => string;
}

const pct = (v: number) => `${(Math.round(v * 10) / 10).toLocaleString('ko-KR')}%`;

export const UPGRADES: UpgradeDef[] = [
  { id: 'atk', name: '공격력', icon: '劍', max: Infinity, baseCost: 10, growth: 1.09,
    value: (lv) => 10 * (1 + lv) * 1.035 ** lv, fmt: (v) => fmtNum(v) },
  { id: 'hp', name: '체력', icon: '體', max: Infinity, baseCost: 10, growth: 1.09,
    value: (lv) => 120 * (1 + lv * 0.6) * 1.035 ** lv, fmt: (v) => fmtNum(v) },
  { id: 'regen', name: '체력 회복', icon: '氣', max: 76, baseCost: 40, growth: 1.14,
    value: (lv) => 1 + lv * 0.25, fmt: (v) => `초당 ${pct(v)}` },
  { id: 'crit', name: '치명타 확률', icon: '必', max: 90, baseCost: 80, growth: 1.15,
    value: (lv) => 5 + lv * 0.5, fmt: pct },
  { id: 'critDmg', name: '치명타 피해', icon: '殺', max: Infinity, baseCost: 120, growth: 1.12,
    value: (lv) => 150 + lv * 10, fmt: pct },
  { id: 'speed', name: '공격 속도', icon: '疾', max: 75, baseCost: 150, growth: 1.18,
    value: (lv) => 1 + lv * 0.02, fmt: (v) => `x${v.toFixed(2)}` },
  { id: 'gold', name: '골드 획득', icon: '金', max: Infinity, baseCost: 200, growth: 1.15,
    value: (lv) => 100 + lv * 5, fmt: pct },
];

export interface GearDef { id: GearId; name: string; icon: string; stat: string }
export const GEAR: GearDef[] = [
  { id: 'weapon', name: '환도', icon: '⚔', stat: '공격력' },
  { id: 'armor', name: '두정갑', icon: '🛡', stat: '체력' },
];
export const GEAR_TIERS = ['녹슨', '무쇠', '강철', '정련', '명장의', '보검', '신검', '천하제일'];
export const gearMult = (lv: number) => 1.18 ** lv;
export const gearCost = (lv: number) => 300 * 1.38 ** lv;
export const gearChance = (lv: number) => Math.max(25, 100 - lv * 4);
export const gearTier = (lv: number) => GEAR_TIERS[Math.min(GEAR_TIERS.length - 1, Math.floor(lv / 5))];

export interface SkillDef {
  id: SkillId; name: string; hanja: string; unlock: number; cd: number; baseCost: number; desc: (lv: number) => string;
}
export const SKILLS: SkillDef[] = [
  { id: 'dash', name: '질풍참', hanja: '疾風斬', unlock: 1, cd: 8, baseCost: 100,
    desc: (lv) => `앞의 적을 3회 베어 공격력의 ${dashMult(lv) * 100 | 0}% 피해 ×3` },
  { id: 'whirl', name: '회천검', hanja: '回天劍', unlock: 5, cd: 14, baseCost: 600,
    desc: (lv) => `화면의 모든 적에게 공격력의 ${whirlMult(lv) * 100 | 0}% 피해` },
  { id: 'guard', name: '호신강기', hanja: '護身罡氣', unlock: 10, cd: 25, baseCost: 3000,
    desc: (lv) => `체력 ${guardHeal(lv) | 0}% 회복, 6초간 받는 피해 -50%` },
  { id: 'rage', name: '광풍노도', hanja: '狂風怒濤', unlock: 20, cd: 40, baseCost: 20000,
    desc: (lv) => `8초간 공격 속도 x2, 피해 x${rageMult(lv).toFixed(1)}` },
];
export const dashMult = (lv: number) => 2 + lv * 0.5;
export const whirlMult = (lv: number) => 3 + lv * 0.8;
export const guardHeal = (lv: number) => 30 + lv * 3;
export const rageMult = (lv: number) => 1.5 + lv * 0.1;
export const skillCost = (def: SkillDef, lv: number) => def.baseCost * 1.55 ** lv;

export const KILLS_PER_STAGE = 10;
export const BOSS_TIME = 30;
export const PRESTIGE_MIN_STAGE = 25;

export interface Zone { name: string; monster: MonsterKind; boss: string; mob: string }
export type MonsterKind = 'wisp' | 'goblin' | 'fox' | 'ghost' | 'bandit';
export const ZONES: Zone[] = [
  { name: '마을 어귀', monster: 'bandit', mob: '산적', boss: '산적 두목' },
  { name: '대나무 숲', monster: 'wisp', mob: '도깨비불', boss: '거대 도깨비불' },
  { name: '안개 계곡', monster: 'goblin', mob: '도깨비', boss: '도깨비 대장' },
  { name: '버려진 산사', monster: 'ghost', mob: '원귀', boss: '천년 원귀' },
  { name: '저승 문턱', monster: 'fox', mob: '구미호', boss: '천년 구미호' },
];
export const zoneIndex = (stage: number) => Math.floor((stage - 1) / 10) % ZONES.length;
export const zoneOf = (stage: number) => ZONES[zoneIndex(stage)];
export const stageLabel = (stage: number) => `${Math.ceil(stage / 10)}-${((stage - 1) % 10) + 1}`;

export function monsterStats(stage: number, boss: boolean) {
  const s = stage - 1;
  const hp = 18 * 1.26 ** s * (boss ? 10 : 1);
  const atk = 5 * 1.2 ** s * (boss ? 2.5 : 1);
  const gold = 4 * 1.15 ** s * (boss ? 12 : 1);
  return { hp, atk, gold };
}

export interface SaveData {
  v: 1;
  gold: number;
  souls: number;
  stage: number;
  maxStage: number;
  kills: number;
  autoBoss: boolean;
  autoSkill: boolean;
  upgrades: Record<UpgradeId, number>;
  gear: Record<GearId, number>;
  skills: Record<SkillId, number>;
  prestiges: number;
  totalKills: number;
  goldRate: number;
  savedAt: number;
}

const SAVE_KEY = 'kwg-idle-save-v1';

export function freshSave(): SaveData {
  return {
    v: 1, gold: 0, souls: 0, stage: 1, maxStage: 1, kills: 0, autoBoss: true, autoSkill: true,
    upgrades: { atk: 0, hp: 0, regen: 0, crit: 0, critDmg: 0, speed: 0, gold: 0 },
    gear: { weapon: 0, armor: 0 },
    skills: { dash: 1, whirl: 0, guard: 0, rage: 0 },
    prestiges: 0, totalKills: 0, goldRate: 0, savedAt: Date.now(),
  };
}

type Listener = (...args: any[]) => void;
class Emitter {
  private map = new Map<string, Set<Listener>>();
  on(e: string, f: Listener) { (this.map.get(e) ?? this.map.set(e, new Set()).get(e)!).add(f); return () => this.off(e, f); }
  off(e: string, f: Listener) { this.map.get(e)?.delete(f); }
  emit(e: string, ...a: unknown[]) { this.map.get(e)?.forEach((f) => f(...a)); }
}

export interface Stats {
  atk: number; maxHp: number; regen: number; critRate: number; critDmg: number; speed: number; goldMul: number; power: number;
}

export class IdleGame extends Emitter {
  s: SaveData;
  hp = 1;
  /** 보스전 진행 중이면 남은 시간(초), 아니면 -1 */
  bossTime = -1;
  cooldowns: Record<SkillId, number> = { dash: 0, whirl: 0, guard: 0, rage: 0 };
  guardTime = 0;
  rageTime = 0;
  private earnWindow: number[] = [];
  private earnAcc = 0;
  private earnTimer = 0;

  constructor(save?: SaveData) {
    super();
    this.s = save ?? freshSave();
    this.hp = this.stats().maxHp;
  }

  // ---------- 저장 ----------
  static load(): { game: IdleGame; offlineSec: number } {
    let save: SaveData | undefined;
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (raw) {
        const base = freshSave();
        const p = JSON.parse(raw) as Partial<SaveData>;
        save = { ...base, ...p, upgrades: { ...base.upgrades, ...p.upgrades }, gear: { ...base.gear, ...p.gear },
          skills: { ...base.skills, ...p.skills } };
      }
    } catch { /* 저장 데이터 손상 시 새로 시작 */ }
    const game = new IdleGame(save);
    const offlineSec = save ? Math.max(0, (Date.now() - save.savedAt) / 1000) : 0;
    return { game, offlineSec };
  }

  save(): void {
    this.s.savedAt = Date.now();
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(this.s)); } catch { /* 저장 불가 환경 무시 */ }
  }

  hardReset(): void {
    try { localStorage.removeItem(SAVE_KEY); } catch { /* */ }
    this.s = freshSave();
    this.resetRun();
    this.emit('reset');
    this.emit('change');
  }

  // ---------- 능력치 ----------
  upLv(id: UpgradeId) { return this.s.upgrades[id]; }
  upDef(id: UpgradeId) { return UPGRADES.find((u) => u.id === id)!; }
  upValue(id: UpgradeId, lvOffset = 0) { return this.upDef(id).value(this.upLv(id) + lvOffset); }

  soulMult() { return 1 + this.s.souls * 0.1; }

  stats(): Stats {
    const atk = this.upValue('atk') * gearMult(this.s.gear.weapon) * this.soulMult();
    const maxHp = this.upValue('hp') * gearMult(this.s.gear.armor) * (1 + this.s.souls * 0.05);
    const critRate = this.upValue('crit') / 100;
    const critDmg = this.upValue('critDmg') / 100;
    const speed = this.upValue('speed');
    const goldMul = (this.upValue('gold') / 100) * this.soulMult();
    const power = atk * speed * (1 + critRate * (critDmg - 1)) * 2 + maxHp * 0.3;
    return { atk, maxHp, regen: this.upValue('regen') / 100, critRate, critDmg, speed, goldMul, power };
  }

  attackSpeed() { return this.stats().speed * (this.rageTime > 0 ? 2 : 1); }

  rollDamage(mult = 1): { dmg: number; crit: boolean } {
    const st = this.stats();
    const crit = Math.random() < st.critRate;
    const rage = this.rageTime > 0 ? rageMult(this.s.skills.rage) : 1;
    const dmg = st.atk * mult * rage * (crit ? st.critDmg : 1) * (0.92 + Math.random() * 0.16);
    return { dmg, crit };
  }

  // ---------- 구매 ----------
  upCost(id: UpgradeId, count = 1): number {
    const d = this.upDef(id);
    const lv = this.upLv(id);
    const n = Math.min(count, d.max - lv);
    if (n <= 0) return Infinity;
    // 등비수열 합
    return d.baseCost * d.growth ** lv * (d.growth ** n - 1) / (d.growth - 1);
  }

  /** 지금 골드로 살 수 있는 최대 개수 */
  upMaxAffordable(id: UpgradeId): number {
    const d = this.upDef(id);
    const lv = this.upLv(id);
    const first = d.baseCost * d.growth ** lv;
    if (this.s.gold < first) return 0;
    const n = Math.floor(Math.log(this.s.gold * (d.growth - 1) / first + 1) / Math.log(d.growth));
    return Math.max(0, Math.min(n, d.max - lv));
  }

  buyUpgrade(id: UpgradeId, count: number): boolean {
    const n = count === Infinity ? this.upMaxAffordable(id) : Math.min(count, this.upDef(id).max - this.upLv(id));
    if (n <= 0) return false;
    const cost = this.upCost(id, n);
    if (cost > this.s.gold) return false;
    const before = this.stats().maxHp;
    this.s.gold -= cost;
    this.s.upgrades[id] += n;
    if (id === 'hp') this.hp += this.stats().maxHp - before;
    this.emit('change');
    return true;
  }

  enhanceGear(id: GearId): 'success' | 'fail' | 'poor' {
    const lv = this.s.gear[id];
    const cost = gearCost(lv);
    if (this.s.gold < cost) return 'poor';
    this.s.gold -= cost;
    const ok = Math.random() * 100 < gearChance(lv);
    if (ok) {
      const before = this.stats().maxHp;
      this.s.gear[id]++;
      if (id === 'armor') this.hp += this.stats().maxHp - before;
    }
    this.emit('change');
    return ok ? 'success' : 'fail';
  }

  skillDef(id: SkillId) { return SKILLS.find((k) => k.id === id)!; }
  skillUnlocked(id: SkillId) { return this.s.maxStage >= this.skillDef(id).unlock; }

  upgradeSkill(id: SkillId): boolean {
    const def = this.skillDef(id);
    const cost = skillCost(def, this.s.skills[id]);
    if (!this.skillUnlocked(id) || this.s.gold < cost) return false;
    this.s.gold -= cost;
    this.s.skills[id]++;
    this.emit('change');
    return true;
  }

  skillReady(id: SkillId) {
    return this.skillUnlocked(id) && this.s.skills[id] > 0 && this.cooldowns[id] <= 0;
  }

  /** 스킬 사용 처리(쿨다운 시작 + 버프). 실제 연출/피해는 전투 씬에서 */
  useSkill(id: SkillId): boolean {
    if (!this.skillReady(id)) return false;
    this.cooldowns[id] = this.skillDef(id).cd;
    if (id === 'guard') {
      const max = this.stats().maxHp;
      this.hp = Math.min(max, this.hp + max * guardHeal(this.s.skills.guard) / 100);
      this.guardTime = 6;
    }
    if (id === 'rage') this.rageTime = 8;
    this.emit('skill', id);
    return true;
  }

  // ---------- 환생 ----------
  prestigeReward(): number {
    if (this.s.maxStage < PRESTIGE_MIN_STAGE) return 0;
    return Math.floor((this.s.maxStage - PRESTIGE_MIN_STAGE + 5) ** 1.35 / 1.5) + 3;
  }

  prestige(): boolean {
    const r = this.prestigeReward();
    if (r <= 0) return false;
    const keep = this.s;
    const fresh = freshSave();
    this.s = { ...fresh, souls: keep.souls + r, prestiges: keep.prestiges + 1, totalKills: keep.totalKills,
      autoSkill: keep.autoSkill, goldRate: 0 };
    this.resetRun();
    this.emit('reset');
    this.emit('change');
    this.save();
    return true;
  }

  private resetRun() {
    this.bossTime = -1;
    this.guardTime = this.rageTime = 0;
    (Object.keys(this.cooldowns) as SkillId[]).forEach((k) => (this.cooldowns[k] = 0));
    this.hp = this.stats().maxHp;
  }

  // ---------- 전투 진행 ----------
  currentMonster(boss: boolean) { return monsterStats(this.s.stage, boss); }

  tick(dt: number): void {
    const st = this.stats();
    if (this.hp > 0) this.hp = Math.min(st.maxHp, this.hp + st.maxHp * st.regen * dt);
    for (const k of Object.keys(this.cooldowns) as SkillId[]) this.cooldowns[k] = Math.max(0, this.cooldowns[k] - dt);
    this.guardTime = Math.max(0, this.guardTime - dt);
    this.rageTime = Math.max(0, this.rageTime - dt);
    if (this.bossTime > 0 && this.hp > 0) {
      this.bossTime -= dt;
      if (this.bossTime <= 0) this.bossFailed('time');
    }
    // 골드 획득 속도(오프라인 보상용) 측정: 10초 단위 이동 평균
    this.earnTimer += dt;
    if (this.earnTimer >= 10) {
      this.earnWindow.push(this.earnAcc / this.earnTimer);
      if (this.earnWindow.length > 6) this.earnWindow.shift();
      this.s.goldRate = this.earnWindow.reduce((a, b) => a + b, 0) / this.earnWindow.length;
      this.earnAcc = 0;
      this.earnTimer = 0;
    }
  }

  get inBoss() { return this.bossTime > 0; }

  /** 일반 몬스터 처치 후 보스에 도전할 조건이 되었는가 */
  shouldStartBoss() { return !this.inBoss && this.s.autoBoss && this.s.kills >= KILLS_PER_STAGE; }

  startBoss() {
    this.bossTime = BOSS_TIME;
    this.emit('boss-start');
  }

  onKill(boss: boolean): number {
    const gold = this.currentMonster(boss).gold * this.stats().goldMul;
    this.s.gold += gold;
    this.earnAcc += gold;
    this.s.totalKills++;
    if (boss) {
      this.bossTime = -1;
      this.s.stage++;
      this.s.kills = 0;
      if (this.s.stage > this.s.maxStage) {
        this.s.maxStage = this.s.stage;
        const unlocked = SKILLS.find((k) => k.unlock === this.s.maxStage);
        if (unlocked) {
          if (this.s.skills[unlocked.id] === 0) this.s.skills[unlocked.id] = 1;
          this.emit('toast', `새 무공 습득: ${unlocked.name}(${unlocked.hanja})`);
        }
      }
      this.emit('stage');
    } else if (!this.inBoss) {
      this.s.kills = Math.min(KILLS_PER_STAGE, this.s.kills + 1);
    }
    this.emit('change');
    return gold;
  }

  damagePlayer(amount: number): number {
    const dmg = amount * (this.guardTime > 0 ? 0.5 : 1);
    this.hp = Math.max(0, this.hp - dmg);
    if (this.hp <= 0) this.emit('death');
    return dmg;
  }

  /** 사망 처리: 보스전이면 보스 실패, 아니면 한 단계 후퇴. 자동 도전 해제 */
  onDeathResolved() {
    if (this.inBoss) this.bossFailed('death');
    else if (this.s.stage > 1) {
      this.s.stage--;
      this.s.kills = KILLS_PER_STAGE;
      this.s.autoBoss = false;
      this.emit('stage');
    }
    this.hp = this.stats().maxHp;
    this.emit('change');
  }

  bossFailed(reason: 'time' | 'death') {
    this.bossTime = -1;
    this.s.autoBoss = false;
    this.emit('boss-fail', reason);
    this.emit('change');
  }

  offlineReward(sec: number): number {
    if (sec < 60) return 0;
    const capped = Math.min(sec, 8 * 3600);
    const rate = this.s.goldRate || this.currentMonster(false).gold * this.stats().goldMul * 0.3;
    return rate * capped * 0.5;
  }
}

// ---------- 숫자 표기 (한국식 단위) ----------
const UNITS = ['', '만', '억', '조', '경', '해', '자', '양', '구', '간', '정', '재', '극'];
export function fmtNum(n: number): string {
  if (!isFinite(n)) return '∞';
  if (n < 10000) return Math.floor(n).toLocaleString('ko-KR');
  const e = Math.floor(Math.log10(n) / 4);
  if (e >= UNITS.length) return n.toExponential(2);
  const v = n / 10000 ** e;
  const digits = v >= 1000 ? 0 : v >= 100 ? 1 : 2;
  return `${Number(v.toFixed(digits)).toLocaleString('ko-KR')}${UNITS[e]}`;
}

export function fmtTime(sec: number): string {
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60);
  return h ? `${h}시간 ${m}분` : `${Math.max(1, m)}분`;
}
