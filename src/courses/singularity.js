// コース⑦: シンギュラリティ(id: singularity)★5
// テーマ: 事象の地平線。ブラックホールの縁に敷かれた暗黒のレース場。
// レイアウト: スタート(北向き) → 右カーブ → 3連ヘアピン地帯(t0.19-0.39、幅7の狭路、高度0→6.2) →
//            高所の下りレグが戻り路の真上を跨ぐ(t0.445-0.48、橋脚自動) →
//            ジャンプ台(t0.502)→ギャップ1(t0.513-0.526) → 南西の大スイープ下り(t0.55-0.68) →
//            南ストレートでジャンプ台(t0.7285)→ギャップ2(t0.7395-0.7524) → 北へ戻る狭路(t0.79-0.97)
// 全長1005の最長・最難コース。落下ゾーン2区間(t0.3856-0.531 / t0.7088-0.7574)は路肩セーフティなし。
// controlPoints・ゾーンt値は実バリデータ検証済みの凍結値(変更禁止)。
(function () {
  Game.courses = Game.courses || {};

  // ---- ローカル定数(マジックナンバー集約) ----
  const SG = {
    decorOffsetMin: 4,
    decorOffsetJitter: 6,

    // 落下ゾーン(地上物の配置禁止区間)
    fallZones: [[0.3856, 0.531], [0.7088, 0.7574]],

    // 1) 特異点(ランドマーク: 黒球+降着円盤)
    holePos: { x: -15, y: 16, z: -125 },
    holeRadius: 10,
    diskRadii: [13, 16],
    diskSpinSpeeds: [0.35, -0.22],

    // 2) 重力レンズ光条(黒球の周囲の湾曲光)
    lensArcCount: 4,

    // 3) ダーククリスタルスパイク(序盤〜ヘアピン地帯の路肩)
    spikeSpots: [0.02, 0.06, 0.10, 0.16, 0.21, 0.26, 0.30, 0.34, 0.365],
    spikeHeightMin: 3.2,
    spikeHeightMax: 6.5,

    // 4) ギャップ警告ビーコン(各ジャンプ台手前に2対ずつ)
    beaconSpots: [0.49, 0.497, 0.716, 0.723],
    beaconLat: 0.95,

    // 5) ワープした星の光跡(空の流線)
    streakCount: 6,

    // 6) 観客スタンド(遮蔽シェルター風)
    standSpots: [0.03, 0.60],
    standRows: 3,
    standSeatsPerRow: 12,
    standWidth: 13,
    standRowDepth: 1.35,
    standRowHeight: 1.05,
    standSwaySpeed: 1.4,
    standSwayAmp: 0.045,

    // 7) 看板(全て落下ゾーン外)
    billboards: [
      { t: 0.05, side: 1, text: 'SINGULARITY' },
      { t: 0.3652, side: -1, text: 'ASTRO GEAR' },
      { t: 0.6816, side: 1, text: 'NOVA TIRES' },
      { t: 0.84, side: -1, text: 'STAR KART GP' },
    ],

    // 8) 街灯(イベントホライズン灯。落下ゾーン外のみ)
    lampSpots: [0.01, 0.09, 0.57, 0.63, 0.80, 0.93],
    lampPoleHeight: 4.4,
    lampBobSpeed: 1.0,
    lampBobAmp: 0.08,
  };

  const controlPoints = [
    { x: 0, y: 0, z: 0, w: 8 },
    { x: 0, y: 0, z: 36, w: 8 },
    { x: 10, y: 0, z: 70, w: 7.5 },
    { x: 36, y: 0, z: 96, w: 7.5 },
    { x: 70, y: 0.5, z: 100, w: 7.5 },
    { x: 96, y: 1, z: 92, w: 7 },
    { x: 106, y: 1.5, z: 74, w: 7 },
    { x: 96, y: 2, z: 58, w: 7 },
    { x: 64, y: 2.5, z: 52, w: 7 },
    { x: 34, y: 3, z: 46, w: 7 },
    { x: 30, y: 3.5, z: 30, w: 7 },
    { x: 40, y: 4, z: 12, w: 7 },
    { x: 68, y: 4.5, z: 8, w: 7 },
    { x: 92, y: 5, z: 4, w: 7 },
    { x: 108, y: 5.5, z: -14, w: 7 },
    { x: 96, y: 6.2, z: -32, w: 7 },
    { x: 64, y: 7, z: -40, w: 7.5 },
    { x: 30, y: 6.8, z: -52, w: 7.5 },
    { x: 0, y: 5.4, z: -64, w: 7.5 },
    { x: -34, y: 4, z: -76, w: 7.5 },
    { x: -64, y: 3, z: -92, w: 7.5 },
    { x: -86, y: 1.5, z: -116, w: 8 },
    { x: -92, y: 0, z: -146, w: 8 },
    { x: -78, y: 0, z: -176, w: 8 },
    { x: -46, y: 0, z: -192, w: 8.5 },
    { x: -12, y: 0, z: -194, w: 8.5 },
    { x: 22, y: 0, z: -186, w: 8 },
    { x: 46, y: 0, z: -166, w: 8 },
    { x: 58, y: 0.5, z: -136, w: 7.5 },
    { x: 54, y: 1, z: -104, w: 7.5 },
    { x: 38, y: 0.3, z: -76, w: 7.5 },
    { x: 18, y: 0, z: -50, w: 8 },
    { x: 10, y: 0, z: -24, w: 8 },
  ];

  Game.courses.singularity = {
    id: 'singularity',
    displayName: 'シンギュラリティ',
    name: 'シンギュラリティ',
    bgmMood: '事象の地平線ギリギリを攻める、緊迫のダークテクノ',
    controlPoints,
    offroadWidth: 7,
    fogDensity: 0.0033,
    clouds: false, // ブラックホールの空に雲は出さない(星の光跡が空の主役)
    colors: {
      sky: 0x0a0a16, fog: 0x2a2440, ground: 0x16121f,
      road: '#343040', edge: '#f0e8ff', curb: '#ff4a6a',
      centerLine: '#ffd94a', offroad: 0x241f33,
    },
    lighting: {
      hemiSky: 0x4a3a72, hemiGround: 0x0a0814, hemiIntensity: 0.48,
      sunColor: 0x8a6aff, sunIntensity: 0.8,
      rimColor: 0xff4a6a, exposure: 1.1,
    },
    boostPads: [
      { t0: 0.6172, t1: 0.625, l0: -0.55, l1: 0.55 },
      { t0: 0.7852, t1: 0.7931, l0: -0.55, l1: 0.55 },
    ],
    jumpPads: [
      { t0: 0.502, t1: 0.508 },
      { t0: 0.7285, t1: 0.7345 },
    ],
    gaps: [
      { t0: 0.513, t1: 0.526 },
      // 幅10u。13uだと露出警戒で減速したAI(射出22)が渡りきれず無限ループした
      { t0: 0.7395, t1: 0.7495 },
    ],
    fallZones: [
      // 橋の跨ぎ〜ギャップ1着地まで(3連ヘアピン自体は路肩を残す。
      // ヘアピン+露出の複合はAIも人も落下が多すぎた)
      { t0: 0.435, t1: 0.531 },
      // ギャップ2の露出は「ジャンプ台開始〜着地直後」だけに絞る。
      // (a) 露出開始がパッドより手前だとAIの露出警戒がジャンプ進入前に減速して
      //     渡りきれず無限ループする (b) 着地後の左カーブの外側膨らみは路肩で受ける
      // (実測: 全落下が x-29〜+10, z-192〜-202 のギャップ前後に集中していた)
      { t0: 0.7285, t1: 0.7534 },
    ],
    itemSpots: [
      { t: 0.0723, l: -0.33 }, { t: 0.0723, l: 0 }, { t: 0.0723, l: 0.33 },
      { t: 0.2441, l: -0.33 }, { t: 0.2441, l: 0 }, { t: 0.2441, l: 0.33 },
      { t: 0.3418, l: -0.33 }, { t: 0.3418, l: 0 }, { t: 0.3418, l: 0.33 },
      { t: 0.584, l: -0.33 }, { t: 0.584, l: 0 }, { t: 0.584, l: 0.33 },
      { t: 0.8828, l: -0.33 }, { t: 0.8828, l: 0 }, { t: 0.8828, l: 0.33 },
    ],

    // ---- テーマ装飾 ----
    decorate(group, course) {
      const s = course.spline;
      let decorCount = 0;
      const maxDecor = 90;

      // 決定的疑似乱数(LCG)
      let seed = 9407;
      const rnd = () => {
        seed = (seed * 1103515245 + 12345) & 0x7fffffff;
        return (seed % 10000) / 10000;
      };

      const placeAt = (t, side) => {
        const idx = Math.floor(((t % 1) + 1) % 1 * s.count) % s.count;
        const p = s.pts[idx], n = s.nrm[idx], w = s.w[idx];
        const off = side * (w + course.offroadWidth + SG.decorOffsetMin + rnd() * SG.decorOffsetJitter);
        return {
          x: p.x + n.x * off, y: p.y, z: p.z + n.z * off,
          angle: s.tangentAngle(idx),
        };
      };

      // ---- 1) 特異点(黒球+降着円盤2本。コース中央の空洞、路肩から50以上の離隔は設計済み) ----
      {
        const hole = new THREE.Group();
        // 完全な黒の球(光を飲み込む見た目のためMeshBasicMaterialの黒)
        const sphere = new THREE.Mesh(
          new THREE.SphereGeometry(SG.holeRadius, 24, 18),
          new THREE.MeshBasicMaterial({ color: 0x000000 })
        );
        hole.add(sphere);
        // 降着円盤(色違い2本、animateで異なる速度・軸回転)
        const diskMats = [Game.mats.glow(0xff4a6a, 1.2), Game.mats.glow(0xffd94a, 1.0)];
        const disks = [];
        for (let i = 0; i < 2; i++) {
          const disk = new THREE.Mesh(
            new THREE.TorusGeometry(SG.diskRadii[i], 0.45 - i * 0.12, 8, 48),
            diskMats[i]
          );
          disk.rotation.x = Math.PI / 2 + (i === 0 ? 0.35 : -0.2);
          hole.add(disk);
          disks.push(disk);
        }
        // 重力レンズ光条(湾曲した光の弧、加算合成)
        const lensMat = new THREE.MeshBasicMaterial({
          color: 0x9a8aff, transparent: true, opacity: 0.35,
          blending: THREE.AdditiveBlending, depthWrite: false, fog: false,
        });
        for (let i = 0; i < SG.lensArcCount; i++) {
          const arc = new THREE.Mesh(
            new THREE.TorusGeometry(SG.holeRadius + 2.5 + i * 1.6, 0.16, 6, 40, Math.PI * (0.5 + rnd() * 0.5)),
            lensMat
          );
          arc.rotation.set(rnd() * Math.PI, rnd() * Math.PI, rnd() * Math.PI);
          hole.add(arc);
        }
        hole.position.set(SG.holePos.x, SG.holePos.y, SG.holePos.z);
        group.add(hole);
        group.userData.sgDisks = disks;
        decorCount += 3 + SG.lensArcCount;
      }

      // ---- 3) ダーククリスタルスパイク(序盤〜ヘアピン地帯の路肩) ----
      const spikeMat = Game.mats.matte(0x1a1226);
      const spikeTipMat = Game.mats.glow(0x8a6aff, 0.9);
      for (let i = 0; i < SG.spikeSpots.length && decorCount < maxDecor; i++) {
        const side = i % 2 === 0 ? 1 : -1;
        const at = placeAt(SG.spikeSpots[i], side * (0.75 + rnd() * 0.5));
        const h = SG.spikeHeightMin + rnd() * (SG.spikeHeightMax - SG.spikeHeightMin);
        const spike = new THREE.Mesh(new THREE.ConeGeometry(h * 0.22, h, 6), spikeMat);
        spike.position.set(at.x, at.y + h / 2, at.z);
        spike.rotation.y = rnd() * Math.PI;
        spike.rotation.z = (rnd() - 0.5) * 0.16;
        group.add(spike);
        const tip = new THREE.Mesh(new THREE.ConeGeometry(h * 0.07, h * 0.24, 6), spikeTipMat);
        tip.position.set(at.x, at.y + h * 0.96, at.z);
        group.add(tip);
        decorCount += 2;
      }

      // ---- 4) ギャップ警告ビーコン(各ジャンプ台手前の路肩に発光ポール) ----
      const beacons = [];
      const beaconMat = Game.mats.glow(0xffd94a, 1.3);
      for (const t of SG.beaconSpots) {
        for (const side of [-1, 1]) {
          const idx = Math.floor(t * s.count) % s.count;
          const p = s.pts[idx], n = s.nrm[idx], w = s.w[idx];
          const off = side * w * SG.beaconLat;
          const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 2.6, 6), beaconMat);
          pole.position.set(p.x + n.x * off, p.y + 1.3, p.z + n.z * off);
          group.add(pole);
          beacons.push(pole);
          decorCount++;
        }
      }
      group.userData.sgBeacons = beacons;

      // ---- 5) ワープした星の光跡(黒球へ吸い込まれる流線) ----
      const streakTex = makeStreakTexture();
      const streaks = [];
      for (let i = 0; i < SG.streakCount; i++) {
        const mat = new THREE.MeshBasicMaterial({
          map: streakTex, transparent: true, opacity: 0.5,
          blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
          depthWrite: false, fog: false,
        });
        const len = 26 + rnd() * 22;
        const streak = new THREE.Mesh(new THREE.PlaneGeometry(len, 1.1 + rnd() * 0.8), mat);
        // 黒球を中心とした円周上に配置し、面を球へ向ける(吸い込まれる向き)
        const a = (i / SG.streakCount) * Math.PI * 2 + rnd() * 0.5;
        const r = 55 + rnd() * 55;
        streak.position.set(
          SG.holePos.x + Math.cos(a) * r,
          30 + rnd() * 20,
          SG.holePos.z + Math.sin(a) * r
        );
        streak.rotation.y = -a; // 長軸が球方向を向くように
        streak.rotation.z = (rnd() - 0.5) * 0.4;
        group.add(streak);
        streaks.push({ mesh: streak, phase: rnd() * Math.PI * 2, baseOpacity: 0.35 + rnd() * 0.25 });
      }
      group.userData.sgStreaks = streaks;

      // ---- 6) 観客スタンド(遮蔽シェルター風) ----
      const stands = [];
      for (let si = 0; si < SG.standSpots.length; si++) {
        const side = si % 2 === 0 ? 1 : -1;
        const at = placeAt(SG.standSpots[si], side * 0.7);
        const stand = buildHorizonStand(SG, si);
        stand.position.set(at.x, at.y, at.z);
        stand.rotation.y = at.angle + (side > 0 ? Math.PI / 2 : -Math.PI / 2);
        group.add(stand);
        stands.push(stand);
      }
      group.userData.sgStands = stands;

      // ---- 7) 看板(黒金属+クリムゾンネオン) ----
      for (const b of SG.billboards) {
        const idx = Math.floor(b.t * s.count) % s.count;
        const p = s.pts[idx], n = s.nrm[idx], w = s.w[idx];
        const off = b.side * (w + course.offroadWidth + SG.decorOffsetMin + 2);
        const board = buildHorizonBillboard(b.text);
        board.position.set(p.x + n.x * off, p.y, p.z + n.z * off);
        board.rotation.y = s.tangentAngle(idx) + (b.side > 0 ? -Math.PI / 2 : Math.PI / 2);
        group.add(board);
      }

      // ---- 8) 街灯(イベントホライズン灯。落下ゾーン外のみ) ----
      const lamps = [];
      const lampPoleMat = Game.mats.metal(0x3f3852);
      for (let i = 0; i < SG.lampSpots.length && decorCount < maxDecor; i++) {
        const side = i % 2 === 0 ? -1 : 1;
        const at = placeAt(SG.lampSpots[i], side * 0.55);
        const lampGrp = new THREE.Group();
        const pole = new THREE.Mesh(
          new THREE.CylinderGeometry(0.13, 0.17, SG.lampPoleHeight, 8), lampPoleMat
        );
        pole.position.y = SG.lampPoleHeight / 2;
        lampGrp.add(pole);
        const core = new THREE.Mesh(
          new THREE.OctahedronGeometry(0.4, 0),
          Game.mats.glow(i % 2 === 0 ? 0xff4a6a : 0xffd94a, 1.2)
        );
        core.position.y = SG.lampPoleHeight + 0.5;
        core.name = 'lampCore';
        lampGrp.add(core);
        const light = new THREE.PointLight(i % 2 === 0 ? 0xff4a6a : 0xffd94a, 0.55, 9, 2);
        light.position.copy(core.position);
        lampGrp.add(light);
        lampGrp.position.set(at.x, at.y, at.z);
        group.add(lampGrp);
        lamps.push(lampGrp);
        decorCount += 2;
      }
      group.userData.sgLamps = lamps;
    },

    // 見た目のみのフック(物理・スプラインに影響させない)
    animate(time, group) {
      // 降着円盤: 異なる速度で回転(傾き軸まわり)
      const disks = group.userData.sgDisks;
      if (disks) {
        for (let i = 0; i < disks.length; i++) {
          disks[i].rotation.z = time * SG.diskSpinSpeeds[i];
        }
      }

      // ギャップビーコン: 速い脈動で「跳ぶ場所」を主張
      const beacons = group.userData.sgBeacons;
      if (beacons) {
        const sc = 1 + Math.sin(time * 3.4) * 0.12;
        for (const b of beacons) b.scale.set(sc, 1, sc);
      }

      // 星の光跡: ゆっくり明滅
      const streaks = group.userData.sgStreaks;
      if (streaks) {
        for (const st of streaks) {
          st.mesh.material.opacity = st.baseOpacity + Math.sin(time * 0.5 + st.phase) * 0.15;
        }
      }

      // スタンドの歓声揺れ
      const stands = group.userData.sgStands;
      if (stands) {
        for (let si = 0; si < stands.length; si++) {
          stands[si].rotation.z = Math.sin(time * SG.standSwaySpeed + si * 1.3) * SG.standSwayAmp;
        }
      }

      // イベントホライズン灯のコア回転+上下
      const lamps = group.userData.sgLamps;
      if (lamps) {
        for (let i = 0; i < lamps.length; i++) {
          const core = lamps[i].getObjectByName('lampCore');
          if (!core) continue;
          core.rotation.y = time * 0.6 + i;
          core.position.y = SG.lampPoleHeight + 0.5 + Math.sin(time * SG.lampBobSpeed + i) * SG.lampBobAmp;
        }
      }
    },
  };

  // 流線テクスチャ(中央が明るい横グラデの線)
  function makeStreakTexture() {
    const cv = document.createElement('canvas');
    cv.width = 128; cv.height = 16;
    const x = cv.getContext('2d');
    const grad = x.createLinearGradient(0, 0, 128, 0);
    grad.addColorStop(0, 'rgba(154,138,255,0)');
    grad.addColorStop(0.5, 'rgba(240,232,255,0.9)');
    grad.addColorStop(1, 'rgba(255,74,106,0)');
    x.fillStyle = grad;
    x.fillRect(0, 0, 128, 16);
    return new THREE.CanvasTexture(cv);
  }

  // 観客スタンド(遮蔽シェルター風: 屋根付き、ダークグレー/クリムゾン)
  function buildHorizonStand(cfg, seed) {
    const grp = new THREE.Group();
    const frameMat = Game.mats.matte(0x241f30);
    for (let r = 0; r < cfg.standRows; r++) {
      const step = new THREE.Mesh(
        new THREE.BoxGeometry(cfg.standWidth, cfg.standRowHeight, cfg.standRowDepth),
        frameMat
      );
      step.position.set(0, cfg.standRowHeight * (r + 0.5), -r * cfg.standRowDepth * 1.35);
      grp.add(step);
    }
    // 遮蔽屋根(特異点から観客を守るシェルター意匠)
    const roof = new THREE.Mesh(
      new THREE.BoxGeometry(cfg.standWidth + 1.4, 0.3, cfg.standRows * cfg.standRowDepth * 1.5),
      Game.mats.metal(0x3f3852)
    );
    roof.position.set(0, cfg.standRowHeight * cfg.standRows + 2.1, -cfg.standRows * cfg.standRowDepth * 0.6);
    grp.add(roof);
    const seatCount = cfg.standRows * cfg.standSeatsPerRow;
    const seatGeo = new THREE.SphereGeometry(0.32, 7, 6);
    const seatMat = Game.mats.matte(0xffffff);
    const inst = new THREE.InstancedMesh(seatGeo, seatMat, seatCount);
    const dummy = new THREE.Object3D();
    const hues = [0xff4a6a, 0x3f3852, 0x8a6aff, 0xd8d2e8, 0xffd94a];
    let k = 0;
    let lseed = 8800 + seed * 61;
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

  // 看板(Canvas文字、黒金属+クリムゾンネオン)
  function buildHorizonBillboard(text) {
    const grp = new THREE.Group();
    const legMat = Game.mats.metal(0x3f3852);
    for (const lx of [-1.6, 1.6]) {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 3.4, 8), legMat);
      leg.position.set(lx, 1.7, 0);
      grp.add(leg);
    }
    const cv = document.createElement('canvas');
    cv.width = 512; cv.height = 160;
    const x = cv.getContext('2d');
    const grad = x.createLinearGradient(0, 0, 0, 160);
    grad.addColorStop(0, '#1c1626'); grad.addColorStop(1, '#0a0a16');
    x.fillStyle = grad; x.fillRect(0, 0, 512, 160);
    x.strokeStyle = '#ff4a6a'; x.lineWidth = 10; x.strokeRect(6, 6, 500, 148);
    x.fillStyle = '#ffd94a';
    x.font = 'bold 54px sans-serif';
    x.textAlign = 'center'; x.textBaseline = 'middle';
    x.fillText(text, 256, 84);
    const boardMat = new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(cv) });
    const board = new THREE.Mesh(new THREE.PlaneGeometry(4.4, 1.4), boardMat);
    board.position.set(0, 3.9, 0.08);
    grp.add(board);
    const backMat = Game.mats.matte(0x241f30);
    const back = new THREE.Mesh(new THREE.BoxGeometry(4.4, 1.4, 0.12), backMat);
    back.position.set(0, 3.9, -0.02);
    grp.add(back);
    return grp;
  }
})();
