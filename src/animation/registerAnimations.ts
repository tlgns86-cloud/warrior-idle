import Phaser from 'phaser';
import { ANIM_FPS } from '../config';
import { ANIM_NAMES, DIRECTIONS, animKey, frameKey, type AssetManifest } from '../assets/manifest';

/**
 * manifest 에 정의된 프레임으로 캐릭터 애니메이션을 등록한다.
 * FPS 는 기획 수치(config.ANIM_FPS)를 따른다: 대기 6 / 걷기 10 / 공격 10.
 */
export function registerAnimations(scene: Phaser.Scene, manifest: AssetManifest): void {
  for (const name of ANIM_NAMES) {
    const entry = manifest.animations[name];
    if (!entry) continue;
    for (const dir of DIRECTIONS) {
      const frames = entry.frames[dir] ?? [];
      const key = animKey(name, dir);
      if (scene.anims.exists(key)) scene.anims.remove(key);
      scene.anims.create({
        key,
        frames: frames.map((_, i) => ({ key: frameKey(name, dir, i) })),
        frameRate: ANIM_FPS[name],
        repeat: name === 'attack' ? 0 : -1,
      });
    }
  }
}
