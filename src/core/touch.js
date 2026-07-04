// タッチ操作(iPad/スマホ用)。画面上のボタンで Game.input のキー状態を直接操作するため、
// 物理・AI・メニュー等の既存ロジックは一切変更不要。
// メニュー画面はDOMのクリック(タップ)がそのまま効くので、レース中の操作ボタンだけを出す。
Game.touch = {
  _root: null,
  _enabled: false,

  isTouchDevice() {
    return 'ontouchstart' in window || (navigator.maxTouchPoints || 0) > 0;
  },

  init() {
    if (!this.isTouchDevice()) return;
    this._enabled = true;

    const style = document.createElement('style');
    style.textContent = `
#touchRoot {
  /* z-index はスクリーン層(#screens=40)より必ず上にする。
     boot時は #touchRoot が #screens より先にDOMへ入るため、同値だと後勝ちで #screens が
     上になり、レイヤーのpointer-events設定次第でボタンへのタッチが届かなくなる */
  position: fixed; inset: 0; z-index: 50; pointer-events: none;
  display: none; font-family: 'Segoe UI', sans-serif;
  -webkit-user-select: none; user-select: none;
  -webkit-touch-callout: none;
}
#touchRoot.visible { display: block; }
/* ポーズ中は走行ボタンを消してポーズメニューと重ならないようにする(ポーズ解除ボタンだけ残す) */
#touchRoot.paused .tc-btn { display: none; }
#touchRoot.paused #tcPause { display: flex; }
.tc-btn {
  position: absolute; pointer-events: auto; touch-action: none;
  border-radius: 50%; border: 3px solid rgba(255,255,255,0.85);
  background: rgba(255,143,176,0.45);
  color: #fff; font-weight: 900; text-align: center;
  display: flex; align-items: center; justify-content: center;
  box-shadow: 0 3px 0 rgba(107,53,80,0.3);
  -webkit-tap-highlight-color: transparent;
}
.tc-btn.on { background: rgba(255,143,176,0.85); transform: scale(0.94); }
#tcLeft  { left: 18px;  bottom: 96px; width: 92px; height: 92px; font-size: 40px; }
#tcRight { left: 124px; bottom: 96px; width: 92px; height: 92px; font-size: 40px; }
#tcBrake { left: 71px;  bottom: 200px; width: 64px; height: 64px; font-size: 14px; background: rgba(120,120,140,0.4); }
#tcAccel { right: 20px; bottom: 84px; width: 116px; height: 116px; font-size: 20px; background: rgba(127,227,196,0.5); }
#tcDrift { right: 148px; bottom: 66px; width: 92px; height: 92px; font-size: 16px; background: rgba(85,200,255,0.5); }
#tcItem  { right: 44px; bottom: 214px; width: 76px; height: 76px; font-size: 15px; background: rgba(255,210,62,0.55); }
#tcPause { right: 16px; top: 64px; width: 52px; height: 52px; font-size: 20px; background: rgba(120,120,140,0.4); }
`;
    document.head.appendChild(style);

    const root = document.createElement('div');
    root.id = 'touchRoot';
    root.innerHTML = `
      <div class="tc-btn" id="tcLeft">◀</div>
      <div class="tc-btn" id="tcRight">▶</div>
      <div class="tc-btn" id="tcBrake">ブレーキ</div>
      <div class="tc-btn" id="tcAccel">アクセル</div>
      <div class="tc-btn" id="tcDrift">ドリフト</div>
      <div class="tc-btn" id="tcItem">アイテム</div>
      <div class="tc-btn" id="tcPause">❚❚</div>
    `;
    document.body.appendChild(root);
    this._root = root;

    const bindHold = (id, code) => {
      const el = root.querySelector('#' + id);
      const press = (e) => {
        if (e.cancelable) e.preventDefault();
        if (e.pointerId !== undefined) {
          try { el.setPointerCapture(e.pointerId); } catch (_) { /* no-op */ }
        }
        if (!Game.input.keys.has(code)) Game.input.just.add(code);
        Game.input.keys.add(code);
        el.classList.add('on');
      };
      const release = () => {
        Game.input.keys.delete(code);
        el.classList.remove('on');
      };
      // pointerイベントとtouchイベントを両方張る。
      // PointerEvent非対応の古いiOS(iPadOS 12以前)でも動き、両対応環境では
      // 両方発火するがキー操作はSetなので冪等(押下二重登録の害なし)。
      // touchstartのpreventDefaultはSafariのスクロール/ズームのジェスチャ奪取
      // (=直後のpointercancelでボタンが即離される現象)も防ぐ
      el.addEventListener('pointerdown', press);
      el.addEventListener('pointerup', release);
      el.addEventListener('pointercancel', release);
      el.addEventListener('touchstart', press, { passive: false });
      el.addEventListener('touchend', release);
      el.addEventListener('touchcancel', release);
      el.addEventListener('contextmenu', (e) => e.preventDefault());
    };

    bindHold('tcLeft', 'ArrowLeft');
    bindHold('tcRight', 'ArrowRight');
    bindHold('tcBrake', 'ArrowDown');
    bindHold('tcAccel', 'ArrowUp');
    bindHold('tcDrift', 'Space');
    bindHold('tcItem', 'KeyE');
    bindHold('tcPause', 'Escape');

    // ピンチズーム/ダブルタップズームの抑止(ゲーム画面上のみ)
    document.addEventListener('gesturestart', (e) => e.preventDefault());
  },

  // screens.setState から呼ばれる。レース中(とポーズ)だけ操作ボタンを表示する
  onState(state) {
    if (!this._enabled || !this._root) return;
    this._root.classList.toggle('visible', state === 'race' || state === 'pause');
    this._root.classList.toggle('paused', state === 'pause');
  },
};
