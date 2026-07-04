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
  const MAX_DECO = 80;           // 従来装飾メッシュ総数の上限(Phase6追加分は別枠)

  // チョコの滝を配置する進行度(渓谷壁沿い、river区間の縁)
  const WATERFALL_SPOTS = [0.335, 0.415];

  // 夕暮れに映えるミルクチョコ&キャラメルの暖色。日没直前のオレンジ〜琥珀へ調整(Phase6)。
  const colors = {
    sky: 0xff9d5c,
    fog: 0xe8834a,
    ground: 0x6a3f22,
    road: '#7a4425',
    edge: '#ffdca0',
    curb: '#ff9d3c',
    offroad: 0x5c3a1e,
    centerLine: 'rgba(255,220,170,0.65)',
  };

  // 夕暮れの光: 暖色ヘミスフィア+オレンジの太陽+ピンクがかったリムで
  // 「甘い冒険の日没」の空気を出す(course.jsが対応済みのdef.lighting契約)
  const lighting = {
    hemiSky: 0xffd9a0,
    hemiGround: 0x5a3a26,
    hemiIntensity: 0.5,
    sunColor: 0xffa050,
    sunIntensity: 1.05,
    rimColor: 0xff8060,
    exposure: 1.05,
  };

  // ---- Phase6: 密度・照明強化のローカル定数 ----
  const P6 = {
    standCount: 2,               // 観客スタンド(谷底の見せ場付近)
    standRows: 3,
    standSeatsPerRow: 12,
    standWidth: 12,
    standRowDepth: 1.3,
    standRowHeight: 1.05,
    standSwaySpeed: 1.4,
    standSwayAmp: 0.045,
    flagChainSpots: [0.08, 0.62],
    flagChainFlags: 8,
    banners: [
      { t: 0.045, side: 1, text: 'NOVA TIRES' },
      { t: 0.50, side: -1, text: 'Meteor Ridge Rally' },
      { t: 0.90, side: 1, text: 'METEOR PEAK' },
    ],
    noboriSpots: [0.16, 0.72, 0.88],
    caramelArchSpots: [0.245, 0.735], // 道路をまたぐキャラメル岩アーチ(2箇所)
    archHeight: 7.2,
    archThickness: 1.3,
    bigFallSpot: 0.375,          // チョコの滝・大型化の追加配置(既存WATERFALL_SPOTSの間)
    lampCount: 8,                // 夕暮れに映える街灯(発光)
    lampPoleHeight: 4.6,
    lampGlowSpeed: 0.5,
    lavaGlowCount: 5,            // 溶岩風チョコの光(渓谷底の縁に点在)
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
    { x: -2, y: 2.6, z: -140, w: 9 },  // 30 最終直線への合流(下り九十九折れと高さ差6以上を確保)
    { x: 8, y: 5.5, z: -98, w: 9 },    // 31 最終カーブ
    { x: 30, y: 6.5, z: -62, w: 9 },   // 32 最終カーブ2(スタート直線から十分離して並走)
    { x: 28, y: 8, z: -12, w: 9 },     // 33 スタートへの導入(広いヘアピンでcp0へ折り返す)
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
    const riverMat = new THREE.MeshStandardMaterial({
      map: chocoRiverTexture(), side: THREE.DoubleSide, roughness: 0.35, metalness: 0.1,
    });
    const waferMat = new THREE.MeshStandardMaterial({ map: waferTexture(), roughness: 0.8, metalness: 0.0 });
    const caramelMat = new THREE.MeshStandardMaterial({ map: caramelTexture(), roughness: 0.55, metalness: 0.1 });
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

    // --- チョコの滝(渓谷壁沿いの薄板、river区間の縁。Phase6で大型化+水しぶき台座を追加) ---
    const basinMat = Game.mats.matte(0x4a2a15);
    WATERFALL_SPOTS.forEach((t, wi) => {
      const i = Math.floor(t * s.count) % s.count;
      const p = s.pts[i], n = s.nrm[i], w = s.w[i];
      const side = 1;
      const big = wi === 0; // 1本目を大型化(見せ場)
      const fall = new THREE.Mesh(new THREE.PlaneGeometry(big ? 9.5 : 6, big ? 20 : 14), fallsMat);
      fall.position.set(
        p.x + n.x * (w + DECO_MARGIN) * side,
        p.y + (big ? 10 : 7),
        p.z + n.z * (w + DECO_MARGIN) * side
      );
      fall.rotation.y = Math.atan2(-n.z, n.x);
      fall.name = 'chocoFalls';
      group.add(fall);
      count++;
      // 滝つぼ(受け皿)
      const basin = new THREE.Mesh(new THREE.CylinderGeometry(big ? 4.2 : 2.6, big ? 4.6 : 3.0, 0.8, 12), basinMat);
      basin.position.set(p.x + n.x * (w + DECO_MARGIN) * side, p.y + 0.3, p.z + n.z * (w + DECO_MARGIN) * side);
      group.add(basin);
      count++;
    });

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

    // ---- Phase6: 観客席(見せ場の谷底区間+最終カーブ付近) ----
    const stands = [];
    const standSpots = [0.05, 0.94];
    for (let si = 0; si < P6.standCount; si++) {
      const t = standSpots[si % standSpots.length];
      const idx = Math.floor(t * s.count) % s.count;
      const p = s.pts[idx], n = s.nrm[idx], w = s.w[idx];
      const side = si % 2 === 0 ? 1 : -1;
      const off = w + course.offroadWidth + DECO_MARGIN + 4;
      const stand = buildGrandstand(P6, si);
      stand.position.set(p.x + n.x * off * side, p.y, p.z + n.z * off * side);
      stand.rotation.y = s.tangentAngle(idx) + (side > 0 ? Math.PI / 2 : -Math.PI / 2);
      group.add(stand);
      stands.push(stand);
    }
    group.userData.chocoStands = stands;

    // ---- Phase6: フラッグチェーン(道路横断) ----
    const flagTex = makeTriangleFlagTexture();
    for (const t of P6.flagChainSpots) {
      const idx = Math.floor(t * s.count) % s.count;
      const p = s.pts[idx], n = s.nrm[idx], w = s.w[idx];
      const chain = buildFlagChain(w + 1.6, P6.flagChainFlags, flagTex);
      chain.position.set(p.x, p.y + P6.archHeight - 0.5, p.z);
      chain.rotation.y = s.tangentAngle(idx);
      group.add(chain);
    }

    // ---- Phase6: のぼり旗 ----
    let noboriSeed = 55;
    const noboriRnd = () => { noboriSeed = (noboriSeed * 1103515245 + 12345) & 0x7fffffff; return (noboriSeed % 10000) / 10000; };
    for (const t of P6.noboriSpots) {
      const idx = Math.floor(t * s.count) % s.count;
      const p = s.pts[idx], n = s.nrm[idx], w = s.w[idx];
      const side = noboriRnd() < 0.5 ? 1 : -1;
      const off = w + course.offroadWidth / 7 + DECO_MARGIN + 2;
      const nobori = buildNobori(s.tangentAngle(idx), t);
      nobori.position.set(p.x + n.x * off * side, p.y, p.z + n.z * off * side);
      group.add(nobori);
    }

    // ---- Phase6: オリジナル看板(架空ブランド) ----
    for (const b of P6.banners) {
      const idx = Math.floor(b.t * s.count) % s.count;
      const p = s.pts[idx], n = s.nrm[idx], w = s.w[idx];
      const off = b.side * (w + course.offroadWidth + DECO_MARGIN + 2);
      const board = buildBillboard(b.text);
      board.position.set(p.x + n.x * off, p.y, p.z + n.z * off);
      board.rotation.y = s.tangentAngle(idx) + (b.side > 0 ? -Math.PI / 2 : Math.PI / 2);
      group.add(board);
    }

    // ---- Phase6: 道路をまたぐキャラメル岩のアーチ ----
    const archMat = new THREE.MeshStandardMaterial({ map: caramelTexture(), roughness: 0.6, metalness: 0.05 });
    for (const t of P6.caramelArchSpots) {
      const idx = Math.floor(t * s.count) % s.count;
      const p = s.pts[idx], n = s.nrm[idx], w = s.w[idx];
      const half = w + course.offroadWidth * 0.4 + DECO_MARGIN;
      const archGrp = new THREE.Group();
      for (const side of [-1, 1]) {
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.2, P6.archHeight, 8), archMat);
        post.position.set(p.x + n.x * side * half, p.y + P6.archHeight / 2, p.z + n.z * side * half);
        archGrp.add(post);
      }
      const beam = new THREE.Mesh(new THREE.CapsuleGeometry(P6.archThickness, half * 2, 4, 8), archMat);
      beam.rotation.z = Math.PI / 2;
      beam.position.set(p.x, p.y + P6.archHeight, p.z);
      beam.rotation.y = s.tangentAngle(idx);
      archGrp.add(beam);
      group.add(archGrp);
    }

    // ---- Phase6: 発光要素(夕暮れに映える街灯+溶岩風チョコの光) ----
    const lamps = [];
    for (let i = 0; i < P6.lampCount; i++) {
      const t = (i / P6.lampCount + 0.03) % 1;
      const idx = Math.floor(t * s.count) % s.count;
      const p = s.pts[idx], n = s.nrm[idx], w = s.w[idx];
      const side = i % 2 === 0 ? -1 : 1;
      const off = w + course.offroadWidth / 7 + DECO_MARGIN + 1.5;
      const lampGrp = new THREE.Group();
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.2, P6.lampPoleHeight, 8), Game.mats.metal(0x6b4426));
      pole.position.y = P6.lampPoleHeight / 2;
      lampGrp.add(pole);
      const lantern = new THREE.Mesh(new THREE.SphereGeometry(0.42, 10, 8), Game.mats.glow(0xffb060, 1.3));
      lantern.position.y = P6.lampPoleHeight + 0.25;
      lantern.name = 'lantern';
      lampGrp.add(lantern);
      const pl = new THREE.PointLight(0xffb060, 0.6, 10, 2);
      pl.position.copy(lantern.position);
      lampGrp.add(pl);
      lampGrp.position.set(p.x + n.x * off * side, p.y, p.z + n.z * off * side);
      group.add(lampGrp);
      lamps.push(lampGrp);
    }
    group.userData.chocoLamps = lamps;

    // 溶岩風チョコの光(渓谷底の縁、fallZone沿いに点在)
    const lavaGlows = [];
    for (let i = 0; i < P6.lavaGlowCount; i++) {
      const t = (0.29 + i / P6.lavaGlowCount * 0.10) % 1;
      const idx = Math.floor(t * s.count) % s.count;
      const p = s.pts[idx], n = s.nrm[idx], w = s.w[idx];
      const off = w + 1.5;
      const glow = new THREE.Mesh(new THREE.SphereGeometry(0.55, 8, 6), Game.mats.glow(0xff5a1a, 1.6));
      glow.position.set(p.x + n.x * off, p.y - RIVER_DROP + 0.2, p.z + n.z * off);
      group.add(glow);
      lavaGlows.push(glow);
    }
    group.userData.chocoLavaGlows = lavaGlows;
  }

  // 見た目のみのアニメーション: 川と滝のテクスチャをスクロール+観客/発光演出
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

    // 観客スタンドを歓声で揺らす
    const stands = group.userData.chocoStands;
    if (stands) {
      for (let si = 0; si < stands.length; si++) {
        stands[si].rotation.z = Math.sin(time * P6.standSwaySpeed + si * 1.1) * P6.standSwayAmp;
      }
    }

    // 街灯のランタンをゆらゆら明滅させる(夕暮れの灯り感)
    const lamps = group.userData.chocoLamps;
    if (lamps) {
      for (let i = 0; i < lamps.length; i++) {
        const lantern = lamps[i].getObjectByName('lantern');
        if (lantern) {
          const flicker = 1.1 + Math.sin(time * P6.lampGlowSpeed * 3 + i * 2.1) * 0.25;
          lantern.material.emissiveIntensity = flicker;
        }
      }
    }

    // 溶岩風チョコの光を脈動させる
    const glows = group.userData.chocoLavaGlows;
    if (glows) {
      for (let i = 0; i < glows.length; i++) {
        glows[i].material.emissiveIntensity = 1.4 + Math.sin(time * 1.4 + i * 1.3) * 0.4;
      }
    }
  }

  Game.courses.chocoCanyon = {
    id: 'chocoCanyon',
    displayName: 'メテオリッジ',
    bgmMood: 'パーカッションが響く夕陽の峡谷アドベンチャー調',
    name: 'チョコレート・キャニオン',
    controlPoints,
    offroadWidth: 6,
    colors,
    lighting,
    boostPads,
    jumpPads,
    gaps,
    fallZones,
    itemSpots,
    decorate,
    animate,
  };

  // ---- Phase6: 観客スタンド(段状ボックス+InstancedMeshの観客球) ----
  function buildGrandstand(cfg, seed) {
    const grp = new THREE.Group();
    const frameMat = Game.mats.matte(0x5c3a1e);
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
    const hues = [0xffb060, 0xff6f91, 0xffe38a, 0x8ad0ff, 0xff9d3c];
    let k = 0;
    let lseed = 4200 + seed * 63;
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

  // 三角旗テクスチャ(フラッグチェーン/のぼり共用)
  function makeTriangleFlagTexture() {
    const cv = document.createElement('canvas');
    cv.width = 64; cv.height = 64;
    const x = cv.getContext('2d');
    x.fillStyle = '#ffb060'; x.beginPath();
    x.moveTo(4, 4); x.lineTo(60, 32); x.lineTo(4, 60); x.closePath(); x.fill();
    return new THREE.CanvasTexture(cv);
  }

  // 道路を横断する三角旗の列
  function buildFlagChain(halfSpan, count, flagTex) {
    const grp = new THREE.Group();
    const cordMat = Game.mats.matte(0xf6e2c4);
    const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, halfSpan * 2, 6), cordMat);
    cord.rotation.z = Math.PI / 2;
    grp.add(cord);
    const flagGeo = new THREE.PlaneGeometry(0.9, 0.7);
    const cols = [0xffb060, 0xff6f91, 0xffe38a, 0x8ad0ff];
    for (let i = 0; i < count; i++) {
      const tRatio = (i + 0.5) / count;
      const flagMat = new THREE.MeshBasicMaterial({ map: flagTex, color: cols[i % cols.length], side: THREE.DoubleSide });
      const flag = new THREE.Mesh(flagGeo, flagMat);
      flag.position.set(-halfSpan + tRatio * halfSpan * 2, -0.35 - Math.sin(tRatio * Math.PI) * 0.5, 0);
      flag.name = 'chainFlag';
      grp.add(flag);
    }
    return grp;
  }

  // のぼり旗
  function buildNobori(angle, tSeed) {
    const grp = new THREE.Group();
    const poleMat = Game.mats.metal(0xb9bec9);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 3.4, 6), poleMat);
    pole.position.y = 1.7;
    grp.add(pole);
    const cols = [0xffb060, 0xff6f91, 0xffe38a, 0x8ad0ff];
    const cv = document.createElement('canvas');
    cv.width = 32; cv.height = 96;
    const x = cv.getContext('2d');
    x.fillStyle = '#fff6ee'; x.fillRect(0, 0, 32, 96);
    x.fillStyle = '#' + new THREE.Color(cols[Math.floor((tSeed * 971) % cols.length)]).getHexString();
    x.fillRect(0, 0, 32, 18);
    x.fillRect(0, 78, 32, 18);
    x.font = 'bold 15px sans-serif';
    x.textAlign = 'center';
    x.save(); x.translate(16, 48); x.rotate(Math.PI / 2);
    x.fillStyle = '#5a3a26';
    x.fillText('CANYON', 0, 6);
    x.restore();
    const flagMat = new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(cv), side: THREE.DoubleSide });
    const flag = new THREE.Mesh(new THREE.PlaneGeometry(0.75, 2.3), flagMat);
    flag.position.set(0.42, 2.4, 0);
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
    grad.addColorStop(0, '#ffe6c2'); grad.addColorStop(1, '#ffb060');
    x.fillStyle = grad; x.fillRect(0, 0, 512, 160);
    x.strokeStyle = '#7a4425'; x.lineWidth = 10; x.strokeRect(6, 6, 500, 148);
    x.fillStyle = '#5a2f14';
    x.font = 'bold 52px sans-serif';
    x.textAlign = 'center'; x.textBaseline = 'middle';
    x.fillText(text, 256, 84);
    const boardMat = new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(cv) });
    const board = new THREE.Mesh(new THREE.PlaneGeometry(4.4, 1.4), boardMat);
    board.position.set(0, 3.9, 0.08);
    grp.add(board);
    const backMat = Game.mats.matte(0x6b4426);
    const back = new THREE.Mesh(new THREE.BoxGeometry(4.4, 1.4, 0.12), backMat);
    back.position.set(0, 3.9, -0.02);
    grp.add(back);
    return grp;
  }
})();
