// 画面フロー統括(Game.screens)。タイトル→キャラ選択→(コース選択)→レース→リザルト→(表彰式)。
// メインループはここが所有: Game.app.start((dt)=>this._update(dt)) を一度だけ呼ぶ。
// 状態機械: title / charSelect / courseSelect / race / pause / result / award
(function () {
  // ---- ローカル定数(マジックナンバー集約) ----
  const SC = {
    rootId: 'screens',
    resultAutoDelaySec: 2,          // onRaceEnd から自動でリザルト画面を出すまでの秒数
    gpPointsByRank: [15, 12, 10, 8, 6, 4, 2, 1],
    gpCourseOrder: ['cookieTown', 'chocoCanyon', 'skyCastle'],
    bgCamRadius: 46,
    bgCamHeight: 22,
    bgCamSpeed: 0.05,               // rad/s
    bgCamLookHeight: 2,
    portraitSize: 108,
    statBarMax: 5,
    taStorageKeyPrefix: 'sugariaGP_ta_',
    courseDifficulty: { cookieTown: 1, chocoCanyon: 2, skyCastle: 3 },
    awardCamRadius: 16,
    awardCamHeight: 7,
    awardCamSpeed: 0.22,
    confettiCount: 46,
    fmt(t) {
      if (t == null) return '--:--.--';
      const m = Math.floor(t / 60), s = t - m * 60;
      return `${m}:${s.toFixed(2).padStart(5, '0')}`;
    },
  };

  const STYLE = `
  #${SC.rootId} { position: fixed; inset: 0; z-index: 40; pointer-events: none; }
  #${SC.rootId} .layer { position: absolute; inset: 0; pointer-events: none; }
  #${SC.rootId} .layer.active { pointer-events: auto; }
  #${SC.rootId} * { box-sizing: border-box; font-family: 'Segoe UI','Hiragino Maru Gothic ProN','Yu Gothic UI',sans-serif; }
  #${SC.rootId} .hidden { display: none !important; }

  .sg-btn {
    display: inline-block; cursor: pointer; user-select: none;
    background: linear-gradient(180deg, #fff7fb 0%, #ffd3e6 60%, #ffb8d6 100%);
    border: 4px solid #fff; border-radius: 999px;
    color: #d43d7c; font-weight: 900; font-size: 22px;
    padding: 14px 40px; margin: 8px;
    box-shadow: 0 6px 0 #e888b3, 0 10px 18px rgba(180,60,110,0.35);
    transition: transform 0.12s ease, box-shadow 0.12s ease;
    text-align: center;
  }
  .sg-btn:hover { transform: translateY(-2px); }
  .sg-btn.selected {
    background: linear-gradient(180deg, #fffdf2 0%, #ffe38a 60%, #ffcf4d 100%);
    color: #a8620a; box-shadow: 0 6px 0 #e8a93b, 0 10px 22px rgba(220,150,20,0.45);
    transform: translateY(-3px) scale(1.04);
  }
  .sg-btn.small { font-size: 16px; padding: 10px 26px; }
  .sg-btn.ghost {
    background: rgba(255,255,255,0.75); color: #7a5570;
    box-shadow: 0 4px 0 #d8c2d2, 0 6px 12px rgba(120,80,110,0.25);
  }

  .sg-title-logo {
    text-align: center; margin-top: 6vh;
    font-size: 88px; font-weight: 900; letter-spacing: 2px;
    background: linear-gradient(180deg, #fff6c2 0%, #ffb6d9 45%, #ff7fb8 75%, #d94f96 100%);
    -webkit-background-clip: text; background-clip: text; color: transparent;
    filter: drop-shadow(0 6px 0 #b8467f) drop-shadow(0 14px 22px rgba(90,20,60,0.45));
  }
  .sg-title-sub {
    text-align: center; margin-top: 4px; font-size: 22px; font-weight: 700;
    color: #fff; text-shadow: 0 2px 0 #d15b95, 0 4px 10px rgba(0,0,0,0.3);
    letter-spacing: 6px;
  }
  .sg-sparkle {
    position: absolute; color: #fff8d6; text-shadow: 0 0 10px #ffe98a;
    font-size: 28px; animation: sg-tw 1.6s ease-in-out infinite;
  }
  @keyframes sg-tw { 0%,100% { opacity: 0.25; transform: scale(0.8); } 50% { opacity: 1; transform: scale(1.15); } }

  .sg-menu { display: flex; flex-direction: column; align-items: center; margin-top: 6vh; }
  .sg-menu .sg-btn { width: 360px; }

  .sg-panel {
    position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%);
    background: rgba(255,250,246,0.92); border-radius: 34px;
    border: 6px solid #fff; box-shadow: 0 14px 40px rgba(120,50,90,0.35);
    padding: 30px 34px; max-width: 94vw; max-height: 92vh; overflow: auto;
  }
  .sg-heading {
    text-align: center; font-size: 30px; font-weight: 900; color: #d43d7c; margin-bottom: 18px;
    text-shadow: 0 2px 0 #fff;
  }

  .sg-char-grid { display: grid; grid-template-columns: repeat(3, 176px); gap: 16px; }
  .sg-char-card {
    background: linear-gradient(180deg,#fff,#fff0f6); border-radius: 20px; border: 4px solid #ffd6e8;
    padding: 10px; text-align: center; cursor: pointer; transition: transform 0.12s, border-color 0.12s;
  }
  .sg-char-card:hover { transform: translateY(-3px); }
  .sg-char-card.selected { border-color: #ffb347; box-shadow: 0 0 0 4px rgba(255,179,71,0.35); transform: translateY(-4px) scale(1.03); }
  .sg-char-card canvas { border-radius: 14px; background: #fff8ec; }
  .sg-char-name { font-weight: 900; color: #b8467f; font-size: 15px; margin: 6px 0 4px; }
  .sg-char-motif { font-size: 11px; color: #a98; margin-bottom: 6px; }
  .sg-stat-row { display: flex; align-items: center; gap: 4px; font-size: 10px; color: #99667c; margin: 2px 10px; }
  .sg-stat-label { width: 18px; text-align: right; font-weight: 700; }
  .sg-stat-bar { flex: 1; height: 7px; background: #f3dbe6; border-radius: 5px; overflow: hidden; }
  .sg-stat-fill { height: 100%; border-radius: 5px; background: linear-gradient(90deg,#ffb6d9,#ff6fa8); }

  .sg-course-grid { display: flex; gap: 20px; }
  .sg-course-card {
    width: 220px; background: linear-gradient(180deg,#fff,#f2f8ff); border-radius: 22px;
    border: 4px solid #cfe8ff; padding: 16px; text-align: center; cursor: pointer;
    transition: transform 0.12s, border-color 0.12s;
  }
  .sg-course-card:hover { transform: translateY(-3px); }
  .sg-course-card.selected { border-color: #ffb347; box-shadow: 0 0 0 4px rgba(255,179,71,0.35); transform: translateY(-4px) scale(1.03); }
  .sg-course-thumb { width: 100%; height: 96px; border-radius: 14px; margin-bottom: 10px; }
  .sg-course-name { font-weight: 900; color: #4a6fa8; font-size: 16px; margin-bottom: 4px; }
  .sg-course-stars { color: #ffb347; font-size: 18px; letter-spacing: 2px; }
  .sg-course-best { margin-top: 6px; font-size: 12px; color: #789; }

  .sg-pause-overlay {
    position: absolute; inset: 0; background: rgba(60,20,40,0.45);
    display: flex; align-items: center; justify-content: center;
  }
  .sg-pause-box {
    background: rgba(255,250,246,0.96); border-radius: 30px; border: 6px solid #fff;
    padding: 34px 50px; text-align: center; box-shadow: 0 14px 40px rgba(120,50,90,0.4);
  }

  .sg-result-table { border-collapse: collapse; margin: 0 auto 18px; }
  .sg-result-table th, .sg-result-table td {
    padding: 7px 16px; font-size: 15px; color: #7a4560; text-align: left;
    border-bottom: 2px dashed #ffdcec;
  }
  .sg-result-table th { color: #d43d7c; font-size: 13px; }
  .sg-result-table tr.me td { color: #d43d7c; font-weight: 900; }
  .sg-rank-cell { font-weight: 900; }

  .sg-confetti {
    position: absolute; top: -20px; width: 10px; height: 16px; opacity: 0.95;
    animation: sg-fall linear infinite;
  }
  @keyframes sg-fall {
    0% { transform: translateY(-20px) rotate(0deg); }
    100% { transform: translateY(110vh) rotate(600deg); }
  }

  .sg-award-podium-label {
    position: absolute; left: 50%; bottom: 8%; transform: translateX(-50%);
    text-align: center; color: #fff; text-shadow: 0 2px 0 #b8467f, 0 4px 10px rgba(0,0,0,0.35);
    font-size: 20px; font-weight: 900;
  }
  `;

  // ---- 汎用DOMヘルパ ----
  function el(tag, cls, html) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    return e;
  }

  Game.screens = {
    root: null,
    layers: {},
    _state: 'title',
    _initialized: false,

    // ---- 起動 ----
    boot() {
      if (this._initialized) return;
      this._initialized = true;

      const styleTag = document.createElement('style');
      styleTag.textContent = STYLE;
      document.head.appendChild(styleTag);

      this.root = el('div', null);
      this.root.id = SC.rootId;
      document.body.appendChild(this.root);

      this._buildTitleLayer();
      this._buildCharSelectLayer();
      this._buildCourseSelectLayer();
      this._buildRaceLayer();
      this._buildResultLayer();
      this._buildAwardLayer();

      // レース関連の可変状態
      this.mode = 'single';          // 'gp' | 'single' | 'ta'
      this.selectedCharId = null;
      this.selectedCourseId = 'cookieTown';
      this.gpCourseIdx = 0;
      this.gpPoints = {};            // charId(自分含む) -> 累計ポイント。エントリ識別はkart参照で管理
      this.gpEntries = null;         // グランプリ通しのロースター(キャラid配列、プレイヤー含む)
      this._raceCtx = null;          // { course, race, entries, playerKart, cam, playerCtrl, elapsed, paused }
      this._bgElapsed = 0;
      this._bgCourse = null;
      this._bgCam = { angle: 0 };
      this._hudActive = false;

      this.setState('title');

      // サウンドはブラウザ仕様上、ユーザー操作後にしか開始できない
      const startAudio = () => {
        if (Game.audio) { Game.audio.init(); Game.audio.playBgm('title'); }
        window.removeEventListener('keydown', startAudio);
        window.removeEventListener('pointerdown', startAudio);
      };
      window.addEventListener('keydown', startAudio);
      window.addEventListener('pointerdown', startAudio);

      Game.app.start((dt) => this._update(dt));
    },

    setState(next) {
      this._state = next;
      Game.state = next;
      for (const key of Object.keys(this.layers)) {
        this.layers[key].classList.toggle('active', key === next || (key === 'race' && next === 'pause'));
        this.layers[key].classList.toggle('hidden', !(key === next || (key === 'race' && next === 'pause')));
      }
      // HUDは race/pause 中のみ表示(結果画面等の裏で3Dだけ動いていても数値表示は隠す)
      if (Game.hud && this._hudActive) Game.hud.setVisible(next === 'race' || next === 'pause');

      if (next === 'title') this._enterTitle();
      if (next === 'charSelect') this._enterCharSelect();
      if (next === 'courseSelect') this._enterCourseSelect();
      if (next === 'result') this._enterResult();
      if (next === 'award') this._enterAward();

      // BGM切替(レース用BGMは_launchRaceで開始する)
      if (Game.audio) {
        if (next === 'title') Game.audio.playBgm('title');
        else if (next === 'result') { Game.audio.detachAll(); Game.audio.playBgm('result'); }
        else if (next === 'award') { Game.audio.detachAll(); Game.audio.playBgm('award'); }
      }
    },

    _update(dt) {
      switch (this._state) {
        case 'title': this._updateTitleBg(dt); this._navTitle(); break;
        case 'charSelect': this._updateTitleBg(dt); this._navCharSelect(); break;
        case 'courseSelect': this._updateTitleBg(dt); this._navCourseSelect(); break;
        case 'race': this._updateRace(dt); break;
        case 'pause': this._updateRace(dt, true); break;
        case 'result': this._updateResultTimer(dt); this._updateTitleBg(dt); this._navResult(); break;
        case 'award': this._updateAward(dt); break;
      }
    },

    // Enterはアイテム使用キーと衝突するため、メニュー決定はEnter+Space両対応にする
    _confirmPressed() { return Game.input.justPressed('Enter', 'Space'); },

    _navTitle() {
      if (Game.input.justPressed('ArrowUp', 'KeyW')) {
        this._titleCursor = (this._titleCursor - 1 + this._titleMenuItems.length) % this._titleMenuItems.length;
        this._refreshTitleMenu();
      } else if (Game.input.justPressed('ArrowDown', 'KeyS')) {
        this._titleCursor = (this._titleCursor + 1) % this._titleMenuItems.length;
        this._refreshTitleMenu();
      } else if (this._confirmPressed()) {
        this._confirmTitleMenu();
      }
    },

    _navCharSelect() {
      const n = Game.characters.list.length;
      const cols = 3;
      if (Game.input.justPressed('ArrowRight', 'KeyD')) { this._charCursor = (this._charCursor + 1) % n; this._refreshCharGrid(); }
      else if (Game.input.justPressed('ArrowLeft', 'KeyA')) { this._charCursor = (this._charCursor - 1 + n) % n; this._refreshCharGrid(); }
      else if (Game.input.justPressed('ArrowDown', 'KeyS')) { this._charCursor = (this._charCursor + cols) % n; this._refreshCharGrid(); }
      else if (Game.input.justPressed('ArrowUp', 'KeyW')) { this._charCursor = (this._charCursor - cols + n) % n; this._refreshCharGrid(); }
      else if (this._confirmPressed()) { this._confirmCharSelect(); }
    },

    _navCourseSelect() {
      const n = this._courseIds.length;
      if (Game.input.justPressed('ArrowRight', 'KeyD')) { this._courseCursor = (this._courseCursor + 1) % n; this._refreshCourseGrid(); }
      else if (Game.input.justPressed('ArrowLeft', 'KeyA')) { this._courseCursor = (this._courseCursor - 1 + n) % n; this._refreshCourseGrid(); }
      else if (this._confirmPressed()) { this._confirmCourseSelect(); }
    },

    _navResult() {
      if (this._confirmPressed()) this._onResultNext();
    },

    // =========================================================
    // 背景シーン(タイトル/キャラ選択/コース選択/リザルトで共用)
    // =========================================================
    _ensureBgScene() {
      if (this._bgCourse) return;
      const scene = Game.app.newScene();
      this._bgCourse = new Game.Course(Game.courses.cookieTown);
      this._bgCourse.build(scene);
      this._bgElapsed = 0;
      this._bgCam.angle = 0;
    },

    _updateTitleBg(dt) {
      this._ensureBgScene();
      this._bgElapsed += dt;
      if (this._bgCourse.def.animate) this._bgCourse.def.animate(this._bgElapsed, this._bgCourse.group);
      this._bgCam.angle += dt * SC.bgCamSpeed;
      const cam = Game.app.camera;
      cam.position.set(
        Math.sin(this._bgCam.angle) * SC.bgCamRadius,
        SC.bgCamHeight,
        Math.cos(this._bgCam.angle) * SC.bgCamRadius);
      cam.lookAt(0, SC.bgCamLookHeight, 0);
      // 描画自体は Game.app.start() のメインループが毎フレーム自動で行う
    },

    // =========================================================
    // 1. タイトル
    // =========================================================
    _buildTitleLayer() {
      const layer = el('div', 'layer');
      layer.appendChild(el('div', 'sg-title-logo', 'シュガリア<br>グランプリ'));
      layer.appendChild(el('div', 'sg-title-sub', 'SUGARIA GRAND PRIX'));

      for (let i = 0; i < 10; i++) {
        const sp = el('div', 'sg-sparkle', '✦');
        sp.style.left = `${5 + Math.random() * 90}%`;
        sp.style.top = `${8 + Math.random() * 30}%`;
        sp.style.animationDelay = `${Math.random() * 1.6}s`;
        layer.appendChild(sp);
      }

      const menu = el('div', 'sg-menu');
      const items = [
        { id: 'gp', label: 'グランプリ' },
        { id: 'single', label: 'シングルレース' },
        { id: 'ta', label: 'タイムアタック' },
      ];
      this._titleMenuItems = items;
      this._titleCursor = 0;
      items.forEach((it, i) => {
        const b = el('div', 'sg-btn', it.label);
        b.addEventListener('click', () => { this._titleCursor = i; this._confirmTitleMenu(); });
        b.addEventListener('mouseenter', () => { this._titleCursor = i; this._refreshTitleMenu(); });
        menu.appendChild(b);
      });
      layer.appendChild(menu);
      this._titleMenuEl = menu;

      this.root.appendChild(layer);
      this.layers.title = layer;
    },

    _refreshTitleMenu() {
      const btns = this._titleMenuEl.children;
      for (let i = 0; i < btns.length; i++) btns[i].classList.toggle('selected', i === this._titleCursor);
    },

    _confirmTitleMenu() {
      const it = this._titleMenuItems[this._titleCursor];
      this.mode = it.id;
      if (it.id === 'gp') {
        this.gpCourseIdx = 0;
        this.gpPoints = {};
        this.selectedCourseId = SC.gpCourseOrder[0];
      }
      this.setState('charSelect');
    },

    _enterTitle() {
      this._refreshTitleMenu();
    },

    // =========================================================
    // 2. キャラ選択
    // =========================================================
    _buildCharSelectLayer() {
      const layer = el('div', 'layer');
      const panel = el('div', 'sg-panel');
      panel.appendChild(el('div', 'sg-heading', 'キャラクターをえらぼう'));
      const grid = el('div', 'sg-char-grid');
      panel.appendChild(grid);
      const foot = el('div', null);
      foot.style.textAlign = 'center';
      foot.style.marginTop = '18px';
      const okBtn = el('div', 'sg-btn', 'このキャラで決定');
      okBtn.addEventListener('click', () => this._confirmCharSelect());
      const backBtn = el('div', 'sg-btn ghost small', 'タイトルへ戻る');
      backBtn.addEventListener('click', () => this.setState('title'));
      foot.appendChild(okBtn);
      foot.appendChild(backBtn);
      panel.appendChild(foot);
      layer.appendChild(panel);
      this.root.appendChild(layer);
      this.layers.charSelect = layer;
      this._charGridEl = grid;
      this._charCursor = 0;
    },

    _enterCharSelect() {
      this._ensureBgScene();
      if (this._charGridEl.children.length === 0) this._populateCharGrid();
      this._refreshCharGrid();
    },

    _populateCharGrid() {
      const list = Game.characters.list;
      this._charGridEl.innerHTML = '';
      list.forEach((c, i) => {
        const card = el('div', 'sg-char-card');
        const cv = document.createElement('canvas');
        cv.width = SC.portraitSize; cv.height = SC.portraitSize;
        const ctx = cv.getContext('2d');
        Game.characters.drawPortrait(ctx, c.id, SC.portraitSize);
        card.appendChild(cv);
        card.appendChild(el('div', 'sg-char-name', c.name));
        card.appendChild(el('div', 'sg-char-motif', c.motif));
        const stats = [['速', c.stats.speed], ['加', c.stats.accel], ['旋', c.stats.handling], ['重', c.stats.weight]];
        for (const [label, val] of stats) {
          const row = el('div', 'sg-stat-row');
          row.appendChild(el('div', 'sg-stat-label', label));
          const bar = el('div', 'sg-stat-bar');
          const fill = el('div', 'sg-stat-fill');
          fill.style.width = `${(val / SC.statBarMax) * 100}%`;
          bar.appendChild(fill);
          row.appendChild(bar);
          card.appendChild(row);
        }
        card.addEventListener('click', () => { this._charCursor = i; this._refreshCharGrid(); });
        card.addEventListener('dblclick', () => { this._charCursor = i; this._confirmCharSelect(); });
        this._charGridEl.appendChild(card);
      });
    },

    _refreshCharGrid() {
      const cards = this._charGridEl.children;
      for (let i = 0; i < cards.length; i++) cards[i].classList.toggle('selected', i === this._charCursor);
    },

    _confirmCharSelect() {
      this.selectedCharId = Game.characters.list[this._charCursor].id;
      if (this.mode === 'gp') {
        this._startGpRun();
      } else {
        this.setState('courseSelect');
      }
    },

    // =========================================================
    // 3. コース選択(シングル/TAのみ)
    // =========================================================
    _buildCourseSelectLayer() {
      const layer = el('div', 'layer');
      const panel = el('div', 'sg-panel');
      panel.appendChild(el('div', 'sg-heading', 'コースをえらぼう'));
      const grid = el('div', 'sg-course-grid');
      panel.appendChild(grid);
      const foot = el('div', null);
      foot.style.textAlign = 'center';
      foot.style.marginTop = '18px';
      const okBtn = el('div', 'sg-btn', 'このコースでスタート');
      okBtn.addEventListener('click', () => this._confirmCourseSelect());
      const backBtn = el('div', 'sg-btn ghost small', 'キャラ選択へ戻る');
      backBtn.addEventListener('click', () => this.setState('charSelect'));
      foot.appendChild(okBtn);
      foot.appendChild(backBtn);
      panel.appendChild(foot);
      layer.appendChild(panel);
      this.root.appendChild(layer);
      this.layers.courseSelect = layer;
      this._courseGridEl = grid;
      this._courseCursor = 0;
      this._courseIds = SC.gpCourseOrder;
    },

    _enterCourseSelect() {
      this._ensureBgScene();
      this._populateCourseGrid();
      this._refreshCourseGrid();
    },

    _courseThumbColor(id) {
      const def = Game.courses[id];
      return def && def.colors ? `#${def.colors.road.toString(16).padStart(6, '0')}` : '#ddd';
    },

    _populateCourseGrid() {
      this._courseGridEl.innerHTML = '';
      this._courseIds.forEach((id, i) => {
        const def = Game.courses[id];
        const card = el('div', 'sg-course-card');
        const thumb = el('div', 'sg-course-thumb');
        thumb.style.background = this._courseThumbColor(id);
        card.appendChild(thumb);
        card.appendChild(el('div', 'sg-course-name', def.displayName || id));
        const stars = '★'.repeat(SC.courseDifficulty[id] || 1) + '☆'.repeat(3 - (SC.courseDifficulty[id] || 1));
        card.appendChild(el('div', 'sg-course-stars', stars));
        if (this.mode === 'ta') {
          const best = this._loadBestTime(id);
          card.appendChild(el('div', 'sg-course-best', `ベスト: ${best ? SC.fmt(best.total) : '--:--.--'}`));
        }
        card.addEventListener('click', () => { this._courseCursor = i; this._refreshCourseGrid(); });
        card.addEventListener('dblclick', () => { this._courseCursor = i; this._confirmCourseSelect(); });
        this._courseGridEl.appendChild(card);
      });
    },

    _refreshCourseGrid() {
      const cards = this._courseGridEl.children;
      for (let i = 0; i < cards.length; i++) cards[i].classList.toggle('selected', i === this._courseCursor);
    },

    _confirmCourseSelect() {
      this.selectedCourseId = this._courseIds[this._courseCursor];
      this._startSingleOrTa();
    },

    // =========================================================
    // localStorage (タイムアタック)
    // =========================================================
    _loadBestTime(courseId) {
      try {
        const raw = localStorage.getItem(SC.taStorageKeyPrefix + courseId);
        return raw ? JSON.parse(raw) : null;
      } catch (e) { return null; }
    },
    _saveBestTime(courseId, total, bestLap) {
      const cur = this._loadBestTime(courseId);
      if (!cur || total < cur.total) {
        const rec = { total, bestLap };
        try { localStorage.setItem(SC.taStorageKeyPrefix + courseId, JSON.stringify(rec)); } catch (e) {}
        return { rec, isNew: true };
      }
      return { rec: cur, isNew: false };
    },

    // =========================================================
    // 4. レース起動
    // =========================================================
    _pickRoster(excludeId, count) {
      const pool = Game.characters.list.filter((c) => c.id !== excludeId).slice();
      for (let i = pool.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [pool[i], pool[j]] = [pool[j], pool[i]];
      }
      return pool.slice(0, count);
    },

    _startGpRun() {
      // グランプリ用ロースター(プレイヤー+CPU7)を初回のみ決定し、3コース通して使い回す
      const cpu = this._pickRoster(this.selectedCharId, Game.config.race.kartCount - 1);
      this.gpEntries = [this.selectedCharId, ...cpu.map((c) => c.id)];
      this.gpPoints = {};
      for (const id of this.gpEntries) this.gpPoints[id] = 0;
      this.gpCourseIdx = 0;
      this.selectedCourseId = SC.gpCourseOrder[0];
      this._launchRace({ isTA: false, charIds: this.gpEntries });
    },

    _startSingleOrTa() {
      if (this.mode === 'ta') {
        this._launchRace({ isTA: true, charIds: [this.selectedCharId] });
      } else {
        const cpu = this._pickRoster(this.selectedCharId, Game.config.race.kartCount - 1);
        const charIds = [this.selectedCharId, ...cpu.map((c) => c.id)];
        this._launchRace({ isTA: false, charIds });
      }
    },

    _launchRace({ isTA, charIds }) {
      this._bgCourse = null; // 背景シーンは newScene() で破棄されるため参照を捨てる(戻った時に再構築させる)
      const scene = Game.app.newScene();
      const def = Game.courses[this.selectedCourseId] || Game.courses.cookieTown;
      const course = new Game.Course(def);
      course.build(scene);

      const entries = [];
      let playerKart = null;
      charIds.forEach((charId, i) => {
        const cdef = Game.characters.list.find((c) => c.id === charId);
        const isPlayer = i === 0;
        const kart = new Game.Kart({ isPlayer, color: cdef.color, stats: cdef.stats, charId });
        scene.add(kart.buildMesh());
        // buildMesh()でkart.group内に'riderPlaceholder'が生成された後でないと差し替えできない
        Game.characters.mountOn(kart, charId);
        if (isPlayer) {
          playerKart = kart;
          entries.push({ kart, controller: new Game.PlayerController() });
        } else {
          entries.push({ kart, controller: new Game.AIController(kart) });
        }
      });

      const race = new Game.RaceManager({ course, entries });
      if (Game.items) {
        if (isTA) Game.items.disable(); // 前レースの残留ボックス/発射体を撤去(見えない箱を拾うバグ防止)
        else Game.items.init(scene, course, race);
      }

      if (Game.hud) {
        // 前レースのHUD DOMが残っていれば破棄してから作り直す(GP連戦/リスタート対策)
        if (this._hudActive && Game.hud.destroy) Game.hud.destroy();
        Game.hud.init({ race, course, playerKart });
        this._hudActive = true;
      }

      const cam = new Game.CameraCtrl(Game.app.camera);
      cam.snapTo(playerKart);

      race.onCountdownTick = (n) => Game.hud && Game.hud.showMsg(String(n), 1.0);
      race.onGo = () => Game.hud && Game.hud.showMsg('GO!', 0.8);
      race.onLapChange = (kart, lap) => {
        if (kart === playerKart) {
          Game.hud && Game.hud.showMsg(lap === race.laps ? 'ファイナルラップ!' : `LAP ${lap} / ${race.laps}`, 1.4);
        }
      };
      race.onKartFinish = (kart, time, rank) => {
        if (kart === playerKart) Game.hud && Game.hud.showMsg(`ゴール! ${rank}位`, 2.4);
      };
      race.onRaceEnd = (results) => {
        this._raceCtx.results = results;
        this._raceCtx.ended = true;
        this._raceCtx.endedT = 0;
      };

      // ---- 演出・サウンドの配線(既存コールバックはチェーンで残す) ----
      if (Game.fx) {
        Game.fx.init(scene);
        entries.forEach((e) => Game.fx.attachKart(e.kart, e.kart === playerKart));
      }
      if (Game.audio) {
        Game.audio.detachAll(); // リスタート/連戦時に旧カートのエンジン音を確実に止める
        Game.audio.attachKart(playerKart, true); // CPUは距離減衰が無く騒がしくなるためプレイヤーのみ
        Game.audio.playBgm(def.id);
      }
      const prevTick = race.onCountdownTick;
      race.onCountdownTick = (n) => { if (prevTick) prevTick(n); if (Game.audio) Game.audio.sfx('countBeep'); };
      const prevGo = race.onGo;
      race.onGo = () => { if (prevGo) prevGo(); if (Game.audio) Game.audio.sfx('countGo'); };
      const prevLap = race.onLapChange;
      race.onLapChange = (kart, lap) => {
        if (prevLap) prevLap(kart, lap);
        if (kart === playerKart && Game.audio) {
          Game.audio.sfx('lap');
          if (lap === race.laps) Game.audio.setFinalLap(true);
        }
      };
      const prevFin = race.onKartFinish;
      race.onKartFinish = (kart, time, rank) => {
        if (prevFin) prevFin(kart, time, rank);
        if (kart === playerKart) {
          if (Game.audio) Game.audio.sfx('finish');
          if (Game.fx) Game.fx.burst(kart.pos, 'confetti');
        }
      };

      race.start();

      this._raceCtx = {
        isTA, charIds, course, race, entries, playerKart, cam,
        elapsed: 0, paused: false, ended: false, endedT: 0, results: null,
      };
      this.setState('race');
    },

    // =========================================================
    // レース中の更新/ポーズ
    // =========================================================
    _buildRaceLayer() {
      const layer = el('div', 'layer');
      // HUDはid=hud(既存グローバルDOM)側に描画される想定なのでここでは3D描画+ポーズオーバーレイのみ
      const overlay = el('div', 'sg-pause-overlay hidden');
      const box = el('div', 'sg-pause-box');
      box.appendChild(el('div', 'sg-heading', 'ポーズ中'));
      const resumeBtn = el('div', 'sg-btn', '再開する');
      resumeBtn.addEventListener('click', () => this._resumeRace());
      const restartBtn = el('div', 'sg-btn ghost', 'リスタート');
      restartBtn.addEventListener('click', () => this._restartRace());
      const titleBtn = el('div', 'sg-btn ghost', 'タイトルへ戻る');
      titleBtn.addEventListener('click', () => this._quitToTitle());
      box.appendChild(resumeBtn);
      box.appendChild(document.createElement('br'));
      box.appendChild(restartBtn);
      box.appendChild(titleBtn);
      overlay.appendChild(box);
      layer.appendChild(overlay);
      this.root.appendChild(layer);
      this.layers.race = layer;
      this._pauseOverlay = overlay;
    },

    _resumeRace() {
      this._pauseOverlay.classList.add('hidden');
      this.setState('race');
    },

    _restartRace() {
      this._pauseOverlay.classList.add('hidden');
      const ctx = this._raceCtx;
      this._launchRace({ isTA: ctx.isTA, charIds: ctx.charIds });
    },

    _quitToTitle() {
      this._pauseOverlay.classList.add('hidden');
      if (Game.hud && this._hudActive) { Game.hud.destroy(); this._hudActive = false; }
      if (Game.audio) Game.audio.detachAll(); // エンジン音の止め忘れ防止
      this._raceCtx = null;
      this.setState('title');
    },

    _updateRace(dt, isPaused) {
      const ctx = this._raceCtx;
      if (!ctx) return;

      const input = Game.input.getState();
      if (input.pausePressed) {
        if (isPaused) { this._resumeRace(); }
        else { this._pauseOverlay.classList.remove('hidden'); this.setState('pause'); }
        return;
      }

      if (!isPaused) {
        ctx.race.update(dt);
        ctx.elapsed += dt;
        if (ctx.course.def.animate && ctx.course.group) ctx.course.def.animate(ctx.elapsed, ctx.course.group);
        ctx.cam.update(dt, ctx.playerKart);
        if (Game.fx) Game.fx.update(dt);
        if (Game.audio) Game.audio.update(dt, ctx.playerKart);
      }

      if (Game.hud) Game.hud.update(dt);
      // 描画自体は Game.app.start() のメインループが毎フレーム自動で行う

      if (!isPaused && ctx.ended) {
        ctx.endedT += dt;
        if (ctx.endedT >= SC.resultAutoDelaySec) {
          this.setState('result');
        }
      }
    },

    // =========================================================
    // 5. リザルト
    // =========================================================
    _buildResultLayer() {
      const layer = el('div', 'layer');
      const panel = el('div', 'sg-panel');
      panel.appendChild(el('div', 'sg-heading', 'リザルト'));
      const tableWrap = el('div', null);
      panel.appendChild(tableWrap);
      const taBest = el('div', 'sg-course-best', '');
      taBest.style.textAlign = 'center';
      panel.appendChild(taBest);
      const foot = el('div', null);
      foot.style.textAlign = 'center';
      foot.style.marginTop = '16px';
      const nextBtn = el('div', 'sg-btn', '次のレースへ');
      nextBtn.addEventListener('click', () => this._onResultNext());
      const titleBtn = el('div', 'sg-btn ghost', 'タイトルへ戻る');
      titleBtn.addEventListener('click', () => this._quitToTitle());
      foot.appendChild(nextBtn);
      foot.appendChild(titleBtn);
      panel.appendChild(foot);
      layer.appendChild(panel);
      this.root.appendChild(layer);
      this.layers.result = layer;
      this._resultTableWrap = tableWrap;
      this._resultTaBest = taBest;
      this._resultNextBtn = nextBtn;
    },

    _enterResult() {
      this._ensureBgScene();
      const ctx = this._raceCtx;
      const results = ctx.results || [];
      const table = el('table', 'sg-result-table');
      const isGp = this.mode === 'gp';
      const head = el('tr', null,
        `<th>順位</th><th>キャラ</th><th>タイム</th>${isGp ? '<th>獲得pt</th>' : ''}`);
      table.appendChild(head);

      results.forEach((r) => {
        const isMe = r.kart === ctx.playerKart;
        const pts = isGp ? (SC.gpPointsByRank[r.rank - 1] ?? 0) : null;
        if (isGp && r.kart.charId) this.gpPoints[r.kart.charId] = (this.gpPoints[r.kart.charId] || 0) + (pts || 0);
        const tr = el('tr', isMe ? 'me' : '');
        tr.innerHTML =
          `<td class="sg-rank-cell">${r.rank}位</td>` +
          `<td>${r.kart.charName || (r.kart.charId || '')}${isMe ? ' ★' : ''}</td>` +
          `<td>${SC.fmt(r.finishTime)}</td>` +
          (isGp ? `<td>${pts}</td>` : '');
        table.appendChild(tr);
      });
      this._resultTableWrap.innerHTML = '';
      this._resultTableWrap.appendChild(table);

      this._resultTaBest.textContent = '';
      if (this.mode === 'ta') {
        const me = results.find((r) => r.kart === ctx.playerKart);
        if (me) {
          const { rec, isNew } = this._saveBestTime(this.selectedCourseId, me.finishTime, me.bestLap);
          this._resultTaBest.textContent =
            `ベストラップ: ${SC.fmt(me.bestLap)}　自己ベスト: ${SC.fmt(rec.total)}${isNew ? '  (更新!)' : ''}`;
        }
        this._resultNextBtn.textContent = 'タイムアタックへ戻る';
      } else if (isGp) {
        const isLast = this.gpCourseIdx >= SC.gpCourseOrder.length - 1;
        this._resultNextBtn.textContent = isLast ? '表彰式へ' : '次のレースへ';
      } else {
        this._resultNextBtn.textContent = 'コース選択へ';
      }
    },

    _updateResultTimer() { /* リザルトは静的画面、背景のみ_updateTitleBgで回している */ },

    _onResultNext() {
      if (this.mode === 'ta') {
        this.setState('courseSelect');
        return;
      }
      if (this.mode === 'single') {
        this.setState('courseSelect');
        return;
      }
      // グランプリ
      this.gpCourseIdx++;
      if (this.gpCourseIdx >= SC.gpCourseOrder.length) {
        this.setState('award');
      } else {
        this.selectedCourseId = SC.gpCourseOrder[this.gpCourseIdx];
        this._launchRace({ isTA: false, charIds: this.gpEntries });
      }
    },

    // =========================================================
    // 6. 表彰式(グランプリ完走後)
    // =========================================================
    _buildAwardLayer() {
      const layer = el('div', 'layer');
      layer.appendChild(el('div', 'sg-heading', ''));
      const podiumLabel = el('div', 'sg-award-podium-label', '');
      layer.appendChild(podiumLabel);
      const panel = el('div', 'sg-panel');
      panel.style.top = '14%';
      panel.style.transform = 'translate(-50%, 0)';
      panel.appendChild(el('div', 'sg-heading', '総合成績'));
      const tableWrap = el('div', null);
      panel.appendChild(tableWrap);
      const foot = el('div', null);
      foot.style.textAlign = 'center';
      foot.style.marginTop = '14px';
      const titleBtn = el('div', 'sg-btn', 'タイトルへ戻る');
      titleBtn.addEventListener('click', () => this._quitToTitle());
      foot.appendChild(titleBtn);
      panel.appendChild(foot);
      layer.appendChild(panel);
      this.root.appendChild(layer);
      this.layers.award = layer;
      this._awardTableWrap = tableWrap;
      this._awardPodiumLabel = podiumLabel;
      this._confettiEls = [];
    },

    _enterAward() {
      this._bgCourse = null; // 背景シーンは newScene() で破棄されるため参照を捨てる(戻った時に再構築させる)
      const scene = Game.app.newScene();
      const ranking = Object.keys(this.gpPoints)
        .map((id) => ({ id, pts: this.gpPoints[id] }))
        .sort((a, b) => b.pts - a.pts);

      // 表彰台(丸っこい台座3つ)+上位3キャラを立たせる
      const podiumHeights = [2.6, 1.8, 1.2];
      const podiumX = [0, -4.2, 4.2];
      const podiumOrder = [1, 0, 2]; // 中央=1位、左=2位、右=3位
      const podiumMat = new THREE.MeshLambertMaterial({ color: 0xffd6e8 });
      for (let slot = 0; slot < 3 && slot < ranking.length; slot++) {
        const rankIdx = podiumOrder[slot];
        const h = podiumHeights[rankIdx];
        const base = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.4, h, 20), podiumMat);
        base.position.set(podiumX[slot], h / 2, 0);
        scene.add(base);
        const person = ranking[rankIdx];
        if (person) {
          const charGroup = Game.characters.build(person.id);
          charGroup.position.set(podiumX[slot], h, 0);
          scene.add(charGroup);
        }
      }

      this._awardScene = scene;
      this._awardElapsed = 0;
      this._awardCamAngle = 0;

      const table = el('table', 'sg-result-table');
      table.appendChild(el('tr', null, '<th>総合順位</th><th>キャラ</th><th>合計pt</th>'));
      ranking.forEach((r, i) => {
        const cdef = Game.characters.list.find((c) => c.id === r.id);
        const isMe = r.id === this.selectedCharId;
        const tr = el('tr', isMe ? 'me' : '');
        tr.innerHTML = `<td class="sg-rank-cell">${i + 1}位</td><td>${cdef ? cdef.name : r.id}${isMe ? ' ★' : ''}</td><td>${r.pts}</td>`;
        table.appendChild(tr);
      });
      this._awardTableWrap.innerHTML = '';
      this._awardTableWrap.appendChild(table);

      const winner = Game.characters.list.find((c) => c.id === (ranking[0] && ranking[0].id));
      this._awardPodiumLabel.textContent = winner ? `優勝: ${winner.name}` : '';

      // 紙吹雪風CSS(既存要素を掃除してから生成)
      for (const c of this._confettiEls) c.remove();
      this._confettiEls = [];
      const colors = ['#ff8fb0', '#ffd166', '#7fe3c4', '#bfe8f7', '#ffb347'];
      for (let i = 0; i < SC.confettiCount; i++) {
        const c = el('div', 'sg-confetti');
        c.style.left = `${Math.random() * 100}%`;
        c.style.background = colors[i % colors.length];
        c.style.animationDuration = `${2.4 + Math.random() * 2.4}s`;
        c.style.animationDelay = `${Math.random() * 2}s`;
        c.style.borderRadius = Math.random() < 0.5 ? '50%' : '2px';
        this.layers.award.appendChild(c);
        this._confettiEls.push(c);
      }
    },

    _updateAward(dt) {
      this._awardElapsed += dt;
      this._awardCamAngle += dt * SC.awardCamSpeed;
      const cam = Game.app.camera;
      cam.position.set(
        Math.sin(this._awardCamAngle) * SC.awardCamRadius,
        SC.awardCamHeight,
        Math.cos(this._awardCamAngle) * SC.awardCamRadius);
      cam.lookAt(0, 2, 0);
      // 描画自体は Game.app.start() のメインループが毎フレーム自動で行う
    },
  };
})();
