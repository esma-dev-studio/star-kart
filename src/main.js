// Phase 1 エントリポイント: テストコースで走りの手触りを確認する
(function () {
  const testCourseDef = {
    name: 'テストサーキット',
    controlPoints: [
      { x: -100, y: 0, z: -80, w: 9 },
      { x: 0, y: 0, z: -85, w: 9 },
      { x: 80, y: 0, z: -80, w: 8 },
      { x: 130, y: 0, z: -40, w: 7 },
      { x: 110, y: 2, z: 10, w: 7 },
      { x: 140, y: 4, z: 60, w: 7 },
      { x: 100, y: 8, z: 100, w: 8 },
      { x: 30, y: 8, z: 110, w: 8 },
      { x: -20, y: 6, z: 80, w: 7 },
      { x: -60, y: 4, z: 100, w: 6 },
      { x: -110, y: 4, z: 70, w: 6 },
      { x: -90, y: 2, z: 20, w: 7 },
      { x: -130, y: 0, z: -20, w: 8 },
      { x: -135, y: 0, z: -60, w: 8 },
    ],
    offroadWidth: 6,
    colors: {
      sky: 0xbfe9ff, ground: 0xa8e6a0,
      road: '#c98d5a', edge: '#fff3e0', offroad: 0x93d178,
    },
    boostPads: [
      { t0: 0.955, t1: 0.975 },           // スタート直線
      { t0: 0.80, t1: 0.815, l0: -0.5, l1: 0.5 }, // ヘアピン後
    ],
    jumpPads: [{ t0: 0.485, t1: 0.495 }],
    gaps: [{ t0: 0.497, t1: 0.505 }],     // ジャンプで飛び越える切れ目
  };

  Game.app.init(document.getElementById('app'));
  const scene = Game.app.newScene();
  const course = new Game.Course(testCourseDef);
  course.build(scene);

  const kart = new Game.Kart({ isPlayer: true, color: 0xff8fb0 });
  scene.add(kart.buildMesh());
  const start = course.startPositions(8)[0];
  kart.resetAt(start.pos, start.heading, start.hint);

  const cam = new Game.CameraCtrl(Game.app.camera);
  cam.snapTo(kart);

  Game.debug = { kart, course };

  const dbg = document.getElementById('debug');
  let fpsAcc = 0, fpsN = 0, fpsShown = 0;

  Game.app.start((dt) => {
    const input = Game.input.getState();
    if (Game.input.justPressed('KeyR')) {
      kart.resetAt(start.pos, start.heading, start.hint);
    }
    kart.update(dt, input, course);
    cam.update(dt, kart);

    fpsAcc += dt; fpsN++;
    if (fpsAcc >= 0.5) { fpsShown = Math.round(fpsN / fpsAcc); fpsAcc = 0; fpsN = 0; }
    const q = kart.lastQuery;
    dbg.textContent =
      `FPS ${fpsShown}\n` +
      `speed ${kart.speed.toFixed(1)} / boost ${kart.boostT.toFixed(2)}\n` +
      `drift ${kart.drift.state} dir=${kart.drift.dir} charge=${kart.drift.charge.toFixed(2)} lv=${kart.drift.level}\n` +
      `surface ${q ? q.surface : '-'} lateral ${q ? q.lateral.toFixed(1) : '-'} / ±${q ? q.halfWidth.toFixed(1) : '-'}\n` +
      `progress ${q ? (q.progress * 100).toFixed(1) : '-'}% grounded=${kart.grounded}\n` +
      `[↑/W]アクセル [←→/AD]ステア [Space]ドリフト [R]リセット`;
  });
})();
