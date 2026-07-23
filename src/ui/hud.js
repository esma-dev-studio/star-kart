// レース中HUD v2。#hud(pointer-events:none)内にDOMを構築し、Game.hudとして公開する。
// デザイン方向: 「レーシングゲームの完成品UI」。半透明ダークガラスパネル+メタリック/発光アクセント。
// 契約: Game.hud.init({race, course, playerKart}) / update(dt) / showMsg(text, sec) / setVisible(bool) / destroy()
// 性能規約: 要素参照はinitでキャッシュし、値が変わった時だけDOM更新する(ミニマップ/速度メーターCanvasのみ毎フレーム再描画可)。
(function () {
  // ---- 定数(マジックナンバー禁止: ここに集約) ----
  const HUD_TUNING = {
    rouletteFlipSec: 0.07,       // ルーレット中のアイテム名切替間隔
    rankPopSec: 0.5,             // 順位変動ポップアニメ時間
    minimapSize: 168,
    minimapPad: 16,              // 正規化時の余白px
    minimapDotR: 4.0,
    minimapDotRPlayer: 5.6,
    speedGaugeSize: 168,         // 速度メーターCanvasの一辺
    speedKmhPerUnit: 6,          // kart.speed × これ = km/h風表示
    speedArcStart: 145,          // 弧の開始角(度, 12時=0, 時計回り基準は下で変換)
    speedArcEnd: 395,            // 弧の終了角
    speedLinesFadeSec: 0.18,
    finalLapBlinkHz: 2.4,
    bannerSlideSec: 0.55,
    countdownPopSec: 0.5,
  };

  const RANK_GRADIENT = {
    1: ['#fff3c4', '#e8b93a', '#a9761a'],   // 金
    2: ['#f5f8fc', '#c7d2df', '#8993a3'],   // 銀
    3: ['#f0c9a0', '#c17a3f', '#7a4620'],   // 銅
  };
  const RANK_GRADIENT_DEFAULT = ['#e8ecf2', '#aab3c2', '#6b7383'];

  let styleInjected = false;
  function injectStyle() {
    if (styleInjected) return;
    styleInjected = true;
    const style = document.createElement('style');
    style.id = 'hud-style';
    style.textContent = `
#hudRoot {
  position: absolute; inset: 0;
  font-family: 'Segoe UI', 'Yu Gothic UI', 'Hiragino Sans', sans-serif;
  font-weight: 800; font-style: italic;
  color: #f4f7ff;
}
.hud-glass {
  background: linear-gradient(160deg, rgba(38,44,60,0.62), rgba(14,17,26,0.68));
  border: 1px solid rgba(255,255,255,0.22);
  border-radius: 14px;
  box-shadow: 0 6px 18px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.12);
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
}
.hud-num { font-variant-numeric: tabular-nums; letter-spacing: 0.5px; }

/* ---- タイマー(上中央) ---- */
#hudTimer {
  position: absolute; left: 50%; top: 14px; transform: translateX(-50%);
  font-size: 27px; padding: 6px 22px;
  text-shadow: 0 2px 6px rgba(0,0,0,0.5);
}

/* ---- ラップパネル(右上) ---- */
#hudLap {
  position: absolute; right: 96px; top: 14px;
  font-size: 22px; padding: 7px 18px;
  text-align: right; line-height: 1.15;
}
#hudLap .lapMain { font-size: 24px; }
#hudLap .lapSub { font-size: 13px; opacity: 0.72; font-style: normal; margin-left: 4px; }
#hudLap.finalLap { animation: hudFinalBlink ${1 / HUD_TUNING.finalLapBlinkHz}s ease-in-out infinite; }
@keyframes hudFinalBlink {
  0%, 100% { box-shadow: 0 6px 18px rgba(255,60,60,0.55), inset 0 1px 0 rgba(255,255,255,0.2); border-color: rgba(255,120,120,0.9); }
  50% { box-shadow: 0 6px 22px rgba(255,60,60,0.15), inset 0 1px 0 rgba(255,255,255,0.12); border-color: rgba(255,255,255,0.22); }
}

/* ---- ファイナルラップ横断バナー ---- */
#hudFinalBanner {
  position: absolute; left: 0; right: 0; top: 38%;
  display: flex; justify-content: center;
  pointer-events: none; overflow: hidden;
  opacity: 0; visibility: hidden;
}
#hudFinalBanner .bannerInner {
  background: linear-gradient(90deg, rgba(180,20,30,0) 0%, rgba(200,26,38,0.88) 18%, rgba(200,26,38,0.88) 82%, rgba(180,20,30,0) 100%);
  color: #fff; font-size: 40px; font-weight: 900; font-style: italic;
  padding: 12px 0; width: 100%; text-align: center;
  letter-spacing: 6px;
  text-shadow: 0 3px 10px rgba(0,0,0,0.5);
  transform: translateX(-100%);
}
#hudFinalBanner.show { opacity: 1; visibility: visible; }
#hudFinalBanner.show .bannerInner { animation: hudBannerSlide ${HUD_TUNING.bannerSlideSec * 4}s cubic-bezier(.2,.9,.25,1) forwards; }
@keyframes hudBannerSlide {
  0% { transform: translateX(-105%); }
  20% { transform: translateX(0%); }
  80% { transform: translateX(0%); }
  100% { transform: translateX(105%); }
}

/* ---- アイテムスロット(左上、六角形風) ---- */
#hudItemBox { position: absolute; left: 18px; top: 16px; display: flex; align-items: flex-start; gap: 8px; }
.hud-hex {
  width: 78px; height: 78px; position: relative;
  clip-path: polygon(25% 3%, 75% 3%, 100% 50%, 75% 97%, 25% 97%, 0% 50%);
  background: linear-gradient(160deg, rgba(40,46,64,0.72), rgba(12,14,22,0.75));
  border: none; display: flex; align-items: center; justify-content: center; flex-direction: column;
  box-shadow: inset 0 0 0 2px rgba(255,255,255,0.28), 0 5px 14px rgba(0,0,0,0.4);
}
.hud-hex.empty { box-shadow: inset 0 0 0 2px rgba(255,255,255,0.12); }
.hud-hex.empty::after {
  content: ''; width: 18px; height: 18px; border-radius: 50%;
  border: 2px dashed rgba(255,255,255,0.22);
}
.hud-hex canvas { width: 52px; height: 52px; display: block; }
.hud-hex .label {
  position: absolute; bottom: 3px; left: 0; right: 0;
  font-size: 9.5px; font-weight: 800; font-style: normal; color: #fff;
  text-align: center; text-shadow: 0 1px 3px rgba(0,0,0,0.8);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis; padding: 0 4px;
}
.hud-hex.roulette canvas { animation: hudSpin 0.45s linear infinite; }
@keyframes hudSpin { from { transform: rotate(0deg);} to { transform: rotate(360deg);} }
.hud-hex.pop { animation: hudHexPop 0.35s cubic-bezier(.3,1.6,.4,1) both; }
@keyframes hudHexPop { 0% { transform: scale(0.5); } 60% { transform: scale(1.12); } 100% { transform: scale(1); } }
#hudQueue { display: flex; flex-direction: column; gap: 6px; margin-top: 4px; }
.hud-qslot {
  width: 34px; height: 34px; position: relative;
  clip-path: polygon(25% 3%, 75% 3%, 100% 50%, 75% 97%, 25% 97%, 0% 50%);
  background: linear-gradient(160deg, rgba(40,46,64,0.6), rgba(12,14,22,0.62));
  box-shadow: inset 0 0 0 1.5px rgba(255,255,255,0.22);
  display: flex; align-items: center; justify-content: center;
}
.hud-qslot canvas { width: 22px; height: 22px; display: block; }

/* ---- ミニマップ(左下) ---- */
#hudMinimapWrap {
  position: absolute; left: 16px; bottom: 118px;
  width: ${HUD_TUNING.minimapSize}px; height: ${HUD_TUNING.minimapSize}px;
  border-radius: 16px; overflow: hidden;
}
#hudMinimap { width: 100%; height: 100%; display: block; }

/* ---- 速度メーター(右下) ---- */
#hudSpeedWrap {
  position: absolute; right: 14px; bottom: 96px;
  width: ${HUD_TUNING.speedGaugeSize}px; height: ${HUD_TUNING.speedGaugeSize}px;
}
#hudSpeedCanvas { width: 100%; height: 100%; display: block; }

/* ---- 順位バッジ(速度メーターの上) ---- */
#hudRank {
  position: absolute; right: 14px; bottom: ${96 + HUD_TUNING.speedGaugeSize + 8}px;
  width: ${HUD_TUNING.speedGaugeSize}px;
  display: flex; align-items: baseline; justify-content: center; gap: 3px;
  font-size: 50px; line-height: 1;
  text-shadow: 0 3px 10px rgba(0,0,0,0.55);
  -webkit-background-clip: text; background-clip: text; color: transparent;
}
#hudRank .rankSuffix { font-size: 20px; -webkit-text-fill-color: #fff; color: #fff; opacity: 0.85; font-style: normal; }
#hudRank.pop { animation: hudRankPop ${HUD_TUNING.rankPopSec}s cubic-bezier(.25,1.7,.4,1) both; }
@keyframes hudRankPop {
  0% { transform: scale(1.7) rotate(-4deg); }
  55% { transform: scale(0.94) rotate(1deg); }
  100% { transform: scale(1) rotate(0deg); }
}

/* ---- 中央メッセージ / カウントダウン ---- */
#centerMsg.hud-pop { animation: hudMsgPop 0.9s cubic-bezier(.2,1.4,.4,1) both; }
@keyframes hudMsgPop {
  0% { transform: translate(-50%, -50%) scale(0.3); opacity: 0; }
  15% { transform: translate(-50%, -50%) scale(1.15); opacity: 1; }
  30% { transform: translate(-50%, -50%) scale(1); opacity: 1; }
  75% { transform: translate(-50%, -50%) scale(1); opacity: 1; }
  100% { transform: translate(-50%, -50%) scale(1); opacity: 0; }
}
#centerMsg.hud-countdown {
  animation: hudCountdownPop ${HUD_TUNING.countdownPopSec}s cubic-bezier(.2,1.6,.3,1) both;
  font-size: 130px !important;
}
@keyframes hudCountdownPop {
  0% { transform: translate(-50%, -50%) scale(2.4); opacity: 0; }
  40% { transform: translate(-50%, -50%) scale(1); opacity: 1; }
  100% { transform: translate(-50%, -50%) scale(0.82); opacity: 0; }
}
#centerMsg.hud-go {
  animation: hudGoFlash 0.9s cubic-bezier(.2,1.4,.3,1) both;
  font-size: 130px !important;
  background: linear-gradient(90deg, #ff5d5d, #ffb703, #6fe86f, #55c8ff, #d05dff, #ff5d5d);
  background-size: 400% 100%;
  -webkit-background-clip: text; background-clip: text; color: transparent;
  -webkit-text-fill-color: transparent;
  animation: hudGoFlash 0.9s cubic-bezier(.2,1.4,.3,1) both, hudGoRainbow 0.9s linear both;
}
@keyframes hudGoFlash {
  0% { transform: translate(-50%, -50%) scale(2.1); opacity: 0; }
  35% { transform: translate(-50%, -50%) scale(1); opacity: 1; }
  100% { transform: translate(-50%, -50%) scale(1.05); opacity: 0; }
}
@keyframes hudGoRainbow { from { background-position: 0% 0; } to { background-position: 200% 0; } }

/* ---- ブースト時のスピードライン ----
   中央36%はマスクで抜いて視界を確保し、外周だけに放射ラインを出す。
   ゆっくり回転させて「風を切る」動きを付ける(DOMアニメのみ、描画負荷ほぼゼロ) */
#hudSpeedLines {
  position: absolute; inset: -12%; pointer-events: none;
  opacity: 0; transition: opacity ${HUD_TUNING.speedLinesFadeSec}s;
  background:
    repeating-conic-gradient(from 0deg at 50% 50%,
      rgba(255,255,255,0.30) 0deg 1.6deg, transparent 1.6deg 8.4deg);
  mix-blend-mode: screen;
  -webkit-mask-image: radial-gradient(ellipse at center, transparent 0 36%, black 80%);
  mask-image: radial-gradient(ellipse at center, transparent 0 36%, black 80%);
  animation: hud-lines-spin 1.1s linear infinite;
}
#hudSpeedLines.on { opacity: 0.75; }
#hudSpeedLines.boostGlow { background:
    repeating-conic-gradient(from 0deg at 50% 50%,
      rgba(255,150,60,0.38) 0deg 1.6deg, transparent 1.6deg 8.4deg); }
@keyframes hud-lines-spin { from { transform: rotate(0deg); } to { transform: rotate(8.4deg); } }
`;
    document.head.appendChild(style);
  }

  // ---- アイテムアイコン描画(Canvas、オリジナル意匠のミニアイコン) ----
  // 各関数は 48x48 canvasのctxに中心(24,24)基準で描く
  const ICONS = {
    honey(ctx) { // はちみつ=雫
      ctx.fillStyle = '#ffb703';
      ctx.beginPath();
      ctx.moveTo(24, 8);
      ctx.bezierCurveTo(32, 20, 36, 27, 36, 32);
      ctx.arc(24, 32, 12, 0, Math.PI * 2);
      ctx.moveTo(24, 8);
      ctx.bezierCurveTo(16, 20, 12, 27, 12, 32);
      ctx.fill();
      ctx.beginPath(); ctx.ellipse(20, 28, 3.2, 5, -0.5, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255,255,255,0.55)'; ctx.fill();
    },
    scone(ctx) { // スコーン=三角
      ctx.fillStyle = '#e8a05a';
      ctx.beginPath(); ctx.moveTo(24, 9); ctx.lineTo(38, 36); ctx.lineTo(10, 36); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = 'rgba(120,60,20,0.5)'; ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.moveTo(24, 15); ctx.lineTo(24, 30); ctx.stroke();
      ctx.fillStyle = '#ff5d8f';
      ctx.beginPath(); ctx.ellipse(24, 12, 3, 2, 0, 0, Math.PI * 2); ctx.fill();
    },
    caramel(ctx) { // トラップ=茶色の水たまり
      ctx.fillStyle = '#8a5a28';
      ctx.beginPath(); ctx.ellipse(24, 27, 15, 8, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.25)';
      ctx.beginPath(); ctx.ellipse(19, 24, 4, 2, 0.3, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#b9722a';
      ctx.beginPath(); ctx.ellipse(24, 16, 3, 3, 0, 0, Math.PI * 2); ctx.fill();
    },
    marshmallow(ctx) { // マシュマロ=羽付き球
      ctx.fillStyle = '#fff2f7';
      ctx.beginPath(); ctx.arc(24, 26, 11, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = 'rgba(200,170,190,0.6)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(24, 26, 11, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = '#ffd8e8';
      ctx.beginPath(); ctx.moveTo(30, 18); ctx.quadraticCurveTo(40, 12, 36, 22); ctx.quadraticCurveTo(33, 20, 30, 18); ctx.fill();
      ctx.beginPath(); ctx.moveTo(33, 22); ctx.quadraticCurveTo(43, 20, 37, 28); ctx.quadraticCurveTo(34, 25, 33, 22); ctx.fill();
    },
    shield(ctx) { // シールド=クッキー盾
      ctx.fillStyle = '#d9a15c';
      ctx.beginPath();
      ctx.moveTo(24, 8); ctx.bezierCurveTo(34, 8, 38, 12, 38, 20);
      ctx.bezierCurveTo(38, 30, 32, 37, 24, 40);
      ctx.bezierCurveTo(16, 37, 10, 30, 10, 20);
      ctx.bezierCurveTo(10, 12, 14, 8, 24, 8); ctx.closePath(); ctx.fill();
      ctx.fillStyle = 'rgba(120,70,30,0.55)';
      for (const [dx, dy] of [[-6, -2], [5, -4], [0, 6], [-4, 10], [6, 6]]) {
        ctx.beginPath(); ctx.arc(24 + dx, 20 + dy, 1.6, 0, Math.PI * 2); ctx.fill();
      }
    },
    lemon(ctx) { // レモン=丸+葉
      ctx.fillStyle = '#e6f24a';
      ctx.beginPath(); ctx.ellipse(24, 27, 11, 13, 0, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = 'rgba(150,160,20,0.4)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.ellipse(24, 27, 11, 13, 0, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = '#6fbf4f';
      ctx.beginPath(); ctx.ellipse(28, 12, 6, 3.2, 0.6, 0, Math.PI * 2); ctx.fill();
    },
    star(ctx) { // スター=星
      ctx.fillStyle = '#ffe14d';
      ctx.beginPath();
      for (let i = 0; i < 5; i++) {
        const a1 = -Math.PI / 2 + i * (Math.PI * 2 / 5);
        const a2 = a1 + Math.PI / 5;
        const r1 = 14, r2 = 6;
        ctx.lineTo(24 + Math.cos(a1) * r1, 26 + Math.sin(a1) * r1);
        ctx.lineTo(24 + Math.cos(a2) * r2, 26 + Math.sin(a2) * r2);
      }
      ctx.closePath(); ctx.fill();
      ctx.strokeStyle = 'rgba(180,120,0,0.5)'; ctx.lineWidth = 1; ctx.stroke();
    },
    soda(ctx) { // ソーダ=泡
      ctx.fillStyle = 'rgba(111,216,255,0.4)';
      ctx.beginPath(); ctx.ellipse(24, 30, 12, 8, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#6fd8ff';
      for (const [dx, dy, r] of [[-6, -2, 4.5], [3, -6, 5.5], [8, 1, 3.6], [-2, 5, 3.2], [10, -3, 2.6]]) {
        ctx.beginPath(); ctx.arc(24 + dx, 22 + dy, r, 0, Math.PI * 2); ctx.fill();
      }
      ctx.fillStyle = 'rgba(255,255,255,0.6)';
      ctx.beginPath(); ctx.arc(21, 17, 1.6, 0, Math.PI * 2); ctx.fill();
    },
    rainbow(ctx) { // スプリンクル=虹弧
      const cols = ['#ff5d5d', '#ffb703', '#6fe86f', '#55c8ff', '#d05dff'];
      for (let i = 0; i < cols.length; i++) {
        ctx.strokeStyle = cols[i]; ctx.lineWidth = 2.6; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.arc(24, 34, 16 - i * 3, Math.PI, Math.PI * 2); ctx.stroke();
      }
    },
    parfait(ctx) { // パフェ=グラス
      ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.moveTo(15, 18); ctx.lineTo(20, 36); ctx.lineTo(28, 36); ctx.lineTo(33, 18); ctx.stroke();
      ctx.fillStyle = '#ffc2e0';
      ctx.beginPath(); ctx.moveTo(16, 19); ctx.lineTo(32, 19); ctx.lineTo(28, 35); ctx.lineTo(20, 35); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#ff8fd8';
      ctx.beginPath(); ctx.arc(24, 16, 6, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#e6547f';
      ctx.beginPath(); ctx.arc(24, 9, 2.4, 0, Math.PI * 2); ctx.fill();
    },
  };
  function drawIcon(canvas, id, color) {
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, 48, 48);
    const fn = ICONS[id];
    if (fn) { fn(ctx); return; }
    // フォールバック(未知id): 単純な円
    ctx.fillStyle = `#${(color ?? 0xffffff).toString(16).padStart(6, '0')}`;
    ctx.beginPath(); ctx.arc(24, 24, 12, 0, Math.PI * 2); ctx.fill();
  }

  Game.hud = {
    _race: null, _course: null, _playerKart: null,
    _root: null, _visible: true,
    _lastRank: null, _lastLap: null, _lastTimerText: null,
    _lastItemSig: null, _lastQueueSig: null,
    _rouletteFlipT: 0, _rouletteIdx: 0, _rouletteIds: null,
    _mmCanvas: null, _mmCtx: null, _mmBounds: null,
    _speedLinesOn: null, _speedLinesBoost: null,
    _msgTimer: 0,
    _finalLapShown: false,
    _driftLevelDisplay: 0,

    init({ race, course, playerKart }) {
      this.destroy();
      injectStyle();
      this._race = race || null;
      this._course = course || null;
      this._playerKart = playerKart || null;

      const hudEl = document.getElementById('hud');
      const root = document.createElement('div');
      root.id = 'hudRoot';
      root.innerHTML = `
        <div id="hudTimer" class="hud-glass hud-num"></div>
        <div id="hudLap" class="hud-glass"></div>
        <div id="hudFinalBanner"><div class="bannerInner">ファイナルラップ！</div></div>
        <div id="hudItemBox">
          <div id="hudSlotMain" class="hud-hex empty"></div>
          <div id="hudQueue"></div>
        </div>
        <div id="hudMinimapWrap" class="hud-glass"><canvas id="hudMinimap"></canvas></div>
        <div id="hudRank" class="hud-num"></div>
        <div id="hudSpeedWrap"><canvas id="hudSpeedCanvas"></canvas></div>
        <div id="hudSpeedLines"></div>
        <div id="hudWrongWay" style="
          position:absolute; top:22%; left:50%; transform:translateX(-50%);
          font-size:40px; font-weight:900; font-style:italic; color:#fff;
          background:linear-gradient(100deg, rgba(200,30,50,0.92), rgba(140,10,30,0.92));
          border:2px solid rgba(255,255,255,0.8); border-radius:10px;
          padding:8px 34px; letter-spacing:3px; display:none;
          animation: hudWrongPulse 0.5s ease-in-out infinite alternate;">⚠ 逆走中!</div>
        <style>@keyframes hudWrongPulse { from { opacity: 0.75; } to { opacity: 1; transform: translateX(-50%) scale(1.04); } }</style>
      `;
      hudEl.appendChild(root);
      this._root = root;

      // 毎フレームのquerySelectorを避けるため要素参照をキャッシュする
      this._els = {
        timer: root.querySelector('#hudTimer'),
        lap: root.querySelector('#hudLap'),
        finalBanner: root.querySelector('#hudFinalBanner'),
        slotMain: root.querySelector('#hudSlotMain'),
        queue: root.querySelector('#hudQueue'),
        rank: root.querySelector('#hudRank'),
        speedLines: root.querySelector('#hudSpeedLines'),
        wrongWay: root.querySelector('#hudWrongWay'),
      };

      this._mmCanvas = root.querySelector('#hudMinimap');
      const mmSize = HUD_TUNING.minimapSize;
      this._mmCanvas.width = mmSize; this._mmCanvas.height = mmSize;
      this._mmCtx = this._mmCanvas.getContext('2d');
      this._computeMinimapBounds();

      this._spCanvas = root.querySelector('#hudSpeedCanvas');
      const spSize = HUD_TUNING.speedGaugeSize;
      this._spCanvas.width = spSize; this._spCanvas.height = spSize;
      this._spCtx = this._spCanvas.getContext('2d');

      this._lastRank = null; this._lastLap = null; this._lastTimerText = null;
      this._lastItemSig = null; this._lastQueueSig = null;
      this._rouletteFlipT = 0; this._rouletteIdx = 0;
      this._rouletteIds = Game.items && Game.items.defs ? Object.keys(Game.items.defs) : [];
      this._speedLinesOn = null; this._speedLinesBoost = null;
      this._msgTimer = 0;
      this._finalLapShown = false;
      this._driftLevelDisplay = 0;
      this._driftArcDisplay = 0;

      this._centerMsg = document.getElementById('centerMsg');
      this.setVisible(true);
    },

    _computeMinimapBounds() {
      const mm = this._course && this._course.minimap;
      if (!mm || mm.length === 0) { this._mmBounds = null; return; }
      let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
      for (const p of mm) {
        if (p.x < minX) minX = p.x; if (p.x > maxX) maxX = p.x;
        if (p.z < minZ) minZ = p.z; if (p.z > maxZ) maxZ = p.z;
      }
      const w = Math.max(1e-3, maxX - minX), h = Math.max(1e-3, maxZ - minZ);
      const size = HUD_TUNING.minimapSize - HUD_TUNING.minimapPad * 2;
      const scale = size / Math.max(w, h);
      this._mmBounds = { minX, minZ, w, h, scale };
    },

    // ワールド座標→ミニマップCanvas座標
    _mmProject(x, z) {
      const b = this._mmBounds;
      const size = HUD_TUNING.minimapSize;
      if (!b) return { x: size / 2, y: size / 2 };
      const px = (x - b.minX) * b.scale + (size - b.w * b.scale) / 2;
      const pz = (z - b.minZ) * b.scale + (size - b.h * b.scale) / 2;
      return { x: px, y: pz };
    },

    setVisible(v) {
      this._visible = !!v;
      if (this._root) this._root.style.display = this._visible ? '' : 'none';
    },

    destroy() {
      if (this._root && this._root.parentNode) this._root.parentNode.removeChild(this._root);
      this._root = null;
      this._els = null;
      this._mmCanvas = null; this._mmCtx = null;
      this._spCanvas = null; this._spCtx = null;
    },

    showMsg(text, sec = 1.4) {
      const el = this._centerMsg || document.getElementById('centerMsg');
      if (!el) return;
      el.textContent = text;
      el.classList.remove('hud-pop', 'hud-countdown', 'hud-go');
      void el.offsetWidth; // 再生させるためリフロー強制
      // カウントダウン数字/GO!は専用の派手な演出にする
      const trimmed = (text || '').trim();
      if (/^[0-9]$/.test(trimmed)) {
        el.classList.add('hud-countdown');
      } else if (/^go!?$/i.test(trimmed) || trimmed === 'ゴー！' || trimmed === 'スタート！') {
        el.classList.add('hud-go');
      } else {
        el.classList.add('hud-pop');
      }
      this._msgTimer = Math.max(0, sec || 0);
    },

    // ---- メイン更新 ----
    update(dt) {
      if (!this._root || !this._visible) return;
      const race = this._race, kart = this._playerKart;

      if (this._msgTimer > 0) {
        this._msgTimer -= dt;
        if (this._msgTimer <= 0 && this._centerMsg) {
          this._centerMsg.classList.remove('hud-pop', 'hud-countdown', 'hud-go');
        }
      }

      if (!race || !kart) {
        // race開始前など: 主要表示は据え置き、ミニマップだけ更新できるものは更新
        this._updateMinimap();
        return;
      }

      this._updateRank(kart);
      this._updateLap(kart, race);
      this._updateTimer(race);
      this._updateItemBox(kart, dt);
      this._updateMinimap();
      this._updateSpeedGauge(kart, dt);
      this._updateSpeedLines(kart);
      // 逆走警告(RaceManagerが検知)
      const ww = !!race.playerWrongWay;
      if (ww !== this._lastWrongWay) {
        this._els.wrongWay.style.display = ww ? 'block' : 'none';
        this._lastWrongWay = ww;
      }
    },

    _updateRank(kart) {
      const el = this._els.rank;
      const rank = Number.isFinite(kart.rank) ? kart.rank : null;
      if (rank == null) { if (el.innerHTML !== '') el.innerHTML = ''; return; }
      if (rank !== this._lastRank) {
        const grad = RANK_GRADIENT[rank] || RANK_GRADIENT_DEFAULT;
        el.innerHTML = `<span class="rankNum" style="background-image:linear-gradient(180deg, ${grad[0]}, ${grad[1]} 55%, ${grad[2]})">${rank}</span><span class="rankSuffix">位</span>`;
        const numEl = el.querySelector('.rankNum');
        if (numEl) {
          numEl.style.webkitBackgroundClip = 'text';
          numEl.style.backgroundClip = 'text';
          numEl.style.color = 'transparent';
          numEl.style.webkitTextFillColor = 'transparent';
        }
        if (this._lastRank !== null) {
          el.classList.remove('pop');
          void el.offsetWidth;
          el.classList.add('pop');
        }
        this._lastRank = rank;
      }
    },

    _updateLap(kart, race) {
      const el = this._els.lap;
      const lap = Number.isFinite(kart.lap) ? kart.lap : null;
      const laps = Number.isFinite(race.laps) ? race.laps : null;
      if (lap == null || laps == null) return;
      const clampedLap = Math.min(lap, laps);
      const isFinal = clampedLap >= laps;
      if (lap !== this._lastLap) {
        el.innerHTML = `<span class="lapSub">LAP</span> <span class="lapMain hud-num">${clampedLap}/${laps}</span>`;
        this._lastLap = lap;
      }
      if (isFinal !== this._finalLapShown) {
        el.classList.toggle('finalLap', isFinal);
        const banner = this._els.finalBanner;
        if (isFinal && banner) {
          banner.classList.remove('show');
          void banner.offsetWidth;
          banner.classList.add('show');
        }
        this._finalLapShown = isFinal;
      }
    },

    _updateTimer(race) {
      const el = this._els.timer;
      const t = Number.isFinite(race.raceTime) ? Math.max(0, race.raceTime) : 0;
      const m = Math.floor(t / 60);
      const s = t - m * 60;
      const text = `${m}:${s.toFixed(2).padStart(5, '0')}`;
      if (text !== this._lastTimerText) {
        el.textContent = text;
        this._lastTimerText = text;
      }
    },

    _renderSlotContent(el, id, def, showLabel) {
      el.innerHTML = `<canvas width="48" height="48"></canvas>` + (showLabel ? `<div class="label">${def.name}</div>` : '');
      const cv = el.querySelector('canvas');
      drawIcon(cv, id, def.color);
    },

    _updateItemBox(kart, dt) {
      const mainSlot = this._els.slotMain;
      const queueEl = this._els.queue;
      const defs = (Game.items && Game.items.defs) || {};
      const inRoulette = (kart._rouletteT || 0) > 0;

      if (inRoulette) {
        const ids = this._rouletteIds && this._rouletteIds.length ? this._rouletteIds : Object.keys(defs);
        if (ids.length > 0) {
          this._rouletteFlipT -= dt;
          if (this._rouletteFlipT <= 0) {
            this._rouletteFlipT = HUD_TUNING.rouletteFlipSec;
            this._rouletteIdx = (this._rouletteIdx + 1) % ids.length;
            const id = ids[this._rouletteIdx];
            const def = defs[id] || { name: '???', color: 0xffffff };
            mainSlot.classList.remove('empty');
            mainSlot.classList.add('roulette');
            this._renderSlotContent(mainSlot, id, def, true);
          }
        }
        this._lastItemSig = 'roulette';
      } else {
        const items = kart.items || [];
        const sig = items.join(',');
        if (sig !== this._lastItemSig) {
          const wasRoulette = mainSlot.classList.contains('roulette');
          mainSlot.classList.remove('roulette');
          if (items.length === 0) {
            mainSlot.classList.add('empty');
            mainSlot.innerHTML = '';
          } else {
            mainSlot.classList.remove('empty');
            const def = defs[items[0]] || { name: items[0], color: 0xffffff };
            this._renderSlotContent(mainSlot, items[0], def, true);
            if (wasRoulette) {
              mainSlot.classList.remove('pop');
              void mainSlot.offsetWidth;
              mainSlot.classList.add('pop');
            }
          }
          this._lastItemSig = sig;
        }
      }

      const items = kart.items || [];
      const qSig = items.slice(1).join(',');
      if (qSig !== this._lastQueueSig) {
        queueEl.innerHTML = items.slice(1).map(() => `<div class="hud-qslot"><canvas width="48" height="48"></canvas></div>`).join('');
        const cvs = queueEl.querySelectorAll('canvas');
        items.slice(1).forEach((id, i) => {
          const def = defs[id] || { name: id, color: 0xffffff };
          if (cvs[i]) drawIcon(cvs[i], id, def.color);
        });
        this._lastQueueSig = qSig;
      }
    },

    _updateMinimap() {
      const ctx = this._mmCtx;
      if (!ctx) return;
      const size = HUD_TUNING.minimapSize;
      ctx.clearRect(0, 0, size, size);

      // ガラスパネル背景(角丸パネルはCSS側の.hud-glassに任せているが、
      // ここでは内側にごく薄いビネットを足して奥行きを出す)
      const bgGrad = ctx.createLinearGradient(0, 0, size, size);
      bgGrad.addColorStop(0, 'rgba(60,68,90,0.25)');
      bgGrad.addColorStop(1, 'rgba(10,12,20,0.25)');
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, size, size);

      const mm = this._course && this._course.minimap;
      if (!mm || mm.length === 0) return;
      if (!this._mmBounds) this._computeMinimapBounds();

      // コースループ: 外側にグロー、内側に白線
      ctx.beginPath();
      for (let i = 0; i < mm.length; i++) {
        const pt = this._mmProject(mm[i].x, mm[i].z);
        if (i === 0) ctx.moveTo(pt.x, pt.y); else ctx.lineTo(pt.x, pt.y);
      }
      ctx.closePath();
      ctx.strokeStyle = 'rgba(120,200,255,0.35)';
      ctx.lineWidth = 8;
      ctx.lineJoin = 'round';
      ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,0.95)';
      ctx.lineWidth = 3.4;
      ctx.stroke();

      // スタート位置に旗マーク
      const startPt = this._mmProject(mm[0].x, mm[0].z);
      ctx.fillStyle = '#ffe14d';
      ctx.fillRect(startPt.x - 1, startPt.y - 11, 2, 11);
      ctx.beginPath();
      ctx.moveTo(startPt.x + 1, startPt.y - 11);
      ctx.lineTo(startPt.x + 8, startPt.y - 8);
      ctx.lineTo(startPt.x + 1, startPt.y - 5);
      ctx.closePath();
      ctx.fill();

      // 全カートのドット(プレイヤーは白縁+進行方向矢印)
      const race = this._race;
      if (race && race.entries) {
        for (const e of race.entries) {
          const k = e.kart;
          if (!k || !k.pos) continue;
          const pt = this._mmProject(k.pos.x, k.pos.z);
          const isPlayer = k === this._playerKart;
          const r = isPlayer ? HUD_TUNING.minimapDotRPlayer : HUD_TUNING.minimapDotR;
          if (isPlayer) {
            // 進行方向矢印(headingに応じて回転)
            const heading = Number.isFinite(k.heading) ? k.heading : 0;
            ctx.save();
            ctx.translate(pt.x, pt.y);
            ctx.rotate(heading);
            ctx.fillStyle = 'rgba(255,255,255,0.9)';
            ctx.beginPath();
            ctx.moveTo(0, -r - 6);
            ctx.lineTo(3.4, -r + 1);
            ctx.lineTo(-3.4, -r + 1);
            ctx.closePath();
            ctx.fill();
            ctx.restore();
          }
          ctx.beginPath();
          ctx.arc(pt.x, pt.y, r, 0, Math.PI * 2);
          ctx.fillStyle = `#${(k.color ?? 0xffffff).toString(16).padStart(6, '0')}`;
          ctx.fill();
          if (isPlayer) {
            ctx.lineWidth = 2;
            ctx.strokeStyle = '#ffffff';
            ctx.stroke();
          } else {
            ctx.lineWidth = 1;
            ctx.strokeStyle = 'rgba(0,0,0,0.4)';
            ctx.stroke();
          }
        }
      }
    },

    // 速度メーター: 円弧ゲージ+デジタル速度+ドリフトチャージ外周弧
    _updateSpeedGauge(kart, dt) {
      const ctx = this._spCtx;
      if (!ctx) return;
      const size = HUD_TUNING.speedGaugeSize;
      const cx = size / 2, cy = size / 2;
      const P = Game.config.physics;

      ctx.clearRect(0, 0, size, size);

      const speed = Number.isFinite(kart.speed) ? Math.max(0, kart.speed) : 0;
      const kmh = speed * HUD_TUNING.speedKmhPerUnit;
      const boosting = (kart.boostT || 0) > 0;
      const cap = Number.isFinite(kart.maxSpeed) ? kart.maxSpeed : P.maxSpeed;
      const capBoosted = cap * P.boostMultiplier;
      const ratio = Game.U.clamp(speed / capBoosted, 0, 1);

      const a0 = (HUD_TUNING.speedArcStart - 90) * Math.PI / 180;
      const a1 = (HUD_TUNING.speedArcEnd - 90) * Math.PI / 180;
      const rOuter = size / 2 - 8;
      const rGauge = size / 2 - 20;

      // 背景ガラスパネル(円形)
      ctx.beginPath();
      ctx.arc(cx, cy, rOuter + 6, 0, Math.PI * 2);
      const panelGrad = ctx.createLinearGradient(0, 0, size, size);
      panelGrad.addColorStop(0, 'rgba(40,46,64,0.55)');
      panelGrad.addColorStop(1, 'rgba(10,12,20,0.6)');
      ctx.fillStyle = panelGrad;
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.18)';
      ctx.lineWidth = 1;
      ctx.stroke();

      // 速度ゲージ トラック(未達分)
      ctx.beginPath();
      ctx.arc(cx, cy, rGauge, a0, a1);
      ctx.strokeStyle = 'rgba(255,255,255,0.14)';
      ctx.lineWidth = 10;
      ctx.lineCap = 'round';
      ctx.stroke();

      // 速度ゲージ 到達分(ブースト中は炎色+発光風)
      if (ratio > 0.002) {
        const aFill = a0 + (a1 - a0) * ratio;
        ctx.beginPath();
        ctx.arc(cx, cy, rGauge, a0, aFill);
        let strokeStyle;
        if (boosting) {
          const g = ctx.createLinearGradient(0, 0, size, size);
          g.addColorStop(0, '#ffe14d');
          g.addColorStop(0.5, '#ff8a30');
          g.addColorStop(1, '#ff3d3d');
          strokeStyle = g;
          ctx.shadowColor = 'rgba(255,140,50,0.9)';
          ctx.shadowBlur = 14;
        } else {
          const g = ctx.createLinearGradient(0, 0, size, size);
          g.addColorStop(0, '#55c8ff');
          g.addColorStop(1, '#7bf0d0');
          strokeStyle = g;
          ctx.shadowColor = 'rgba(85,200,255,0.5)';
          ctx.shadowBlur = 6;
        }
        ctx.strokeStyle = strokeStyle;
        ctx.lineWidth = 10;
        ctx.lineCap = 'round';
        ctx.stroke();
        ctx.shadowBlur = 0;
      }

      // ドリフトチャージ弧(ゲージ外周に重ねる。青→橙→紫)
      const drifting = kart.drift && kart.drift.state === 'drifting';
      const targetLevel = drifting ? (kart.drift.level || 0) : 0;
      const targetCharge = drifting ? (kart.drift.charge || 0) : 0;
      const maxTime = P.miniTurbo[P.miniTurbo.length - 1].time;
      const targetArcRatio = drifting ? Game.U.clamp(targetCharge / maxTime, 0, 1) : 0;
      this._driftArcDisplay = Game.U.damp(this._driftArcDisplay || 0, targetArcRatio, 14, dt || 0.016);
      if (this._driftArcDisplay > 0.003) {
        const dcol = targetLevel > 0 ? P.sparkColors[targetLevel - 1] : P.sparkColors[0];
        const hex = `#${dcol.toString(16).padStart(6, '0')}`;
        const aFillD = a0 + (a1 - a0) * this._driftArcDisplay;
        ctx.beginPath();
        ctx.arc(cx, cy, rOuter, a0, aFillD);
        ctx.strokeStyle = hex;
        ctx.lineWidth = 4;
        ctx.lineCap = 'round';
        ctx.shadowColor = hex;
        ctx.shadowBlur = 10;
        ctx.stroke();
        ctx.shadowBlur = 0;
      }

      // デジタル速度表示
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = boosting ? '#ffcf7a' : '#ffffff';
      ctx.font = 'italic 900 34px "Segoe UI", sans-serif';
      ctx.fillText(String(Math.round(kmh)), cx, cy - 2);
      ctx.font = 'italic 700 12px "Segoe UI", sans-serif';
      ctx.fillStyle = 'rgba(255,255,255,0.65)';
      ctx.fillText('km/h', cx, cy + 22);
    },

    _updateSpeedLines(kart) {
      const el = this._els.speedLines;
      const on = (kart.boostT || 0) > 0;
      if (on !== this._speedLinesOn) {
        el.classList.toggle('on', on);
        this._speedLinesOn = on;
      }
      if (on !== this._speedLinesBoost) {
        el.classList.toggle('boostGlow', on);
        this._speedLinesBoost = on;
      }
    },
  };
})();
