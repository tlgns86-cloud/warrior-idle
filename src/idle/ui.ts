import {
  GEAR, KILLS_PER_STAGE, BOSS_TIME, PRESTIGE_MIN_STAGE, SKILLS, UPGRADES, IdleGame,
  fmtNum, fmtTime, gearChance, gearCost, gearMult, gearTier, skillCost, stageLabel, zoneOf,
  type GearId, type SkillId, type UpgradeId,
} from './model';

const $ = <K extends keyof HTMLElementTagNameMap>(tag: K, cls = '', html = ''): HTMLElementTagNameMap[K] => {
  const el = document.createElement(tag);
  if (cls) el.className = cls;
  if (html) el.innerHTML = html;
  return el;
};

/** 누르고 있으면 반복 실행되는 버튼 */
function holdRepeat(btn: HTMLElement, fn: () => boolean | void): void {
  let t: number | undefined, iv: number | undefined;
  const stop = () => { clearTimeout(t); clearInterval(iv); t = iv = undefined; };
  btn.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    if ((btn as HTMLButtonElement).disabled) return;
    fn();
    t = window.setTimeout(() => {
      iv = window.setInterval(() => { if (fn() === false) stop(); }, 70);
    }, 380);
  });
  for (const ev of ['pointerup', 'pointerleave', 'pointercancel']) btn.addEventListener(ev, stop);
}

type Tab = 'train' | 'gear' | 'skill' | 'rebirth';

export class IdleUI {
  private updaters: (() => void)[] = [];
  private buyCount = 1;
  private toastBox: HTMLElement;

  constructor(private g: IdleGame, hud: HTMLElement, panel: HTMLElement) {
    this.toastBox = $('div', 'toasts');
    this.buildHud(hud);
    this.buildPanel(panel);
    hud.appendChild(this.toastBox);
    g.on('toast', (m: string) => this.toast(m));
    g.on('boss-fail', (r: string) => this.toast(r === 'time' ? '보스 처치 실패 — 더 강해져서 다시 도전하세요' : '쓰러졌습니다 — 수련 후 다시 도전하세요'));
    setInterval(() => this.refresh(), 100);
    this.refresh();
  }

  toast(msg: string): void {
    const t = $('div', 'toast');
    t.textContent = msg;
    this.toastBox.appendChild(t);
    setTimeout(() => t.classList.add('out'), 2200);
    setTimeout(() => t.remove(), 2700);
  }

  modal(title: string, body: string, buttons: { label: string; primary?: boolean; onClick?: () => void }[]): void {
    const bg = $('div', 'modal-bg');
    const m = $('div', 'modal', `<h3>${title}</h3><div class="modal-body">${body}</div>`);
    const row = $('div', 'modal-btns');
    for (const b of buttons) {
      const btn = $('button', b.primary ? 'btn primary' : 'btn', b.label);
      btn.onclick = () => { bg.remove(); b.onClick?.(); };
      row.appendChild(btn);
    }
    m.appendChild(row);
    bg.appendChild(m);
    document.body.appendChild(bg);
  }

  private refresh(): void {
    for (const u of this.updaters) u();
  }

  // ---------------- 전투 화면 위 HUD ----------------
  private buildHud(hud: HTMLElement): void {
    const g = this.g;
    const stage = $('div', 'hud-stage', `
      <div class="stage-name"><b class="st-lbl"></b> <span class="st-zone"></span></div>
      <div class="bar prog"><i></i><span></span></div>
      <div class="bar hp"><i></i><span></span></div>`);
    const lbl = stage.querySelector('.st-lbl')!, zone = stage.querySelector('.st-zone')!;
    const prog = stage.querySelector('.prog') as HTMLElement, progFill = prog.querySelector('i')!, progTxt = prog.querySelector('span')!;
    const hp = stage.querySelector('.hp') as HTMLElement, hpFill = hp.querySelector('i')!, hpTxt = hp.querySelector('span')!;

    const bossBtn = $('button', 'boss-btn');
    bossBtn.onclick = () => {
      g.s.autoBoss = !g.s.autoBoss;
      if (g.s.autoBoss && g.s.kills < KILLS_PER_STAGE) this.toast(`몬스터 ${KILLS_PER_STAGE}마리 처치 후 보스가 등장합니다`);
    };

    const skills = $('div', 'hud-skills');
    const autoBtn = $('button', 'skill auto', 'AUTO');
    autoBtn.onclick = () => (g.s.autoSkill = !g.s.autoSkill);
    skills.appendChild(autoBtn);
    const skillEls = SKILLS.map((def) => {
      const b = $('button', 'skill', `<span class="sk-h">${def.hanja.slice(0, 2)}</span><span class="sk-n">${def.name}</span><i class="cd"></i><em></em>`);
      b.onclick = () => g.emit('skill-request', def.id);
      skills.appendChild(b);
      return { def, b, cd: b.querySelector('.cd') as HTMLElement, txt: b.querySelector('em')! };
    });

    hud.append(stage, bossBtn, skills);

    this.updaters.push(() => {
      const st = g.stats();
      lbl.textContent = stageLabel(g.s.stage);
      zone.textContent = zoneOf(g.s.stage).name;
      if (g.inBoss) {
        prog.classList.add('boss');
        progFill.style.width = `${(g.bossTime / BOSS_TIME) * 100}%`;
        progTxt.textContent = `보스 ${g.bossTime.toFixed(1)}초`;
      } else {
        prog.classList.remove('boss');
        progFill.style.width = `${(g.s.kills / KILLS_PER_STAGE) * 100}%`;
        progTxt.textContent = `처치 ${g.s.kills}/${KILLS_PER_STAGE}`;
      }
      hpFill.style.width = `${Math.max(0, g.hp / st.maxHp) * 100}%`;
      hpTxt.textContent = `${fmtNum(g.hp)} / ${fmtNum(st.maxHp)}`;

      const ready = g.s.kills >= KILLS_PER_STAGE;
      bossBtn.style.display = g.inBoss ? 'none' : '';
      bossBtn.classList.toggle('on', g.s.autoBoss);
      bossBtn.classList.toggle('pulse', !g.s.autoBoss && ready);
      bossBtn.textContent = g.s.autoBoss ? '자동 도전 중' : ready ? '보스 도전!' : '반복 사냥 중';

      autoBtn.classList.toggle('on', g.s.autoSkill);
      for (const e of skillEls) {
        const unlocked = g.skillUnlocked(e.def.id);
        e.b.classList.toggle('locked', !unlocked);
        const cd = g.cooldowns[e.def.id];
        e.cd.style.setProperty('--p', `${unlocked ? (cd / e.def.cd) * 100 : 100}%`);
        e.txt.textContent = !unlocked ? `${stageLabel(e.def.unlock)}` : cd > 0 ? Math.ceil(cd).toString() : '';
      }
    });
  }

  // ---------------- 하단/우측 성장 패널 ----------------
  private buildPanel(panel: HTMLElement): void {
    const g = this.g;
    const top = $('div', 'res', `
      <div class="r gold"><i class="coin"></i><b></b></div>
      <div class="r soul"><i>魂</i><b></b></div>
      <div class="r power"><i>戰</i><b></b></div>`);
    const [goldEl, soulEl, powEl] = [...top.querySelectorAll('b')];
    this.updaters.push(() => {
      goldEl.textContent = fmtNum(g.s.gold);
      soulEl.textContent = fmtNum(g.s.souls);
      powEl.textContent = fmtNum(g.stats().power);
    });

    const tabs = $('div', 'tabs');
    const body = $('div', 'tab-body');
    const pages: Record<Tab, HTMLElement> = {
      train: this.buildTrain(), gear: this.buildGear(), skill: this.buildSkills(), rebirth: this.buildRebirth(),
    };
    const names: [Tab, string][] = [['train', '수련'], ['gear', '장비'], ['skill', '무공'], ['rebirth', '환생']];
    const btns = names.map(([id, label]) => {
      const b = $('button', 'tab', label);
      b.onclick = () => show(id);
      tabs.appendChild(b);
      return [id, b] as const;
    });
    const show = (id: Tab) => {
      for (const [k, b] of btns) b.classList.toggle('on', k === id);
      for (const [k, p] of Object.entries(pages)) p.style.display = k === id ? '' : 'none';
      try { localStorage.setItem('kwg-tab', id); } catch { /* */ }
    };
    Object.values(pages).forEach((p) => body.appendChild(p));
    let saved: Tab = 'train';
    try { saved = (localStorage.getItem('kwg-tab') as Tab) || 'train'; } catch { /* */ }
    show(pages[saved] ? saved : 'train');

    panel.append(top, tabs, body);
  }

  private buildTrain(): HTMLElement {
    const g = this.g;
    const page = $('div', 'page');
    const mult = $('div', 'mult');
    const opts: [string, number][] = [['x1', 1], ['x10', 10], ['x100', 100], ['MAX', Infinity]];
    const multBtns = opts.map(([l, n]) => {
      const b = $('button', 'chip', l);
      b.onclick = () => { this.buyCount = n; multBtns.forEach((x) => x.classList.toggle('on', x === b)); };
      mult.appendChild(b);
      return b;
    });
    multBtns[0].classList.add('on');
    page.appendChild(mult);

    for (const def of UPGRADES) {
      const row = $('div', 'row', `
        <div class="ic">${def.icon}</div>
        <div class="info"><div class="nm">${def.name} <small class="lv"></small></div><div class="val"></div></div>
        <button class="buy"><span class="cnt"></span><span class="cost"></span></button>`);
      const lv = row.querySelector('.lv')!, val = row.querySelector('.val')!;
      const buy = row.querySelector('.buy') as HTMLButtonElement, cnt = buy.querySelector('.cnt')!, cost = buy.querySelector('.cost')!;
      holdRepeat(buy, () => g.buyUpgrade(def.id as UpgradeId, this.buyCount));
      page.appendChild(row);
      this.updaters.push(() => {
        if (page.style.display === 'none') return;
        const L = g.upLv(def.id);
        const maxed = L >= def.max;
        const n = this.buyCount === Infinity ? Math.max(1, g.upMaxAffordable(def.id)) : Math.min(this.buyCount, def.max - L);
        const c = g.upCost(def.id, n);
        lv.textContent = maxed ? 'MAX' : `Lv.${L}`;
        val.innerHTML = maxed ? def.fmt(def.value(L)) : `${def.fmt(def.value(L))} <b>→ ${def.fmt(def.value(L + n))}</b>`;
        cnt.textContent = maxed ? '' : `+${n}`;
        cost.textContent = maxed ? '완료' : fmtNum(c);
        buy.disabled = maxed || c > g.s.gold;
      });
    }
    return page;
  }

  private buildGear(): HTMLElement {
    const g = this.g;
    const page = $('div', 'page');
    page.appendChild($('p', 'hint', '강화에 실패해도 단계는 내려가지 않습니다. 성공 확률은 단계가 오를수록 낮아집니다.'));
    for (const def of GEAR) {
      const card = $('div', 'gear', `
        <div class="gear-ic">${def.icon}</div>
        <div class="info"><div class="nm"></div><div class="val"></div><div class="chance"></div></div>
        <button class="buy big"><span class="cnt">강화</span><span class="cost"></span></button>`);
      const nm = card.querySelector('.nm')!, val = card.querySelector('.val')!, ch = card.querySelector('.chance')!;
      const buy = card.querySelector('.buy') as HTMLButtonElement, cost = buy.querySelector('.cost')!;
      buy.onclick = () => {
        const r = g.enhanceGear(def.id as GearId);
        if (r === 'poor') return;
        card.classList.remove('ok', 'ng');
        void card.offsetWidth;
        card.classList.add(r === 'success' ? 'ok' : 'ng');
        if (r === 'success') this.toast(`${def.name} +${g.s.gear[def.id]} 강화 성공!`);
        else this.toast('강화 실패…');
      };
      page.appendChild(card);
      this.updaters.push(() => {
        if (page.style.display === 'none') return;
        const lv = g.s.gear[def.id];
        nm.innerHTML = `${gearTier(lv)} ${def.name} <b>+${lv}</b>`;
        const fm = (v: number) => (v < 1000 ? v.toFixed(2) : fmtNum(v));
        val.innerHTML = `${def.stat} x${fm(gearMult(lv))} <b>→ x${fm(gearMult(lv + 1))}</b>`;
        ch.textContent = `성공 확률 ${gearChance(lv)}%`;
        const c = gearCost(lv);
        cost.textContent = fmtNum(c);
        buy.disabled = c > g.s.gold;
      });
    }
    return page;
  }

  private buildSkills(): HTMLElement {
    const g = this.g;
    const page = $('div', 'page');
    page.appendChild($('p', 'hint', 'AUTO 가 켜져 있으면 전투 중 무공을 자동으로 사용합니다. 무공은 스테이지를 돌파하면 습득합니다.'));
    for (const def of SKILLS) {
      const row = $('div', 'row', `
        <div class="ic sk">${def.hanja.slice(0, 2)}</div>
        <div class="info"><div class="nm">${def.name} <small class="lv"></small></div><div class="val"></div></div>
        <button class="buy"><span class="cnt">수련</span><span class="cost"></span></button>`);
      const lv = row.querySelector('.lv')!, val = row.querySelector('.val')!;
      const buy = row.querySelector('.buy') as HTMLButtonElement, cost = buy.querySelector('.cost')!;
      holdRepeat(buy, () => g.upgradeSkill(def.id as SkillId));
      page.appendChild(row);
      this.updaters.push(() => {
        if (page.style.display === 'none') return;
        const L = g.s.skills[def.id];
        const unlocked = g.skillUnlocked(def.id);
        row.classList.toggle('locked', !unlocked);
        lv.textContent = unlocked ? `Lv.${L}` : '';
        val.textContent = unlocked ? `${def.desc(L)} · 재사용 ${def.cd}초` : `${stageLabel(def.unlock)} 돌파 시 습득`;
        const c = skillCost(def, L);
        cost.textContent = unlocked ? fmtNum(c) : '잠김';
        buy.disabled = !unlocked || c > g.s.gold;
      });
    }
    return page;
  }

  private buildRebirth(): HTMLElement {
    const g = this.g;
    const page = $('div', 'page');
    const box = $('div', 'rebirth', `
      <div class="big-ic">魂</div>
      <p>환생하면 스테이지·골드·수련·장비·무공이 초기화되고,<br>최고 스테이지에 비례해 <b>혼(魂)</b>을 얻습니다.</p>
      <p class="sm">혼 1개당 공격력·골드 획득 <b>+10%</b>, 체력 <b>+5%</b> (영구)</p>
      <div class="stat-line"></div>
      <button class="btn primary rb">환생하기</button>`);
    const line = box.querySelector('.stat-line')!;
    const btn = box.querySelector('.rb') as HTMLButtonElement;
    btn.onclick = () => {
      const r = g.prestigeReward();
      if (r <= 0) return;
      this.modal('환생', `정말 환생하시겠습니까?<br>혼 <b>${fmtNum(r)}</b>개를 얻고 처음부터 다시 시작합니다.`, [
        { label: '취소' },
        { label: '환생', primary: true, onClick: () => { g.prestige(); this.toast(`환생 완료! 혼 +${fmtNum(r)}`); } },
      ]);
    };
    const stats = $('div', 'stats-box');
    const reset = $('button', 'btn danger', '저장 데이터 초기화');
    reset.onclick = () => this.modal('초기화', '모든 진행 상황(혼 포함)이 삭제됩니다. 되돌릴 수 없습니다.', [
      { label: '취소' }, { label: '삭제', primary: true, onClick: () => g.hardReset() },
    ]);
    page.append(box, stats, reset);
    this.updaters.push(() => {
      if (page.style.display === 'none') return;
      const r = g.prestigeReward();
      line.innerHTML = g.s.maxStage < PRESTIGE_MIN_STAGE
        ? `최고 스테이지 <b>${stageLabel(g.s.maxStage)}</b> · ${stageLabel(PRESTIGE_MIN_STAGE)} 도달 시 환생 가능`
        : `최고 스테이지 <b>${stageLabel(g.s.maxStage)}</b> · 획득 예정 혼 <b>+${fmtNum(r)}</b>`;
      btn.disabled = r <= 0;
      const st = g.stats();
      stats.innerHTML = `
        <div><span>공격력</span><b>${fmtNum(st.atk)}</b></div>
        <div><span>체력</span><b>${fmtNum(st.maxHp)}</b></div>
        <div><span>치명타</span><b>${(st.critRate * 100).toFixed(1)}% / ${(st.critDmg * 100) | 0}%</b></div>
        <div><span>공격 속도</span><b>x${st.speed.toFixed(2)}</b></div>
        <div><span>골드 배율</span><b>x${st.goldMul.toFixed(2)}</b></div>
        <div><span>환생 횟수</span><b>${g.s.prestiges}</b></div>
        <div><span>총 처치</span><b>${fmtNum(g.s.totalKills)}</b></div>
        <div><span>최고 스테이지</span><b>${stageLabel(g.s.maxStage)}</b></div>`;
    });
    return page;
  }

  showOffline(sec: number, gold: number): void {
    this.modal('돌아오셨군요!', `자리를 비운 <b>${fmtTime(sec)}</b> 동안<br>전사가 수련하여 <span class="gold-txt">${fmtNum(gold)}</span> 골드를 모았습니다.`, [
      { label: '받기', primary: true, onClick: () => { this.g.s.gold += gold; this.g.emit('change'); } },
    ]);
  }
}
