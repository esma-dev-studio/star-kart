// コース①: クッキータウン・ロード(初級)
// テーマ: 焼きたてクッキーとビスケットの街並み。のどか、あたたかい茶系+パステル。
// レイアウト: 緩いS字の商店街 → 大きな右コーナー → クッキー橋の緩い上り → 広い直線 → ゴール前の左複合コーナー。
// 初心者向けの安心設計: fallZones/gapsは使用しない。
//
// controlPoints概算全長: 約760ユニット(隣接点距離合計) × 1.05 ≒ 798ユニット。
// (スプラインは閉ループでオーバーシュートするため実測はこれよりわずかに長くなる)
(function () {
  Game.courses = Game.courses || {};

  // ---- ローカル定数(マジックナンバー集約) ----
  const CT = {
    // 装飾配置(路面+路肩の外側オフセット、路肩は概ね半幅+offroadWidthまで)
    decorOffsetMin: 3,        // 路肩外縁からの最小オフセット
    decorOffsetJitter: 10,    // オフセットのばらつき幅
    houseCount: 14,           // クッキーの家の数
    archCount: 5,             // ビスケットアーチの数(左右ペア)
    lampCount: 10,            // キャンディ街灯の数
    sugarHillCount: 8,        // 粉砂糖の丘の数
    houseBodySize: [3.2, 3.6, 3.2],
    lampPoleHeight: 4.2,
    lampPoleRadius: 0.22,
    candyRadius: 0.55,
    sugarHillRadiusMin: 2.2,
    sugarHillRadiusMax: 4.0,
    archSpan: 12,             // アーチの左右支柱間隔(路面をまたぐ意匠、路肩外側に立てるので実際は装飾のみ)
    archHeight: 6.5,
    archThickness: 1.1,
    lampSpinSpeed: 0.6,       // 飴玉のゆっくり回転(rad/s)
    lampBobSpeed: 1.1,
    lampBobAmp: 0.12,

    // ---- Phase6: 密度・照明強化(観客席/旗/ランドマーク/発光) ----
    standCount: 3,             // 観客スタンドの数(スタートストレート+主要コーナー)
    standRows: 3,               // スタンド段数
    standSeatsPerRow: 12,       // 1段あたりの観客数(InstancedMesh)
    standWidth: 13,
    standRowDepth: 1.35,
    standRowHeight: 1.05,
    standSwaySpeed: 1.6,        // 歓声で揺れる速さ
    standSwayAmp: 0.05,
    flagChainSpots: [0.10, 0.335, 0.605],  // 道路横断フラッグチェーン3箇所
    flagChainFlags: 9,
    banners: [
      { t: 0.045, side: 1, text: 'SUGARIA GP' },
      { t: 0.30, side: -1, text: 'TURBO WAFFLE' },
      { t: 0.62, side: 1, text: 'Soda Splash Racing' },
      { t: 0.90, side: -1, text: 'COOKIE TOWN' },
    ],
    noboriSpots: [0.20, 0.40, 0.56, 0.78, 0.93],
    millSpot: 0.145,             // 風車クッキーミル(ランドマーク)の進行度
    millSailSpeed: 0.9,          // 風車の回転速度(rad/s)
    balloonCount: 3,             // 浮かぶ熱気球の数
    balloonDriftSpeed: 0.05,     // ゆっくり移動する速度(rad/s、コース中心を巡る)
    balloonBobAmp: 0.6,
    balloonBobSpeed: 0.5,
    glowLampCount: 10,           // 発光化する街灯(既存キャンディ街灯を活用)
  };

  // t=0付近(スタート)は cp0->cp1 がほぼ直線・平坦・w=10 で確保している。
  const controlPoints = [
    { x: 0,    y: 0,   z: 0,    w: 10 },   // 0 スタート直線 始点
    { x: 0,    y: 0,   z: 40,   w: 10 },   // 1 スタート直線 終点(平坦・幅広)
    { x: -6,   y: 0,   z: 78,   w: 9.5 },  // 2 緩いS字(商店街) 左
    { x: -22,  y: 0,   z: 108,  w: 9 },    // 3 S字継続
    { x: -18,  y: 0,   z: 148,  w: 9 },    // 4 S字戻り(右)
    { x: 6,    y: 0,   z: 178,  w: 9 },    // 5 大きな右コーナー進入
    { x: 48,   y: 0,   z: 192,  w: 9 },    // 6 右コーナー頂点
    { x: 90,   y: 1,   z: 182,  w: 9 },    // 7 コーナー出口、緩やかに上り始め
    { x: 124,  y: 2,   z: 158,  w: 9 },    // 8 クッキー橋 上り
    { x: 146,  y: 3.5, z: 124,  w: 8.5 },  // 9 クッキー橋 上り継続
    { x: 150,  y: 5,   z: 84,   w: 8.5 },  // 10 クッキー橋 中間(ジャンプ台の直前)
    { x: 140,  y: 6,   z: 48,   w: 8.5 },  // 11 クッキー橋 最高点付近(小ジャンプ台の着地側)
    { x: 150,  y: 5.5, z: 10,   w: 9 },    // 12 橋を降り始める
    { x: 150,  y: 4,   z: -30,  w: 9.5 },  // 13 広い直線 始点
    { x: 120,  y: 2,   z: -64,  w: 10 },   // 14 広い直線 継続
    { x: 70,   y: 0.5, z: -78,  w: 10 },   // 15 ゴール前 左複合コーナー入口
    { x: 30,   y: 0,   z: -70,  w: 10 },   // 16 左複合コーナー継続
    { x: -10,  y: 0,   z: -50,  w: 10 },   // 17 スタートへ戻る緩いカーブ
    { x: -20,  y: 0,   z: -20,  w: 10 },   // 18 最終アプローチ(スタート直線へ滑らかに接続)
  ];

  Game.courses.cookieTown = {
    id: 'cookieTown',
    displayName: 'クッキータウン・ロード',
    bgmMood: 'ほのぼの弾む街角ポップス調',
    name: 'クッキータウン・ロード',
    controlPoints,
    offroadWidth: 7,
    fogDensity: 0.0032,
    // リアル寄りの屋外レース感: 青空+緑の草原+アスファルト。
    // クッキーの家や街灯は「郊外の道沿いのお菓子の街」として残る
    colors: {
      sky: 0x7fc0ee,
      fog: 0xcfe6f5,
      ground: 0x58a53f,
      road: '#55555e',
      edge: '#fff3df',
      curb: '#ff6f91',
      centerLine: '#eec53a',
      offroad: 0x69b84e,
    },
    // ブーストパッド2箇所: S字明け(コーナー進入前の加速)と広い直線
    boostPads: [
      { t0: 0.235, t1: 0.250, l0: -0.5, l1: 0.5 },
      { t0: 0.700, t1: 0.716, l0: -0.55, l1: 0.55 },
    ],
    // 小ジャンプ台1箇所: クッキー橋の頂上付近。ギャップは無く着地は同じ路面上(演出ジャンプ)
    jumpPads: [
      { t0: 0.520, t1: 0.530, l0: -0.6, l1: 0.6 },
    ],
    // 初級コースにつきfallZones/gapsは使用しない

    // ---- アイテムボックス配置候補(Phase3で使用) ----
    itemSpots: [
      { t: 0.06, l: -0.35 }, { t: 0.06, l: 0 }, { t: 0.06, l: 0.35 },
      { t: 0.28, l: -0.3 },  { t: 0.28, l: 0 },  { t: 0.28, l: 0.3 },
      { t: 0.47, l: -0.3 },  { t: 0.47, l: 0.3 }, { t: 0.50, l: 0 },
      { t: 0.66, l: -0.3 },  { t: 0.66, l: 0 },   { t: 0.66, l: 0.3 },
      { t: 0.83, l: -0.35 }, { t: 0.83, l: 0 },   { t: 0.83, l: 0.35 },
      { t: 0.95, l: -0.3 },  { t: 0.95, l: 0.3 },
    ],

    // ---- テーマ装飾 ----
    decorate(group, course) {
      const s = course.spline;
      const houseTex = makeCookieHouseTexture();
      const houseMat = new THREE.MeshStandardMaterial({ map: houseTex, roughness: 0.88, metalness: 0.0 });
      const roofMat = Game.mats.matte(0xb5652f);
      const archMat = Game.mats.matte(0xe0b27a);
      const archDotMat = Game.mats.matte(0x6b3a20);
      const poleMat = Game.mats.metal(0xd8c9a8);
      const sugarMat = Game.mats.matte(0xfffaf0);

      let decorCount = 0;
      const maxDecor = 80;

      // 均等っぽく見えるよう疑似乱数(決定的)
      let seed = 1337;
      const rnd = () => {
        seed = (seed * 1103515245 + 12345) & 0x7fffffff;
        return (seed % 10000) / 10000;
      };

      const placeAt = (t, side) => {
        const idx = Math.floor(((t % 1) + 1) % 1 * s.count) % s.count;
        const p = s.pts[idx], n = s.nrm[idx], w = s.w[idx];
        const off = side * (w + course.offroadWidth / 7 * 7 + CT.decorOffsetMin + rnd() * CT.decorOffsetJitter);
        return {
          x: p.x + n.x * off, y: p.y, z: p.z + n.z * off,
          angle: s.tangentAngle(idx),
        };
      };

      // クッキーの家(箱+チョコチップ模様)
      const lamps = [];
      for (let i = 0; i < CT.houseCount && decorCount < maxDecor; i++) {
        const t = (i / CT.houseCount + rnd() * 0.01) % 1;
        const side = i % 2 === 0 ? 1 : -1;
        const at = placeAt(t, side);
        const houseGrp = new THREE.Group();
        const body = new THREE.Mesh(
          new THREE.BoxGeometry(CT.houseBodySize[0], CT.houseBodySize[1], CT.houseBodySize[2]),
          houseMat
        );
        body.position.y = CT.houseBodySize[1] / 2;
        houseGrp.add(body);
        const roof = new THREE.Mesh(new THREE.ConeGeometry(2.6, 2.0, 4), roofMat);
        roof.position.y = CT.houseBodySize[1] + 1.0;
        roof.rotation.y = Math.PI / 4;
        houseGrp.add(roof);
        houseGrp.position.set(at.x, at.y, at.z);
        houseGrp.rotation.y = at.angle + (side > 0 ? Math.PI / 2 : -Math.PI / 2);
        group.add(houseGrp);
        decorCount++;
      }

      // ビスケットのアーチ(左右支柱+梁、路肩の外側に立てて頭上を演出)
      for (let i = 0; i < CT.archCount && decorCount + 2 < maxDecor; i++) {
        const t = (0.08 + i / CT.archCount) % 1;
        const idx = Math.floor(t * s.count) % s.count;
        const p = s.pts[idx], n = s.nrm[idx], w = s.w[idx];
        const half = w + course.offroadWidth * 0.5 + CT.decorOffsetMin;
        const archGrp = new THREE.Group();
        for (const side of [-1, 1]) {
          const post = new THREE.Mesh(
            new THREE.CylinderGeometry(0.45, 0.5, CT.archHeight, 10),
            archDotMat
          );
          post.position.set(
            p.x + n.x * side * half,
            p.y + CT.archHeight / 2,
            p.z + n.z * side * half
          );
          archGrp.add(post);
          decorCount++;
        }
        const beam = new THREE.Mesh(
          new THREE.BoxGeometry(half * 2 + 1.5, CT.archThickness, CT.archThickness),
          archMat
        );
        beam.position.set(p.x, p.y + CT.archHeight, p.z);
        beam.rotation.y = s.tangentAngle(idx);
        archGrp.add(beam);
        decorCount++;
        group.add(archGrp);
      }

      // キャンディ街灯(飴玉が回転)
      for (let i = 0; i < CT.lampCount && decorCount < maxDecor; i++) {
        const t = (i / CT.lampCount + 0.02) % 1;
        const side = i % 2 === 0 ? -1 : 1;
        const at = placeAt(t, side * 0.55);
        const lampGrp = new THREE.Group();
        const pole = new THREE.Mesh(
          new THREE.CylinderGeometry(CT.lampPoleRadius, CT.lampPoleRadius * 1.2, CT.lampPoleHeight, 8),
          poleMat
        );
        pole.position.y = CT.lampPoleHeight / 2;
        lampGrp.add(pole);
        // 飴玉は発光マテリアルで街灯らしい輝きを出す(Phase6: 発光オブジェクト)
        const candy = new THREE.Mesh(
          new THREE.SphereGeometry(CT.candyRadius, 10, 8),
          Game.mats.glow(i % 2 === 0 ? 0xff6fa0 : 0x63c6ff, 1.1)
        );
        candy.position.y = CT.lampPoleHeight + CT.candyRadius * 0.6;
        candy.name = 'candy';
        lampGrp.add(candy);
        // 小さな点光源で足元の路面をほんのり照らす(発光感の補強、負荷を抑えるためdistance制限)
        const lampLight = new THREE.PointLight(i % 2 === 0 ? 0xff6fa0 : 0x63c6ff, 0.55, 9, 2);
        lampLight.position.copy(candy.position);
        lampGrp.add(lampLight);
        lampGrp.position.set(at.x, at.y, at.z);
        group.add(lampGrp);
        lamps.push(lampGrp);
        decorCount++;
      }

      // 粉砂糖の丘(白い半球)
      for (let i = 0; i < CT.sugarHillCount && decorCount < maxDecor; i++) {
        const t = (0.03 + i / CT.sugarHillCount * 0.97) % 1;
        const side = (i % 2 === 0 ? 1 : -1) * (0.8 + rnd() * 0.4);
        const at = placeAt(t, side);
        const r = CT.sugarHillRadiusMin + rnd() * (CT.sugarHillRadiusMax - CT.sugarHillRadiusMin);
        const hill = new THREE.Mesh(
          new THREE.SphereGeometry(r, 10, 8, 0, Math.PI * 2, 0, Math.PI / 2),
          sugarMat
        );
        hill.position.set(at.x, at.y, at.z);
        group.add(hill);
        decorCount++;
      }

      // ---- Phase6: 観客席 ----
      const stands = [];
      const standSpots = [0.02, 0.135, 0.62]; // スタートストレート付近+主要コーナー2箇所
      for (let si = 0; si < CT.standCount; si++) {
        const t = standSpots[si % standSpots.length];
        const side = si % 2 === 0 ? 1 : -1;
        const at = placeAt(t, side * 0.62);
        const stand = buildGrandstand(CT, si);
        stand.position.set(at.x, at.y, at.z);
        stand.rotation.y = at.angle + (side > 0 ? Math.PI / 2 : -Math.PI / 2);
        group.add(stand);
        stands.push(stand);
      }
      group.userData.cookieTownStands = stands;

      // ---- Phase6: 道路を横断するフラッグチェーン ----
      const flagTex = makeTriangleFlagTexture();
      for (const t of CT.flagChainSpots) {
        const idx = Math.floor(t * s.count) % s.count;
        const p = s.pts[idx], n = s.nrm[idx], w = s.w[idx];
        const chain = buildFlagChain(w + 1.4, CT.flagChainFlags, flagTex);
        chain.position.set(p.x, p.y + CT.archHeight + 1.0, p.z);
        chain.rotation.y = s.tangentAngle(idx);
        group.add(chain);
      }

      // ---- Phase6: のぼり旗 ----
      for (const t of CT.noboriSpots) {
        const side = rnd() < 0.5 ? 1 : -1;
        const at = placeAt(t, side * 0.5);
        const nobori = buildNobori(at.angle, t);
        nobori.position.set(at.x, at.y, at.z);
        group.add(nobori);
      }

      // ---- Phase6: オリジナル看板(架空ブランド) ----
      for (const b of CT.banners) {
        const idx = Math.floor(b.t * s.count) % s.count;
        const p = s.pts[idx], n = s.nrm[idx], w = s.w[idx];
        const off = b.side * (w + course.offroadWidth + CT.decorOffsetMin + 2);
        const board = buildBillboard(b.text);
        board.position.set(p.x + n.x * off, p.y, p.z + n.z * off);
        board.rotation.y = s.tangentAngle(idx) + (b.side > 0 ? -Math.PI / 2 : Math.PI / 2);
        group.add(board);
      }

      // ---- Phase6: ランドマーク(回る風車のクッキーミル) ----
      {
        const millIdx = Math.floor(CT.millSpot * s.count) % s.count;
        const p = s.pts[millIdx], n = s.nrm[millIdx], w = s.w[millIdx];
        const off = -1 * (w + course.offroadWidth + CT.decorOffsetMin + 6);
        const mill = buildCookieMill();
        mill.position.set(p.x + n.x * off, p.y, p.z + n.z * off);
        mill.rotation.y = s.tangentAngle(millIdx);
        group.add(mill);
        group.userData.cookieTownMillSails = mill.getObjectByName('millSails');
      }

      // ---- Phase6: 浮かぶ熱気球 ----
      const balloons = [];
      let bcx = 0, bcz = 0;
      for (const p of s.pts) { bcx += p.x; bcz += p.z; }
      bcx /= s.count; bcz /= s.count;
      for (let i = 0; i < CT.balloonCount; i++) {
        const balloon = buildHotAirBalloon(i);
        const baseAngle = (i / CT.balloonCount) * Math.PI * 2;
        const baseR = 70 + i * 22;
        balloon.position.set(bcx + Math.cos(baseAngle) * baseR, 34 + i * 6, bcz + Math.sin(baseAngle) * baseR);
        group.add(balloon);
        balloons.push({ mesh: balloon, angle: baseAngle, r: baseR, baseY: balloon.position.y, phase: i * 1.7 });
      }
      group.userData.cookieTownBalloons = { balloons, cx: bcx, cz: bcz };

      group.userData.cookieTownLamps = lamps;
    },

    // 街灯の飴玉をゆっくり回転+わずかに上下(見た目のみ、物理には影響しない)
    animate(time, group) {
      const lamps = group.userData.cookieTownLamps;
      if (!lamps) return;
      for (let i = 0; i < lamps.length; i++) {
        const lampGrp = lamps[i];
        const candy = lampGrp.children.find((c) => c.name === 'candy');
        if (!candy) continue;
        candy.rotation.y = time * CT.lampSpinSpeed + i;
        candy.position.y = CT.lampPoleHeight + 0.55 * 0.6 +
          Math.sin(time * CT.lampBobSpeed + i) * CT.lampBobAmp;
      }

      // 観客スタンドを歓声で揺らす(段ごとに位相をずらして波打たせる)
      const stands = group.userData.cookieTownStands;
      if (stands) {
        for (let si = 0; si < stands.length; si++) {
          const sway = Math.sin(time * CT.standSwaySpeed + si * 1.3) * CT.standSwayAmp;
          stands[si].rotation.z = sway;
        }
      }

      // 風車のクッキーミルをゆっくり回す
      const sails = group.userData.cookieTownMillSails;
      if (sails) sails.rotation.z = time * CT.millSailSpeed;

      // 熱気球はコース上空をゆっくり周回しつつ上下にふわふわ漂う
      const balloonData = group.userData.cookieTownBalloons;
      if (balloonData) {
        for (const b of balloonData.balloons) {
          const a = b.angle + time * CT.balloonDriftSpeed;
          b.mesh.position.x = balloonData.cx + Math.cos(a) * b.r;
          b.mesh.position.z = balloonData.cz + Math.sin(a) * b.r;
          b.mesh.position.y = b.baseY + Math.sin(time * CT.balloonBobSpeed + b.phase) * CT.balloonBobAmp;
          b.mesh.rotation.y = -a + Math.PI / 2;
        }
      }
    },
  };

  // クッキーの家の壁テクスチャ(チョコチップ模様)をCanvasで生成
  function makeCookieHouseTexture() {
    const cv = document.createElement('canvas');
    cv.width = 128; cv.height = 128;
    const x = cv.getContext('2d');
    x.fillStyle = '#e0b184';
    x.fillRect(0, 0, 128, 128);
    // うっすら焼き色ムラ
    for (let i = 0; i < 40; i++) {
      x.fillStyle = 'rgba(150,90,40,0.08)';
      const r = 4 + (i % 5) * 2;
      x.beginPath();
      x.arc((i * 29) % 128, (i * 61) % 128, r, 0, Math.PI * 2);
      x.fill();
    }
    // チョコチップ
    x.fillStyle = '#4a2a18';
    for (let i = 0; i < 26; i++) {
      const cx = (i * 41 + 13) % 128;
      const cy = (i * 67 + 25) % 128;
      x.beginPath();
      x.arc(cx, cy, 3.2, 0, Math.PI * 2);
      x.fill();
    }
    const tex = new THREE.CanvasTexture(cv);
    tex.wrapS = THREE.RepeatWrapping; tex.wrapT = THREE.RepeatWrapping;
    return tex;
  }

  // ---- Phase6: 観客スタンド(段状ボックス+InstancedMeshの観客球) ----
  function buildGrandstand(CT, seed) {
    const grp = new THREE.Group();
    const frameMat = Game.mats.matte(0xd9c9a0);
    const rowCount = CT.standRows;
    for (let r = 0; r < rowCount; r++) {
      const step = new THREE.Mesh(
        new THREE.BoxGeometry(CT.standWidth, CT.standRowHeight, CT.standRowDepth),
        frameMat
      );
      step.position.set(0, CT.standRowHeight * (r + 0.5), -r * CT.standRowDepth * 1.35);
      grp.add(step);
    }
    // 観客: InstancedMeshの球(カラフル、段ごとに1体分の高さに並べる)
    const seatCount = rowCount * CT.standSeatsPerRow;
    const seatGeo = new THREE.SphereGeometry(0.32, 7, 6);
    const seatMat = Game.mats.matte(0xffffff);
    const inst = new THREE.InstancedMesh(seatGeo, seatMat, seatCount);
    const dummy = new THREE.Object3D();
    const hues = [0xff6f91, 0x63c6ff, 0xffd166, 0x8fe08a, 0xd6a8ff, 0xff9d3c];
    let k = 0;
    let lseed = 900 + seed * 71;
    const lrnd = () => { lseed = (lseed * 1103515245 + 12345) & 0x7fffffff; return (lseed % 10000) / 10000; };
    for (let r = 0; r < rowCount; r++) {
      for (let c = 0; c < CT.standSeatsPerRow; c++) {
        const px = (c / (CT.standSeatsPerRow - 1) - 0.5) * (CT.standWidth - 1.2);
        const py = CT.standRowHeight * (r + 1) + 0.32;
        const pz = -r * CT.standRowDepth * 1.35 + (lrnd() - 0.5) * 0.3;
        dummy.position.set(px, py, pz);
        dummy.scale.setScalar(0.85 + lrnd() * 0.3);
        dummy.updateMatrix();
        inst.setMatrixAt(k, dummy.matrix);
        inst.setColorAt(k, new THREE.Color(hues[Math.floor(lrnd() * hues.length)]));
        k++;
      }
    }
    inst.instanceMatrix.needsUpdate = true;
    if (inst.instanceColor) inst.instanceColor.needsUpdate = true;
    inst.castShadow = true;
    grp.add(inst);
    return grp;
  }

  // 三角旗の連続テクスチャ(フラッグチェーン/のぼり共用)
  function makeTriangleFlagTexture() {
    const cv = document.createElement('canvas');
    cv.width = 64; cv.height = 64;
    const x = cv.getContext('2d');
    const cols = ['#ff6f91', '#63c6ff', '#ffd166', '#8fe08a'];
    x.fillStyle = cols[0]; x.beginPath();
    x.moveTo(4, 4); x.lineTo(60, 32); x.lineTo(4, 60); x.closePath(); x.fill();
    const tex = new THREE.CanvasTexture(cv);
    return tex;
  }

  // 道路を横断する三角旗の列(半幅+マージンをスパンとして両端を支柱間に張る想定の吊り下げ)
  function buildFlagChain(halfSpan, count, flagTex) {
    const grp = new THREE.Group();
    const cordMat = Game.mats.matte(0xfff6ee);
    const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, halfSpan * 2, 6), cordMat);
    cord.rotation.z = Math.PI / 2;
    grp.add(cord);
    const flagGeo = new THREE.PlaneGeometry(0.9, 0.7);
    const cols = [0xff6f91, 0x63c6ff, 0xffd166, 0x8fe08a];
    for (let i = 0; i < count; i++) {
      const tRatio = (i + 0.5) / count;
      const flagMat = new THREE.MeshBasicMaterial({ map: flagTex, color: cols[i % cols.length], side: THREE.DoubleSide });
      const flag = new THREE.Mesh(flagGeo, flagMat);
      flag.position.set(-halfSpan + tRatio * halfSpan * 2, -0.35 - Math.sin(tRatio * Math.PI) * 0.5, 0);
      flag.name = 'chainFlag';
      grp.add(flag);
    }
    grp.userData.isFlagChain = true;
    return grp;
  }

  // のぼり旗(ポール+縦長の三角旗)
  function buildNobori(angle, tSeed) {
    const grp = new THREE.Group();
    const poleMat = Game.mats.metal(0xcccccc);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 3.4, 6), poleMat);
    pole.position.y = 1.7;
    grp.add(pole);
    const cols = [0xff6f91, 0x63c6ff, 0xffd166, 0x8fe08a, 0xd6a8ff];
    const cv = document.createElement('canvas');
    cv.width = 32; cv.height = 96;
    const x = cv.getContext('2d');
    x.fillStyle = '#fff6ee'; x.fillRect(0, 0, 32, 96);
    x.fillStyle = '#' + new THREE.Color(cols[Math.floor((tSeed * 971) % cols.length)]).getHexString();
    x.fillRect(0, 0, 32, 18);
    x.fillRect(0, 78, 32, 18);
    x.font = 'bold 16px sans-serif';
    x.textAlign = 'center';
    x.save(); x.translate(16, 48); x.rotate(Math.PI / 2);
    x.fillStyle = '#5a3a26';
    x.fillText('SUGARIA', 0, 6);
    x.restore();
    const flagMat = new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(cv), side: THREE.DoubleSide });
    const flag = new THREE.Mesh(new THREE.PlaneGeometry(0.75, 2.3), flagMat);
    flag.position.set(0.42, 2.4, 0);
    flag.name = 'noboriFlag';
    grp.add(flag);
    grp.rotation.y = angle;
    return grp;
  }

  // オリジナル架空ブランドの看板(Canvas文字)
  function buildBillboard(text) {
    const grp = new THREE.Group();
    const legMat = Game.mats.metal(0xb9bec9);
    for (const lx of [-1.6, 1.6]) {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 3.4, 8), legMat);
      leg.position.set(lx, 1.7, 0);
      grp.add(leg);
    }
    const cv = document.createElement('canvas');
    cv.width = 512; cv.height = 160;
    const x = cv.getContext('2d');
    const grad = x.createLinearGradient(0, 0, 0, 160);
    grad.addColorStop(0, '#fff3df'); grad.addColorStop(1, '#ffd9a0');
    x.fillStyle = grad; x.fillRect(0, 0, 512, 160);
    x.strokeStyle = '#b5652f'; x.lineWidth = 10; x.strokeRect(6, 6, 500, 148);
    x.fillStyle = '#8a4a20';
    x.font = 'bold 58px sans-serif';
    x.textAlign = 'center'; x.textBaseline = 'middle';
    x.fillText(text, 256, 84);
    const boardMat = new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(cv) });
    const board = new THREE.Mesh(new THREE.PlaneGeometry(4.4, 1.4), boardMat);
    board.position.set(0, 3.9, 0.08);
    grp.add(board);
    const backMat = Game.mats.matte(0xe0b27a);
    const back = new THREE.Mesh(new THREE.BoxGeometry(4.4, 1.4, 0.12), backMat);
    back.position.set(0, 3.9, -0.02);
    grp.add(back);
    return grp;
  }

  // ランドマーク: 回る風車のクッキーミル(円柱の塔+円錐屋根+回転する4枚羽根)
  function buildCookieMill() {
    const grp = new THREE.Group();
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0xd9a86a, roughness: 0.82, metalness: 0.0 });
    const roofMat = Game.mats.matte(0x8a4a20);
    const body = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 3.4, 8.5, 12), bodyMat);
    body.position.y = 4.25;
    grp.add(body);
    const roof = new THREE.Mesh(new THREE.ConeGeometry(3.2, 3.2, 12), roofMat);
    roof.position.y = 10.1;
    grp.add(roof);
    // 窓(チョコチップ風の丸窓)
    const windowMat = Game.mats.glow(0xffe6a0, 0.9);
    const win = new THREE.Mesh(new THREE.CircleGeometry(0.55, 12), windowMat);
    win.position.set(0, 5.5, 3.42);
    grp.add(win);
    // 風車の羽根(4枚、回転軸グループ)
    const sails = new THREE.Group();
    sails.name = 'millSails';
    sails.position.set(0, 6.6, 3.5);
    const sailMat = Game.mats.paint(0xfff3df);
    const spokeMat = Game.mats.metal(0x9a9aa0);
    for (let i = 0; i < 4; i++) {
      const arm = new THREE.Group();
      arm.rotation.z = (Math.PI / 2) * i;
      const spoke = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 4.4, 6), spokeMat);
      spoke.position.y = 2.2;
      arm.add(spoke);
      const blade = new THREE.Mesh(new THREE.BoxGeometry(1.3, 2.0, 0.1), sailMat);
      blade.position.y = 4.2;
      arm.add(blade);
      sails.add(arm);
    }
    grp.add(sails);
    return grp;
  }

  // ランドマーク: 浮かぶ熱気球(球状のバルーン+ストライプ+ゴンドラ)
  function buildHotAirBalloon(seed) {
    const grp = new THREE.Group();
    const stripeCols = [
      ['#ff6f91', '#fff6ee'],
      ['#63c6ff', '#fff6ee'],
      ['#ffd166', '#fff6ee'],
    ];
    const pair = stripeCols[seed % stripeCols.length];
    const cv = document.createElement('canvas');
    cv.width = 64; cv.height = 64;
    const x = cv.getContext('2d');
    for (let i = 0; i < 8; i++) {
      x.fillStyle = i % 2 === 0 ? pair[0] : pair[1];
      x.fillRect((i / 8) * 64, 0, 64 / 8, 64);
    }
    const balloonMat = new THREE.MeshStandardMaterial({
      map: new THREE.CanvasTexture(cv), roughness: 0.5, metalness: 0.05,
    });
    const balloon = new THREE.Mesh(new THREE.SphereGeometry(3.6, 16, 12), balloonMat);
    grp.add(balloon);
    const basketMat = Game.mats.matte(0xb5652f);
    const basket = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.1, 1.3, 8), basketMat);
    basket.position.y = -4.8;
    grp.add(basket);
    const ropeMat = Game.mats.matte(0xf6e2c4);
    for (const [rx, rz] of [[-0.8, -0.8], [0.8, -0.8], [-0.8, 0.8], [0.8, 0.8]]) {
      const rope = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 2.6, 4), ropeMat);
      rope.position.set(rx, -3.5, rz);
      rope.rotation.x = Math.atan2(rz, 2.6) * 0.4;
      rope.rotation.z = -Math.atan2(rx, 2.6) * 0.4;
      grp.add(rope);
    }
    return grp;
  }
})();
