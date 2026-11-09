// 게임 전역 설정값. 수치 조정은 이 파일에서 한다.

/** 논리 화면 높이(고정). 가로 폭은 기기 비율에 맞춰 변한다. */
export const VIEW_H = 720;
export const VIEW_W_MIN = 960;
export const VIEW_W_MAX = 1680;

export const WORLD_W = 3200;
/** 캐릭터 발(기준점 y=240)이 닿는 지면 높이 */
export const GROUND_Y = 610;

export const SPRITE = {
  frameSize: 256,
  pivotX: 128,
  pivotY: 240,
} as const;

export const ANIM_FPS = {
  idle: 6,
  walk: 10,
  attack: 10,
} as const;

export const PLAYER = {
  startX: 380,
  speed: 270,
  maxHp: 100,
  /** 공격 애니메이션 중 실제 베기 프레임(0부터). 04번 프레임에서 검기가 가장 크게 그려짐 */
  hitFrame: 4,
  /** 이 프레임 이후 공격 입력은 1회 예약된다 */
  bufferFromFrame: 6,
  attackDamage: 25,
  /** 바라보는 방향 기준 공격 범위 (기준점에서의 거리, px) */
  attackRange: { near: -10, far: 150, top: 210, bottom: 0 },
} as const;

export const DUMMY = {
  maxHp: 100,
  positions: [920, 1340],
  respawnMs: 4000,
  hurtWidth: 56,
  hurtHeight: 170,
} as const;

export const DEPTH = {
  sky: -100,
  far: -90,
  mid: -80,
  village: -70,
  ground: -10,
  propsBack: 0,
  dummy: 10,
  player: 20,
  effects: 30,
  foreground: 40,
} as const;
