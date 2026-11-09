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
}

export const DIRECTIONS: Direction[] = ['left', 'right'];
export const ANIM_NAMES: AnimName[] = ['idle', 'walk', 'attack'];

export const MANIFEST_KEY = 'asset-manifest';
export const MANIFEST_URL = 'assets/manifest.json';

export const frameKey = (anim: AnimName, dir: Direction, i: number) => `warrior_${anim}_${dir}_${i}`;
export const animKey = (anim: AnimName, dir: Direction) => `warrior_${anim}_${dir}`;
