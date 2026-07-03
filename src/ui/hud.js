// レース中HUD。#hud(pointer-events:none)内にDOMを構築し、Game.hudとして公開する。
// 可愛くポップな見た目: 丸ゴシック系フォント、白縁取りの太字、パステル角丸チップ。
// 契約: Game.hud.init({race, course, playerKart}) / update(dt) / showMsg(text, sec) / setVisible(bool) / destroy()
(function () {
  const HUD_TUNING = {
    rouletteFlipSec: 0.07,      // ルーレット中のアイテム名切替間隔
    rankPopSec: 0.45,           // 順位変動ポップアニメ時間
    minimapSize: 170,
    minimapPad: 14,             // 正規化時の余白px
    minimapDotR: 4.2,
    minimapDotRPlayer: 5.6,
    driftBarWMax: 180,
    speedLinesFadeSec: 0.18,
  };

  const RANK_COLOR = { 1: '#ffd23e', 2: '#dfe6ee', 3: '#e2a765' };
  const RANK_COLOR_DEFAULT = '#ffffff';

  let styleInjected = false;
  function injectStyle() {
    if (styleInjected) return;
    styleInjected = true;
    const style = document.createElement('style');
    style.id = 'hud-style';
    style.textContent = `
#hudRoot { position: absolute; inset: 0; font-family: 'Segoe UI', 'Hiragino Maru Gothic ProN', 'Yu Gothic UI', 'Rounded Mplus 1c', sans-serif; }
.hud-outline { -webkit-text-stroke: 3px #6b3550; paint-order: stroke fill; text-shadow: 0 3px 0 rgba(107,53,80,0.35); }
#hudRank {
  position: absolute; right: 22px; bottom: 14px;
  font-size: 76px; font-weight: 900; color: #fff;
  letter-spacing: -1px; text-align: right; line-height: 1;
}
#hudRank .rankSuffix { font-size: 30px; margin-left: 2px; }
#hudRank.pop { animation: hudRankPop ${HUD_TUNING.rankPopSec}s ease-out; }
@keyframes hudRankPop {
  0% { transform: scale(1.55); }
  100% { transform: scale(1); }
}
#hudLap {
  position: absolute; right: 22px; top: 16px;
  font-size: 26px; font-weight: 800; color: #fff;
  background: rgba(255,255,255,0.22); border-radius: 14px;
  padding: 4px 16px;
}
#hudTimer {
  position: absolute; left: 50%; top: 14px; transform: translateX(-50%);
  font-size: 28px; font-weight: 800; color: #fff;
  background: rgba(255,255,255,0.22); border-radius: 14px;
  padding: 4px 18px; letter-spacing: 1px;
}
#hudItemBox {
  position: absolute; left: 18px; top: 16px;
  display: flex; align-items: center; gap: 6px;
}
.hud-slot {
  width: 66px; height: 66px; border-radius: 18px;
  background: rgba(255,255,255,0.28); border: 3px solid rgba(255,255,255,0.85);
  display: flex; align-items: center; justify-content: center; flex-direction: column;
  box-shadow: 0 3px 0 rgba(107,53,80,0.25);
}
.hud-slot.empty { background: rgba(255,255,255,0.12); border-color: rgba(255,255,255,0.35); }
.hud-slot .chip {
  width: 34px; height: 34px; border-radius: 50%;
  border: 3px solid #fff; box-shadow: 0 2px 0 rgba(107,53,80,0.3);
}
.hud-slot .label {
  font-size: 11px; font-weight: 800; color: #fff; margin-top: 2px;
  max-width: 60px; text-align: center; line-height: 1.1;
}
.hud-slot.roulette .chip { animation: hudSpin 0.5s linear infinite; }
@keyframes hudSpin { from { transform: rotate(0deg);} to { transform: rotate(360deg);} }
#hudQueue { display: flex; flex-direction: column; gap: 4px; }
.hud-qslot {
  width: 34px; height: 34px; border-radius: 10px;
  background: rgba(255,255,255,0.24); border: 2px solid rgba(255,255,255,0.7);
  display: flex; align-items: center; justify-content: center;
}
.hud-qslot .chip { width: 18px; height: 18px; border-radius: 50%; border: 2px solid #fff; }
#hudMinimapWrap {
  position: absolute; left: 16px; bottom: 14px;
  width: ${HUD_TUNING.minimapSize}px; height: ${HUD_TUNING.minimapSize}px;
  background: rgba(255,255,255,0.22); border-radius: 20px;
  border: 3px solid rgba(255,255,255,0.75);
  box-shadow: 0 3px 0 rgba(107,53,80,0.25);
}
#hudMinimap { width: 100%; height: 100%; display: block; }
#hudDriftBar {
  position: absolute; left: 50%; bottom: 26px; transform: translateX(-50%);
  width: ${HUD_TUNING.driftBarWMax}px; height: 14px;
  background: rgba(255,255,255,0.28); border-radius: 8px;
  border: 2px solid rgba(255,255,255,0.8); overflow: hidden;
  display: none;
}
#hudDriftBar .fill { height: 100%; width: 0%; background: #55c8ff; transition: background 0.1s; }
#centerMsg.hud-pop { animation: hudMsgPop 0.9s cubic-bezier(.2,1.4,.4,1) both; }
@keyframes hudMsgPop {
  0% { transform: translate(-50%, -50%) scale(0.3); opacity: 0; }
  15% { transform: translate(-50%, -50%) scale(1.15); opacity: 1; }
  30% { transform: translate(-50%, -50%) scale(1); opacity: 1; }
  75% { transform: translate(-50%, -50%) scale(1); opacity: 1; }
  100% { transform: translate(-50%, -50%) scale(1); opacity: 0; }
}
#hudSpeedLines {
  position: absolute; inset: 0; pointer-events: none;
  opacity: 0; transition: opacity ${HUD_TUNING.speedLinesFadeSec}s;
  background:
    repeating-conic-gradient(from 0deg at 50% 50%,
      rgba(255,255,255,0.16) 0deg 2deg, transparent 2deg 10deg);
  mix-blend-mode: screen;
}
#hudSpeedLines.on { opacity: 0.55; }
`;
    document.head.appendChild(style);
  }

  Game.hud = {
    _race: null, _course: null, _playerKart: null,
    _root: null, _visible: true,
    _lastRank: null, _lastLap: null, _lastTimerText: null,
    _lastItemSig: null, _lastQueueSig: null,
    _rouletteFlipT: 0, _rouletteIdx: 0, _rouletteIds: null,
    _mmCanvas: null, _mmCtx: null, _mmBounds: null,
    _driftVisible: null,
    _speedLinesOn: null,
    _msgTimer: 0,

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
        <div id="hudRank" class="hud-outline"></div>
        <div id="hudLap" class="hud-outline"></div>
        <div id="hudTimer" class="hud-outline"></div>
        <div id="hudItemBox">
          <div id="hudSlotMain" class="hud-slot empty"></div>
          <div id="hudQueue"></div>
        </div>
        <div id="hudMinimapWrap"><canvas id="hudMinimap"></canvas></div>
        <div id="hudDriftBar"><div class="fill"></div></div>
        <div id="hudSpeedLines"></div>
      `;
      hudEl.appendChild(root);
      this._root = root;

      this._mmCanvas = root.querySelector('#hudMinimap');
      const size = HUD_TUNING.minimapSize;
      this._mmCanvas.width = size;
      this._mmCanvas.height = size;
      this._mmCtx = this._mmCanvas.getContext('2d');
      this._computeMinimapBounds();

      this._lastRank = null; this._lastLap = null; this._lastTimerText = null;
      this._lastItemSig = null; this._lastQueueSig = null;
      this._rouletteFlipT = 0; this._rouletteIdx = 0;
      this._rouletteIds = Game.items && Game.items.defs ? Object.keys(Game.items.defs) : [];
      this._driftVisible = null;
      this._speedLinesOn = null;
      this._msgTimer = 0;

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
      // 画面座標系はZ増加=下方向。ワールドZ増加も同じ向きに描画(見下ろし想定)
      return { x: px, y: pz };
    },

    setVisible(v) {
      this._visible = !!v;
      if (this._root) this._root.style.display = this._visible ? '' : 'none';
    },

    destroy() {
      if (this._root && this._root.parentNode) this._root.parentNode.removeChild(this._root);
      this._root = null;
      this._mmCanvas = null; this._mmCtx = null;
    },

    showMsg(text, sec = 1.4) {
      const el = this._centerMsg || document.getElementById('centerMsg');
      if (!el) return;
      el.textContent = text;
      el.classList.remove('hud-pop');
      // 再生させるためにリフロー強制してからクラス再付与
      void el.offsetWidth;
      el.classList.add('hud-pop');
      this._msgTimer = Math.max(0, sec || 0);
    },

    // ---- メイン更新 ----
    update(dt) {
      if (!this._root || !this._visible) return;
      const race = this._race, kart = this._playerKart;

      if (this._msgTimer > 0) {
        this._msgTimer -= dt;
        if (this._msgTimer <= 0 && this._centerMsg) {
          this._centerMsg.classList.remove('hud-pop');
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
      this._updateDriftBar(kart);
      this._updateSpeedLines(kart);
    },

    _updateRank(kart) {
      const el = this._root.querySelector('#hudRank');
      const rank = Number.isFinite(kart.rank) ? kart.rank : null;
      if (rank == null) { if (el.textContent !== '') el.textContent = ''; return; }
      if (rank !== this._lastRank) {
        el.innerHTML = `${rank}<span class="rankSuffix">位</span>`;
        el.style.color = RANK_COLOR[rank] || RANK_COLOR_DEFAULT;
        if (this._lastRank !== null) {
          el.classList.remove('pop');
          void el.offsetWidth;
          el.classList.add('pop');
        }
        this._lastRank = rank;
      }
    },

    _updateLap(kart, race) {
      const el = this._root.querySelector('#hudLap');
      const lap = Number.isFinite(kart.lap) ? kart.lap : null;
      const laps = Number.isFinite(race.laps) ? race.laps : null;
      if (lap == null || laps == null) return;
      if (lap !== this._lastLap) {
        el.textContent = `LAP ${Math.min(lap, laps)}/${laps}`;
        this._lastLap = lap;
      }
    },

    _updateTimer(race) {
      const el = this._root.querySelector('#hudTimer');
      const t = Number.isFinite(race.raceTime) ? Math.max(0, race.raceTime) : 0;
      const m = Math.floor(t / 60);
      const s = t - m * 60;
      const text = `${m}:${s.toFixed(2).padStart(5, '0')}`;
      if (text !== this._lastTimerText) {
        el.textContent = text;
        this._lastTimerText = text;
      }
    },

    _updateItemBox(kart, dt) {
      const mainSlot = this._root.querySelector('#hudSlotMain');
      const queueEl = this._root.querySelector('#hudQueue');
      const defs = (Game.items && Game.items.defs) || {};
      const inRoulette = (kart._rouletteT || 0) > 0;

      if (inRoulette) {
        const ids = this._rouletteIds && this._rouletteIds.length ? this._rouletteIds : Object.keys(defs);
        if (ids.length > 0) {
          this._rouletteFlipT -= dt;
          if (this._rouletteFlipT <= 0) {
            this._rouletteFlipT = HUD_TUNING.rouletteFlipSec;
            this._rouletteIdx = (this._rouletteIdx + 1) % ids.length;
          }
          const id = ids[this._rouletteIdx];
          const def = defs[id] || { name: '???', color: 0xffffff };
          mainSlot.classList.remove('empty');
          mainSlot.classList.add('roulette');
          mainSlot.innerHTML =
            `<div class="chip" style="background:#${def.color.toString(16).padStart(6, '0')}"></div>` +
            `<div class="label">${def.name}</div>`;
        }
        this._lastItemSig = 'roulette';
      } else {
        const items = kart.items || [];
        const sig = items.join(',');
        if (sig !== this._lastItemSig) {
          mainSlot.classList.remove('roulette');
          if (items.length === 0) {
            mainSlot.classList.add('empty');
            mainSlot.innerHTML = '';
          } else {
            mainSlot.classList.remove('empty');
            const def = defs[items[0]] || { name: items[0], color: 0xffffff };
            mainSlot.innerHTML =
              `<div class="chip" style="background:#${def.color.toString(16).padStart(6, '0')}"></div>` +
              `<div class="label">${def.name}</div>`;
          }
          this._lastItemSig = sig;
        }
      }

      const items = kart.items || [];
      const qSig = items.slice(1).join(',');
      if (qSig !== this._lastQueueSig) {
        queueEl.innerHTML = items.slice(1).map((id) => {
          const def = defs[id] || { name: id, color: 0xffffff };
          return `<div class="hud-qslot"><div class="chip" style="background:#${def.color.toString(16).padStart(6, '0')}"></div></div>`;
        }).join('');
        this._lastQueueSig = qSig;
      }
    },

    _updateMinimap() {
      const ctx = this._mmCtx;
      if (!ctx) return;
      const size = HUD_TUNING.minimapSize;
      ctx.clearRect(0, 0, size, size);

      const mm = this._course && this._course.minimap;
      if (!mm || mm.length === 0) return;
      if (!this._mmBounds) this._computeMinimapBounds();

      // コースループ(白い太線)
      ctx.beginPath();
      for (let i = 0; i < mm.length; i++) {
        const pt = this._mmProject(mm[i].x, mm[i].z);
        if (i === 0) ctx.moveTo(pt.x, pt.y); else ctx.lineTo(pt.x, pt.y);
      }
      ctx.closePath();
      ctx.strokeStyle = 'rgba(255,255,255,0.95)';
      ctx.lineWidth = 5;
      ctx.lineJoin = 'round';
      ctx.stroke();

      // スタート位置に旗マーク
      const startPt = this._mmProject(mm[0].x, mm[0].z);
      ctx.fillStyle = '#ff6f91';
      ctx.fillRect(startPt.x - 1, startPt.y - 10, 2, 10);
      ctx.beginPath();
      ctx.moveTo(startPt.x + 1, startPt.y - 10);
      ctx.lineTo(startPt.x + 8, startPt.y - 7);
      ctx.lineTo(startPt.x + 1, startPt.y - 4);
      ctx.closePath();
      ctx.fill();

      // 全カートのドット
      const race = this._race;
      if (race && race.entries) {
        for (const e of race.entries) {
          const k = e.kart;
          if (!k || !k.pos) continue;
          const pt = this._mmProject(k.pos.x, k.pos.z);
          const isPlayer = k === this._playerKart;
          const r = isPlayer ? HUD_TUNING.minimapDotRPlayer : HUD_TUNING.minimapDotR;
          ctx.beginPath();
          ctx.arc(pt.x, pt.y, r, 0, Math.PI * 2);
          ctx.fillStyle = `#${(k.color ?? 0xffffff).toString(16).padStart(6, '0')}`;
          ctx.fill();
          if (isPlayer) {
            ctx.lineWidth = 2;
            ctx.strokeStyle = '#ffffff';
            ctx.stroke();
          }
        }
      }
    },

    _updateDriftBar(kart) {
      const wrap = this._root.querySelector('#hudDriftBar');
      const drifting = kart.drift && kart.drift.state === 'drifting';
      if (drifting !== this._driftVisible) {
        wrap.style.display = drifting ? '' : 'none';
        this._driftVisible = drifting;
      }
      if (!drifting) return;
      const P = Game.config.physics;
      const charge = Number.isFinite(kart.drift.charge) ? kart.drift.charge : 0;
      const level = Number.isFinite(kart.drift.level) ? kart.drift.level : 0;
      const maxTime = P.miniTurbo[P.miniTurbo.length - 1].time;
      const ratio = Game.U.clamp(charge / maxTime, 0, 1);
      const fill = wrap.querySelector('.fill');
      fill.style.width = `${(ratio * 100).toFixed(1)}%`;
      const color = level > 0 ? P.sparkColors[level - 1] : P.sparkColors[0];
      fill.style.background = `#${color.toString(16).padStart(6, '0')}`;
    },

    _updateSpeedLines(kart) {
      const el = this._root.querySelector('#hudSpeedLines');
      const on = (kart.boostT || 0) > 0;
      if (on !== this._speedLinesOn) {
        el.classList.toggle('on', on);
        this._speedLinesOn = on;
      }
    },
  };
})();
