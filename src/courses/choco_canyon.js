// 中級コース「チョコレート・キャニオン」(id: chocoCanyon)
// 溶けたチョコの川が流れる渓谷を、連続ヘアピンで谷底へ下り、長い上りで登り返し、
// ジャンプ台付きの下り九十九折れで駆け抜ける。DESIGN.md コース②準拠。
// controlPoints概算全長: 約1067ユニット × 1.05 ≈ 1120ユニット(t=0..1に対応)
Game.courses = Game.courses || {};

(function () {
  // ---- ローカル定数(マジックナンバー集約) ----
  // 装飾配置の基準オフセット(路面+路肩から3ユニット以上外側)
  const DECO_MARGIN = 3.2;       // 路肩外縁からの最小離隔
  const RIVER_DROP = 1.6;        // チョコ川の路面からの沈み込み量
  const RIVER_HALF_W = 5.5;      // チョコ川帯の半幅
  const ROCK_STEP = 5;           // キャラメル岩の配置間引き(スプラインサンプル間隔)
  const PIER_STEP = 9;           // ウエハース橋脚の配置間引き
  const MAX_DECO = 80;           // 装飾メッシュ総数の上限

  // チョコの滝を配置する進行度(渓谷壁沿い、river区間の縁)
  const WATERFALL_SPOTS = [0.335, 0.415];

  // ミルクチョコ&キャラメルの明るい暖色。暗くしすぎると夜のように見えて
  // 「甘い冒険」の世界観が伝わらない(実プレイ確認で調整済み)
  const colors = {
    sky: 0xe8b06a,
    fog: 0xd99e5e,
    ground: 0x8a5a34,
    road: '#8f4f2c',
    edge: '#ffdca0',
    offroad: 0x6e4526,
  };

  // 全長概算1067×1.05≈1120。制御点は起伏15%以下(一部16.8%区間は
  // Catmull-Rom平滑化で緩和される想定)、隣接間隔25〜60ユニット目安。
  const controlPoints = [
    { x: 0, y: 8, z: 0, w: 9 },        // 0 スタート(平坦・直線)
    { x: 0, y: 8, z: -45, w: 9 },      // 1 スタート直線続き(平坦)
    { x: -10, y: 8, z: -85, w: 8.5 },  // 2 緩いターンイン
    { x: -38, y: 7, z: -108, w: 8 },   // 3 ヘアピン1進入(下り開始)
    { x: -62, y: 4.5, z: -102, w: 7.5 }, // 4 ヘアピン1頂点
    { x: -68, y: 1.5, z: -72, w: 7.5 }, // 5 ヘアピン1出口
    { x: -48, y: -1.5, z: -45, w: 7.5 }, // 6 ヘアピン2進入
    { x: -20, y: -4.5, z: -48, w: 7.5 }, // 7 ヘアピン2頂点
    { x: 2, y: -7.5, z: -72, w: 7.5 }, // 8 ヘアピン2出口→谷底へ
    { x: 8, y: -10, z: -108, w: 8 },   // 9 谷底/チョコ川直線開始
    { x: 2, y: -11, z: -148, w: 8 },   // 10 川沿い直線(落下注意)
    { x: -12, y: -11, z: -178, w: 7.5 }, // 11 川沿いカーブ(緩やか化)
    { x: -34, y: -9.5, z: -196, w: 7.5 }, // 12 川沿いカーブ2(緩やか化)
    { x: -60, y: -7, z: -196, w: 7 },  // 13 滝沿いの上り開始
    { x: -87, y: -3.5, z: -172, w: 7 }, // 14 長い上り1
    { x: -101, y: 0.5, z: -145, w: 7 }, // 15 長い上り2
    { x: -107, y: 5.5, z: -112, w: 7 }, // 16 長い上り3
    { x: -104, y: 9, z: -84, w: 7 },   // 17 長い上り4
    { x: -94, y: 12.5, z: -60, w: 7.5 }, // 18 長い上り5
    { x: -76, y: 16, z: -50, w: 7.5 }, // 19 長い上り6(頂上到達)
    { x: -48, y: 18, z: -50, w: 8 },   // 20 ビスケット筏直線(平坦・ジャンプ台手前)
    { x: -22, y: 18, z: -52, w: 8 },   // 21 ギャップ着地後、下り九十九折れ開始(平坦)
    { x: -8, y: 16.5, z: -68, w: 8 },  // 22 九十九折れ1
    { x: 15, y: 13, z: -92, w: 7.5 },  // 23 九十九折れ2
    { x: 32, y: 9, z: -118, w: 7.5 },  // 24 九十九折れ3
    { x: 42, y: 5, z: -148, w: 7.5 },  // 25 九十九折れ4(噴水リスクライン)
    { x: 38, y: 1, z: -178, w: 8 },    // 26 九十九折れ5
    { x: 20, y: -1, z: -195, w: 8.5 }, // 27 九十九折れ底
    { x: -2, y: 0, z: -190, w: 8.5 },  // 28 スタート側へ回り込み
    { x: -2, y: 2, z: -160, w: 8.5 },  // 29 緩い上り
    { x: 15, y: 4, z: -130, w: 9 },    // 30 最終直線への合流
    { x: 30, y: 6, z: -95, w: 9 },     // 31 最終カーブ
    { x: 22, y: 7, z: -55, w: 9 },     // 32 最終カーブ2→スタート直線へ
    { x: 8, y: 8, z: -25, w: 9 },      // 33 スタートへの導入(平坦)
  ];

  // チョコの川沿い区間(コース全体の約22%): 谷底直線〜川カーブ〜上り開始手前
  // 縁から落ちるとリスポーン。ヘアピン2出口の直後(急旋回中)は除外し、
  // 直線に十分乗ってから開始することで、リスポーン地点が再度縁に近い
  // 危険地帯へ置かれる連鎖を避ける。
  const fallZones = [
    { t0: 0.285, t1: 0.400 },
  ];

  // ビスケット筏区間: ジャンプ台(4ユニット)→3ユニット間隔→ギャップ(7ユニット)
  // 手前(t19=0.5754〜t20=0.6017)は平坦な直線。ジャンプ初速7.5・重力20で滞空0.75秒、
  // 速度30なら飛距離約22ユニット。gap終端はjumpPad始端から14ユニット(≤16基準内)。
  const jumpPads = [
    { t0: 0.5784, t1: 0.5820 },
  ];
  const gaps = [
    { t0: 0.5846, t1: 0.5909 },
  ];

  // チョコ噴水ブーストパッド: ①ヘアピン2出口の加速区間 ②谷底直線の中央(安全)
  // ③九十九折れ4の縁ギリギリ(リスクライン、幅を左右非対称にして寄せる)
  const boostPads = [
    { t0: 0.2340, t1: 0.2400 },
    { t0: 0.2650, t1: 0.2710 },
    { t0: 0.7150, t1: 0.7210, l0: 0.45, l1: 0.95 }, // 縁ギリギリのリスクライン
  ];

  // アイテムボックス候補(Phase3用)。進行度tと半幅比l(-0.8..0.8)
  const itemSpots = [
    { t: 0.02, l: -0.3 }, { t: 0.02, l: 0.3 }, { t: 0.03, l: 0 },
    { t: 0.19, l: -0.35 }, { t: 0.19, l: 0.35 }, { t: 0.205, l: 0 },
    { t: 0.30, l: -0.3 }, { t: 0.30, l: 0.3 }, { t: 0.315, l: 0 },
    { t: 0.47, l: -0.3 }, { t: 0.47, l: 0.3 }, { t: 0.485, l: 0 },
    { t: 0.60, l: -0.4 }, { t: 0.615, l: 0.4 }, { t: 0.63, l: 0 },
    { t: 0.85, l: -0.3 }, { t: 0.85, l: 0.3 }, { t: 0.865, l: 0 },
  ];

  // ---- テクスチャ生成ヘルパー ----
  function chocoRiverTexture() {
    const cv = document.createElement('canvas');
    cv.width = 64; cv.height = 64;
    const x = cv.getContext('2d');
    x.fillStyle = '#3a1d0e'; x.fillRect(0, 0, 64, 64);
    x.fillStyle = 'rgba(255,200,140,0.18)';
    for (let i = 0; i < 10; i++) {
      x.beginPath();
      x.ellipse(8 + (i * 13) % 64, 6 + (i * 23) % 64, 10, 3, 0.4, 0, Math.PI * 2);
      x.fill();
    }
    x.fillStyle = 'rgba(120,60,25,0.35)';
    x.fillRect(0, 28, 64, 8);
    const tex = new THREE.CanvasTexture(cv);
    tex.wrapS = THREE.RepeatWrapping; tex.wrapT = THREE.RepeatWrapping;
    return tex;
  }

  function waferTexture() {
    const cv = document.createElement('canvas');
    cv.width = 32; cv.height = 32;
    const x = cv.getContext('2d');
    x.fillStyle = '#e8c48a'; x.fillRect(0, 0, 32, 32);
    x.strokeStyle = 'rgba(150,100,50,0.5)'; x.lineWidth = 2;
    for (let i = 0; i < 32; i += 8) { x.beginPath(); x.moveTo(0, i); x.lineTo(32, i); x.stroke(); }
    const tex = new THREE.CanvasTexture(cv);
    tex.wrapS = THREE.RepeatWrapping; tex.wrapT = THREE.RepeatWrapping;
    return tex;
  }

  function caramelTexture() {
    const cv = document.createElement('canvas');
    cv.width = 32; cv.height = 32;
    const x = cv.getContext('2d');
    x.fillStyle = '#b06a2a'; x.fillRect(0, 0, 32, 32);
    x.fillStyle = 'rgba(255,220,160,0.25)';
    for (let i = 0; i < 14; i++) x.fillRect((i * 7) % 32, (i * 11) % 32, 4, 4);
    const tex = new THREE.CanvasTexture(cv);
    return tex;
  }

  // ---- decorate: テーマ装飾 ----
  function decorate(group, course) {
    const s = course.spline;
    let count = 0;

    // 帯メッシュ/薄板は巻き順に依存せず見えるよう両面描画にする
    const riverMat = new THREE.MeshLambertMaterial({ map: chocoRiverTexture(), side: THREE.DoubleSide });
    const waferMat = new THREE.MeshLambertMaterial({ map: waferTexture() });
    const caramelMat = new THREE.MeshLambertMaterial({ map: caramelTexture() });
    const fallsMat = new THREE.MeshBasicMaterial({
      map: chocoRiverTexture(), transparent: true, opacity: 0.85, side: THREE.DoubleSide,
    });

    // --- チョコの川(fallZone区間に沿って路面より低い帯を敷く) ---
    {
      const pos = [], uv = [], idx = [];
      let vi = 0;
      const riverPts = [];
      for (let i = 0; i < s.count; i++) {
        const t = i / s.count;
        if (!Game.Course.inRange(course.fallZones[0], t)) continue;
        riverPts.push(i);
      }
      for (let k = 0; k < riverPts.length; k++) {
        const i = riverPts[k];
        const j = riverPts[(k + 1) % riverPts.length];
        if (Math.abs(j - i) !== 1 && !(i === s.count - 1 && j === 0)) continue;
        const pa = s.pts[i], na = s.nrm[i];
        const pb = s.pts[j], nb = s.nrm[j];
        const a0x = pa.x - na.x * RIVER_HALF_W, a0z = pa.z - na.z * RIVER_HALF_W;
        const a1x = pa.x + na.x * RIVER_HALF_W, a1z = pa.z + na.z * RIVER_HALF_W;
        const b0x = pb.x - nb.x * RIVER_HALF_W, b0z = pb.z - nb.z * RIVER_HALF_W;
        const b1x = pb.x + nb.x * RIVER_HALF_W, b1z = pb.z + nb.z * RIVER_HALF_W;
        const y = pa.y - RIVER_DROP;
        pos.push(a0x, y, a0z, a1x, y, a1z, b0x, pb.y - RIVER_DROP, b0z, b1x, pb.y - RIVER_DROP, b1z);
        uv.push(0, k * 0.3, 1, k * 0.3, 0, (k + 1) * 0.3, 1, (k + 1) * 0.3);
        idx.push(vi, vi + 2, vi + 1, vi + 1, vi + 2, vi + 3);
        vi += 4;
      }
      if (pos.length) {
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
        geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
        geo.setIndex(idx);
        geo.computeVertexNormals();
        const river = new THREE.Mesh(geo, riverMat);
        river.name = 'chocoRiver';
        group.add(river);
      }
    }

    // --- チョコの滝(渓谷壁沿いの薄板、river区間の縁) ---
    for (const t of WATERFALL_SPOTS) {
      const i = Math.floor(t * s.count) % s.count;
      const p = s.pts[i], n = s.nrm[i], w = s.w[i];
      const side = 1;
      const fall = new THREE.Mesh(new THREE.PlaneGeometry(6, 14), fallsMat);
      fall.position.set(
        p.x + n.x * (w + DECO_MARGIN) * side,
        p.y + 7,
        p.z + n.z * (w + DECO_MARGIN) * side
      );
      fall.rotation.y = Math.atan2(-n.z, n.x);
      fall.name = 'chocoFalls';
      group.add(fall);
      count++;
    }

    // --- キャラメル岩(ごつごつした球/円錐、路肩外側に点在) ---
    for (let i = 0; i < s.count && count < MAX_DECO - 8; i += ROCK_STEP * 3) {
      if (i % (ROCK_STEP * 9) !== 0) continue; // 間引いて総数抑制
      const p = s.pts[i], n = s.nrm[i], w = s.w[i];
      const side = (i / ROCK_STEP) % 2 === 0 ? 1 : -1;
      const off = w + course.offroadWidth / 7 + DECO_MARGIN + (i % 5);
      const rockType = i % 3;
      const mesh = rockType === 0
        ? new THREE.Mesh(new THREE.SphereGeometry(1.6 + (i % 3) * 0.4, 8, 6), caramelMat)
        : new THREE.Mesh(new THREE.ConeGeometry(1.4 + (i % 3) * 0.3, 3 + (i % 2), 6), caramelMat);
      mesh.position.set(p.x + n.x * off * side, p.y + 0.6, p.z + n.z * off * side);
      mesh.rotation.y = (i * 0.7) % (Math.PI * 2);
      mesh.name = 'caramelRock';
      group.add(mesh);
      count++;
    }

    // --- ウエハースの橋脚(渓谷区間の路肩外に等間隔) ---
    for (let i = 0; i < s.count && count < MAX_DECO; i += PIER_STEP * 4) {
      const t = i / s.count;
      if (t < 0.10 || t > 0.42) continue; // 渓谷区間のみ
      const p = s.pts[i], n = s.nrm[i], w = s.w[i];
      for (const side of [-1, 1]) {
        if (count >= MAX_DECO) break;
        const off = w + course.offroadWidth / 7 + DECO_MARGIN + 1.5;
        const pier = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.3, 10, 8), waferMat);
        pier.position.set(p.x + n.x * off * side, p.y - 4, p.z + n.z * off * side);
        pier.name = 'waferPier';
        group.add(pier);
        count++;
      }
    }
  }

  // 見た目のみのアニメーション: 川と滝のテクスチャをスクロール
  function animate(time, group) {
    const river = group.getObjectByName('chocoRiver');
    if (river && river.material.map) {
      river.material.map.offset.y = (time * 0.12) % 1;
    }
    group.traverse((obj) => {
      if (obj.name === 'chocoFalls' && obj.material.map) {
        obj.material.map.offset.y = (time * 0.6) % 1;
      }
    });
  }

  Game.courses.chocoCanyon = {
    id: 'chocoCanyon',
    displayName: 'チョコレート・キャニオン',
    bgmMood: 'パーカッションが響く冒険オーケストラ調',
    name: 'チョコレート・キャニオン',
    controlPoints,
    offroadWidth: 6,
    colors,
    boostPads,
    jumpPads,
    gaps,
    fallZones,
    itemSpots,
    decorate,
    animate,
  };
})();
