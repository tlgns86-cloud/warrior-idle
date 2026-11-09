# 무사의 길 — 전사 키우기

한국 전통 판타지 방치형 성장 RPG. Vite + TypeScript + Phaser 3.

- 기본 주소(`/`): **방치형 키우기 모드** — 주인공은 `assets/hero/warrior.png` (단일 이미지, 걷기·베기 동작은 코드로 연출)
- `/?training`: 기존 **수련장 모드** (직접 조작 액션 프로토타입)

## 키우기 모드 구성

| 요소 | 내용 |
|---|---|
| 전투 | 자동 전진/공격, 스테이지당 10마리 처치 → 보스(30초 제한). 실패·사망 시 반복 사냥 ("보스 도전" 버튼으로 재도전) |
| 지역 | 10스테이지마다 변경: 마을 어귀(산적) → 대나무 숲(도깨비불) → 안개 계곡(도깨비) → 버려진 산사(원귀) → 저승 문턱(구미호) |
| 수련 | 공격력·체력·체력 회복·치명타 확률/피해·공격 속도·골드 획득 (x1/x10/x100/MAX, 버튼 꾹 누르면 연속 구매) |
| 장비 | 환도·두정갑 강화 (확률형, 실패해도 하락 없음) |
| 무공 | 질풍참·회천검·호신강기·광풍노도 — 스테이지 돌파로 습득, AUTO 자동 사용 |
| 환생 | 3-5 이후 가능. 혼(魂) 획득 → 공격력·골드 +10%/개 영구 |
| 저장 | localStorage 자동 저장(10초), 오프라인 보상(최대 8시간) |

수치 조정은 `src/idle/model.ts` (몬스터 성장률 `monsterStats`, 업그레이드 `UPGRADES`, 장비/무공/환생 공식).
몬스터 픽셀아트는 `src/idle/monsterArt.ts` 의 문자 격자로 그려집니다.

## 실행

```bash
npm install      # 처음 한 번
npm run dev      # 개발 서버 (http://localhost:5173, 같은 와이파이 휴대폰은 표시되는 Network 주소로 접속)
npm run build    # 배포용 빌드 → dist/
npm run preview  # 빌드 결과 확인
```

`dev` / `build` 실행 시 `npm run sync-assets` 가 먼저 자동 실행되어
원본 `assets/` 를 검증하고 `public/assets/` 로 복사합니다. **원본은 수정하지 않습니다.**

## 조작

| | PC | 모바일 (가로 화면) |
|---|---|---|
| 이동 | A / D, ← / → | 왼쪽 아래 ◀ ▶ |
| 공격 | Space | 오른쪽 아래 斬 |
| 디버그 | H: 체력 -10, B: 공격 판정 표시 | ⛶ 전체화면 |

## 폴더 구조

```
assets/                원본 스프라이트 (보존)
scripts/sync-assets.mjs  PNG 검증(크기·투명·잘림·발 위치) + 복사 + manifest.json 생성
public/assets/         복사본 (자동 생성, git 제외)
src/
  config.ts            모든 수치 (속도, 데미지, FPS, 공격 범위, 허수아비 위치 등)
  assets/              manifest 타입, 오류 표시
  animation/           애니메이션 등록
  characters/          Player(상태 머신), TrainingDummy, Health
  combat/              CombatSystem(판정), Effects(타격 효과)
  input/               키보드 + 터치 입력 통합
  ui/                  HealthBar, TouchControls
  world/               배경(시차 스크롤), 코드 생성 텍스처
  idle/                키우기 모드: model(수치·저장) / IdleBattleScene(자동 전투) / ui(HUD·성장 패널) / 배경·몬스터 아트
  scenes/              Boot(로딩/검증), Game, UI
```

## 에셋 메모

- `idle/` 폴더가 비어 있어 `base/warrior_left_256.png`, `warrior_right_256.png` 를 1프레임 대기 동작으로 사용 중.
  `assets/idle/left/*.png`, `assets/idle/right/*.png` (또는 `idle/idle.json`) 를 넣으면 코드 수정 없이 자동 적용 (6FPS 반복).
- 공격 데미지는 04번 프레임(검기가 가장 큰 프레임)에서 적용. `config.ts` 의 `PLAYER.hitFrame` 으로 조정.

## 앱 확장

`vite.config.ts` 의 `base: './'` 로 상대 경로 빌드 → Capacitor 로 `dist/` 를 Android/iOS 앱에 감싸면 됩니다.
