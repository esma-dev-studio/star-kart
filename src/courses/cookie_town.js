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
      const houseMat = new THREE.MeshLambertMaterial({ map: houseTex });
      const roofMat = new THREE.MeshLambertMaterial({ color: 0xb5652f });
      const archMat = new THREE.MeshLambertMaterial({ color: 0xe0b27a });
      const archDotMat = new THREE.MeshLambertMaterial({ color: 0x6b3a20 });
      const poleMat = new THREE.MeshLambertMaterial({ color: 0xf6e2c4 });
      const sugarMat = new THREE.MeshLambertMaterial({ color: 0xfffaf0 });

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
        const candy = new THREE.Mesh(
          new THREE.SphereGeometry(CT.candyRadius, 10, 8),
          new THREE.MeshLambertMaterial({ color: i % 2 === 0 ? 0xff6fa0 : 0x63c6ff })
        );
        candy.position.y = CT.lampPoleHeight + CT.candyRadius * 0.6;
        candy.name = 'candy';
        lampGrp.add(candy);
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
})();
