// キーボード入力。getState()は人間/AI共通の入力形式(inputLike)を返す。
// steer: +1=左, -1=右 (heading増加=画面左旋回の座標系に合わせる)
Game.input = {
  keys: new Set(),
  just: new Set(),

  init() {
    window.addEventListener('keydown', (e) => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
      if (!this.keys.has(e.code)) this.just.add(e.code);
      this.keys.add(e.code);
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => this.keys.clear());
  },

  has(...codes) { return codes.some((c) => this.keys.has(c)); },
  justPressed(...codes) { return codes.some((c) => this.just.has(c)); },

  getState() {
    const steer = (this.has('ArrowLeft', 'KeyA') ? 1 : 0) + (this.has('ArrowRight', 'KeyD') ? -1 : 0);
    return {
      throttle: this.has('ArrowUp', 'KeyW') ? 1 : 0,
      brake: this.has('ArrowDown', 'KeyS') ? 1 : 0,
      steer,
      drift: this.has('Space', 'ShiftLeft', 'ShiftRight'),
      driftPressed: this.justPressed('Space', 'ShiftLeft', 'ShiftRight'),
      itemPressed: this.justPressed('KeyE', 'Enter'),
      pausePressed: this.justPressed('KeyP', 'Escape'),
    };
  },

  // フレーム終端で呼ぶ(エッジ検出のクリア)
  endFrame() { this.just.clear(); },
};
