// 画面フロー統括(Game.screens)。タイトル→キャラ選択→(コース選択)→レース→リザルト→(表彰式)。
// メインループはここが所有: Game.app.start((dt)=>this._update(dt)) を一度だけ呼ぶ。
// 状態機械: title / charSelect / courseSelect / race / pause / result / award
(function () {
  // ---- ローカル定数(マジックナンバー集約) ----
  const SC = {
    rootId: 'screens',
    resultAutoDelaySec: 2,          // onRaceEnd から自動でリザルト画面を出すまでの秒数
    gpPointsByRank: [15, 12, 10, 8, 6, 4, 2, 1],
    // 全コース一覧(コース選択画面の表示順=難易度順)。GPはこの中から3つ選ぶ
    courseList: ['cookieTown', 'auroraFrost', 'chocoCanyon', 'skyCastle', 'solarForge', 'voidSpiral', 'singularity'],
    gpRaceCount: 3,
    bgCamRadius: 46,
    bgCamHeight: 22,
    bgCamSpeed: 0.05,               // rad/s
    bgCamLookHeight: 2,
    portraitSize: 108,
    statBarMax: 5,
    taStorageKeyPrefix: 'sugariaGP_ta_',
    courseDifficulty: { cookieTown: 1, auroraFrost: 2, chocoCanyon: 2, skyCastle: 3, solarForge: 3, voidSpiral: 4, singularity: 5 },
    courseStarMax: 5,
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
    background: linear-gradient(180deg, #35427a 0%, #222c58 55%, #171f42 100%);
    border: 4px solid rgba(150,200,255,0.55); border-radius: 999px;
    color: #eaf4ff; font-weight: 900; font-size: 22px;
    padding: 14px 40px; margin: 8px;
    box-shadow: 0 6px 0 #0c1230, 0 10px 18px rgba(0,10,40,0.55), inset 0 1px 0 rgba(255,255,255,0.22);
    transition: transform 0.12s ease, box-shadow 0.12s ease;
    text-align: center;
    text-shadow: 0 1px 3px rgba(0,10,40,0.6);
  }
  .sg-btn:hover { transform: translateY(-2px); box-shadow: 0 8px 0 #0c1230, 0 12px 24px rgba(40,120,255,0.35), inset 0 1px 0 rgba(255,255,255,0.22); }
  .sg-btn.selected {
    background: linear-gradient(180deg, #fff3c4 0%, #ffd94a 55%, #ff9a3c 100%);
    color: #4a2c00; text-shadow: none;
    box-shadow: 0 6px 0 #8a5a10, 0 10px 26px rgba(255,190,60,0.5), inset 0 1px 0 rgba(255,255,255,0.6);
    transform: translateY(-3px) scale(1.04);
    border-color: rgba(255,240,200,0.9);
  }
  .sg-btn.small { font-size: 16px; padding: 10px 26px; }
  .sg-btn.ghost {
    background: rgba(16,22,48,0.72); color: #9fb4e8;
    border-color: rgba(140,165,230,0.35);
    box-shadow: 0 4px 0 #0a0f28, 0 6px 12px rgba(0,10,40,0.4);
  }

  .sg-title-logo {
    text-align: center; margin-top: 6vh;
    font-size: 88px; font-weight: 900; letter-spacing: 2px;
    /* シャインスイープ: グラデを横に3倍で敷き、background-positionを流す(clip:textと両立) */
    background: linear-gradient(115deg,
      #fff9d0 0%, #ffe27a 16%, #7ef0d8 34%, #3a9bff 48%,
      #ffffff 52%, #3a9bff 56%,
      #7ef0d8 70%, #ffe27a 86%, #fff9d0 100%);
    background-size: 300% 100%;
    -webkit-background-clip: text; background-clip: text; color: transparent;
    filter: drop-shadow(0 5px 0 #14205a) drop-shadow(0 0 26px rgba(80,170,255,0.55)) drop-shadow(0 14px 22px rgba(0,10,40,0.6));
    animation: sg-logo-sheen 5.5s ease-in-out infinite;
  }
  @keyframes sg-logo-sheen {
    0%, 62% { background-position: 0% 0; }
    88%, 100% { background-position: 100% 0; }
  }
  .sg-title-sub {
    text-align: center; margin-top: 4px; font-size: 22px; font-weight: 700;
    color: #cfe2ff; text-shadow: 0 2px 0 #14205a, 0 0 14px rgba(90,160,255,0.5);
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
    background: rgba(10,15,36,0.9); border-radius: 34px;
    border: 6px solid rgba(90,130,230,0.32);
    box-shadow: 0 14px 44px rgba(0,0,0,0.65), inset 0 1px 0 rgba(150,190,255,0.18), 0 0 0 1px rgba(126,240,216,0.12);
    padding: 30px 34px; max-width: 94vw; max-height: 92vh; overflow: auto;
  }
  .sg-heading {
    text-align: center; font-size: 30px; font-weight: 900; color: #ffe27a; margin-bottom: 18px;
    text-shadow: 0 2px 0 #14205a, 0 0 16px rgba(255,210,90,0.35);
  }

  .sg-char-grid { display: grid; grid-template-columns: repeat(3, 176px); gap: 16px; }
  .sg-char-card {
    background: linear-gradient(180deg, rgba(34,44,88,0.95), rgba(16,22,48,0.95));
    border-radius: 20px; border: 4px solid #2c3a6e;
    padding: 10px; text-align: center; cursor: pointer; transition: transform 0.12s, border-color 0.12s;
  }
  .sg-char-card:hover { transform: translateY(-3px); }
  .sg-char-card.selected { border-color: #ffd94a; box-shadow: 0 0 0 4px rgba(255,217,74,0.3), 0 0 22px rgba(255,190,60,0.35); transform: translateY(-4px) scale(1.03); }
  .sg-char-card canvas { border-radius: 14px; background: #0e1430; }
  .sg-char-name { font-weight: 900; color: #eaf4ff; font-size: 15px; margin: 6px 0 4px; }
  .sg-char-motif { font-size: 11px; color: #8fa0cc; margin-bottom: 6px; }
  .sg-stat-row { display: flex; align-items: center; gap: 4px; font-size: 10px; color: #9fb4e8; margin: 2px 10px; }
  .sg-stat-label { width: 18px; text-align: right; font-weight: 700; }
  .sg-stat-bar { flex: 1; height: 7px; background: #141c40; border-radius: 5px; overflow: hidden; }
  .sg-stat-fill { height: 100%; border-radius: 5px; background: linear-gradient(90deg,#7ef0d8,#3a9bff); }

  .sg-course-grid { display: flex; gap: 16px; flex-wrap: wrap; justify-content: center; max-width: 1240px; }
  .sg-course-card {
    width: 200px; background: linear-gradient(180deg, rgba(34,44,88,0.95), rgba(16,22,48,0.95));
    border-radius: 22px;
    border: 4px solid #2c3a6e; padding: 14px; text-align: center; cursor: pointer;
    transition: transform 0.12s, border-color 0.12s;
    position: relative;
  }
  .sg-course-pick {
    position: absolute; top: -12px; right: -12px; width: 36px; height: 36px;
    border-radius: 50%; background: linear-gradient(180deg,#ffe38a,#ffcf4d);
    border: 3px solid #fff8e0; color: #6a4200; font-weight: 900; font-size: 19px;
    display: flex; align-items: center; justify-content: center;
    box-shadow: 0 3px 10px rgba(255,190,60,0.55); z-index: 2;
  }
  .sg-course-hint { text-align: center; color: #9fb4e8; font-size: 14px; font-weight: 700; margin: -6px 0 12px; min-height: 18px; }
  .sg-course-card:hover { transform: translateY(-3px); }
  .sg-course-card.selected { border-color: #ffd94a; box-shadow: 0 0 0 4px rgba(255,217,74,0.3), 0 0 22px rgba(255,190,60,0.35); transform: translateY(-4px) scale(1.03); }
  .sg-course-thumb {
    width: 100%; height: 96px; border-radius: 14px; margin-bottom: 10px;
    background-size: cover; background-position: center;
    box-shadow: inset 0 0 0 1px rgba(255,255,255,0.18), inset 0 -18px 24px rgba(0,0,0,0.25);
  }
  .sg-course-name { font-weight: 900; color: #eaf4ff; font-size: 16px; margin-bottom: 4px; }
  .sg-course-stars { color: #ffd94a; font-size: 18px; letter-spacing: 2px; text-shadow: 0 0 8px rgba(255,200,60,0.45); }
  .sg-course-best { margin-top: 6px; font-size: 12px; color: #8fa0cc; }

  .sg-pause-overlay {
    position: absolute; inset: 0; background: rgba(3,6,18,0.6);
    display: flex; align-items: center; justify-content: center;
  }
  .sg-pause-box {
    background: rgba(10,15,36,0.94); border-radius: 30px; border: 6px solid rgba(90,130,230,0.32);
    padding: 34px 50px; text-align: center;
    box-shadow: 0 14px 44px rgba(0,0,0,0.7), inset 0 1px 0 rgba(150,190,255,0.18);
  }

  .sg-result-table { border-collapse: collapse; margin: 0 auto 18px; }
  .sg-result-table th, .sg-result-table td {
    padding: 7px 16px; font-size: 15px; color: #cfe2ff; text-align: left;
    border-bottom: 2px dashed rgba(120,150,230,0.28);
  }
  .sg-result-table th { color: #ffe27a; font-size: 13px; }
  .sg-result-table tr.me td { color: #7ef0d8; font-weight: 900; text-shadow: 0 0 10px rgba(126,240,216,0.4); }
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
    text-align: center; color: #fff; text-shadow: 0 2px 0 #14205a, 0 0 18px rgba(255,210,90,0.5), 0 4px 10px rgba(0,0,0,0.45);
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
      this._buildDiffSelectLayer();
      this._buildCharSelectLayer();
      this._buildCourseSelectLayer();
      this._buildRaceLayer();
      this._buildResultLayer();
      this._buildAwardLayer();

      // CPUの強さ(前回選択を記憶)
      this.difficulty = (() => {
        try { return localStorage.getItem('sugariaGP_diff') || 'normal'; } catch (e) { return 'normal'; }
      })();
      Game.difficulty = this.difficulty;

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
      if (next === 'diffSelect') this._enterDiffSelect();
      if (next === 'charSelect') this._enterCharSelect();
      if (next === 'courseSelect') this._enterCourseSelect();
      if (next === 'result') this._enterResult();
      if (next === 'award') this._enterAward();

      // タッチ操作ボタンはレース中のみ表示
      if (Game.touch) Game.touch.onState(next);

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
        case 'diffSelect': this._updateTitleBg(dt); this._navDiffSelect(); break;
        case 'charSelect': this._updateCharShowcase(dt); this._navCharSelect(); break;
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
      else if (this.mode === 'gp' && Game.input.justPressed('KeyX', 'Backspace')) {
        // 3つ選び終えた後でもキーボードでやり直せる「1つ取り消し」
        this._gpPicked.pop();
        this._refreshCourseGrid();
      }
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
      layer.appendChild(el('div', 'sg-title-logo', 'スター<br>カート'));
      layer.appendChild(el('div', 'sg-title-sub', 'STAR KART GRAND PRIX'));

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
        this.gpCourses = null; // 出走コースはコース選択画面で3つ選ぶ
        this.selectedCourseId = SC.courseList[0];
      }
      // タイムアタックはCPUがいないので難易度選択を飛ばす
      this.setState(it.id === 'ta' ? 'charSelect' : 'diffSelect');
    },

    // =========================================================
    // 1.5 CPUの強さ選択
    // =========================================================
    _buildDiffSelectLayer() {
      const layer = el('div', 'layer');
      const panel = el('div', 'sg-panel');
      panel.appendChild(el('div', 'sg-heading', 'CPUの強さをえらぼう'));
      const menu = el('div', 'sg-menu');
      const items = [
        { id: 'easy', label: 'やさしい', desc: 'のんびり楽しみたい人に。CPUはひかえめ' },
        { id: 'normal', label: 'ふつう', desc: 'ちょうどいい接戦が楽しめる' },
        { id: 'hard', label: 'むずかしい', desc: 'CPUが本気を出す。腕に自信がある人向け' },
      ];
      this._diffItems = items;
      this._diffCursor = 1;
      items.forEach((it, i) => {
        const b = el('div', 'sg-btn',
          `${it.label}<br><span style="font-size:12px;font-weight:600;opacity:.8">${it.desc}</span>`);
        b.addEventListener('click', () => { this._diffCursor = i; this._confirmDiffSelect(); });
        b.addEventListener('mouseenter', () => { this._diffCursor = i; this._refreshDiffMenu(); });
        menu.appendChild(b);
      });
      panel.appendChild(menu);
      const foot = el('div', null);
      foot.style.textAlign = 'center';
      foot.style.marginTop = '14px';
      const backBtn = el('div', 'sg-btn ghost small', 'タイトルへ戻る');
      backBtn.addEventListener('click', () => this.setState('title'));
      foot.appendChild(backBtn);
      panel.appendChild(foot);
      layer.appendChild(panel);
      this.root.appendChild(layer);
      this.layers.diffSelect = layer;
      this._diffMenuEl = menu;
    },

    _refreshDiffMenu() {
      const btns = this._diffMenuEl.children;
      for (let i = 0; i < btns.length; i++) btns[i].classList.toggle('selected', i === this._diffCursor);
    },

    _enterDiffSelect() {
      this._ensureBgScene();
      const idx = this._diffItems.findIndex((d) => d.id === this.difficulty);
      this._diffCursor = idx >= 0 ? idx : 1;
      this._refreshDiffMenu();
    },

    _navDiffSelect() {
      const n = this._diffItems.length;
      if (Game.input.justPressed('ArrowUp', 'KeyW')) { this._diffCursor = (this._diffCursor - 1 + n) % n; this._refreshDiffMenu(); }
      else if (Game.input.justPressed('ArrowDown', 'KeyS')) { this._diffCursor = (this._diffCursor + 1) % n; this._refreshDiffMenu(); }
      else if (this._confirmPressed()) this._confirmDiffSelect();
    },

    _confirmDiffSelect() {
      this.difficulty = this._diffItems[this._diffCursor].id;
      Game.difficulty = this.difficulty;
      try { localStorage.setItem('sugariaGP_diff', this.difficulty); } catch (e) { /* no-op */ }
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

      // 選択カードの角ブラケット+ネームプレートのスタイル
      const style = document.createElement('style');
      style.textContent = `
.sg-char-card { position: relative; }
.sg-char-card.selected {
  outline: 3px solid #ffc531; outline-offset: 2px;
  box-shadow: 0 0 18px rgba(255,197,49,0.45);
}
.sg-char-card.selected::before, .sg-char-card.selected::after {
  content: ''; position: absolute; width: 15px; height: 15px; pointer-events: none;
}
.sg-char-card.selected::before {
  top: -7px; left: -7px;
  border-top: 4px solid #ffc531; border-left: 4px solid #ffc531; border-radius: 4px 0 0 0;
}
.sg-char-card.selected::after {
  bottom: -7px; right: -7px;
  border-bottom: 4px solid #ffc531; border-right: 4px solid #ffc531; border-radius: 0 0 4px 0;
}
#sgNamePlate {
  position: absolute; right: 5%; bottom: 8%; z-index: 5;
  background: linear-gradient(100deg, rgba(24,18,30,0.92), rgba(48,38,58,0.92));
  color: #fff; font-size: 34px; font-weight: 900; font-style: italic;
  padding: 10px 44px; transform: skewX(-12deg);
  border: 2px solid rgba(255,197,49,0.7); border-radius: 6px;
  box-shadow: 0 4px 16px rgba(0,0,0,0.45); letter-spacing: 2px;
  pointer-events: none;
}
#sgNamePlate span { display: inline-block; transform: skewX(12deg); }
`;
      document.head.appendChild(style);

      // ネームプレート(参考構成: 3Dモデルの下に選択中キャラ名)
      const plate = el('div', null);
      plate.id = 'sgNamePlate';
      plate.innerHTML = '<span></span>';
      layer.appendChild(plate);
      this._namePlateEl = plate.querySelector('span');

      const panel = el('div', 'sg-panel');
      // 3Dショーケース(画面右)が見えるよう、カードUIは左に寄せる
      panel.style.left = '28%';
      panel.style.maxWidth = '540px';
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
      this._bgCourse = null; // 3Dショーケースに切り替える(他画面へ戻ったら背景を再構築させる)
      this._buildCharShowcase();
      if (this._charGridEl.children.length === 0) this._populateCharGrid();
      this._refreshCharGrid();
    },

    // ---- キャラ選択の3Dショーケース(選択中キャラを台座で回転表示) ----
    _buildCharShowcase() {
      const scene = Game.app.newScene();
      scene.background = new THREE.Color(0x171225);
      scene.fog = null;
      const floor = new THREE.Mesh(new THREE.PlaneGeometry(50, 50), Game.mats.matte(0x241e33));
      floor.rotation.x = -Math.PI / 2;
      floor.receiveShadow = true;
      scene.add(floor);
      const podium = new THREE.Mesh(
        new THREE.CylinderGeometry(1.6, 1.9, 0.5, 32), Game.mats.metal(0x3a3450));
      podium.position.set(0, 0.25, 0);
      podium.receiveShadow = true;
      scene.add(podium);
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(1.75, 0.05, 8, 40), Game.mats.glow(0xff8fb0, 1.6));
      ring.rotation.x = Math.PI / 2;
      ring.position.set(0, 0.52, 0);
      scene.add(ring);
      // ショーケース用ライティング(リム強め。newScene()がライトを作り直すため後始末不要)
      if (Game.app.rim) { Game.app.rim.intensity = 1.25; Game.app.rim.color.setHex(0x8fd0ff); }
      if (Game.app.hemi) Game.app.hemi.intensity = 0.35;
      if (Game.app.sun) { Game.app.sun.intensity = 0.95; Game.app.updateSun(new THREE.Vector3(0, 0, 0)); }
      const cam = Game.app.camera;
      cam.position.set(-1.35, 1.75, 3.7); // キャラを画面右寄りに見せる(左はカードUI)
      cam.lookAt(0, 1.05, 0);
      this._showcase = { scene, charGroup: null, id: null, spin: 0 };
    },

    _setShowcaseChar(id) {
      const sc = this._showcase;
      if (!sc || sc.id === id) return;
      if (sc.charGroup) sc.scene.remove(sc.charGroup);
      const g = Game.characters.build(id);
      g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
      g.scale.setScalar(1.55);
      g.position.set(0, 0.5, 0);
      if (Game.charRig && Game.charRig.setPose) Game.charRig.setPose(g, 'select');
      sc.scene.add(g);
      sc.charGroup = g;
      sc.id = id;
    },

    _updateCharShowcase(dt) {
      const sc = this._showcase;
      if (!sc) return;
      const cur = Game.characters.list[this._charCursor];
      if (cur) this._setShowcaseChar(cur.id);
      if (sc.charGroup) {
        sc.spin += dt * 0.9;
        sc.charGroup.rotation.y = sc.spin;
        sc.charGroup.position.y = 0.5 + Math.sin(sc.spin * 1.7) * 0.05;
      }
    },

    _populateCharGrid() {
      const list = Game.characters.list;
      this._charGridEl.innerHTML = '';
      list.forEach((c, i) => {
        const card = el('div', 'sg-char-card');
        let cv;
        try {
          cv = this._renderCharThumb(c.id, SC.portraitSize); // 3D実機レンダリング
        } catch (e) {
          cv = document.createElement('canvas');
          cv.width = SC.portraitSize; cv.height = SC.portraitSize;
          Game.characters.drawPortrait(cv.getContext('2d'), c.id, SC.portraitSize);
        }
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
      const cur = Game.characters.list[this._charCursor];
      if (this._namePlateEl && cur) this._namePlateEl.textContent = cur.name;
    },

    // カード用サムネイルを実際の3Dモデルからレンダリングする(2D似顔絵より一段上の完成感)
    _renderCharThumb(id, size) {
      const renderer = Game.app.renderer;
      const scene = new THREE.Scene();
      scene.background = new THREE.Color(0x241e33);
      scene.add(new THREE.HemisphereLight(0xffffff, 0x8a80a0, 0.85));
      const key = new THREE.DirectionalLight(0xfff3dd, 1.0);
      key.position.set(2, 3, 4);
      scene.add(key);
      const rim = new THREE.DirectionalLight(0x8fd0ff, 0.9);
      rim.position.set(-2, 2, -3);
      scene.add(rim);
      const g = Game.characters.build(id);
      if (Game.charRig && Game.charRig.setPose) Game.charRig.setPose(g, 'select');
      g.rotation.y = 0.35;
      scene.add(g);
      // キャラの身長に合わせてフレーミング
      const box = new THREE.Box3().setFromObject(g);
      const h = Math.max(0.6, box.max.y - box.min.y);
      const cy = (box.max.y + box.min.y) / 2;
      const cam = new THREE.PerspectiveCamera(38, 1, 0.1, 30);
      cam.position.set(0.2, cy + h * 0.12, h * 1.95);
      cam.lookAt(0, cy, 0);
      const prev = renderer.getSize(new THREE.Vector2());
      renderer.setSize(size, size, false);
      renderer.render(scene, cam);
      const cv = document.createElement('canvas');
      cv.width = size; cv.height = size;
      cv.getContext('2d').drawImage(renderer.domElement, 0, 0, size, size);
      renderer.setSize(prev.x, prev.y, false);
      scene.traverse((o) => {
        if (o.geometry) o.geometry.dispose();
        if (o.material) {
          const ms = Array.isArray(o.material) ? o.material : [o.material];
          ms.forEach((m) => { if (m.map) m.map.dispose(); m.dispose(); });
        }
      });
      return cv;
    },

    _confirmCharSelect() {
      this.selectedCharId = Game.characters.list[this._charCursor].id;
      // GPもコース選択を経由する(7コースから3つを選ぶ形式)
      this.setState('courseSelect');
    },

    // =========================================================
    // 3. コース選択(シングル/TA=1つ選ぶ、GP=3つ選ぶ)
    // =========================================================
    _buildCourseSelectLayer() {
      const layer = el('div', 'layer');
      const panel = el('div', 'sg-panel');
      const heading = el('div', 'sg-heading', 'コースをえらぼう');
      panel.appendChild(heading);
      const hint = el('div', 'sg-course-hint', '');
      panel.appendChild(hint);
      const grid = el('div', 'sg-course-grid');
      panel.appendChild(grid);
      const foot = el('div', null);
      foot.style.textAlign = 'center';
      foot.style.marginTop = '18px';
      const okBtn = el('div', 'sg-btn', 'このコースでスタート');
      okBtn.addEventListener('click', () => this._onCourseOkButton());
      const backBtn = el('div', 'sg-btn ghost small', 'キャラ選択へ戻る');
      backBtn.addEventListener('click', () => this.setState('charSelect'));
      foot.appendChild(okBtn);
      foot.appendChild(backBtn);
      panel.appendChild(foot);
      layer.appendChild(panel);
      this.root.appendChild(layer);
      this.layers.courseSelect = layer;
      this._courseGridEl = grid;
      this._courseHeading = heading;
      this._courseHint = hint;
      this._courseOkBtn = okBtn;
      this._courseCursor = 0;
      this._courseIds = SC.courseList;
      this._gpPicked = [];
    },

    _enterCourseSelect() {
      this._ensureBgScene();
      this._gpPicked = [];
      if (this.mode === 'gp') {
        this._courseHeading.textContent = 'グランプリ: 3コースをえらぼう';
        this._courseHint.textContent = 'Enter/タップでえらぶ(もう一度でとりけし)・3つえらんだらスタート';
      } else {
        this._courseHeading.textContent = 'コースをえらぼう';
        this._courseHint.textContent = '';
      }
      this._populateCourseGrid();
      this._refreshCourseGrid();
    },

    _courseThumbColor(id) {
      const def = Game.courses[id];
      if (!def || !def.colors) return '#ddd';
      // road は '#rrggbb' 文字列、sky は数値。空→路面のグラデでコースの雰囲気を出す
      const road = typeof def.colors.road === 'string'
        ? def.colors.road
        : `#${def.colors.road.toString(16).padStart(6, '0')}`;
      const sky = `#${(def.colors.sky >>> 0).toString(16).padStart(6, '0')}`;
      return `linear-gradient(180deg, ${sky} 0%, ${sky} 45%, ${road} 46%, ${road} 100%)`;
    },

    // =========================================================
    // コース選択の実3Dサムネイル(各コースを一度だけ空撮レンダリングしてキャッシュ)
    // =========================================================
    _ensureCourseThumb(id, thumbEl) {
      this._thumbCache = this._thumbCache || {};
      if (this._thumbCache[id]) {
        this._applyThumb(thumbEl, this._thumbCache[id]);
        return;
      }
      // 生成は1コースずつ直列に(同時生成でフレームを落とさない)
      this._thumbQueue = (this._thumbQueue || Promise.resolve()).then(() => {
        if (this._thumbCache[id]) { this._applyThumb(thumbEl, this._thumbCache[id]); return; }
        return new Promise((res) => setTimeout(res, 0)).then(() => {
          try {
            const url = this._renderCourseThumb(id);
            if (url) { this._thumbCache[id] = url; this._applyThumb(thumbEl, url); }
          } catch (e) { /* 失敗時はプレースホルダのまま(致命ではない) */ }
        });
      });
    },

    _applyThumb(el2, url) {
      if (!el2 || !el2.isConnected) return;
      el2.style.background = `url(${url})`;
      el2.style.backgroundSize = 'cover';
      el2.style.backgroundPosition = 'center';
    },

    _renderCourseThumb(id) {
      const def = Game.courses[id];
      if (!def) return null;
      if (!this._thumbRenderer) {
        this._thumbRenderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
        this._thumbRenderer.setSize(320, 192, false);
        this._thumbRenderer.outputEncoding = THREE.sRGBEncoding;
        this._thumbRenderer.toneMapping = THREE.ACESFilmicToneMapping;
        this._thumbRenderer.toneMappingExposure = 1.05;
      }
      const scene = new THREE.Scene();
      const course = new Game.Course(def);
      course.build(scene);
      // 空撮距離では走行用の指数フォグが濃すぎて真っ白になる(スターシタデルで実証)。
      // 色味だけ残して密度を大きく下げる
      if (scene.fog && scene.fog.density) {
        scene.fog = new THREE.FogExp2(scene.fog.color.getHex(), scene.fog.density * 0.18);
      }
      // コース定義の照明を再現(レース本編のライティングに寄せる)
      const L = def.lighting || {};
      const hemi = new THREE.HemisphereLight(L.hemiSky ?? 0xbfd9ff, L.hemiGround ?? 0x3a3550, L.hemiIntensity ?? 0.55);
      scene.add(hemi);
      const sun = new THREE.DirectionalLight(L.sunColor ?? 0xffffff, L.sunIntensity ?? 0.9);
      sun.position.set(80, 120, 60);
      scene.add(sun);
      this._thumbRenderer.toneMappingExposure = (L.exposure ?? 1.05);
      // コース全体が収まる斜め空撮カメラ
      let minX = 1e9, maxX = -1e9, minZ = 1e9, maxZ = -1e9;
      for (const p of course.minimap) {
        if (p.x < minX) minX = p.x; if (p.x > maxX) maxX = p.x;
        if (p.z < minZ) minZ = p.z; if (p.z > maxZ) maxZ = p.z;
      }
      const cx = (minX + maxX) / 2, cz = (minZ + maxZ) / 2;
      const span = Math.max(maxX - minX, maxZ - minZ);
      const cam = new THREE.PerspectiveCamera(45, 320 / 192, 1, 2000);
      const dist = span * 0.98 + 60;
      cam.position.set(cx + dist * 0.42, dist * 0.62, cz + dist * 0.52);
      cam.lookAt(cx, 0, cz);
      this._thumbRenderer.render(scene, cam);
      const url = this._thumbRenderer.domElement.toDataURL('image/jpeg', 0.85);
      // 後始末: ジオメトリと(共有でない)マテリアル/テクスチャを破棄
      scene.traverse((o) => {
        if (o.isMesh && !o.isSprite) {
          if (o.geometry) o.geometry.dispose();
          const mats = Array.isArray(o.material) ? o.material : [o.material];
          for (const m of mats) {
            if (!m) continue;
            if (m.map) m.map.dispose();
            m.dispose();
          }
        }
      });
      return url;
    },

    _populateCourseGrid() {
      this._courseGridEl.innerHTML = '';
      this._courseIds.forEach((id, i) => {
        const def = Game.courses[id];
        const card = el('div', 'sg-course-card');
        const pick = el('div', 'sg-course-pick hidden', '');
        card.appendChild(pick);
        const thumb = el('div', 'sg-course-thumb');
        thumb.style.background = this._courseThumbColor(id); // 生成完了までのプレースホルダ
        this._ensureCourseThumb(id, thumb);                  // 実3D空撮に差し替え(初回のみ描画)
        card.appendChild(thumb);
        card.appendChild(el('div', 'sg-course-name', def.displayName || id));
        const d = SC.courseDifficulty[id] || 1;
        const stars = '★'.repeat(d) + '☆'.repeat(SC.courseStarMax - d);
        card.appendChild(el('div', 'sg-course-stars', stars));
        if (this.mode === 'ta') {
          const best = this._loadBestTime(id);
          card.appendChild(el('div', 'sg-course-best', `ベスト: ${best ? SC.fmt(best.total) : '--:--.--'}`));
        }
        card.addEventListener('click', () => {
          this._courseCursor = i;
          if (this.mode === 'gp') this._toggleGpPick(i);
          this._refreshCourseGrid();
        });
        card.addEventListener('dblclick', () => {
          this._courseCursor = i;
          if (this.mode !== 'gp') this._confirmCourseSelect();
        });
        this._courseGridEl.appendChild(card);
      });
    },

    _refreshCourseGrid() {
      const cards = this._courseGridEl.children;
      for (let i = 0; i < cards.length; i++) {
        cards[i].classList.toggle('selected', i === this._courseCursor);
        const pick = cards[i].querySelector('.sg-course-pick');
        if (pick) {
          const order = this._gpPicked.indexOf(this._courseIds[i]);
          pick.classList.toggle('hidden', this.mode !== 'gp' || order < 0);
          if (order >= 0) pick.textContent = String(order + 1);
        }
      }
      if (this.mode === 'gp') {
        const left = SC.gpRaceCount - this._gpPicked.length;
        this._courseOkBtn.textContent = left > 0 ? `あと${left}コース` : 'グランプリ開始!';
        this._courseOkBtn.classList.toggle('ghost', left > 0);
      } else {
        this._courseOkBtn.textContent = 'このコースでスタート';
        this._courseOkBtn.classList.remove('ghost');
      }
    },

    // GP: カーソル位置のコースの選択/取り消しをトグルする
    _toggleGpPick(i) {
      const id = this._courseIds[i];
      const at = this._gpPicked.indexOf(id);
      if (at >= 0) this._gpPicked.splice(at, 1);
      else if (this._gpPicked.length < SC.gpRaceCount) this._gpPicked.push(id);
    },

    // フッターのOKボタン(クリック/タップ)
    _onCourseOkButton() {
      if (this.mode === 'gp') {
        if (this._gpPicked.length === SC.gpRaceCount) this._startGpRun(this._gpPicked.slice());
        return;
      }
      this._confirmCourseSelect();
    },

    _confirmCourseSelect() {
      if (this.mode === 'gp') {
        // 3つ揃っていれば決定=開始、揃うまではトグル
        if (this._gpPicked.length === SC.gpRaceCount) {
          this._startGpRun(this._gpPicked.slice());
        } else {
          this._toggleGpPick(this._courseCursor);
          this._refreshCourseGrid();
        }
        return;
      }
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

    _startGpRun(courseIds) {
      // グランプリ用ロースター(プレイヤー+CPU7)を初回のみ決定し、選んだ3コースを通して使い回す
      this.gpCourses = courseIds && courseIds.length ? courseIds : SC.courseList.slice(0, SC.gpRaceCount);
      const cpu = this._pickRoster(this.selectedCharId, Game.config.race.kartCount - 1);
      this.gpEntries = [this.selectedCharId, ...cpu.map((c) => c.id)];
      this.gpPoints = {};
      for (const id of this.gpEntries) this.gpPoints[id] = 0;
      this.gpCourseIdx = 0;
      this.selectedCourseId = this.gpCourses[0];
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
        const kart = new Game.Kart({
          isPlayer, color: cdef.color, stats: cdef.stats, charId,
          number: Game.characters.list.indexOf(cdef) + 1, // ゼッケン=ロスター番号
        });
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
      race.onCountdownTick = (n) => {
        if (prevTick) prevTick(n);
        if (Game.audio) Game.audio.sfx('countBeep');
        if (course.setStartSignal) course.setStartSignal(n);
      };
      const prevGo = race.onGo;
      race.onGo = () => {
        if (prevGo) prevGo();
        if (Game.audio) Game.audio.sfx('countGo');
        if (course.setStartSignal) course.setStartSignal(0);
      };

      // プレイヤーの被弾・衝突・着地でカメラを揺らす(臨場感)
      for (const [ev, mag] of [['onSpin', 0.5], ['onWallHit', 0.3], ['onBump', 0.2], ['onJumpPad', 0.15]]) {
        const prevCb = playerKart[ev];
        playerKart[ev] = (...a) => { if (prevCb) prevCb(...a); cam.addShake(mag); };
      }
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
      // 重要: レースレイヤーは全画面だが中身はポーズオーバーレイだけなので、
      // レイヤー自体は入力を素通しにする(inline styleは .layer.active のCSSより優先される)。
      // これをしないと、タッチ操作ボタン(#touchRoot)への入力をこのレイヤーが全て吸い込み、
      // iPad/スマホで「ボタンが見えるのに反応しない」状態になる
      layer.style.pointerEvents = 'none';
      const overlay = el('div', 'sg-pause-overlay hidden');
      overlay.style.pointerEvents = 'auto'; // ポーズメニューだけは入力を受け付ける
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
        if (ctx.course.tick) ctx.course.tick(ctx.elapsed); // パッド流動などコース共通の軽量アニメ
        if (ctx.course.def.animate && ctx.course.group) ctx.course.def.animate(ctx.elapsed, ctx.course.group);
        // カメラ: カウントダウン中はスタート演出、ゴール後はオービット、通常は追従
        if (ctx.race.phase === 'countdown') {
          const total = Game.config.race.countdownSec || 3;
          ctx.cam.startSweep(ctx.playerKart, 1 - Math.max(0, ctx.race.countdownT) / total);
        } else if (ctx.ended && ctx.playerKart.finished) {
          ctx.cam.victoryOrbit(ctx.playerKart, dt);
        } else {
          ctx.cam.update(dt, ctx.playerKart);
        }
        Game.app.updateSun(ctx.playerKart.pos); // 影のカバー範囲をプレイヤーに追従
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
        const isLast = this.gpCourseIdx >= (this.gpCourses ? this.gpCourses.length : SC.gpRaceCount) - 1;
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
      // グランプリ(選んだ3コースを順に走る)
      const courses = this.gpCourses || SC.courseList.slice(0, SC.gpRaceCount);
      this.gpCourseIdx++;
      if (this.gpCourseIdx >= courses.length) {
        this.setState('award');
      } else {
        this.selectedCourseId = courses[this.gpCourseIdx];
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
