import Phaser from 'phaser';

/** 한 프레임의 입력 결과 */
export interface InputFrame {
  left: boolean;
  right: boolean;
  /** 이번 프레임에 '새로' 눌린 공격 입력 (누르고 있어도 반복되지 않음) */
  attackPressed: boolean;
}

/** 터치 버튼(UI 씬)이 써 넣고 게임 씬이 읽는 공유 상태 */
export const touchState = {
  left: false,
  right: false,
  attackQueued: false,
};

/** 키보드(A/D, ←/→, Space)와 터치 입력을 합친다. */
export class Controls {
  private keys: Record<'a' | 'd' | 'left' | 'right' | 'space', Phaser.Input.Keyboard.Key>;

  constructor(scene: Phaser.Scene) {
    const kb = scene.input.keyboard!;
    const K = Phaser.Input.Keyboard.KeyCodes;
    this.keys = {
      a: kb.addKey(K.A),
      d: kb.addKey(K.D),
      left: kb.addKey(K.LEFT),
      right: kb.addKey(K.RIGHT),
      space: kb.addKey(K.SPACE),
    };
    // 스페이스/방향키로 페이지가 스크롤되지 않게
    kb.addCapture([K.SPACE, K.LEFT, K.RIGHT]);
  }

  read(): InputFrame {
    const k = this.keys;
    const attackPressed = Phaser.Input.Keyboard.JustDown(k.space) || touchState.attackQueued;
    touchState.attackQueued = false;
    return {
      left: k.a.isDown || k.left.isDown || touchState.left,
      right: k.d.isDown || k.right.isDown || touchState.right,
      attackPressed,
    };
  }
}
