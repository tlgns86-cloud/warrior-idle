// 에셋 누락/검증 실패를 화면에 명확히 표시한다.

export function showFatalError(title: string, lines: string[]): void {
  console.error(`[KoreanWarriorGame] ${title}\n` + lines.join('\n'));
  let el = document.getElementById('error');
  if (!el) {
    el = document.createElement('div');
    el.id = 'error';
    document.body.appendChild(el);
  }
  el.innerHTML = '';
  const h = document.createElement('h2');
  h.textContent = `⚠ ${title}`;
  const pre = document.createElement('div');
  pre.textContent = lines.join('\n');
  el.append(h, pre);
}
