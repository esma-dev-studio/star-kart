// 上級コース「レインボーシュガー・スカイキャッスル」(id: skyCastle)
// テーマ: 雲の上の金平糖と飴細工の天空城。白+虹色パステルの幻想的な空間。
// レイアウト: 細かい連続コーナー → 巨大螺旋スロープ(高低差約42) →
//            浮遊アメ玉足場のジャンプ地帯(ジャンプ台+ギャップ×2、間に短い足場) →
//            急降下ロングストレート(ブーストパッド列) → 平坦な戻り区間
// controlPoints概算全長 = 各点間距離合計(約1089.6) × 1.05 ≒ 1144.1 ユニット
// 高低差の刻みは全て「隣接点間隔の14.5%以内」に収まるよう事前検算済み(基準15%以下)。
(function () {
  Game.courses = Game.courses || {};

  // ---- ローカル定数(マジックナンバー禁止のため集約) ----
  // ジャンプ台/ギャップ地帯のt値(全長概算に基づき算出。飛距離22u・滞空0.75sで設計)
  const GAP_ZONE = {
    jump1: { t0: 0.3223, t1: 0.3241 },
    gap1: { t0: 0.3267, t1: 0.3337 },   // jump1始端+13u以内 / jump1終端+3u後
    jump2: { t0: 0.3761, t1: 0.3779 },
    gap2: { t0: 0.3805, t1: 0.3875 },   // jump2始端+13u以内 / jump2終端+3u後
  };

  // 急降下ロングストレートのブーストパッド列(3箇所)
  const DESCENT_BOOSTS = [
    { t0: 0.4580, t1: 0.4628 },
    { t0: 0.5182, t1: 0.5230 },
    { t0: 0.5776, t1: 0.5816 },
  ];

  // 露出(縁から落ちる)区間: 螺旋登り+浮遊足場ギャップ地帯 + 急降下ストレート(全体の40%)
  const FALL_ZONES = [
    { t0: 0.170, t1: 0.400 },   // 螺旋スロープ〜ギャップ地帯
    { t0: 0.430, t1: 0.600 },   // 急降下ストレート
  ];

  // アイテムボックス配置候補(6グループ×3個)
  const ITEM_SPOT_GROUPS = [0.05, 0.22, 0.30, 0.47, 0.60, 0.71];
  const ITEM_SPOT_LATS = [-0.5, 0, 0.5];

  // 装飾チューニング(装飾メッシュ合計は80個以下に抑える:
  //  塔6×2 + 金平糖8×4 + 雲6×3 + 虹2×4 = 12+32+18+8 = 70個)
  const DECO = {
    towerCount: 6,
    candyCount: 8,
    candyBumpCount: 3,
    cloudClusterCount: 6,
    cloudPuffCount: 3,
    rainbowArchCount: 2,
    offroadWidth: 5,          // course.offroadWidthと一致させる(路肩幅)
    minOutset: 3.5,           // 路肩の外側からさらに確保する最小オフセット
    candyFloatAmp: 1.1,
    candyFloatSpeed: 0.7,
    cloudFloatAmp: 0.6,
    cloudFloatSpeed: 0.4,
    towerSpinSpeed: 0.15,
  };

  const STRIPE_COLORS = [
    ['#ff9fd0', '#ffffff'],
    ['#9fd8ff', '#ffffff'],
    ['#c6ffb0', '#ffffff'],
    ['#ffe38a', '#ffffff'],
  ];

  // 幻想的な昼のまま、リムライトをピンク系にする程度の軽い調整(DESIGN指示準拠)
  const lighting = {
    rimColor: 0xff9fd0,
  };

  // ---- Phase6: 密度・照明強化(観客席/旗/看板/ランドマーク/発光クリスタル) ----
  const P6 = {
    standCount: 2,                // 幅の広い区間(スタート付近+着地後)に観客席
    standRows: 3,
    standSeatsPerRow: 11,
    standWidth: 11,
    standRowDepth: 1.25,
    standRowHeight: 1.0,
    standSwaySpeed: 1.7,
    standSwayAmp: 0.05,
    bannerSpots: [
      { t: 0.03, side: 1, text: 'STAR KART GP' },
      { t: 0.46, side: -1, text: 'Soda Splash Racing' },
      { t: 0.94, side: 1, text: 'SKY CASTLE CUP' },
    ],
    noboriSpots: [0.12, 0.55, 0.83],
    crystalCount: 10,             // 光るクリスタルキャンディ(路肩に点在)
    crystalGlowSpeed: 0.8,
    castleSilhouetteDist: 260,    // 遠景の飴細工の城シルエット距離
    castleSilhouetteHeight: 95,
    ringRadius: 34,               // 回転する虹のリング(城の上に浮かべる)
    ringSpinSpeed: 0.12,
  };

  function itemSpots() {
    const spots = [];
    for (const t of ITEM_SPOT_GROUPS) {
      for (const l of ITEM_SPOT_LATS) spots.push({ t, l });
    }
    return spots;
  }

  // 縞模様キャンディテクスチャ(飴細工の塔用)
  function stripeTexture(colorA, colorB) {
    const cv = document.createElement('canvas');
    cv.width = 32; cv.height = 64;
    const x = cv.getContext('2d');
    const stripes = 8;
    for (let i = 0; i < stripes; i++) {
      x.fillStyle = i % 2 === 0 ? colorA : colorB;
      x.fillRect(0, (i / stripes) * 64, 32, 64 / stripes);
    }
    const tex = new THREE.CanvasTexture(cv);
    tex.wrapS = THREE.RepeatWrapping; tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(1, 3);
    return tex;
  }

  // 飴細工の塔(円柱+円錐、ストライプ)。ガラス質のtranslucent感でプレミアム感を出す
  function buildCandyTower(colorPair, height, radius) {
    const g = new THREE.Group();
    const tex = stripeTexture(colorPair[0], colorPair[1]);
    const bodyMat = new THREE.MeshStandardMaterial({
      map: tex, roughness: 0.18, metalness: 0.05, transparent: true, opacity: 0.92,
    });
    const body = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius * 1.1, height, 10), bodyMat);
    body.position.y = height / 2;
    g.add(body);
    const capMat = Game.mats.glass(colorPair[0], 0.85);
    const cap = new THREE.Mesh(new THREE.ConeGeometry(radius * 1.3, height * 0.35, 10), capMat);
    cap.position.y = height + (height * 0.35) / 2;
    g.add(cap);
    return g;
  }

  // 浮かぶ金平糖(球+丸い突起、控えめな数で可愛く)。光沢のあるペイント質感
  function buildCandyBall(color, radius) {
    const g = new THREE.Group();
    const mat = Game.mats.paint(color);
    const core = new THREE.Mesh(new THREE.SphereGeometry(radius, 10, 8), mat);
    g.add(core);
    const bumpCount = DECO.candyBumpCount;
    for (let i = 0; i < bumpCount; i++) {
      const phi = Math.acos(1 - 2 * (i + 0.5) / bumpCount);
      const theta = Math.PI * (1 + Math.sqrt(5)) * i;
      const bx = Math.sin(phi) * Math.cos(theta);
      const by = Math.sin(phi) * Math.sin(theta);
      const bz = Math.cos(phi);
      const bump = new THREE.Mesh(new THREE.SphereGeometry(radius * 0.42, 8, 6), mat);
      bump.position.set(bx * radius, by * radius, bz * radius);
      g.add(bump);
    }
    return g;
  }

  // 雲(白い球の集合、控えめな数)
  function buildCloud(scale) {
    const g = new THREE.Group();
    const mat = Game.mats.matte(0xffffff);
    const puffs = [
      [0, 0, 0, 1.0], [0.85, 0.1, 0.1, 0.68], [-0.85, 0.05, -0.1, 0.68],
    ].slice(0, DECO.cloudPuffCount);
    for (const [x, y, z, r] of puffs) {
      const puff = new THREE.Mesh(new THREE.SphereGeometry(r * scale, 10, 8), mat);
      puff.position.set(x * scale, y * scale, z * scale);
      g.add(puff);
    }
    return g;
  }

  // 虹のアーチ(トーラス半分、4色バンド)
  function buildRainbowArch(radius) {
    const g = new THREE.Group();
    const bandColors = [0xff6fa0, 0xffe38a, 0x8fe08a, 0x7ec8ff];
    bandColors.forEach((color, i) => {
      const r = radius - i * (radius * 0.06);
      const geo = new THREE.TorusGeometry(r, radius * 0.05, 8, 12, Math.PI);
      const mat = new THREE.MeshBasicMaterial({ color });
      const band = new THREE.Mesh(geo, mat);
      band.rotation.z = Math.PI;
      band.position.y = i * radius * 0.001; // わずかにずらして重なりのZファイト回避
      g.add(band);
    });
    return g;
  }

  function decorate(group, course) {
    const s = course.spline;
    const rng = mulberry32(20260703);
    // 路面半幅 + 路肩幅 + 最小オフセット = 路肩の外側から確実に3ユニット以上離れた基準距離
    const outsetBase = DECO.offroadWidth + DECO.minOutset;

    // 飴細工の塔(コース沿いに点在)
    const anim = { candies: [], clouds: [], towers: [] };
    group.userData.skyDecoAnim = anim;
    for (let i = 0; i < DECO.towerCount; i++) {
      const t = (i + 0.3) / DECO.towerCount;
      const idx = Math.floor(t * s.count) % s.count;
      const p = s.pts[idx], n = s.nrm[idx], w = s.w[idx];
      const side = i % 2 === 0 ? 1 : -1;
      const outset = w + outsetBase + rng() * 6;
      const height = 9 + rng() * 7;
      const radius = 1.0 + rng() * 0.6;
      const colorPair = STRIPE_COLORS[i % STRIPE_COLORS.length];
      const tower = buildCandyTower(colorPair, height, radius);
      tower.position.set(p.x + n.x * outset * side, p.y, p.z + n.z * outset * side);
      group.add(tower);
      anim.towers.push({ mesh: tower, phase: rng() * Math.PI * 2 });
    }

    // 浮かぶ金平糖
    const candyColors = [0xff8fc0, 0xffe38a, 0x9fe8ff, 0xb8ffb0, 0xd6a8ff];
    for (let i = 0; i < DECO.candyCount; i++) {
      const t = (i + 0.5) / DECO.candyCount;
      const idx = Math.floor(t * s.count) % s.count;
      const p = s.pts[idx], n = s.nrm[idx], w = s.w[idx];
      const side = (i % 2 === 0) ? 1 : -1;
      const outset = w + outsetBase + 2 + rng() * 8;
      const lift = 3 + rng() * 6;
      const radius = 0.6 + rng() * 0.5;
      const ball = buildCandyBall(candyColors[i % candyColors.length], radius);
      ball.position.set(p.x + n.x * outset * side, p.y + lift, p.z + n.z * outset * side);
      group.add(ball);
      anim.candies.push({ mesh: ball, baseY: ball.position.y, phase: rng() * Math.PI * 2 });
    }

    // 雲(浮遊クラスタ)
    for (let i = 0; i < DECO.cloudClusterCount; i++) {
      const t = (i + 0.15) / DECO.cloudClusterCount;
      const idx = Math.floor(t * s.count) % s.count;
      const p = s.pts[idx], n = s.nrm[idx], w = s.w[idx];
      const side = (i % 2 === 0) ? -1 : 1;
      const outset = w + outsetBase + 4 + rng() * 10;
      const lift = 4 + rng() * 8;
      const scale = 1.6 + rng() * 1.4;
      const cloud = buildCloud(scale);
      cloud.position.set(p.x + n.x * outset * side, p.y + lift, p.z + n.z * outset * side);
      group.add(cloud);
      anim.clouds.push({ mesh: cloud, baseY: cloud.position.y, phase: rng() * Math.PI * 2 });
    }

    // 虹のアーチ(スタート付近とギャップ地帯前に配置)
    const archTs = [0.02, 0.31];
    archTs.forEach((t, i) => {
      const idx = Math.floor(t * s.count) % s.count;
      const p = s.pts[idx], tan = s.tan[idx], w = s.w[idx];
      const arch = buildRainbowArch(w + 6);
      arch.position.set(p.x, p.y, p.z);
      arch.rotation.y = Math.atan2(tan.x, tan.z) + Math.PI / 2;
      group.add(arch);
    });

    // ---- Phase6: 観客席(スタート直線+着地後の広い区間) ----
    const stands = [];
    const standSpots = [0.965, 0.02];
    for (let si = 0; si < P6.standCount; si++) {
      const t = standSpots[si % standSpots.length];
      const idx = Math.floor(t * s.count) % s.count;
      const p = s.pts[idx], n = s.nrm[idx], w = s.w[idx];
      const side = si % 2 === 0 ? 1 : -1;
      const outset = w + outsetBase + 3;
      const stand = buildGrandstand(P6, si);
      stand.position.set(p.x + n.x * outset * side, p.y, p.z + n.z * outset * side);
      stand.rotation.y = s.tangentAngle(idx) + (side > 0 ? Math.PI / 2 : -Math.PI / 2);
      group.add(stand);
      stands.push(stand);
    }
    group.userData.skyStands = stands;

    // ---- Phase6: のぼり旗 ----
    for (const t of P6.noboriSpots) {
      const idx = Math.floor(t * s.count) % s.count;
      const p = s.pts[idx], n = s.nrm[idx], w = s.w[idx];
      const side = rng() < 0.5 ? 1 : -1;
      const outset = w + outsetBase * 0.5;
      const nobori = buildNobori(s.tangentAngle(idx), t);
      nobori.position.set(p.x + n.x * outset * side, p.y, p.z + n.z * outset * side);
      group.add(nobori);
    }

    // ---- Phase6: オリジナル看板(架空ブランド) ----
    for (const b of P6.bannerSpots) {
      const idx = Math.floor(b.t * s.count) % s.count;
      const p = s.pts[idx], n = s.nrm[idx], w = s.w[idx];
      const outset = b.side * (w + outsetBase);
      const board = buildBillboard(b.text);
      board.position.set(p.x + n.x * outset, p.y, p.z + n.z * outset);
      board.rotation.y = s.tangentAngle(idx) + (b.side > 0 ? -Math.PI / 2 : Math.PI / 2);
      group.add(board);
    }

    // ---- Phase6: 光るクリスタルキャンディ(路肩に点在、発光オブジェクト) ----
    const crystalColors = [0xff9fd0, 0x9fd8ff, 0xc6ffb0, 0xffe38a, 0xd6a8ff];
    const crystals = [];
    for (let i = 0; i < P6.crystalCount; i++) {
      const t = (i + 0.6) / P6.crystalCount;
      const idx = Math.floor(t * s.count) % s.count;
      const p = s.pts[idx], n = s.nrm[idx], w = s.w[idx];
      const side = (i % 2 === 0) ? 1 : -1;
      const outset = w + DECO.offroadWidth * 0.4 + 1.4;
      const color = crystalColors[i % crystalColors.length];
      const crystal = new THREE.Mesh(new THREE.OctahedronGeometry(0.6, 0), Game.mats.glow(color, 1.2));
      crystal.position.set(p.x + n.x * outset * side, p.y + 0.7, p.z + n.z * outset * side);
      group.add(crystal);
      crystals.push({ mesh: crystal, phase: rng() * Math.PI * 2 });
    }
    anim.crystals = crystals;

    // ---- Phase6: ランドマーク(遠景の大きな飴細工の城シルエット) ----
    {
      let ccx = 0, ccz = 0;
      for (const p of s.pts) { ccx += p.x; ccz += p.z; }
      ccx /= s.count; ccz /= s.count;
      const castle = buildCastleSilhouette();
      castle.position.set(ccx, 0, ccz - P6.castleSilhouetteDist);
      group.add(castle);

      // ---- Phase6: 回転する虹のリング(城の上に浮かべる) ----
      const ring = buildSpinningRainbowRing(P6.ringRadius);
      ring.position.set(ccx, P6.castleSilhouetteHeight * 0.62, ccz - P6.castleSilhouetteDist);
      group.add(ring);
      anim.rainbowRing = ring;
    }
  }

  // group.userData.skyDecoAnimに保存したアニメ対象をたどって浮遊・回転させる。
  // decorate(group, course)実行後、このgroupに対してanimate(time, group)が呼ばれる想定。
  function animateGroup(time, group) {
    const a = group.userData.skyDecoAnim;
    if (!a) return;
    for (const c of a.candies) {
      c.mesh.position.y = c.baseY + Math.sin(time * DECO.candyFloatSpeed + c.phase) * DECO.candyFloatAmp;
      c.mesh.rotation.y = time * 0.3 + c.phase;
    }
    for (const c of a.clouds) {
      c.mesh.position.y = c.baseY + Math.sin(time * DECO.cloudFloatSpeed + c.phase) * DECO.cloudFloatAmp;
    }
    for (const t of a.towers) {
      t.mesh.rotation.y = time * DECO.towerSpinSpeed + t.phase;
    }

    // 光るクリスタルキャンディを明滅させる
    if (a.crystals) {
      for (const c of a.crystals) {
        c.mesh.rotation.y = time * 0.6 + c.phase;
        c.mesh.material.emissiveIntensity = 1.0 + Math.sin(time * P6.crystalGlowSpeed + c.phase) * 0.35;
      }
    }
    // 城上空の虹のリングをゆっくり回転させる
    if (a.rainbowRing) {
      a.rainbowRing.rotation.z = time * P6.ringSpinSpeed;
      a.rainbowRing.rotation.y = time * P6.ringSpinSpeed * 0.4;
    }

    // 観客スタンドを歓声で揺らす
    const stands = group.userData.skyStands;
    if (stands) {
      for (let si = 0; si < stands.length; si++) {
        stands[si].rotation.z = Math.sin(time * P6.standSwaySpeed + si * 1.2) * P6.standSwayAmp;
      }
    }
  }

  // 決定論的な擬似乱数(装飾配置を再現可能にする)
  function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  Game.courses.skyCastle = {
    id: 'skyCastle',
    displayName: 'レインボーシュガー・スカイキャッスル',
    bgmMood: 'きらびやかで浮遊感のあるシンセ+鈴のファンファーレ調',
    name: 'レインボーシュガー・スカイキャッスル',

    // 概算全長: 1089.6(制御点間距離合計) × 1.05 ≒ 1144.1 ユニット
    controlPoints: [
      { x: 0, y: 0, z: -50, w: 9.0 },       // 0 スタート(平坦・幅9)
      { x: 0, y: 0, z: -14, w: 9.0 },       // 1
      { x: 18, y: 1, z: 22, w: 7.5 },       // 2 細かい連続コーナー
      { x: 42, y: 1.8, z: 21, w: 7.0 },     // 3
      { x: 31, y: 2.4, z: -11, w: 7.0 },    // 4
      { x: 5, y: 2.8, z: -15, w: 6.8 },     // 5 螺旋登り入口
      { x: 27, y: 6.43, z: -27, w: 6.4 },   // 6
      { x: 50, y: 10.85, z: -7, w: 6.2 },   // 7
      { x: 48, y: 15.21, z: 23, w: 6.0 },   // 8
      { x: 21, y: 19.56, z: 36, w: 5.9 },   // 9
      { x: -9, y: 24.79, z: 16, w: 5.6 },   // 10 城上層到達
      { x: -14, y: 29.77, z: -18, w: 5.3 }, // 11 jumpPad1直前
      { x: -14, y: 34.41, z: -50, w: 5.3 }, // 12 gap1着地・短足場
      { x: -14, y: 38.18, z: -76, w: 5.3 }, // 13 jumpPad2直前
      { x: -14, y: 42.53, z: -106, w: 5.3 },// 14 gap2着地・急降下入口
      { x: 9, y: 34.42, z: -157, w: 6.5 },  // 15 急降下ジグザグ
      { x: -27, y: 25.01, z: -211, w: 7.4 },// 16
      { x: 9, y: 15.6, z: -265, w: 8.2 },   // 17
      { x: -13, y: 7.81, z: -314, w: 8.8 }, // 18
      { x: 0, y: 1.02, z: -359, w: 9.0 },   // 19 着地
      { x: 0, y: 0, z: -386, w: 9.0 },      // 20 スタートへの戻り直線
    ],

    offroadWidth: 5,

    colors: {
      sky: 0xcfeeff,
      fog: 0xe8f6ff,
      ground: 0xffffff,     // 雲海(地面代わり)
      road: '#f4f0ff',
      edge: '#ff9fd0',
      curb: '#8ad0ff',
      offroad: 0xdfeeff,
    },
    fogDensity: 0.0032,
    lighting,

    boostPads: DESCENT_BOOSTS,
    jumpPads: [
      { t0: GAP_ZONE.jump1.t0, t1: GAP_ZONE.jump1.t1 },
      { t0: GAP_ZONE.jump2.t0, t1: GAP_ZONE.jump2.t1 },
    ],
    gaps: [
      { t0: GAP_ZONE.gap1.t0, t1: GAP_ZONE.gap1.t1 },
      { t0: GAP_ZONE.gap2.t0, t1: GAP_ZONE.gap2.t1 },
    ],
    fallZones: FALL_ZONES,

    itemSpots: itemSpots(),

    decorate(group, course) {
      decorate(group, course);
    },
    // 見た目のみのフック(物理には影響させない)。金平糖と雲を浮遊、塔をゆっくり回転させる。
    animate(time, group) {
      animateGroup(time, group);
    },
  };

  // ---- Phase6: 観客スタンド(段状ボックス+InstancedMeshの観客球) ----
  function buildGrandstand(cfg, seed) {
    const grp = new THREE.Group();
    const frameMat = Game.mats.matte(0xf4f0ff);
    for (let r = 0; r < cfg.standRows; r++) {
      const step = new THREE.Mesh(
        new THREE.BoxGeometry(cfg.standWidth, cfg.standRowHeight, cfg.standRowDepth),
        frameMat
      );
      step.position.set(0, cfg.standRowHeight * (r + 0.5), -r * cfg.standRowDepth * 1.35);
      grp.add(step);
    }
    const seatCount = cfg.standRows * cfg.standSeatsPerRow;
    const seatGeo = new THREE.SphereGeometry(0.3, 7, 6);
    const seatMat = Game.mats.matte(0xffffff);
    const inst = new THREE.InstancedMesh(seatGeo, seatMat, seatCount);
    const dummy = new THREE.Object3D();
    const hues = [0xff9fd0, 0x9fd8ff, 0xc6ffb0, 0xffe38a, 0xd6a8ff];
    let k = 0;
    let lseed = 8100 + seed * 47;
    const lrnd = () => { lseed = (lseed * 1103515245 + 12345) & 0x7fffffff; return (lseed % 10000) / 10000; };
    for (let r = 0; r < cfg.standRows; r++) {
      for (let c = 0; c < cfg.standSeatsPerRow; c++) {
        const px = (c / (cfg.standSeatsPerRow - 1) - 0.5) * (cfg.standWidth - 1.2);
        const py = cfg.standRowHeight * (r + 1) + 0.3;
        const pz = -r * cfg.standRowDepth * 1.35 + (lrnd() - 0.5) * 0.3;
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

  // のぼり旗
  function buildNobori(angle, tSeed) {
    const grp = new THREE.Group();
    const poleMat = Game.mats.metal(0xe8d8ff);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 3.2, 6), poleMat);
    pole.position.y = 1.6;
    grp.add(pole);
    const cols = ['#ff9fd0', '#9fd8ff', '#c6ffb0', '#ffe38a'];
    const cv = document.createElement('canvas');
    cv.width = 32; cv.height = 96;
    const x = cv.getContext('2d');
    x.fillStyle = '#ffffff'; x.fillRect(0, 0, 32, 96);
    x.fillStyle = cols[Math.floor((tSeed * 971) % cols.length)];
    x.fillRect(0, 0, 32, 18);
    x.fillRect(0, 78, 32, 18);
    x.font = 'bold 14px sans-serif';
    x.textAlign = 'center';
    x.save(); x.translate(16, 48); x.rotate(Math.PI / 2);
    x.fillStyle = '#8a5aa0';
    x.fillText('SKY CUP', 0, 6);
    x.restore();
    const flagMat = new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(cv), side: THREE.DoubleSide });
    const flag = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 2.1), flagMat);
    flag.position.set(0.4, 2.3, 0);
    grp.add(flag);
    grp.rotation.y = angle;
    return grp;
  }

  // オリジナル架空ブランドの看板(Canvas文字)
  function buildBillboard(text) {
    const grp = new THREE.Group();
    const legMat = Game.mats.metal(0xe8d8ff);
    for (const lx of [-1.6, 1.6]) {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 3.3, 8), legMat);
      leg.position.set(lx, 1.65, 0);
      grp.add(leg);
    }
    const cv = document.createElement('canvas');
    cv.width = 512; cv.height = 160;
    const x = cv.getContext('2d');
    const grad = x.createLinearGradient(0, 0, 0, 160);
    grad.addColorStop(0, '#fff0fa'); grad.addColorStop(1, '#ffd0ea');
    x.fillStyle = grad; x.fillRect(0, 0, 512, 160);
    x.strokeStyle = '#ff9fd0'; x.lineWidth = 10; x.strokeRect(6, 6, 500, 148);
    x.fillStyle = '#8a5aa0';
    x.font = 'bold 50px sans-serif';
    x.textAlign = 'center'; x.textBaseline = 'middle';
    x.fillText(text, 256, 84);
    const boardMat = new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(cv) });
    const board = new THREE.Mesh(new THREE.PlaneGeometry(4.2, 1.35), boardMat);
    board.position.set(0, 3.8, 0.08);
    grp.add(board);
    const backMat = Game.mats.matte(0xffe6f5);
    const back = new THREE.Mesh(new THREE.BoxGeometry(4.2, 1.35, 0.12), backMat);
    back.position.set(0, 3.8, -0.02);
    grp.add(back);
    return grp;
  }

  // ランドマーク: 遠景の大きな飴細工の城シルエット(単色シルエットで軽量、fogに溶けて奥行きを演出)
  function buildCastleSilhouette() {
    const grp = new THREE.Group();
    const mat = new THREE.MeshBasicMaterial({ color: 0xd9b8e8, fog: true, transparent: true, opacity: 0.85 });
    const keep = new THREE.Mesh(new THREE.CylinderGeometry(14, 18, 55, 10), mat);
    keep.position.y = 27.5;
    grp.add(keep);
    const roof = new THREE.Mesh(new THREE.ConeGeometry(20, 26, 10), mat);
    roof.position.y = 55 + 13;
    grp.add(roof);
    const towerPositions = [[-22, 0.75, -6], [22, 0.75, -6], [0, 0.9, -18]];
    for (const [tx, scale, tz] of towerPositions) {
      const tower = new THREE.Mesh(new THREE.CylinderGeometry(6 * scale, 7 * scale, 38 * scale, 8), mat);
      tower.position.set(tx, 19 * scale, tz);
      grp.add(tower);
      const tRoof = new THREE.Mesh(new THREE.ConeGeometry(8 * scale, 14 * scale, 8), mat);
      tRoof.position.set(tx, 38 * scale + 7 * scale, tz);
      grp.add(tRoof);
    }
    grp.traverse((o) => { if (o.isMesh) { o.castShadow = false; o.receiveShadow = false; } });
    return grp;
  }

  // ランドマーク: 城の上空で回転する虹のリング(トーラス、4色バンド)
  function buildSpinningRainbowRing(radius) {
    const g = new THREE.Group();
    const bandColors = [0xff9fd0, 0xffe38a, 0xc6ffb0, 0x9fd8ff];
    bandColors.forEach((color, i) => {
      const r = radius - i * (radius * 0.045);
      const geo = new THREE.TorusGeometry(r, radius * 0.035, 8, 24);
      const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9 });
      const band = new THREE.Mesh(geo, mat);
      g.add(band);
    });
    return g;
  }
})();
