// Phase 2 エントリポイント: 本番コースで8台レース(プレイヤー+CPU7)
// ?course=cookieTown|chocoCanyon|skyCastle で走るコースを選択(デフォルトcookieTown)
(function () {
  // 暫定キャラロスター(Phase 4で characters.js に移管)
  const ROSTER = [
    { name: 'マカロン・ププル', color: 0xff9ec7, stats: { speed: 2, accel: 5, handling: 4, weight: 2 } },
    { name: 'ドーナ・リング', color: 0xd98e4a, stats: { speed: 2, accel: 4, handling: 5, weight: 1 } },
    { name: 'タプリン', color: 0xffd23e, stats: { speed: 3, accel: 4, handling: 4, weight: 2 } },
    { name: 'ソフクリン', color: 0xbfe8f7, stats: { speed: 3, accel: 3, handling: 4, weight: 2 } },
    { name: 'ソーダ・シュワリ', color: 0x7fe3c4, stats: { speed: 3, accel: 3, handling: 3, weight: 3 } },
    { name: 'ワッフル・グリッド', color: 0xe8b23e, stats: { speed: 3, accel: 2, handling: 3, weight: 4 } },
    { name: 'ショコラ・ノワール', color: 0x5a3825, stats: { speed: 4, accel: 2, handling: 2, weight: 4 } },
    { name: 'バウム・ロール', color: 0xc9995f, stats: { speed: 4, accel: 2, handling: 2, weight: 5 } },
    { name: 'ボンボン・キャノン', color: 0xff5a5a, stats: { speed: 5, accel: 1, handling: 1, weight: 5 } },
  ];

  const params = new URLSearchParams(location.search);
  const courseId = params.get('course') || 'cookieTown';
  const def = Game.courses[courseId] || Game.courses.cookieTown;

  Game.app.init(document.getElementById('app'));

  let race = null, course = null, cam = null, playerKart = null, elapsed = 0;
  const centerMsg = document.getElementById('centerMsg');
  const dbg = document.getElementById('debug');
  let msgTimer = 0;

  const showMsg = (text, sec = 1.2) => { centerMsg.textContent = text; msgTimer = sec; };

  function setupRace() {
    const scene = Game.app.newScene();
    course = new Game.Course(def);
    course.build(scene);

    // プレイヤー=先頭キャラ、CPU=残りから7体
    const entries = [];
    const player = new Game.Kart({ isPlayer: true, color: ROSTER[0].color, stats: ROSTER[0].stats });
    player.charName = ROSTER[0].name;
    scene.add(player.buildMesh());
    entries.push({ kart: player, controller: new Game.PlayerController() });
    for (let i = 1; i < Game.config.race.kartCount; i++) {
      const c = ROSTER[i % ROSTER.length];
      const kart = new Game.Kart({ color: c.color, stats: c.stats });
      kart.charName = c.name;
      scene.add(kart.buildMesh());
      entries.push({ kart, controller: new Game.AIController(kart) });
    }
    playerKart = player;

    race = new Game.RaceManager({ course, entries });
    race.onCountdownTick = (n) => showMsg(String(n), 1.0);
    race.onGo = () => showMsg('GO!', 0.8);
    race.onLapChange = (kart, lap) => {
      if (kart === playerKart) showMsg(lap === race.laps ? 'FINAL LAP!' : `LAP ${lap}/${race.laps}`, 1.4);
    };
    race.onKartFinish = (kart, time, rank) => {
      if (kart === playerKart) showMsg(`FINISH!  ${rank}位`, 3);
    };
    race.onRaceEnd = (results) => {
      const lines = results.map((r) =>
        `${r.rank}位 ${r.kart.charName}${r.kart === playerKart ? ' ★' : ''} ${r.finishTime ? r.finishTime.toFixed(2) + 's' : '--'}`);
      centerMsg.innerHTML = `<div style="font-size:28px;line-height:1.6">${lines.join('<br>')}</div>`;
      msgTimer = 9999;
    };
    race.start();

    cam = new Game.CameraCtrl(Game.app.camera);
    cam.snapTo(playerKart);
    Game.debug = { race, course, kart: playerKart };
  }

  setupRace();

  const fmt = (t) => t == null ? '--:--' : `${Math.floor(t / 60)}:${(t % 60).toFixed(2).padStart(5, '0')}`;
  let fpsAcc = 0, fpsN = 0, fpsShown = 0;

  Game.app.start((dt) => {
    if (Game.input.justPressed('KeyR')) { centerMsg.textContent = ''; setupRace(); }

    race.update(dt);
    cam.update(dt, playerKart);
    elapsed += dt;
    if (def.animate && course.group) def.animate(elapsed, course.group);

    if (msgTimer > 0) {
      msgTimer -= dt;
      if (msgTimer <= 0) centerMsg.textContent = '';
    }

    fpsAcc += dt; fpsN++;
    if (fpsAcc >= 0.5) { fpsShown = Math.round(fpsN / fpsAcc); fpsAcc = 0; fpsN = 0; }
    const standings = race.getStandings()
      .map((s) => `${s.rank}. ${s.kart.charName}${s.kart === playerKart ? ' ★' : ''} Lap${s.lap}${s.finished ? ' ✓' : ''}`)
      .join('\n');
    dbg.textContent =
      `${def.displayName}  FPS ${fpsShown}  time ${fmt(race.raceTime)}\n` +
      `you: ${playerKart.rank}位 Lap${playerKart.lap}/${race.laps} speed ${playerKart.speed.toFixed(0)}\n` +
      standings +
      `\n[↑/W]アクセル [←→/AD]ステア [Space]ドリフト [R]リスタート\n?course=cookieTown / chocoCanyon / skyCastle`;
  });
})();
