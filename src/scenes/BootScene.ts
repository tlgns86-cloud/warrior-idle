import Phaser from 'phaser';
import { SPRITE } from '../config';
import {
  ANIM_NAMES, DIRECTIONS, MANIFEST_KEY, MANIFEST_URL, frameKey, type AssetManifest,
} from '../assets/manifest';
import { showFatalError } from '../assets/errorOverlay';
import { registerAnimations } from '../animation/registerAnimations';
import { generateTextures } from '../world/TextureFactory';
import { generateIdleTextures } from '../idle/monsterArt';

/** 에셋 로딩 + 검증. 실패하면 게임을 시작하지 않고 원인을 화면에 표시한다. */
export class BootScene extends Phaser.Scene {
  private failed: string[] = [];

  constructor() {
    super('Boot');
  }

  preload(): void {
    this.drawLoadingBar();
    this.load.on(Phaser.Loader.Events.FILE_LOAD_ERROR, (file: Phaser.Loader.File) => {
      this.failed.push(`${file.key} → ${file.url}`);
    });
    this.load.json(MANIFEST_KEY, MANIFEST_URL);
  }

  create(): void {
    const manifest = this.cache.json.get(MANIFEST_KEY) as AssetManifest | undefined;
    if (!manifest) {
      showFatalError('에셋 목록(manifest.json)을 찾을 수 없습니다', [
        `요청 경로: ${MANIFEST_URL}`,
        '',
        '해결 방법: 터미널에서 다음을 실행하세요.',
        '  npm run sync-assets',
        '(npm run dev / npm run build 는 자동으로 실행합니다)',
      ]);
      return;
    }

    const missingDefs: string[] = [];
    for (const name of ANIM_NAMES) {
      for (const dir of DIRECTIONS) {
        const frames = manifest.animations[name]?.frames[dir];
        if (!frames?.length) {
          missingDefs.push(`애니메이션 '${name}' / 방향 '${dir}' 프레임 없음`);
          continue;
        }
        frames.forEach((f, i) => this.load.image(frameKey(name, dir, i), `assets/${f.file}`));
      }
    }
    if (missingDefs.length) {
      showFatalError('필수 애니메이션이 누락되었습니다', missingDefs);
      return;
    }

    this.load.once(Phaser.Loader.Events.COMPLETE, () => this.afterFramesLoaded(manifest));
    this.load.start();
  }

  private afterFramesLoaded(manifest: AssetManifest): void {
    if (this.failed.length) {
      showFatalError('스프라이트 파일을 불러오지 못했습니다', [
        ...this.failed,
        '',
        'assets/ 폴더의 파일명과 JSON 경로가 일치하는지 확인 후 npm run sync-assets 를 다시 실행하세요.',
      ]);
      return;
    }

    // 런타임 검증: 모든 프레임이 256x256 인지 (잘림/스케일 오류 방지)
    const bad: string[] = [];
    for (const name of ANIM_NAMES) {
      for (const dir of DIRECTIONS) {
        manifest.animations[name]!.frames[dir]!.forEach((f, i) => {
          const src = this.textures.get(frameKey(name, dir, i)).getSourceImage();
          if (src.width !== SPRITE.frameSize || src.height !== SPRITE.frameSize) {
            bad.push(`${f.file}: ${src.width}x${src.height}`);
          }
        });
      }
    }
    if (bad.length) {
      showFatalError('프레임 크기가 256x256 이 아닙니다', bad);
      return;
    }

    for (const w of manifest.warnings ?? []) console.warn('[에셋 경고]', w);

    registerAnimations(this, manifest);
    generateTextures(this);
    if (this.registry.get('mode') === 'idle') {
      generateIdleTextures(this);
      this.scene.start('IdleBattle');
      return;
    }
    this.scene.start('Game');
    this.scene.launch('UI');
  }

  private drawLoadingBar(): void {
    const { width, height } = this.scale;
    const box = this.add.rectangle(width / 2, height / 2, 320, 10, 0x2a2233).setStrokeStyle(1, 0xc9a45c);
    const bar = this.add.rectangle(box.x - 158, height / 2, 0, 6, 0xc9a45c).setOrigin(0, 0.5);
    this.add.text(width / 2, height / 2 - 30, this.registry.get('mode') === 'idle' ? '수련의 길로 떠나는 중…' : '수련장으로 향하는 중…', {
      fontFamily: 'serif', fontSize: '20px', color: '#e9d9b4',
    }).setOrigin(0.5);
    this.load.on(Phaser.Loader.Events.PROGRESS, (p: number) => (bar.width = 316 * p));
  }
}
