export function Chessground(element, config) {
  globalThis.__chessviewRendererBoardCalls ??= [];
  globalThis.__chessviewRendererBoardCalls.push({ element, config });
  return { destroy() {} };
}
