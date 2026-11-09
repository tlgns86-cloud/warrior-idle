// scripts/sync-assets.mjs 가 생성하는 public/assets/manifest.json 의 타입과 헬퍼.

export type Direction = 'left' | 'right';
export type AnimName = 'idle' | 'walk' | 'attack';

export interface FrameInfo {
  file: string;
  bounds: { x: number; y: number; w: number; h: number } | null;
}

export interface AnimationEntry {
  fps: number;
  loop: boolean;
  frames: Partial<Record<Direction, FrameInfo[]>>;
}

export interface AssetManifest {
  frameSize: number;
  pivot: { x: number; y: number };
  animations: Partial<Record<AnimName, AnimationEntry>>;
  notes: string[];
  warnings: string[];
  /** 주인공 이미지 내용 해시 (캐시 무효화용) */
  heroVersion?: string;
}

/** 주인공 이미지 주소. 내용이 바뀌면 ?v= 가 바뀌어 새로 받는다 */
export const heroUrl = (m?: AssetManifest) => `assets/hero/warrior.png?v=${m?.heroVersion ?? Date.now()}`;

export const DIRECTIONS: Direction[] = ['left', 'right'];
export const ANIM_NAMES: AnimName[] = ['idle', 'walk', 'attack'];

export const MANIFEST_KEY = 'asset-manifest';
export const MANIFEST_URL = 'assets/manifest.json';

export const frameKey = (anim: AnimName, dir: Direction, i: number) => `warrior_${anim}_${dir}_${i}`;
export const animKey = (anim: AnimName, dir: Direction) => `warrior_${anim}_${dir}`;
