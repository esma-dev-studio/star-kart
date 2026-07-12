// コース④: オーロラフロスト(id: auroraFrost)
// テーマ: 夜の氷の惑星。STAR KART世界観(宇宙×ネオン)を、極夜のオーロラと
// 発光クリスタルで表現する。白銀の氷原に浮かぶオーロラカーテンと、
// 遠くからでも見える巨大クリスタルスパイアが道しるべになる。
// レイアウト: スタート直線(北向き) → 右スイーパー(t≈0.1-0.25) →
//            登り(0.3-0.43、頂上y=6) → クレスト小ジャンプ → 下り(0.44-0.6) →
//            南ストレート(0.63) → 西のS字(0.74-0.87) → 最終区間(0.91-1.0)
// controlPoints概算全長: 約805ユニット(隣接点距離合計) × 1.05 ≒ 845ユニット
// (スプラインは閉ループでオーバーシュートするため実測はこれよりわずかに長くなる)
// fallZones/gapsは使用しない(落下ハザードなしの設計判断)。
(function () {
  Game.courses = Game.courses || {};

  // ---- ローカル定数(マジックナンバー集約) ----
  const AF = {
    // 装飾配置(路面+路肩の外側オフセット)
    decorOffsetMin: 3,
    decorOffsetJitter: 8,
    maxDecor: 80,

    // オーロラカーテン
    curtainCount: 4,
    curtainWidthMin: 50,
    curtainWidthJitter: 34,
    curtainHeightMin: 42,
    curtainHeightJitter: 14,
    curtainAltMin: 44,     // 配置高度(中心y)下限、上限は+ curtainAltJitter
    curtainAltJitter: 14,
    curtainWaveSpeed: 0.18,
    curtainOpacityAmp: 0.16,

    // クリスタルスパイア(ランドマーク、クレスト外側)
    spireT: 0.435,

    // 発光クリスタル群
    crystalClusterCount: 10,
    crystalShardMin: 2,
    crystalShardMax: 4,
    crystalFlickerSpeed: 0.9,
    crystalFlickerAmp: 0.12,

    // 雪丘・氷塊
    iceCount: 10,
    iceRadiusMin: 1.6,
    iceRadiusMax: 3.4,

    // 凍った湖面(コース内側の空き地、コースから20以上離す)
    lakeCenter: { x: 76, z: 28 },
    lakeRadius: 24,

    // 観客スタンド
    standCount: 3,
    standRows: 3,
    standSeatsPerRow: 12,
    standWidth: 13,
    standRowDepth: 1.35,
    standRowHeight: 1.05,
    standSwaySpeed: 1.5,
    standSwayAmp: 0.045,
    standSpots: [0.015, 0.185, 0.67],

    // 看板(架空ブランド4枚)
    banners: [
      { t: 0.05, side: 1, text: 'STAR KART GP' },
      { t: 0.30, side: -1, text: 'ASTRO GEAR' },
      { t: 0.60, side: 1, text: 'COMET FUEL' },
      { t: 0.87, side: -1, text: 'AURORA FROST' },
    ],

    // 街灯(氷柱ランタン)
    lampCount: 6,
    lampPoleHeight: 4.4,
    lampBobSpeed: 1.0,
    lampBobAmp: 0.1,
  };

  Game.courses.auroraFrost = {
    id: 'auroraFrost',
    displayName: 'オーロラフロスト',
    name: 'オーロラフロスト',
    bgmMood: '夜の氷原を滑るような、きらめくドリーミーなアルペジオ',
    controlPoints: [
      { x: 0,    y: 0,   z: 0,    w: 10 },
      { x: 0,    y: 0,   z: 42,   w: 10 },
      { x: 10,   y: 0,   z: 84,   w: 9.5 },
      { x: 34,   y: 0.5, z: 116,  w: 9.5 },
      { x: 70,   y: 1,   z: 134,  w: 9 },
      { x: 108,  y: 1.5, z: 138,  w: 9 },
      { x: 144,  y: 2.5, z: 124,  w: 9 },
      { x: 168,  y: 4,   z: 96,   w: 9 },
      { x: 180,  y: 5.5, z: 62,   w: 8.5 },
      { x: 178,  y: 6,   z: 26,   w: 8.5 },
      { x: 168,  y: 5,   z: -14,  w: 9 },
      { x: 146,  y: 3.5, z: -46,  w: 9 },
      { x: 112,  y: 2,   z: -62,  w: 9 },
      { x: 74,   y: 1,   z: -70,  w: 9.5 },
      { x: 30,   y: 0.5, z: -88,  w: 9 },
      { x: -8,   y: 0,   z: -96,  w: 9 },
      { x: -44,  y: 0,   z: -104, w: 8.5 },
      { x: -72,  y: 0,   z: -82,  w: 8.5 },
      { x: -80,  y: 0,   z: -48,  w: 9 },
      { x: -66,  y: 0,   z: -18,  w: 9.5 },
      { x: -24,  y: 0,   z: -14,  w: 10 },
    ],
    offroadWidth: 7,
    fogDensity: 0.0034,
    colors: {
      sky: 0x1a2a52, fog: 0x5a76b8, ground: 0x9fc2dc,
      road: '#3e4756', edge: '#eaf8ff', curb: '#7ef0d8',
      centerLine: '#bfe9ff', offroad: 0x8fb4cc,
    },
    lighting: {
      hemiSky: 0x8fb0ff, hemiGround: 0x2c3a56, hemiIntensity: 0.55,
      sunColor: 0xbfd9ff, sunIntensity: 0.75,
      rimColor: 0x66ffd8, exposure: 1.05,
    },
    boostPads: [
      { t0: 0.252, t1: 0.267, l0: -0.55, l1: 0.55 },
      { t0: 0.629, t1: 0.645, l0: -0.55, l1: 0.55 },
    ],
    jumpPads: [
      { t0: 0.430, t1: 0.440, l0: -0.6, l1: 0.6 },
    ],
    itemSpots: [
      { t: 0.1055, l: -0.33 }, { t: 0.1055, l: 0 }, { t: 0.1055, l: 0.33 },
      { t: 0.3457, l: -0.33 }, { t: 0.3457, l: 0 }, { t: 0.3457, l: 0.33 },
      { t: 0.5352, l: -0.33 }, { t: 0.5352, l: 0 }, { t: 0.5352, l: 0.33 },
      { t: 0.7363, l: -0.33 }, { t: 0.7363, l: 0 }, { t: 0.7363, l: 0.33 },
      { t: 0.9121, l: -0.33 }, { t: 0.9121, l: 0 }, { t: 0.9121, l: 0.33 },
    ],

    // ---- テーマ装飾 ----
    decorate(group, course) {
      const s = course.spline;

      // 共有マテリアル(ループ内での再生成を避けるため一度だけ生成)
      const snowMat = Game.mats.matte(0xf3fbff);
      const iceBlockMat = Game.mats.glass(0xcfeeff, 0.85);
      const lakeMat = Game.mats.metal(0x8fd0f0);
      const lampPoleMat = Game.mats.metal(0xc9d6e3);
      const lanternMats = [Game.mats.glow(0xbfe9ff, 1.15), Game.mats.glow(0x9fd8ff, 1.15)];
      const crystalMats = [
        Game.mats.glow(0x7ef0d8, 0.95),  // シアン
        Game.mats.glow(0x8fd6ff, 0.95),  // ミント寄りの水色
        Game.mats.glow(0xb08cff, 0.95),  // バイオレット
      ];

      let decorCount = 0;
      const maxDecor = AF.maxDecor;

      // 決定的疑似乱数(cookie_town.jsと同じ生成式)
      let seed = 8842;
      const rnd = () => {
        seed = (seed * 1103515245 + 12345) & 0x7fffffff;
        return (seed % 10000) / 10000;
      };

      const placeAt = (t, side) => {
        const idx = Math.floor(((t % 1) + 1) % 1 * s.count) % s.count;
        const p = s.pts[idx], n = s.nrm[idx], w = s.w[idx];
        const off = side * (w + course.offroadWidth + AF.decorOffsetMin + rnd() * AF.decorOffsetJitter);
        return {
          x: p.x + n.x * off, y: p.y, z: p.z + n.z * off,
          angle: s.tangentAngle(idx),
        };
      };

      // コース中心(遠景ランドマークやオーロラカーテンの配置基準)
      let cx = 0, cz = 0;
      for (const p of s.pts) { cx += p.x; cz += p.z; }
      cx /= s.count; cz /= s.count;

      // ---- 1. オーロラカーテン(空に浮かぶ半透明グラデーション板) ----
      const auroraTex = makeAuroraTexture();
      const curtains = [];
      for (let i = 0; i < AF.curtainCount; i++) {
        const cw = AF.curtainWidthMin + rnd() * AF.curtainWidthJitter;
        const ch = AF.curtainHeightMin + rnd() * AF.curtainHeightJitter;
        const mat = new THREE.MeshBasicMaterial({
          map: auroraTex, transparent: true, opacity: 0.55,
          blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
          depthWrite: false, fog: false,
        });
        const curtain = new THREE.Mesh(new THREE.PlaneGeometry(cw, ch), mat);
        const a = (i / AF.curtainCount) * Math.PI * 2 + rnd() * 0.7;
        const r = 140 + rnd() * 80;
        curtain.position.set(
          cx + Math.cos(a) * r,
          AF.curtainAltMin + rnd() * AF.curtainAltJitter,
          cz + Math.sin(a) * r
        );
        curtain.rotation.y = a + Math.PI / 2 + (rnd() - 0.5) * 0.5;
        group.add(curtain);
        curtains.push({ mesh: curtain, phase: rnd() * Math.PI * 2, baseOpacity: 0.5 + rnd() * 0.14 });
      }
      group.userData.afCurtains = curtains;

      // ---- 2. 巨大クリスタルスパイア(ランドマーク、クレスト外側) ----
      {
        const idx = Math.floor(AF.spireT * s.count) % s.count;
        const p = s.pts[idx], n = s.nrm[idx], w = s.w[idx];
        // コース中心から遠ざかる向きを外側として選ぶ
        const dPlus = (p.x + n.x * 10 - cx) ** 2 + (p.z + n.z * 10 - cz) ** 2;
        const dMinus = (p.x - n.x * 10 - cx) ** 2 + (p.z - n.z * 10 - cz) ** 2;
        const outSign = dPlus > dMinus ? 1 : -1;
        const off = outSign * (w + course.offroadWidth + AF.decorOffsetMin + 9);
        const spire = buildCrystalSpire();
        spire.position.set(p.x + n.x * off, p.y, p.z + n.z * off);
        spire.rotation.y = s.tangentAngle(idx);
        group.add(spire);
        group.userData.afSpireTop = spire.getObjectByName('spireCrystalTop');
      }

      // ---- 3. 発光クリスタル群(路肩外に点在、地面から生える) ----
      const crystalClusters = [];
      for (let i = 0; i < AF.crystalClusterCount && decorCount < maxDecor; i++) {
        const t = (i + 0.5) / AF.crystalClusterCount;
        const side = i % 2 === 0 ? 1 : -1;
        const at = placeAt(t, side * (0.8 + rnd() * 0.6));
        const mat = crystalMats[i % crystalMats.length];
        const clusterGrp = new THREE.Group();
        const shardCount = AF.crystalShardMin + Math.floor(rnd() * (AF.crystalShardMax - AF.crystalShardMin + 1));
        for (let k = 0; k < shardCount; k++) {
          const h = 1.1 + rnd() * 1.7;
          const r = 0.34 + rnd() * 0.32;
          const geo = k % 2 === 0 ? new THREE.ConeGeometry(r, h, 6) : new THREE.OctahedronGeometry(r * 0.95, 0);
          const shard = new THREE.Mesh(geo, mat);
          const ang = rnd() * Math.PI * 2;
          const dist = rnd() * 0.55;
          shard.position.set(Math.cos(ang) * dist, h * 0.42, Math.sin(ang) * dist);
          shard.rotation.set((rnd() - 0.5) * 0.3, rnd() * Math.PI, (rnd() - 0.5) * 0.3);
          clusterGrp.add(shard);
        }
        clusterGrp.position.set(at.x, at.y, at.z);
        group.add(clusterGrp);
        crystalClusters.push({ mesh: clusterGrp, phase: rnd() * Math.PI * 2 });
        decorCount++;
      }
      group.userData.afCrystalClusters = crystalClusters;

      // ---- 4. 雪丘・氷塊 ----
      for (let i = 0; i < AF.iceCount && decorCount < maxDecor; i++) {
        const t = (0.02 + (i / AF.iceCount) * 0.97) % 1;
        const side = (i % 2 === 0 ? 1 : -1) * (0.7 + rnd() * 0.5);
        const at = placeAt(t, side);
        const r = AF.iceRadiusMin + rnd() * (AF.iceRadiusMax - AF.iceRadiusMin);
        let deco;
        if (i % 2 === 0) {
          // 雪丘(白い半球)
          deco = new THREE.Mesh(new THREE.SphereGeometry(r, 10, 8, 0, Math.PI * 2, 0, Math.PI / 2), snowMat);
        } else {
          // 角の丸い氷塊(低ポリゴンの正二十面体で丸みを表現)
          deco = new THREE.Mesh(new THREE.IcosahedronGeometry(r * 0.85, 0), iceBlockMat);
          deco.rotation.set(rnd() * Math.PI, rnd() * Math.PI, rnd() * Math.PI);
        }
        deco.position.set(at.x, at.y, at.z);
        group.add(deco);
        decorCount++;
      }

      // ---- 5. 凍った湖面(コース内側の空き地、コースから20以上離れた平面) ----
      {
        const lake = new THREE.Mesh(new THREE.CircleGeometry(AF.lakeRadius, 40), lakeMat);
        lake.rotation.x = -Math.PI / 2;
        lake.position.set(AF.lakeCenter.x, 0.03, AF.lakeCenter.z);
        group.add(lake);
      }

      // ---- 6. 観客スタンド ----
      const stands = [];
      for (let si = 0; si < AF.standCount; si++) {
        const t = AF.standSpots[si % AF.standSpots.length];
        const side = si % 2 === 0 ? 1 : -1;
        const at = placeAt(t, side * 0.6);
        const stand = buildGrandstand(si);
        stand.position.set(at.x, at.y, at.z);
        stand.rotation.y = at.angle + (side > 0 ? Math.PI / 2 : -Math.PI / 2);
        group.add(stand);
        stands.push(stand);
      }
      group.userData.afStands = stands;

      // ---- 7. 看板(架空ブランド4枚) ----
      for (const b of AF.banners) {
        const idx = Math.floor(b.t * s.count) % s.count;
        const p = s.pts[idx], n = s.nrm[idx], w = s.w[idx];
        const off = b.side * (w + course.offroadWidth + AF.decorOffsetMin + 2);
        const board = buildBillboard(b.text);
        board.position.set(p.x + n.x * off, p.y, p.z + n.z * off);
        board.rotation.y = s.tangentAngle(idx) + (b.side > 0 ? -Math.PI / 2 : Math.PI / 2);
        group.add(board);
      }

      // ---- 8. 街灯(氷柱ランタン) ----
      const lamps = [];
      for (let i = 0; i < AF.lampCount; i++) {
        const t = (i / AF.lampCount + 0.03) % 1;
        const side = i % 2 === 0 ? -1 : 1;
        const at = placeAt(t, side * 0.55);
        const lanternMat = lanternMats[i % lanternMats.length];
        const lampGrp = new THREE.Group();
        const pole = new THREE.Mesh(
          new THREE.CylinderGeometry(0.15, 0.19, AF.lampPoleHeight, 8), lampPoleMat
        );
        pole.position.y = AF.lampPoleHeight / 2;
        lampGrp.add(pole);
        // ランタン本体(氷柱を束ねた形、上向きの尖塔3本+中心コア)
        for (let k = 0; k < 3; k++) {
          const ang = (k / 3) * Math.PI * 2;
          const shard = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.85, 6), lanternMat);
          shard.position.set(Math.cos(ang) * 0.16, AF.lampPoleHeight + 0.42, Math.sin(ang) * 0.16);
          lampGrp.add(shard);
        }
        const core = new THREE.Mesh(new THREE.OctahedronGeometry(0.32, 0), lanternMat);
        core.position.y = AF.lampPoleHeight + 0.55;
        core.name = 'lanternCore';
        lampGrp.add(core);
        // 足元の路面をほんのり照らす点光源(コース全体でここが唯一の発光源、6個・distance9で予算内)
        const lampLight = new THREE.PointLight(i % 2 === 0 ? 0xbfe9ff : 0x9fd8ff, 0.6, 9, 2);
        lampLight.position.set(0, AF.lampPoleHeight + 0.55, 0);
        lampGrp.add(lampLight);
        lampGrp.position.set(at.x, at.y, at.z);
        group.add(lampGrp);
        lamps.push(lampGrp);
      }
      group.userData.afLamps = lamps;
    },

    // 見た目のみのフック(物理・スプラインには影響させない)。
    // decorate()でgroup.userDataに保存した参照をたどってアニメーションさせる。
    animate(time, group) {
      // オーロラカーテン: ゆっくり波打つ(不透明度+わずかな傾きの微振動)
      const curtains = group.userData.afCurtains;
      if (curtains) {
        for (const c of curtains) {
          c.mesh.material.opacity = c.baseOpacity + Math.sin(time * AF.curtainWaveSpeed + c.phase) * AF.curtainOpacityAmp;
          c.mesh.rotation.z = Math.sin(time * AF.curtainWaveSpeed * 0.7 + c.phase * 1.3) * 0.06;
        }
      }

      // クリスタルスパイア頂部: ゆっくり回転+わずかなスケール脈動
      const spireTop = group.userData.afSpireTop;
      if (spireTop) {
        spireTop.rotation.y = time * 0.25;
        const sc = 1 + Math.sin(time * 0.8) * 0.05;
        spireTop.scale.set(sc, 1, sc);
      }

      // 発光クリスタル群: スケールの微振動で明滅させる(emissiveIntensityは変更しない)
      const crystalClusters = group.userData.afCrystalClusters;
      if (crystalClusters) {
        for (const c of crystalClusters) {
          const sc = 1 + Math.sin(time * AF.crystalFlickerSpeed + c.phase) * AF.crystalFlickerAmp;
          c.mesh.scale.set(sc, sc, sc);
        }
      }

      // 観客スタンドを歓声で揺らす
      const stands = group.userData.afStands;
      if (stands) {
        for (let si = 0; si < stands.length; si++) {
          stands[si].rotation.z = Math.sin(time * AF.standSwaySpeed + si * 1.3) * AF.standSwayAmp;
        }
      }

      // 氷柱ランタンの発光コアをゆっくり回転+上下
      const lamps = group.userData.afLamps;
      if (lamps) {
        for (let i = 0; i < lamps.length; i++) {
          const core = lamps[i].getObjectByName('lanternCore');
          if (!core) continue;
          core.rotation.y = time * 0.5 + i;
          core.position.y = AF.lampPoleHeight + 0.55 + Math.sin(time * AF.lampBobSpeed + i) * AF.lampBobAmp;
        }
      }
    },
  };

  // オーロラのグラデーションテクスチャ
  // 縦: 緑→シアン→紫のカーテン色。横: 「襞」の光柱パターン+左右端のフェードを
  // destination-inでアルファに焼き込む。これが無いと板ポリの直線エッジが見えて
  // 「光のカーテン」ではなく壁のようなスラブに見えてしまう
  function makeAuroraTexture() {
    const cv = document.createElement('canvas');
    cv.width = 256; cv.height = 256;
    const x = cv.getContext('2d');
    const grad = x.createLinearGradient(0, 0, 0, 256);
    grad.addColorStop(0.00, 'rgba(111,255,176,0)');
    grad.addColorStop(0.16, 'rgba(111,255,176,0.85)');
    grad.addColorStop(0.42, 'rgba(126,240,216,0.80)');
    grad.addColorStop(0.66, 'rgba(126,240,216,0.55)');
    grad.addColorStop(0.84, 'rgba(176,140,255,0.60)');
    grad.addColorStop(1.00, 'rgba(176,140,255,0)');
    x.fillStyle = grad;
    x.fillRect(0, 0, 256, 256);
    // 襞: アルファ強弱の縦柱をランダム幅で並べる(決定的LCG)
    let seed = 4649;
    const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return (seed % 10000) / 10000; };
    const alpha = x.createLinearGradient(0, 0, 256, 0);
    alpha.addColorStop(0, 'rgba(0,0,0,0)');
    let p = 0.06;
    while (p < 0.94) {
      alpha.addColorStop(p, `rgba(0,0,0,${(0.25 + rnd() * 0.75).toFixed(2)})`);
      p += 0.04 + rnd() * 0.09;
    }
    alpha.addColorStop(1, 'rgba(0,0,0,0)');
    x.globalCompositeOperation = 'destination-in';
    x.fillStyle = alpha;
    x.fillRect(0, 0, 256, 256);
    x.globalCompositeOperation = 'source-over';
    const tex = new THREE.CanvasTexture(cv);
    tex.wrapS = THREE.ClampToEdgeWrapping;
    tex.wrapT = THREE.ClampToEdgeWrapping;
    return tex;
  }

  // ランドマーク: 巨大な発光クリスタルスパイア(氷の台座+多段の尖塔+周囲の小クリスタル)
  // コースのどこからでも方角の目印になるよう、高さ20を大きく超える塔にする。
  function buildCrystalSpire() {
    const grp = new THREE.Group();
    const baseMat = Game.mats.glass(0x9fe8ff, 0.55);
    const glowMat = Game.mats.glow(0x7ef0d8, 0.8);
    const glowMat2 = Game.mats.glow(0xb08cff, 0.75);

    // 氷の台座
    const base = new THREE.Mesh(new THREE.OctahedronGeometry(4.2, 0), baseMat);
    base.position.y = 3.2;
    base.scale.y = 0.6;
    grp.add(base);

    // 多段の尖塔(下から積み上げ、最上段のみ発光)
    const segHeights = [14, 9, 5];
    let y = 6.4;
    for (let i = 0; i < segHeights.length; i++) {
      const h = segHeights[i];
      const r = 3.4 - i * 1.0;
      const isTop = i === segHeights.length - 1;
      const cone = new THREE.Mesh(new THREE.ConeGeometry(r, h, 6), isTop ? glowMat : baseMat);
      cone.position.y = y + h / 2;
      if (isTop) cone.name = 'spireCrystalTop';
      grp.add(cone);
      y += h;
    }

    // 周囲を飾る小さな発光クリスタル(4本)
    for (let i = 0; i < 4; i++) {
      const ang = (i / 4) * Math.PI * 2;
      const shard = new THREE.Mesh(new THREE.OctahedronGeometry(1.1, 0), i % 2 === 0 ? glowMat : glowMat2);
      shard.position.set(Math.cos(ang) * 3.6, 4.6, Math.sin(ang) * 3.6);
      shard.rotation.y = ang;
      grp.add(shard);
    }
    return grp;
  }

  // 観客スタンド(段状ボックス+InstancedMeshの観客球、防寒カラー: 青/白/ミント系)
  function buildGrandstand(seed) {
    const grp = new THREE.Group();
    const frameMat = Game.mats.matte(0xdcecf5);
    for (let r = 0; r < AF.standRows; r++) {
      const step = new THREE.Mesh(
        new THREE.BoxGeometry(AF.standWidth, AF.standRowHeight, AF.standRowDepth),
        frameMat
      );
      step.position.set(0, AF.standRowHeight * (r + 0.5), -r * AF.standRowDepth * 1.35);
      grp.add(step);
    }
    const seatCount = AF.standRows * AF.standSeatsPerRow;
    const seatGeo = new THREE.SphereGeometry(0.32, 7, 6);
    const seatMat = Game.mats.matte(0xffffff);
    const inst = new THREE.InstancedMesh(seatGeo, seatMat, seatCount);
    const dummy = new THREE.Object3D();
    const hues = [0x63c6ff, 0x7ef0d8, 0xffffff, 0xb08cff, 0x9fd8ff];
    let k = 0;
    let lseed = 4200 + seed * 61;
    const lrnd = () => { lseed = (lseed * 1103515245 + 12345) & 0x7fffffff; return (lseed % 10000) / 10000; };
    for (let r = 0; r < AF.standRows; r++) {
      for (let c = 0; c < AF.standSeatsPerRow; c++) {
        const px = (c / (AF.standSeatsPerRow - 1) - 0.5) * (AF.standWidth - 1.2);
        const py = AF.standRowHeight * (r + 1) + 0.32;
        const pz = -r * AF.standRowDepth * 1.35 + (lrnd() - 0.5) * 0.3;
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

  // オリジナル架空ブランドの看板(Canvas文字、氷テーマ配色)
  function buildBillboard(text) {
    const grp = new THREE.Group();
    const legMat = Game.mats.metal(0xcfd8e6);
    for (const lx of [-1.6, 1.6]) {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 3.4, 8), legMat);
      leg.position.set(lx, 1.7, 0);
      grp.add(leg);
    }
    const cv = document.createElement('canvas');
    cv.width = 512; cv.height = 160;
    const x = cv.getContext('2d');
    const grad = x.createLinearGradient(0, 0, 0, 160);
    grad.addColorStop(0, '#eaf8ff'); grad.addColorStop(1, '#bfe9ff');
    x.fillStyle = grad; x.fillRect(0, 0, 512, 160);
    x.strokeStyle = '#3e4756'; x.lineWidth = 10; x.strokeRect(6, 6, 500, 148);
    x.fillStyle = '#1a2a52';
    x.font = 'bold 56px sans-serif';
    x.textAlign = 'center'; x.textBaseline = 'middle';
    x.fillText(text, 256, 84);
    const boardMat = new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(cv) });
    const board = new THREE.Mesh(new THREE.PlaneGeometry(4.4, 1.4), boardMat);
    board.position.set(0, 3.9, 0.08);
    grp.add(board);
    const backMat = Game.mats.matte(0x2c3a56);
    const back = new THREE.Mesh(new THREE.BoxGeometry(4.4, 1.4, 0.12), backMat);
    back.position.set(0, 3.9, -0.02);
    grp.add(back);
    return grp;
  }
})();
