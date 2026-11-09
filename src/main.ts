import Phaser from 'phaser';
import { VIEW_H, VIEW_W_MAX, VIEW_W_MIN } from './config';
import { BootScene } from './scenes/BootScene';
import { GameScene } from './scenes/GameScene';
import { UIScene } from './scenes/UIScene';
import { IdleBattleScene } from './idle/IdleBattleScene';
import { IdleGame } from './idle/model';
import { IdleUI } from './idle/ui';
import { RpgScene } from './rpg/RpgScene';
import './idle/style.css';

// ?training 을 붙이면 기존 수련장(직접 조작) 모드, 기본은 방치형 키우기 모드
const params = new URLSearchParams(location.search);
const training = params.has('training');
const rpg = params.has('rpg');
// ?rpg: 탑다운 필드 RPG 미리보기
document.body.classList.add(training ? 'training' : rpg ? 'rpg' : 'idle');

if (training) startTraining();
else if (rpg) startRpg();
else startIdle();

function startRpg(): void {
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: 'game',
    backgroundColor: '#1c2a18',
    pixelArt: true,
    roundPixels: true,
    scale: { mode: Phaser.Scale.RESIZE, width: window.innerWidth, height: window.innerHeight },
    input: { activePointers: 2 },
    scene: [BootScene, RpgScene],
    callbacks: { preBoot: (g) => g.registry.set('mode', 'rpg') },
  });
  (window as unknown as { game: Phaser.Game }).game = game;
}

function startTraining(): void {
  /** 화면 높이를 720 으로 고정하고, 가로 폭은 기기 비율에 맞춘다 (가로 모드 기준) */
  const viewWidth = () => {
    const aspect = window.innerWidth / Math.max(1, window.innerHeight);
    return Math.round(Phaser.Math.Clamp(VIEW_H * aspect, VIEW_W_MIN, VIEW_W_MAX));
  };
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: 'game',
    backgroundColor: '#14111c',
    pixelArt: true,
    roundPixels: true,
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH, width: viewWidth(), height: VIEW_H },
    input: { activePointers: 4 },
    scene: [BootScene, GameScene, UIScene],
  });
  const onResize = () => {
    const w = viewWidth();
    if (w !== game.scale.width) game.scale.setGameSize(w, VIEW_H);
    game.scale.refresh();
  };
  new ResizeObserver(onResize).observe(document.getElementById('game')!);
  window.addEventListener('orientationchange', () => setTimeout(onResize, 200));
  (window as unknown as { game: Phaser.Game }).game = game;
}

function startIdle(): void {
  const { game: idle, offlineSec } = IdleGame.load();
  const app = document.getElementById('app')!;
  const wrap = document.getElementById('battle-wrap')!;

  /** 가로 화면: 전투(왼쪽) + 패널(오른쪽) / 세로 화면: 전투(위) + 패널(아래) */
  const measure = () => {
    const vw = window.innerWidth, vh = window.innerHeight;
    const landscape = vw >= 820 && vw / vh > 1.15;
    const logicalW = landscape ? 1280 : 960;
    let areaW: number, areaH: number;
    if (landscape) {
      const panelW = Math.round(Math.min(460, Math.max(360, vw * 0.32)));
      app.style.setProperty('--panel-w', `${panelW}px`);
      areaW = vw - panelW; areaH = vh;
    } else {
      areaW = vw; areaH = Math.round(vh * 0.48);
    }
    const ratio = logicalW / VIEW_H;
    const w = Math.floor(Math.min(areaW, areaH * ratio));
    return { landscape, logicalW, w, h: Math.floor(w / ratio) };
  };

  const first = measure();
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: 'game',
    backgroundColor: '#14111c',
    pixelArt: true,
    roundPixels: true,
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH, width: first.logicalW, height: VIEW_H },
    scene: [BootScene, IdleBattleScene],
    callbacks: {
      preBoot: (g) => {
        g.registry.set('mode', 'idle');
        g.registry.set('idle', idle);
      },
    },
  });

  const layout = () => {
    const m = measure();
    app.classList.toggle('landscape', m.landscape);
    app.classList.toggle('portrait', !m.landscape);
    wrap.style.width = `${m.w}px`;
    wrap.style.height = `${m.h}px`;
    wrap.style.setProperty('--u', `${m.w / m.logicalW}`);
    if (game.scale.width !== m.logicalW) game.scale.setGameSize(m.logicalW, VIEW_H);
    game.scale.refresh();
  };
  layout();
  window.addEventListener('resize', layout);
  window.addEventListener('orientationchange', () => setTimeout(layout, 200));

  const ui = new IdleUI(idle, document.getElementById('hud')!, document.getElementById('panel')!);
  const offline = idle.offlineReward(offlineSec);
  if (offline > 0) ui.showOffline(offlineSec, offline);

  // 자동 저장
  setInterval(() => idle.save(), 10000);
  document.addEventListener('visibilitychange', () => document.hidden && idle.save());
  window.addEventListener('pagehide', () => idle.save());

  (window as unknown as { game: Phaser.Game; idle: IdleGame }).game = game;
  (window as unknown as { idle: IdleGame }).idle = idle;
}
