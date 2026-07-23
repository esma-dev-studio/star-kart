// 設定画面オーバーレイ(Game.settings)。
// BGM/SE音量・影の表示・タッチボタンサイズをlocalStorageに保存し、変更を即時に反映する。
// DOMは open() が初回呼び出しされるまで生成しない(遅延生成、起動コストを抑える)。
(function () {
  // ==== ローカル定数(マジックナンバー集約) ====
  const ST = {
    rootId: 'sgSettings',
    storageKey: 'sgSettings',
    zIndex: 70, // タッチUI(#touchRoot z-index:50)より上
  };

  // 保存項目の既定値(localStorageに何もなければこれを使う)
  const DEFAULTS = {
    bgmVol: 100,
    sfxVol: 100,
    shadows: true,
    bigButtons: false,
  };

  // ネイビー×ネオンのUIトークンはscreens.jsのsg-btn/sg-panel/sg-headingを踏襲しつつ、
  // 他ファイルのCSSクラスには依存しない自前スタイルとして sg-set- プレフィックスで用意する
  const STYLE = `
  #${ST.rootId} {
    position: fixed; inset: 0; z-index: ${ST.zIndex};
    background: rgba(4,8,22,0.78);
    -webkit-backdrop-filter: blur(4px); backdrop-filter: blur(4px);
    display: none; align-items: center; justify-content: center;
    pointer-events: auto;
  }
  #${ST.rootId}.open { display: flex; }
  #${ST.rootId} * { box-sizing: border-box; font-family: 'Segoe UI','Hiragino Maru Gothic ProN','Yu Gothic UI',sans-serif; }

  #${ST.rootId} .sg-set-panel {
    width: 100%; max-width: 480px; max-height: 90vh; overflow: auto;
    background: linear-gradient(180deg,#141b3c,#0c1128);
    border: 2px solid rgba(126,240,216,0.35); border-radius: 22px;
    box-shadow: 0 20px 60px rgba(0,0,0,0.6);
    padding: 30px 32px; pointer-events: auto;
  }
  #${ST.rootId} .sg-set-heading {
    text-align: center; color: #eaf4ff; font-weight: 900; font-size: 26px;
    margin: 0 0 24px;
    text-shadow: 0 2px 0 #14205a, 0 0 16px rgba(126,240,216,0.35);
  }
  #${ST.rootId} .sg-set-row { margin-bottom: 22px; }
  #${ST.rootId} .sg-set-row:last-of-type { margin-bottom: 0; }
  #${ST.rootId} .sg-set-label {
    color: #9fb4e8; font-weight: 700; font-size: 15px; margin-bottom: 10px;
  }
  #${ST.rootId} .sg-set-slider-row { display: flex; align-items: center; gap: 14px; }
  #${ST.rootId} input[type=range] {
    flex: 1; accent-color: #7ef0d8; height: 6px; cursor: pointer;
  }
  #${ST.rootId} .sg-set-val {
    width: 40px; text-align: right; color: #eaf4ff; font-weight: 900;
    font-size: 15px; font-variant-numeric: tabular-nums;
  }

  #${ST.rootId} .sg-set-toggle-group { display: flex; gap: 10px; }
  #${ST.rootId} .sg-set-toggle-btn {
    flex: 1; cursor: pointer; user-select: none; text-align: center;
    padding: 11px 14px; border-radius: 14px;
    background: rgba(16,22,48,0.72); color: #9fb4e8; font-weight: 900; font-size: 14px;
    border: 3px solid rgba(140,165,230,0.35);
    transition: transform 0.12s ease, box-shadow 0.12s ease;
  }
  #${ST.rootId} .sg-set-toggle-btn:active { transform: scale(0.96); }
  #${ST.rootId} .sg-set-toggle-btn.selected {
    background: linear-gradient(180deg, #fff3c4 0%, #ffd94a 55%, #ff9a3c 100%);
    color: #4a2c00; border-color: rgba(255,240,200,0.9);
    box-shadow: 0 0 14px rgba(255,190,60,0.4);
  }

  #${ST.rootId} .sg-set-close {
    display: block; width: fit-content; margin: 28px auto 0; cursor: pointer; user-select: none;
    background: linear-gradient(180deg, #35427a 0%, #222c58 55%, #171f42 100%);
    border: 4px solid rgba(150,200,255,0.55); border-radius: 999px;
    color: #eaf4ff; font-weight: 900; font-size: 18px;
    padding: 10px 36px;
    box-shadow: 0 6px 0 #0c1230, 0 10px 18px rgba(0,10,40,0.55), inset 0 1px 0 rgba(255,255,255,0.22);
    transition: transform 0.12s ease, box-shadow 0.12s ease;
    text-align: center; text-shadow: 0 1px 3px rgba(0,10,40,0.6);
  }
  #${ST.rootId} .sg-set-close:hover { transform: translateY(-2px); }
  #${ST.rootId} .sg-set-close:active { transform: translateY(0) scale(0.97); }

  /* タッチボタン拡大(#touchRoot自体はtouch.jsが所有、ここではclass付与のみ)。
     各ボタンがtouch.js側でleft/right・bottom/topのどちらを基準に置かれているかに合わせて
     transform-originを画面端側へ寄せ、拡大時に画面外へはみ出さないようにする */
  #touchRoot.bigButtons .tc-btn { transform: scale(1.18); }
  #touchRoot.bigButtons #tcLeft,
  #touchRoot.bigButtons #tcRight,
  #touchRoot.bigButtons #tcBrake { transform-origin: left bottom; }
  #touchRoot.bigButtons #tcAccel,
  #touchRoot.bigButtons #tcDrift,
  #touchRoot.bigButtons #tcItem { transform-origin: right bottom; }
  #touchRoot.bigButtons #tcPause { transform-origin: right top; }
  `;

  // ==== 状態 ====
  let state = Object.assign({}, DEFAULTS);
  let root = null;
  const els = {}; // DOM参照キャッシュ(buildDomで一度だけ埋める)

  function loadState() {
    let saved = null;
    try {
      const raw = localStorage.getItem(ST.storageKey);
      if (raw) saved = JSON.parse(raw);
    } catch (e) { /* 読み込み失敗時は既定値のまま続行 */ }
    state = Object.assign({}, DEFAULTS, saved || {});
  }

  function saveState() {
    try {
      localStorage.setItem(ST.storageKey, JSON.stringify({
        bgmVol: state.bgmVol,
        sfxVol: state.sfxVol,
        shadows: state.shadows,
        bigButtons: state.bigButtons,
      }));
    } catch (e) { /* 容量超過等の保存失敗は無視してゲーム続行 */ }
  }

  // ==== 反映系(init()適用時とUI操作時の両方から呼ぶ) ====
  function applyVolumes(partial) {
    // Game.audio.setVolumes は並行作業で追加される前提のAPIなので存在チェックしてから呼ぶ
    if (Game.audio && Game.audio.setVolumes) {
      try { Game.audio.setVolumes(partial); } catch (e) { /* 音声APIの失敗はゲーム続行を優先し握りつぶす */ }
    }
  }

  function fireShadowChange() {
    // onShadowChangeは統合担当が代入するコールバック。未代入ならスキップ
    if (typeof api.onShadowChange === 'function') {
      try { api.onShadowChange(!!state.shadows); } catch (e) { /* コールバック側の失敗でゲームを止めない */ }
    }
  }

  function applyBigButtons() {
    const touchRoot = document.getElementById('touchRoot');
    if (touchRoot) touchRoot.classList.toggle('bigButtons', !!state.bigButtons);
  }

  // ==== DOM生成(open()の初回呼び出しで一度だけ) ====
  function setToggleSelection(groupEl, val) {
    Array.prototype.forEach.call(groupEl.children, (btn) => {
      btn.classList.toggle('selected', btn.dataset.val === val);
    });
  }

  function buildDom() {
    const style = document.createElement('style');
    style.textContent = STYLE;
    document.head.appendChild(style);

    root = document.createElement('div');
    root.id = ST.rootId;
    root.innerHTML = `
      <div class="sg-set-panel">
        <div class="sg-set-heading">せってい</div>

        <div class="sg-set-row">
          <div class="sg-set-label">BGM音量</div>
          <div class="sg-set-slider-row">
            <input type="range" id="sgSetBgmVol" min="0" max="100" step="1" value="${state.bgmVol}">
            <span class="sg-set-val" id="sgSetBgmVolVal">${state.bgmVol}</span>
          </div>
        </div>

        <div class="sg-set-row">
          <div class="sg-set-label">SE音量</div>
          <div class="sg-set-slider-row">
            <input type="range" id="sgSetSfxVol" min="0" max="100" step="1" value="${state.sfxVol}">
            <span class="sg-set-val" id="sgSetSfxVolVal">${state.sfxVol}</span>
          </div>
        </div>

        <div class="sg-set-row">
          <div class="sg-set-label">影の表示</div>
          <div class="sg-set-toggle-group" id="sgSetShadowGroup">
            <div class="sg-set-toggle-btn" data-val="on">ON</div>
            <div class="sg-set-toggle-btn" data-val="off">OFF</div>
          </div>
        </div>

        <div class="sg-set-row">
          <div class="sg-set-label">タッチボタン サイズ</div>
          <div class="sg-set-toggle-group" id="sgSetSizeGroup">
            <div class="sg-set-toggle-btn" data-val="std">標準</div>
            <div class="sg-set-toggle-btn" data-val="big">大きい</div>
          </div>
        </div>

        <div class="sg-set-close" id="sgSetCloseBtn">とじる</div>
      </div>
    `;
    document.body.appendChild(root);

    els.bgmSlider = root.querySelector('#sgSetBgmVol');
    els.bgmVal = root.querySelector('#sgSetBgmVolVal');
    els.sfxSlider = root.querySelector('#sgSetSfxVol');
    els.sfxVal = root.querySelector('#sgSetSfxVolVal');
    els.shadowGroup = root.querySelector('#sgSetShadowGroup');
    els.sizeGroup = root.querySelector('#sgSetSizeGroup');
    els.closeBtn = root.querySelector('#sgSetCloseBtn');

    setToggleSelection(els.shadowGroup, state.shadows ? 'on' : 'off');
    setToggleSelection(els.sizeGroup, state.bigButtons ? 'big' : 'std');

    bindEvents();
  }

  function bindEvents() {
    // BGM音量: ドラッグ中はリアルタイムに反映+保存
    els.bgmSlider.addEventListener('input', () => {
      const v = Number(els.bgmSlider.value);
      state.bgmVol = v;
      els.bgmVal.textContent = String(v);
      applyVolumes({ bgm: v / 100 });
      saveState();
    });

    // SE音量: リアルタイム反映+保存。つまみを離した(change)ら既存SFXでテスト再生
    els.sfxSlider.addEventListener('input', () => {
      const v = Number(els.sfxSlider.value);
      state.sfxVol = v;
      els.sfxVal.textContent = String(v);
      applyVolumes({ sfx: v / 100 });
      saveState();
    });
    els.sfxSlider.addEventListener('change', () => {
      // 'select'はaudio.js内に実在するUI用SFX(2音の短い確認音)
      if (Game.audio && Game.audio.sfx) {
        try { Game.audio.sfx('select'); } catch (e) { /* テスト再生の失敗は無視 */ }
      }
    });

    // 影の表示 ON/OFF
    els.shadowGroup.addEventListener('click', (e) => {
      const btn = e.target.closest('.sg-set-toggle-btn');
      if (!btn) return;
      state.shadows = btn.dataset.val === 'on';
      setToggleSelection(els.shadowGroup, btn.dataset.val);
      saveState();
      fireShadowChange();
    });

    // タッチボタンサイズ 標準/大きい
    els.sizeGroup.addEventListener('click', (e) => {
      const btn = e.target.closest('.sg-set-toggle-btn');
      if (!btn) return;
      state.bigButtons = btn.dataset.val === 'big';
      setToggleSelection(els.sizeGroup, btn.dataset.val);
      saveState();
      applyBigButtons();
    });

    // とじるボタン
    els.closeBtn.addEventListener('click', () => close());

    // 背景クリックで閉じる(パネル内のクリックはバブリングしてもtarget===rootにはならない)
    root.addEventListener('click', (e) => {
      if (e.target === root) close();
    });

    // Escapeキーで閉じる(開いている時だけ)
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && isOpen()) close();
    });
  }

  function ensureDom() {
    if (root) return;
    buildDom();
  }

  // ==== 公開API ====
  function init() {
    loadState();
    applyVolumes({ bgm: state.bgmVol / 100, sfx: state.sfxVol / 100 });
    fireShadowChange();
    applyBigButtons();
  }

  function open() {
    ensureDom();
    root.classList.add('open');
  }

  function close() {
    if (root) root.classList.remove('open');
  }

  function isOpen() {
    return !!root && root.classList.contains('open');
  }

  window.Game = window.Game || {};
  const api = {
    init,
    open,
    close,
    isOpen,
    onShadowChange: null, // 統合担当がbool引数のコールバックを代入する
  };
  Game.settings = api;
})();
