// コース: ソーラーフォージ(id: solarForge)
// テーマ: 恒星炉の重工業地帯。宇宙×ネオンのSTAR KART世界観を灼熱の製鉄プラントで表現する。
// レイアウト: 北向きスタート直線(頭上を橋が横切る、t≈0.088) → 北ループ(0.13-0.35) →
//            東側を南下(0.35-0.45) → 登り(0.45-0.56、y=7へ) → 橋の上で自コースを跨ぐ(t≈0.59) →
//            西へ下り(0.6-0.75) → 南西コーナー(0.85) → 南ストレート(0.89) → ゴールへ(0.97-1.0)
// 立体交差の橋脚・縁梁は course.js(buildCrossingDecor)が自動生成するため、
// このファイルの装飾はその周辺の雰囲気づくり(産業施設・発光チャンネル等)に専念する。
// fallZones/gapsは使用しない(落下ハザードなしの設計。難所は立体交差と下りコーナーで表現済み)。
// controlPoints概算全長: 約832ユニット(隣接点距離合計) × 1.05 ≒ 874ユニット。
(function () {
  Game.courses = Game.courses || {};

  // ---- ローカル定数(マジックナンバー集約) ----
  const SF = {
    // 装飾配置共通(路肩外縁からの離隔)
    decorOffsetMin: 4,
    decorOffsetJitter: 6,

    // 1) 恒星炉タワー(ランドマーク、北ループ中央の空き地)
    towerPos: { x: 62, z: 76 },
    towerBaseRadius: 3.6,
    towerRadius: 2.9,
    towerHeight: 27,
    towerCoreRadius: 2.5,
    towerRingCount: 3,
    towerPulseSpeed: 0.85,
    towerPulseAmp: 0.07,

    // 2) 回転する巨大歯車(タワー脇2枚+橋の近く1枚)
    gearRadius: 3.2,
    gearSpokeCount: 6,
    gearSpinSpeed: 0.45,

    // 3) 溶けた星鉄のチャンネル(路肩の外側に沿わせる発光帯)
    channelSpots: [
      { t: 0.015, side: 1 },
      { t: 0.235, side: -1 },
      { t: 0.43, side: 1 },
      { t: 0.705, side: -1 },
      { t: 0.865, side: 1 },
    ],
    channelLength: 15,
    channelWidth: 1.4,

    // 4) 鍛造クレーン/ガントリー(門型フレーム)
    // 注意: t≈0.088は頭上を橋が横切る区間。ここに置くとビーム(高さ8)が橋の走行空間に
    // 突っ込むため、立体交差を抜けた直後(0.115)に配置する
    gantrySpots: [0.115, 0.50],
    gantryHeight: 8,

    // 5) 煙突と火の粉
    chimneySpots: [0.175, 0.40, 0.625, 0.835],
    chimneyHeightMin: 8,
    chimneyHeightMax: 12,
    emberRiseHeight: 3.4,
    emberSpeed: 0.35,

    // 6) 観客スタンド(耐熱スーツカラー)
    standSpots: [0.025, 0.255, 0.865],
    standRows: 3,
    standSeatsPerRow: 12,
    standWidth: 13,
    standRowDepth: 1.35,
    standRowHeight: 1.05,
    standSwaySpeed: 1.5,
    standSwayAmp: 0.05,

    // 7) 看板(架空ブランド)
    billboards: [
      { t: 0.05, side: 1, text: 'SOLAR FORGE' },
      { t: 0.3145, side: -1, text: 'NOVA TIRES' },
      { t: 0.6758, side: 1, text: 'COMET FUEL' },
      { t: 0.93, side: -1, text: 'STAR KART GP' },
    ],

    // 8) 街灯(工業ランプ)
    lampCount: 7,
    lampLitCount: 6,          // PointLight総数を6個以内に抑えるための点灯数
    lampPoleHeight: 4.4,
    lampBobSpeed: 1.0,
    lampBobAmp: 0.08,
    lampFlickerSpeed: 2.2,
  };

  const controlPoints = [
    { x: 0, y: 0, z: 0, w: 9.5 },
    { x: 0, y: 0, z: 36, w: 9.5 },
    { x: 2, y: 0, z: 74, w: 9 },
    { x: 12, y: 0, z: 112, w: 9 },
    { x: 38, y: 0, z: 140, w: 8.5 },
    { x: 74, y: 0, z: 150, w: 8.5 },
    { x: 108, y: 0, z: 136, w: 8.5 },
    { x: 126, y: 0.5, z: 104, w: 9 },
    { x: 124, y: 1.5, z: 66, w: 9 },
    { x: 108, y: 2.5, z: 32, w: 9 },
    { x: 78, y: 3.5, z: 10, w: 9 },
    { x: 44, y: 5, z: 2, w: 8.5 },
    { x: 26, y: 6.2, z: 22, w: 8.5 },
    { x: 22, y: 7, z: 52, w: 8.5 },
    { x: 8, y: 7.2, z: 72, w: 8.5 },
    { x: -26, y: 7, z: 74, w: 8.5 },
    { x: -60, y: 6, z: 62, w: 9 },
    { x: -86, y: 4.5, z: 36, w: 9 },
    { x: -98, y: 2.5, z: 2, w: 9 },
    { x: -92, y: 1, z: -32, w: 9 },
    { x: -68, y: 0, z: -58, w: 9 },
    { x: -34, y: 0, z: -68, w: 9.5 },
    { x: -4, y: 0, z: -58, w: 9.5 },
    { x: 6, y: 0, z: -26, w: 9.5 },
  ];

  Game.courses.solarForge = {
    id: 'solarForge',
    displayName: 'ソーラーフォージ',
    name: 'ソーラーフォージ',
    bgmMood: '恒星炉の重工業地帯を駆けるドライビングなインダストリアル',
    controlPoints,
    offroadWidth: 7,
    fogDensity: 0.0036,
    colors: {
      sky: 0x2a1626, fog: 0x6b3a4a, ground: 0x4a3038,
      road: '#4a4148', edge: '#ffe8cc', curb: '#ff9a3c',
      centerLine: '#ffd94a', offroad: 0x5c3a30,
    },
    lighting: {
      hemiSky: 0xff9a58, hemiGround: 0x2a1418, hemiIntensity: 0.5,
      sunColor: 0xffb066, sunIntensity: 1.0,
      rimColor: 0xff7a3c, exposure: 1.12,
    },
    boostPads: [
      { t0: 0.4043, t1: 0.419, l0: -0.55, l1: 0.55 },
      { t0: 0.8887, t1: 0.9047, l0: -0.55, l1: 0.55 },
    ],
    jumpPads: [],
    // fallZones/gapsは使用しない(落下ハザードなしの設計判断)

    itemSpots: [
      { t: 0.1348, l: -0.33 }, { t: 0.1348, l: 0 }, { t: 0.1348, l: 0.33 },
      { t: 0.3145, l: -0.33 }, { t: 0.3145, l: 0 }, { t: 0.3145, l: 0.33 },
      { t: 0.4922, l: -0.33 }, { t: 0.4922, l: 0 }, { t: 0.4922, l: 0.33 },
      { t: 0.6758, l: -0.33 }, { t: 0.6758, l: 0 }, { t: 0.6758, l: 0.33 },
      { t: 0.925, l: -0.33 }, { t: 0.925, l: 0 }, { t: 0.925, l: 0.33 },
    ],

    // ---- テーマ装飾 ----
    decorate(group, course) {
      const s = course.spline;
      let decorCount = 0;
      const maxDecor = 90;

      // 均等っぽく見えるよう疑似乱数(決定的、cookie_town.jsと同方式のLCG)
      let seed = 8102;
      const rnd = () => {
        seed = (seed * 1103515245 + 12345) & 0x7fffffff;
        return (seed % 10000) / 10000;
      };

      const placeAt = (t, side) => {
        const idx = Math.floor(((t % 1) + 1) % 1 * s.count) % s.count;
        const p = s.pts[idx], n = s.nrm[idx], w = s.w[idx];
        const off = side * (w + course.offroadWidth + SF.decorOffsetMin + rnd() * SF.decorOffsetJitter);
        return {
          x: p.x + n.x * off, y: p.y, z: p.z + n.z * off,
          angle: s.tangentAngle(idx),
        };
      };

      // ---- 1) 恒星炉タワー(ランドマーク。北ループ中央の空き地、コースから40以上離す) ----
      {
        const tower = buildForgeTower();
        tower.position.set(SF.towerPos.x, 0, SF.towerPos.z);
        tower.rotation.y = rnd() * Math.PI * 2;
        group.add(tower);
        group.userData.solarForgeTowerCore = tower.getObjectByName('forgeCore');
        decorCount += 6;
      }

      // ---- 2) 回転する巨大歯車(タワー脇2枚+橋の近く1枚) ----
      const gears = [];
      const towerGearOffsets = [
        { dx: -9, dz: 4, angle: 0.4 },
        { dx: 8, dz: -7, angle: -2.6 },
      ];
      for (const go of towerGearOffsets) {
        const gear = buildGear(SF.gearRadius, SF.gearSpokeCount);
        gear.position.set(SF.towerPos.x + go.dx, 0, SF.towerPos.z + go.dz);
        gear.rotation.y = go.angle;
        group.add(gear);
        gears.push(gear.userData.spin);
        decorCount += 3;
      }
      {
        const at = placeAt(0.575, -1);
        const gear = buildGear(SF.gearRadius * 0.85, SF.gearSpokeCount);
        gear.position.set(at.x, at.y, at.z);
        gear.rotation.y = at.angle + Math.PI / 2;
        group.add(gear);
        gears.push(gear.userData.spin);
        decorCount += 3;
      }
      group.userData.solarForgeGears = gears;

      // ---- 3) 溶けた星鉄のチャンネル(路肩の外側に沿わせる発光帯) ----
      const channelMat = Game.mats.glow(0xff6a2c, 1.0);
      for (const c of SF.channelSpots) {
        if (decorCount >= maxDecor) break;
        const idx = Math.floor(((c.t % 1) + 1) % 1 * s.count) % s.count;
        const p = s.pts[idx], n = s.nrm[idx], w = s.w[idx];
        const off = c.side * (w + course.offroadWidth + SF.decorOffsetMin + rnd() * SF.decorOffsetJitter);
        const channel = new THREE.Mesh(
          new THREE.BoxGeometry(SF.channelLength, 0.14, SF.channelWidth),
          channelMat
        );
        channel.position.set(p.x + n.x * off, p.y + 0.08, p.z + n.z * off);
        // tangentAngleは「長軸X=道路横断」の向き(ゲート梁と同じ)。チャンネルは道路に
        // 沿って流す意匠なので90°足して長軸を進行方向に合わせる
        channel.rotation.y = s.tangentAngle(idx) + Math.PI / 2;
        group.add(channel);
        decorCount++;
      }

      // ---- 4) 鍛造クレーン/ガントリー(門型フレーム。立体交差付近に配置) ----
      for (const t of SF.gantrySpots) {
        if (decorCount + 5 > maxDecor) break;
        const idx = Math.floor(t * s.count) % s.count;
        const p = s.pts[idx], w = s.w[idx];
        const halfSpan = w + course.offroadWidth * 0.5 + SF.decorOffsetMin;
        const gantry = buildGantry(halfSpan, SF.gantryHeight);
        gantry.position.set(p.x, p.y, p.z);
        gantry.rotation.y = s.tangentAngle(idx);
        group.add(gantry);
        decorCount += 5;
      }

      // ---- 5) 煙突と火の粉(先端の発光球が上昇→リセット) ----
      const emberMat = Game.mats.glow(0xffb066, 1.3);
      const embers = [];
      for (const t of SF.chimneySpots) {
        if (decorCount >= maxDecor) break;
        const side = rnd() < 0.5 ? 1 : -1;
        const at = placeAt(t, side);
        const height = SF.chimneyHeightMin + rnd() * (SF.chimneyHeightMax - SF.chimneyHeightMin);
        const chimney = buildChimney(height, 0.75 + rnd() * 0.25);
        chimney.position.set(at.x, at.y, at.z);
        group.add(chimney);
        decorCount += 2;
        for (let k = 0; k < 2; k++) {
          const ember = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6), emberMat);
          const bx = at.x + (rnd() - 0.5) * 0.4;
          const bz = at.z + (rnd() - 0.5) * 0.4;
          const by = at.y + height;
          ember.position.set(bx, by, bz);
          group.add(ember);
          embers.push({ mesh: ember, baseX: bx, baseY: by, baseZ: bz, phase: rnd() });
          decorCount++;
        }
      }
      group.userData.solarForgeEmbers = embers;

      // ---- 6) 観客スタンド(耐熱スーツカラー: オレンジ/チャコール) ----
      const stands = [];
      for (let si = 0; si < SF.standSpots.length; si++) {
        const t = SF.standSpots[si];
        const side = si % 2 === 0 ? 1 : -1;
        const at = placeAt(t, side * 0.7);
        const stand = buildForgeStand(SF, si);
        stand.position.set(at.x, at.y, at.z);
        stand.rotation.y = at.angle + (side > 0 ? Math.PI / 2 : -Math.PI / 2);
        group.add(stand);
        stands.push(stand);
      }
      group.userData.solarForgeStands = stands;

      // ---- 7) 看板(架空ブランド、金属+エンバー配色) ----
      for (const b of SF.billboards) {
        const idx = Math.floor(b.t * s.count) % s.count;
        const p = s.pts[idx], n = s.nrm[idx], w = s.w[idx];
        const off = b.side * (w + course.offroadWidth + SF.decorOffsetMin + 2);
        const board = buildForgeBillboard(b.text);
        board.position.set(p.x + n.x * off, p.y, p.z + n.z * off);
        board.rotation.y = s.tangentAngle(idx) + (b.side > 0 ? -Math.PI / 2 : Math.PI / 2);
        group.add(board);
      }

      // ---- 8) 街灯(工業ランプ、オレンジglow) ----
      const lamps = [];
      const lampPoleMat = Game.mats.metal(0x5c5a5e);
      for (let i = 0; i < SF.lampCount && decorCount < maxDecor; i++) {
        const t = (i / SF.lampCount + 0.015) % 1;
        const side = i % 2 === 0 ? -1 : 1;
        const at = placeAt(t, side * 0.55);
        const lampGrp = new THREE.Group();
        const pole = new THREE.Mesh(
          new THREE.CylinderGeometry(0.13, 0.16, SF.lampPoleHeight, 8),
          lampPoleMat
        );
        pole.position.y = SF.lampPoleHeight / 2;
        lampGrp.add(pole);
        const head = new THREE.Mesh(
          new THREE.OctahedronGeometry(0.42, 0),
          Game.mats.glow(i % 2 === 0 ? 0xff9a3c : 0xffcf6b, 1.2)
        );
        head.position.y = SF.lampPoleHeight + 0.2;
        head.name = 'lampHead';
        lampGrp.add(head);
        if (i < SF.lampLitCount) {
          const light = new THREE.PointLight(i % 2 === 0 ? 0xff9a3c : 0xffcf6b, 0.55, 8, 2);
          light.position.copy(head.position);
          lampGrp.add(light);
        }
        lampGrp.position.set(at.x, at.y, at.z);
        group.add(lampGrp);
        lamps.push(lampGrp);
        decorCount += 2;
      }
      group.userData.solarForgeLamps = lamps;
    },

    // 見た目のみのフック(物理・スプラインには影響させない)
    animate(time, group) {
      // 恒星炉タワーの発光コアがゆっくり脈動
      const core = group.userData.solarForgeTowerCore;
      if (core) {
        const scale = 1 + Math.sin(time * SF.towerPulseSpeed) * SF.towerPulseAmp;
        core.scale.setScalar(scale);
      }

      // 巨大歯車をゆっくり回転(隣り合う歯車は逆回転)
      const gears = group.userData.solarForgeGears;
      if (gears) {
        for (let i = 0; i < gears.length; i++) {
          gears[i].rotation.z = time * SF.gearSpinSpeed * (i % 2 === 0 ? 1 : -1) + i;
        }
      }

      // 煙突の先端から火の粉がゆっくり上昇してリセット
      const embers = group.userData.solarForgeEmbers;
      if (embers) {
        for (const e of embers) {
          const cyc = ((time * SF.emberSpeed + e.phase) % 1 + 1) % 1;
          e.mesh.position.y = e.baseY + cyc * SF.emberRiseHeight;
          e.mesh.position.x = e.baseX + Math.sin(time * 1.4 + e.phase * 8) * 0.12;
          e.mesh.position.z = e.baseZ + Math.cos(time * 1.2 + e.phase * 8) * 0.12;
          const fade = 1 - cyc;
          e.mesh.scale.setScalar(0.5 + fade * 0.7);
        }
      }

      // 観客スタンドを歓声で揺らす
      const stands = group.userData.solarForgeStands;
      if (stands) {
        for (let si = 0; si < stands.length; si++) {
          stands[si].rotation.z = Math.sin(time * SF.standSwaySpeed + si * 1.3) * SF.standSwayAmp;
        }
      }

      // 工業ランプが微かにバウンド+明滅(電力の脈動感)
      const lamps = group.userData.solarForgeLamps;
      if (lamps) {
        for (let i = 0; i < lamps.length; i++) {
          const head = lamps[i].children.find((c) => c.name === 'lampHead');
          if (!head) continue;
          head.position.y = SF.lampPoleHeight + 0.2 + Math.sin(time * SF.lampBobSpeed + i) * SF.lampBobAmp;
          head.material.emissiveIntensity = 1.2 + Math.sin(time * SF.lampFlickerSpeed + i * 2.1) * 0.15;
        }
      }
    },
  };

  // ランドマーク: 恒星炉タワー(円筒本体+外骨格リング+発光コア)
  function buildForgeTower() {
    const grp = new THREE.Group();
    const baseMat = Game.mats.matte(0x3a2f2c);
    const bodyMat = Game.mats.matte(0x5a4a42);
    const ringMat = Game.mats.metal(0x8a8f9a);
    const coreMat = Game.mats.glow(0xff9a3c, 1.2);

    const base = new THREE.Mesh(
      new THREE.CylinderGeometry(SF.towerBaseRadius, SF.towerBaseRadius * 1.2, 3, 14),
      baseMat
    );
    base.position.y = 1.5;
    grp.add(base);

    const body = new THREE.Mesh(
      new THREE.CylinderGeometry(SF.towerRadius * 0.72, SF.towerRadius, SF.towerHeight - 3, 14),
      bodyMat
    );
    body.position.y = 3 + (SF.towerHeight - 3) / 2;
    grp.add(body);

    // 外骨格リング(等間隔に3本)
    for (let i = 0; i < SF.towerRingCount; i++) {
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(SF.towerRadius * 1.15, 0.26, 8, 16),
        ringMat
      );
      ring.rotation.x = Math.PI / 2;
      ring.position.y = 3 + (SF.towerHeight - 3) * ((i + 1) / (SF.towerRingCount + 1));
      grp.add(ring);
    }

    // 頂上の発光コア(animateでscale脈動)
    const core = new THREE.Mesh(new THREE.SphereGeometry(SF.towerCoreRadius, 16, 12), coreMat);
    core.position.y = SF.towerHeight + SF.towerCoreRadius * 0.5;
    core.name = 'forgeCore';
    grp.add(core);

    return grp;
  }

  // 回転する巨大歯車(台座+トーラスリング+InstancedMeshのスポーク)
  function buildGear(radius, spokeCount) {
    const grp = new THREE.Group();
    const pedestalMat = Game.mats.metal(0x6b6a6e);
    const pedestal = new THREE.Mesh(
      new THREE.CylinderGeometry(radius * 0.22, radius * 0.3, 2.6, 10),
      pedestalMat
    );
    pedestal.position.y = 1.3;
    grp.add(pedestal);

    // 回転部(リング+スポーク)。animate側から参照してrotation.zを回す
    const spin = new THREE.Group();
    spin.name = 'gearSpin';
    spin.position.y = 2.6;
    const ringMat = Game.mats.metal(0x9aa0ab);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(radius, radius * 0.16, 8, 16), ringMat);
    spin.add(ring);

    const spokeGeo = new THREE.BoxGeometry(radius * 1.7, radius * 0.14, radius * 0.14);
    const spokes = new THREE.InstancedMesh(spokeGeo, ringMat, spokeCount);
    const dummy = new THREE.Object3D();
    for (let i = 0; i < spokeCount; i++) {
      dummy.position.set(0, 0, 0);
      dummy.rotation.set(0, 0, (Math.PI * 2 * i) / spokeCount);
      dummy.updateMatrix();
      spokes.setMatrixAt(i, dummy.matrix);
    }
    spokes.instanceMatrix.needsUpdate = true;
    spin.add(spokes);

    grp.add(spin);
    grp.userData.spin = spin;
    return grp;
  }

  // 鍛造クレーン/ガントリー(門型フレーム+吊り下げフック。halfSpanは中心線からの支柱距離)
  function buildGantry(halfSpan, height) {
    const grp = new THREE.Group();
    const legMat = Game.mats.metal(0x888d97);
    const beamMat = Game.mats.paint(0xff8a3c);
    const hookMat = Game.mats.metal(0x45464c);
    for (const side of [-1, 1]) {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.42, height, 8), legMat);
      leg.position.set(side * halfSpan, height / 2, 0);
      grp.add(leg);
    }
    const beam = new THREE.Mesh(new THREE.BoxGeometry(halfSpan * 2 + 1.0, 0.55, 0.55), beamMat);
    beam.position.set(0, height, 0);
    grp.add(beam);
    const chain = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, height * 0.3, 6), legMat);
    chain.position.set(0, height - height * 0.15, 0);
    grp.add(chain);
    const hook = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.4, 0.55), hookMat);
    hook.position.set(0, height - height * 0.3 - 0.2, 0);
    grp.add(hook);
    return grp;
  }

  // 煙突(本体+口金リング)。先端の火の粉はdecorate側で個別に生成しanimateで動かす
  function buildChimney(height, radius) {
    const grp = new THREE.Group();
    const bodyMat = Game.mats.matte(0x362a26);
    const rimMat = Game.mats.metal(0x6b6a6e);
    const body = new THREE.Mesh(
      new THREE.CylinderGeometry(radius * 0.82, radius, height, 10),
      bodyMat
    );
    body.position.y = height / 2;
    grp.add(body);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(radius * 0.86, radius * 0.14, 6, 12), rimMat);
    rim.rotation.x = Math.PI / 2;
    rim.position.y = height;
    grp.add(rim);
    return grp;
  }

  // ---- 観客スタンド(段状ボックス+InstancedMeshの観客、耐熱スーツカラー) ----
  function buildForgeStand(cfg, seed) {
    const grp = new THREE.Group();
    const frameMat = Game.mats.matte(0x3a3a40);
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
    const hues = [0xff9a3c, 0xffcf6b, 0x6b4a3a, 0x3a3a40, 0xff6a2c];
    let k = 0;
    let lseed = 5100 + seed * 61;
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

  // オリジナル架空ブランドの看板(Canvas文字、金属フレーム+エンバー配色)
  function buildForgeBillboard(text) {
    const grp = new THREE.Group();
    const legMat = Game.mats.metal(0x6b6a6e);
    for (const lx of [-1.6, 1.6]) {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 3.4, 8), legMat);
      leg.position.set(lx, 1.7, 0);
      grp.add(leg);
    }
    const cv = document.createElement('canvas');
    cv.width = 512; cv.height = 160;
    const x = cv.getContext('2d');
    const grad = x.createLinearGradient(0, 0, 0, 160);
    grad.addColorStop(0, '#3a2c28'); grad.addColorStop(1, '#1c1412');
    x.fillStyle = grad; x.fillRect(0, 0, 512, 160);
    x.strokeStyle = '#ff9a3c'; x.lineWidth = 10; x.strokeRect(6, 6, 500, 148);
    x.fillStyle = '#ffcf6b';
    x.font = 'bold 58px sans-serif';
    x.textAlign = 'center'; x.textBaseline = 'middle';
    x.fillText(text, 256, 84);
    const boardMat = new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(cv) });
    const board = new THREE.Mesh(new THREE.PlaneGeometry(4.4, 1.4), boardMat);
    board.position.set(0, 3.9, 0.08);
    grp.add(board);
    const backMat = Game.mats.metal(0x45464c);
    const back = new THREE.Mesh(new THREE.BoxGeometry(4.4, 1.4, 0.12), backMat);
    back.position.set(0, 3.9, -0.02);
    grp.add(back);
    return grp;
  }
})();
