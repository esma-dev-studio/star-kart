// コース⑥: ボイドスパイラル(id: voidSpiral)★4
// テーマ: 次元の裂け目に浮かぶ観測路。紫の虚空にネオンの道が螺旋を描く。
// レイアウト: スタート(北向き) → 左S字の観測基地エリア(t0.05-0.33) →
//            螺旋タワーを1周半登る(t0.40-0.68、y3.5→11.5、真下の自道を2回跨ぐ・橋脚自動) →
//            高所から下りつつジャンプ台(t0.717)→宙のギャップ(t0.729-0.744)を飛ぶ →
//            着地(y6)から下りの大回り(t0.77-0.91) → 平地の戻り直線(t0.95-1.0)
// t0.3934〜0.7491は落下ゾーン(路肩セーフティなし=踏み外すと虚空へ落ちてリスポーン)。
// controlPoints・ゾーンt値は実バリデータ検証済みの凍結値(変更禁止)。
(function () {
  Game.courses = Game.courses || {};

  // ---- ローカル定数(マジックナンバー集約) ----
  const VS = {
    decorOffsetMin: 4,
    decorOffsetJitter: 6,

    // 落下ゾーン(地上物の配置禁止区間)
    fallT0: 0.3934,
    fallT1: 0.7491,

    // 1) 裂け目ポータル(ランドマーク、螺旋中心軸の真上に浮かぶ)
    portalPos: { x: -30, y: 22, z: -52 },
    portalRadius: 7.5,
    portalTube: 0.8,
    portalSpinSpeed: 0.22,
    membraneSpinSpeed: -0.35,

    // 2) 浮遊する裂け片(落下ゾーンの外空間に漂う)
    shardCount: 12,
    shardMin: 1.2,
    shardMax: 3.2,
    shardDriftAmp: 1.4,
    shardDriftSpeed: 0.3,

    // 3) エナジーパイロン(序盤/終盤の路肩)
    pylonSpots: [0.02, 0.08, 0.15, 0.24, 0.31, 0.80, 0.87, 0.97],
    pylonHeight: 5.2,

    // 4) ギャップ警告ビーコン(ジャンプ台手前の路肩)
    beaconSpots: [0.705, 0.712],
    beaconLat: 0.95,

    // 5) 観測基地ドーム
    domeSpots: [0.10, 0.22],

    // 6) 観客スタンド(落下ゾーン外のみ)
    standSpots: [0.03, 0.90],
    standRows: 3,
    standSeatsPerRow: 12,
    standWidth: 13,
    standRowDepth: 1.35,
    standRowHeight: 1.05,
    standSwaySpeed: 1.5,
    standSwayAmp: 0.05,

    // 7) 看板(全て落下ゾーン外)
    billboards: [
      { t: 0.043, side: 1, text: 'VOID SPIRAL' },
      { t: 0.3262, side: -1, text: 'ASTRO GEAR' },
      { t: 0.8027, side: 1, text: 'NOVA TIRES' },
      { t: 0.9121, side: -1, text: 'COMET FUEL' },
    ],

    // 8) 街灯(反重力ランタン、落下ゾーン外のみ)
    lampSpots: [0.005, 0.12, 0.19, 0.28, 0.82, 0.94],
    lampPoleHeight: 4.4,
    lampBobSpeed: 1.0,
    lampBobAmp: 0.09,
  };

  const controlPoints = [
    { x: 0, y: 0, z: 0, w: 8.5 },
    { x: 0, y: 0, z: 38, w: 8.5 },
    { x: -12, y: 0, z: 72, w: 8 },
    { x: -40, y: 0, z: 96, w: 8 },
    { x: -74, y: 0.5, z: 100, w: 7.5 },
    { x: -104, y: 1, z: 84, w: 7.5 },
    { x: -122, y: 1.5, z: 54, w: 7.5 },
    { x: -118, y: 2, z: 20, w: 8 },
    { x: -96, y: 2.5, z: -6, w: 8 },
    { x: -64, y: 3, z: -28, w: 8 },
    { x: -56, y: 3.5, z: -52, w: 7.5 },
    { x: -48, y: 4.1, z: -74, w: 7.5 },
    { x: -30, y: 5.1, z: -78, w: 7.5 },
    { x: -10, y: 6.5, z: -70, w: 7.5 },
    { x: -4, y: 7.5, z: -52, w: 7.5 },
    { x: -10, y: 8.5, z: -32, w: 7.5 },
    { x: -30, y: 9.5, z: -26, w: 7.5 },
    { x: -49, y: 10.2, z: -33, w: 7.5 },
    { x: -56, y: 10.9, z: -52, w: 7.5 },
    { x: -48, y: 11.5, z: -78, w: 7.5 },
    { x: -28, y: 11, z: -96, w: 8 },
    { x: -2, y: 9.2, z: -110, w: 8 },
    { x: 30, y: 7.5, z: -116, w: 8 },
    { x: 66, y: 6, z: -112, w: 8.5 },
    { x: 94, y: 4.5, z: -96, w: 8.5 },
    { x: 104, y: 3, z: -64, w: 8.5 },
    { x: 96, y: 1.5, z: -34, w: 8 },
    { x: 70, y: 0.5, z: -20, w: 8 },
    { x: 40, y: 0, z: -14, w: 8.5 },
    { x: 16, y: 0, z: -14, w: 9 },
  ];

  Game.courses.voidSpiral = {
    id: 'voidSpiral',
    displayName: 'ボイドスパイラル',
    name: 'ボイドスパイラル',
    bgmMood: '次元の裂け目を昇る、うねる変拍子シンセ',
    controlPoints,
    offroadWidth: 7,
    fogDensity: 0.0038,
    clouds: false, // 虚空に雲は出さない(浮遊シャードが空の主役)
    colors: {
      sky: 0x120a2a, fog: 0x3a2a5e, ground: 0x241a40,
      road: '#3a3346', edge: '#e8dcff', curb: '#c46bff',
      centerLine: '#7ef0d8', offroad: 0x352a52,
    },
    lighting: {
      hemiSky: 0x6a4ab8, hemiGround: 0x140a28, hemiIntensity: 0.5,
      sunColor: 0x9a7aff, sunIntensity: 0.85,
      rimColor: 0xc46bff, exposure: 1.08,
    },
    boostPads: [
      { t0: 0.8027, t1: 0.8107, l0: -0.55, l1: 0.55 },
      { t0: 0.9473, t1: 0.9553, l0: -0.55, l1: 0.55 },
    ],
    jumpPads: [
      { t0: 0.7168, t1: 0.7236 },
    ],
    gaps: [
      { t0: 0.7293, t1: 0.7441 },
    ],
    fallZones: [
      // 螺旋の2周目(高所)〜ギャップ着地まで。1周目と進入は路肩を残して
      // 「登るほど危険になる」段階設計にする(全域露出はAIも人も落下が多すぎた)
      { t0: 0.47, t1: 0.7491 },
    ],
    itemSpots: [
      { t: 0.084, l: -0.33 }, { t: 0.084, l: 0 }, { t: 0.084, l: 0.33 },
      { t: 0.2871, l: -0.33 }, { t: 0.2871, l: 0 }, { t: 0.2871, l: 0.33 },
      { t: 0.4727, l: -0.33 }, { t: 0.4727, l: 0 }, { t: 0.4727, l: 0.33 },
      { t: 0.6875, l: -0.33 }, { t: 0.6875, l: 0 }, { t: 0.6875, l: 0.33 },
      { t: 0.8789, l: -0.33 }, { t: 0.8789, l: 0 }, { t: 0.8789, l: 0.33 },
    ],

    // ---- テーマ装飾 ----
    decorate(group, course) {
      const s = course.spline;
      let decorCount = 0;
      const maxDecor = 90;

      // 決定的疑似乱数(LCG)
      let seed = 6203;
      const rnd = () => {
        seed = (seed * 1103515245 + 12345) & 0x7fffffff;
        return (seed % 10000) / 10000;
      };

      const placeAt = (t, side) => {
        const idx = Math.floor(((t % 1) + 1) % 1 * s.count) % s.count;
        const p = s.pts[idx], n = s.nrm[idx], w = s.w[idx];
        const off = side * (w + course.offroadWidth + VS.decorOffsetMin + rnd() * VS.decorOffsetJitter);
        return {
          x: p.x + n.x * off, y: p.y, z: p.z + n.z * off,
          angle: s.tangentAngle(idx),
        };
      };

      // ---- 1) 裂け目ポータル(ランドマーク。螺旋の真上に浮かび、登坂中ずっと見える) ----
      {
        const portal = buildRiftPortal();
        portal.position.set(VS.portalPos.x, VS.portalPos.y, VS.portalPos.z);
        group.add(portal);
        group.userData.vsPortalRing = portal.getObjectByName('riftRing');
        group.userData.vsPortalMembrane = portal.getObjectByName('riftMembrane');
        decorCount += 2;
      }

      // ---- 2) 浮遊する裂け片(虚空に漂う黒紫の結晶。路肩から15以上離す) ----
      const shards = [];
      const darkMat = Game.mats.matte(0x1a1030);
      const glowShardMat = Game.mats.glow(0x7ef0d8, 0.8);
      for (let i = 0; i < VS.shardCount && decorCount < maxDecor; i++) {
        // 落下ゾーン区間の外側空間に配置(路肩から15〜35離れた宙)
        const t = VS.fallT0 + (i / VS.shardCount) * (VS.fallT1 - VS.fallT0);
        const idx = Math.floor(t * s.count) % s.count;
        const p = s.pts[idx], n = s.nrm[idx], w = s.w[idx];
        const side = i % 2 === 0 ? 1 : -1;
        const off = side * (w + 15 + rnd() * 20);
        const size = VS.shardMin + rnd() * (VS.shardMax - VS.shardMin);
        const geo = i % 3 === 0
          ? new THREE.TetrahedronGeometry(size, 0)
          : new THREE.OctahedronGeometry(size * 0.8, 0);
        const shard = new THREE.Mesh(geo, i % 4 === 0 ? glowShardMat : darkMat);
        shard.position.set(p.x + n.x * off, 5 + rnd() * 20, p.z + n.z * off);
        shard.rotation.set(rnd() * Math.PI, rnd() * Math.PI, rnd() * Math.PI);
        group.add(shard);
        shards.push({
          mesh: shard, baseY: shard.position.y,
          spinX: 0.1 + rnd() * 0.3, spinY: 0.1 + rnd() * 0.3, phase: rnd() * Math.PI * 2,
        });
        decorCount++;
      }
      group.userData.vsShards = shards;

      // ---- 3) エナジーパイロン(発光柱。序盤/終盤の路肩のみ) ----
      const pylonPoleMat = Game.mats.metal(0x4a3f66);
      const pylonGlowMat = Game.mats.glow(0xc46bff, 1.1);
      for (let i = 0; i < VS.pylonSpots.length && decorCount < maxDecor; i++) {
        const side = i % 2 === 0 ? 1 : -1;
        const at = placeAt(VS.pylonSpots[i], side * 0.7);
        const grp2 = new THREE.Group();
        const pole = new THREE.Mesh(
          new THREE.CylinderGeometry(0.18, 0.3, VS.pylonHeight, 8), pylonPoleMat
        );
        pole.position.y = VS.pylonHeight / 2;
        grp2.add(pole);
        const tip = new THREE.Mesh(new THREE.OctahedronGeometry(0.55, 0), pylonGlowMat);
        tip.position.y = VS.pylonHeight + 0.45;
        tip.name = 'pylonTip';
        grp2.add(tip);
        grp2.position.set(at.x, at.y, at.z);
        group.add(grp2);
        decorCount += 2;
      }

      // ---- 4) ギャップ警告ビーコン(ジャンプ台手前の路肩に反重力ポール2対) ----
      // 落下ゾーン内だが「道の縁に浮かぶ反重力灯」意匠。ここで跳ぶ、が遠くから分かる
      const beacons = [];
      const beaconMat = Game.mats.glow(0x7ef0d8, 1.3);
      for (const t of VS.beaconSpots) {
        for (const side of [-1, 1]) {
          const idx = Math.floor(t * s.count) % s.count;
          const p = s.pts[idx], n = s.nrm[idx], w = s.w[idx];
          const off = side * w * VS.beaconLat;
          const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 2.6, 6), beaconMat);
          pole.position.set(p.x + n.x * off, p.y + 1.3, p.z + n.z * off);
          group.add(pole);
          beacons.push(pole);
          decorCount++;
        }
      }
      group.userData.vsBeacons = beacons;

      // ---- 5) 観測基地ドーム(半球+アンテナ) ----
      const domeMat = Game.mats.paint(0x3f3560);
      const domeGlassMat = Game.mats.glass(0x9a7aff, 0.6);
      for (const t of VS.domeSpots) {
        if (decorCount + 3 > maxDecor) break;
        const at = placeAt(t, -1);
        const base = new THREE.Mesh(
          new THREE.SphereGeometry(3.2, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), domeMat
        );
        base.position.set(at.x, at.y, at.z);
        group.add(base);
        const window2 = new THREE.Mesh(
          new THREE.SphereGeometry(1.4, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), domeGlassMat
        );
        window2.position.set(at.x, at.y + 2.0, at.z);
        group.add(window2);
        const antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 3.4, 6), Game.mats.metal(0x8a86a8));
        antenna.position.set(at.x + 1.6, at.y + 4.0, at.z);
        group.add(antenna);
        decorCount += 3;
      }

      // ---- 6) 観客スタンド(紫/シアンの耐圧スーツカラー) ----
      const stands = [];
      for (let si = 0; si < VS.standSpots.length; si++) {
        const side = si % 2 === 0 ? 1 : -1;
        const at = placeAt(VS.standSpots[si], side * 0.7);
        const stand = buildVoidStand(VS, si);
        stand.position.set(at.x, at.y, at.z);
        stand.rotation.y = at.angle + (side > 0 ? Math.PI / 2 : -Math.PI / 2);
        group.add(stand);
        stands.push(stand);
      }
      group.userData.vsStands = stands;

      // ---- 7) 看板(金属+紫ネオン) ----
      for (const b of VS.billboards) {
        const idx = Math.floor(b.t * s.count) % s.count;
        const p = s.pts[idx], n = s.nrm[idx], w = s.w[idx];
        const off = b.side * (w + course.offroadWidth + VS.decorOffsetMin + 2);
        const board = buildVoidBillboard(b.text);
        board.position.set(p.x + n.x * off, p.y, p.z + n.z * off);
        board.rotation.y = s.tangentAngle(idx) + (b.side > 0 ? -Math.PI / 2 : Math.PI / 2);
        group.add(board);
      }

      // ---- 8) 街灯(反重力ランタン。落下ゾーン外のみ) ----
      const lamps = [];
      const lampPoleMat = Game.mats.metal(0x55496e);
      for (let i = 0; i < VS.lampSpots.length && decorCount < maxDecor; i++) {
        const side = i % 2 === 0 ? -1 : 1;
        const at = placeAt(VS.lampSpots[i], side * 0.55);
        const lampGrp = new THREE.Group();
        const pole = new THREE.Mesh(
          new THREE.CylinderGeometry(0.13, 0.17, VS.lampPoleHeight, 8), lampPoleMat
        );
        pole.position.y = VS.lampPoleHeight / 2;
        lampGrp.add(pole);
        const core = new THREE.Mesh(
          new THREE.OctahedronGeometry(0.4, 0),
          Game.mats.glow(i % 2 === 0 ? 0xc46bff : 0x9a7aff, 1.2)
        );
        core.position.y = VS.lampPoleHeight + 0.5;
        core.name = 'lampCore';
        lampGrp.add(core);
        const light = new THREE.PointLight(i % 2 === 0 ? 0xc46bff : 0x9a7aff, 0.55, 9, 2);
        light.position.copy(core.position);
        lampGrp.add(light);
        lampGrp.position.set(at.x, at.y, at.z);
        group.add(lampGrp);
        lamps.push(lampGrp);
        decorCount += 2;
      }
      group.userData.vsLamps = lamps;
    },

    // 見た目のみのフック(物理・スプラインに影響させない)
    animate(time, group) {
      // ポータル: リング回転+渦膜の逆回転
      const ring = group.userData.vsPortalRing;
      if (ring) ring.rotation.z = time * VS.portalSpinSpeed;
      const mem = group.userData.vsPortalMembrane;
      if (mem) mem.rotation.z = time * VS.membraneSpinSpeed;

      // 裂け片: 各自ゆっくり回転+上下ドリフト
      const shards = group.userData.vsShards;
      if (shards) {
        for (const sh of shards) {
          sh.mesh.rotation.x = time * sh.spinX + sh.phase;
          sh.mesh.rotation.y = time * sh.spinY + sh.phase * 1.3;
          sh.mesh.position.y = sh.baseY + Math.sin(time * VS.shardDriftSpeed + sh.phase) * VS.shardDriftAmp;
        }
      }

      // ギャップビーコン: 脈打つスケール(「ここで跳ぶ」の注意喚起)
      const beacons = group.userData.vsBeacons;
      if (beacons) {
        const sc = 1 + Math.sin(time * 3.2) * 0.12;
        for (const b of beacons) b.scale.set(sc, 1, sc);
      }

      // スタンドの歓声揺れ
      const stands = group.userData.vsStands;
      if (stands) {
        for (let si = 0; si < stands.length; si++) {
          stands[si].rotation.z = Math.sin(time * VS.standSwaySpeed + si * 1.3) * VS.standSwayAmp;
        }
      }

      // 反重力ランタンのコア回転+上下
      const lamps = group.userData.vsLamps;
      if (lamps) {
        for (let i = 0; i < lamps.length; i++) {
          const core = lamps[i].getObjectByName('lampCore');
          if (!core) continue;
          core.rotation.y = time * 0.6 + i;
          core.position.y = VS.lampPoleHeight + 0.5 + Math.sin(time * VS.lampBobSpeed + i) * VS.lampBobAmp;
        }
      }
    },
  };

  // ランドマーク: 裂け目ポータル(発光リング+内側の渦膜)
  function buildRiftPortal() {
    const grp = new THREE.Group();
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(VS.portalRadius, VS.portalTube, 10, 32),
      Game.mats.glow(0xc46bff, 1.3)
    );
    ring.name = 'riftRing';
    grp.add(ring);
    // 渦膜(半透明・加算合成。裏からも見えるようDoubleSide)
    const mem = new THREE.Mesh(
      new THREE.CircleGeometry(VS.portalRadius - 0.6, 28),
      new THREE.MeshBasicMaterial({
        map: makeSwirlTexture(), transparent: true, opacity: 0.7,
        blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
        depthWrite: false, fog: false,
      })
    );
    mem.name = 'riftMembrane';
    grp.add(mem);
    // ポータルはコース側(南向き)へ少し傾けて見せる
    grp.rotation.x = -0.18;
    return grp;
  }

  // 渦のグラデーションテクスチャ(中心が明るいスパイラル)
  function makeSwirlTexture() {
    const cv = document.createElement('canvas');
    cv.width = 128; cv.height = 128;
    const x = cv.getContext('2d');
    const grad = x.createRadialGradient(64, 64, 4, 64, 64, 64);
    grad.addColorStop(0, 'rgba(230,215,255,0.95)');
    grad.addColorStop(0.35, 'rgba(196,107,255,0.55)');
    grad.addColorStop(0.75, 'rgba(126,240,216,0.25)');
    grad.addColorStop(1, 'rgba(126,240,216,0)');
    x.fillStyle = grad;
    x.fillRect(0, 0, 128, 128);
    // 渦の腕(円弧を数本描いて回転感を出す)
    x.strokeStyle = 'rgba(240,230,255,0.5)';
    x.lineWidth = 3;
    for (let a = 0; a < 3; a++) {
      x.beginPath();
      for (let i = 0; i <= 40; i++) {
        const th = a * (Math.PI * 2 / 3) + i * 0.09;
        const r = 6 + i * 1.35;
        const px = 64 + Math.cos(th) * r, py = 64 + Math.sin(th) * r;
        if (i === 0) x.moveTo(px, py); else x.lineTo(px, py);
      }
      x.stroke();
    }
    return new THREE.CanvasTexture(cv);
  }

  // 観客スタンド(段状ボックス+InstancedMeshの観客、紫/シアン)
  function buildVoidStand(cfg, seed) {
    const grp = new THREE.Group();
    const frameMat = Game.mats.matte(0x2c2444);
    for (let r = 0; r < cfg.standRows; r++) {
      const step = new THREE.Mesh(
        new THREE.BoxGeometry(cfg.standWidth, cfg.standRowHeight, cfg.standRowDepth),
        frameMat
      );
      step.position.set(0, cfg.standRowHeight * (r + 0.5), -r * cfg.standRowDepth * 1.35);
      grp.add(step);
    }
    const seatCount = cfg.standRows * cfg.standSeatsPerRow;
    const seatGeo = new THREE.SphereGeometry(0.32, 7, 6);
    const seatMat = Game.mats.matte(0xffffff);
    const inst = new THREE.InstancedMesh(seatGeo, seatMat, seatCount);
    const dummy = new THREE.Object3D();
    const hues = [0xc46bff, 0x7ef0d8, 0x9a7aff, 0xe8dcff, 0x63c6ff];
    let k = 0;
    let lseed = 7300 + seed * 61;
    const lrnd = () => { lseed = (lseed * 1103515245 + 12345) & 0x7fffffff; return (lseed % 10000) / 10000; };
    for (let r = 0; r < cfg.standRows; r++) {
      for (let c = 0; c < cfg.standSeatsPerRow; c++) {
        const px = (c / (cfg.standSeatsPerRow - 1) - 0.5) * (cfg.standWidth - 1.2);
        const py = cfg.standRowHeight * (r + 1) + 0.32;
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

  // 看板(Canvas文字、黒地+紫ネオン枠)
  function buildVoidBillboard(text) {
    const grp = new THREE.Group();
    const legMat = Game.mats.metal(0x55496e);
    for (const lx of [-1.6, 1.6]) {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 3.4, 8), legMat);
      leg.position.set(lx, 1.7, 0);
      grp.add(leg);
    }
    const cv = document.createElement('canvas');
    cv.width = 512; cv.height = 160;
    const x = cv.getContext('2d');
    const grad = x.createLinearGradient(0, 0, 0, 160);
    grad.addColorStop(0, '#241a40'); grad.addColorStop(1, '#120a2a');
    x.fillStyle = grad; x.fillRect(0, 0, 512, 160);
    x.strokeStyle = '#c46bff'; x.lineWidth = 10; x.strokeRect(6, 6, 500, 148);
    x.fillStyle = '#7ef0d8';
    x.font = 'bold 56px sans-serif';
    x.textAlign = 'center'; x.textBaseline = 'middle';
    x.fillText(text, 256, 84);
    const boardMat = new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(cv) });
    const board = new THREE.Mesh(new THREE.PlaneGeometry(4.4, 1.4), boardMat);
    board.position.set(0, 3.9, 0.08);
    grp.add(board);
    const backMat = Game.mats.matte(0x2c2444);
    const back = new THREE.Mesh(new THREE.BoxGeometry(4.4, 1.4, 0.12), backMat);
    back.position.set(0, 3.9, -0.02);
    grp.add(back);
    return grp;
  }
})();
