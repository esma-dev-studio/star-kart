// キャラクター9体 v3: ロスター刷新(人外レーサー版)。データ定義+プロシージャルモデル生成。
// 「お菓子の王国」マスコット群(第2版)を退役させ、シュガリア王国GPに種族も背景も異なる
// 9人のレーサーが自分の意思で参戦している構図に刷新(DESIGN.md 2-v3準拠)。
// 全キャラ共通: 頭・胴・腕(左右独立ノード arm_L_pivot/arm_R_pivot)・脚(or代替下半身)を持ち、
// ハンドルを握るポーズが成立する。白目+虹彩+ハイライトの重ね目、表情4種(visible切替)、
// Game.mats(paint/matte/metal/rubber/glow/glass)で質感差。原点=足元中央、+Z向き。
(function () {
  // ==================== 定数(冒頭集約) ====================
  const SEG_LOW = 8;
  const SEG_MID = 12;
  const SEG_HI = 16;

  const C_WHITE = 0xffffff;
  const C_SKIN_LINE = 0x4a3226; // 輪郭線色(口テクスチャ用)

  // 表情キー
  const EXPR = {
    NORMAL: 'normal',
    DIZZY: 'dizzy',
    EXCITED: 'excited',
    JOY: 'joy',
  };

  // アニメ用チューニング(このファイル内で完結する演出値はここに集約)
  const ANIM = {
    bounceFreqMin: 5.2,      // 停止時のバウンス周波数
    bounceFreqMax: 13.5,     // 高速時のバウンス周波数
    bounceAmpBase: 0.028,    // バウンス基礎振幅
    bounceAmpBoost: 0.05,    // ブースト/スター中の追加振幅
    leanMax: 0.5,            // ステア/ドリフトによる体の傾き最大(rad)
    leanDamp: 9,
    forwardLeanBoost: 0.22,  // ブースト/スター中の前傾(rad)
    armFlapFreq: 16,         // スピン中の腕バタバタ周波数
    armFlapAmp: 0.9,
    joyArmUpSpeed: 8,        // ゴール喜びで腕が上がる速さ
    dizzyHeadSpin: 9,        // 目を回す速さ
  };

  function mat(color, opts) {
    return new THREE.MeshLambertMaterial(Object.assign({ color }, opts || {}));
  }

  // ---- Canvasテクスチャヘルパー ----
  function makeCanvas(size) {
    const cv = document.createElement('canvas');
    cv.width = size; cv.height = size;
    return cv;
  }
  function toTexture(cv) {
    const tex = new THREE.CanvasTexture(cv);
    tex.needsUpdate = true;
    return tex;
  }
  function hexToCss(hex) {
    return '#' + hex.toString(16).padStart(6, '0');
  }

  // ==================== キャラ専用Canvasテクスチャ ====================
  // クリーム前髪の渦
  function texCreamSwirl(size) {
    const cv = makeCanvas(size), ctx = cv.getContext('2d');
    ctx.fillStyle = '#fff6e0';
    ctx.fillRect(0, 0, size, size);
    ctx.strokeStyle = 'rgba(230,190,130,0.55)';
    ctx.lineWidth = size * 0.03;
    ctx.beginPath();
    ctx.arc(size * 0.5, size * 0.55, size * 0.28, 0, Math.PI * 1.5);
    ctx.stroke();
    return toTexture(cv);
  }

  // キツネの毛並み(オレンジ×白のグラデ)
  function texFoxFur(size) {
    const cv = makeCanvas(size), ctx = cv.getContext('2d');
    const grad = ctx.createLinearGradient(0, 0, 0, size);
    grad.addColorStop(0, '#ff9a3c');
    grad.addColorStop(1, '#ff7a1c');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.beginPath();
    ctx.moveTo(size * 0.5, size);
    ctx.quadraticCurveTo(size * 0.5, size * 0.35, size * 0.5, size * 0.15);
    ctx.lineTo(size * 0.5, size);
    ctx.closePath();
    // 胸元の白い模様
    ctx.beginPath();
    ctx.ellipse(size * 0.5, size * 0.75, size * 0.18, size * 0.28, 0, 0, Math.PI * 2);
    ctx.fill();
    return toTexture(cv);
  }

  // キャラメル岩(ひび割れ+発光ムラ)
  function texCaramelRock(size) {
    const cv = makeCanvas(size), ctx = cv.getContext('2d');
    ctx.fillStyle = '#8a7362';
    ctx.fillRect(0, 0, size, size);
    for (let i = 0; i < 60; i++) {
      ctx.fillStyle = `rgba(0,0,0,${0.05 + Math.random() * 0.12})`;
      ctx.beginPath();
      ctx.arc(Math.random() * size, Math.random() * size, size * (0.02 + Math.random() * 0.05), 0, Math.PI * 2);
      ctx.fill();
    }
    // ひび割れの発光ライン
    ctx.strokeStyle = '#ff6a1c';
    ctx.lineWidth = size * 0.02;
    for (let i = 0; i < 5; i++) {
      ctx.beginPath();
      let x = Math.random() * size, y = Math.random() * size;
      ctx.moveTo(x, y);
      for (let j = 0; j < 4; j++) {
        x += (Math.random() - 0.5) * size * 0.3;
        y += (Math.random() - 0.5) * size * 0.3;
        ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    return toTexture(cv);
  }

  // 年輪(バウム翁)
  function texWoodRing(size) {
    const cv = makeCanvas(size), ctx = cv.getContext('2d');
    ctx.fillStyle = '#a9773f';
    ctx.fillRect(0, 0, size, size);
    for (let y = 0; y < size; y += size / 9) {
      ctx.strokeStyle = `rgba(110,70,30,${0.45 + Math.random() * 0.3})`;
      ctx.lineWidth = size * 0.018;
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(size, y); ctx.stroke();
    }
    return toTexture(cv);
  }

  // ジンジャークッキーのアイシング隈取り+忍者帯用の地の生地
  function texGingerBody(size) {
    const cv = makeCanvas(size), ctx = cv.getContext('2d');
    ctx.fillStyle = '#a86a34';
    ctx.fillRect(0, 0, size, size);
    const grad = ctx.createLinearGradient(0, 0, 0, size);
    grad.addColorStop(0, 'rgba(255,255,255,0.15)');
    grad.addColorStop(1, 'rgba(0,0,0,0.18)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);
    return toTexture(cv);
  }

  // ビターカカオ鎧下地(縞なしのつや消し黒/割れ目)
  function texBitterArmor(size) {
    const cv = makeCanvas(size), ctx = cv.getContext('2d');
    ctx.fillStyle = '#241512';
    ctx.fillRect(0, 0, size, size);
    const grad = ctx.createLinearGradient(0, 0, size, size);
    grad.addColorStop(0, 'rgba(255,255,255,0.08)');
    grad.addColorStop(0.5, 'rgba(255,255,255,0)');
    grad.addColorStop(1, 'rgba(0,0,0,0.3)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);
    return toTexture(cv);
  }

  // ==================== 顔テクスチャ(表情差分) ====================
  function drawMouthNormal(ctx, size) {
    ctx.clearRect(0, 0, size, size);
    ctx.strokeStyle = hexToCss(C_SKIN_LINE);
    ctx.lineWidth = size * 0.09;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(size * 0.5, size * 0.32, size * 0.34, 0.15 * Math.PI, 0.85 * Math.PI);
    ctx.stroke();
  }
  function drawMouthExcited(ctx, size) {
    ctx.clearRect(0, 0, size, size);
    ctx.fillStyle = '#7a3b2e';
    ctx.beginPath();
    ctx.moveTo(size * 0.22, size * 0.3);
    ctx.quadraticCurveTo(size * 0.5, size * 0.78, size * 0.78, size * 0.3);
    ctx.quadraticCurveTo(size * 0.5, size * 0.44, size * 0.22, size * 0.3);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(size * 0.3, size * 0.3);
    ctx.quadraticCurveTo(size * 0.5, size * 0.4, size * 0.7, size * 0.3);
    ctx.lineTo(size * 0.65, size * 0.36);
    ctx.quadraticCurveTo(size * 0.5, size * 0.44, size * 0.35, size * 0.36);
    ctx.fill();
  }
  function drawMouthDizzy(ctx, size) {
    ctx.clearRect(0, 0, size, size);
    ctx.strokeStyle = hexToCss(C_SKIN_LINE);
    ctx.lineWidth = size * 0.08;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(size * 0.2, size * 0.35);
    ctx.quadraticCurveTo(size * 0.35, size * 0.2, size * 0.5, size * 0.35);
    ctx.quadraticCurveTo(size * 0.65, size * 0.5, size * 0.8, size * 0.35);
    ctx.stroke();
  }
  function drawMouthJoy(ctx, size) {
    ctx.clearRect(0, 0, size, size);
    ctx.fillStyle = '#7a3b2e';
    ctx.beginPath();
    ctx.ellipse(size * 0.5, size * 0.4, size * 0.28, size * 0.32, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.ellipse(size * 0.5, size * 0.28, size * 0.22, size * 0.1, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  // ノワール卿専用: 兜スリットの発光ライン(通常=細い一文字、興奮=角度をつけて鋭く、
  // ダウン=波打つ、勝利=にやりと弧を描く)。glowマテリアルのプレーンに描く。
  function drawSlitNormal(ctx, size) {
    ctx.clearRect(0, 0, size, size);
    ctx.fillStyle = '#ff3b30';
    ctx.fillRect(size * 0.1, size * 0.46, size * 0.8, size * 0.08);
  }
  function drawSlitExcited(ctx, size) {
    ctx.clearRect(0, 0, size, size);
    ctx.fillStyle = '#ff6a3b';
    ctx.save();
    ctx.translate(size * 0.5, size * 0.5);
    ctx.rotate(-0.12);
    ctx.fillRect(-size * 0.42, -size * 0.05, size * 0.84, size * 0.1);
    ctx.restore();
  }
  function drawSlitDizzy(ctx, size) {
    ctx.clearRect(0, 0, size, size);
    ctx.strokeStyle = '#ff3b30';
    ctx.lineWidth = size * 0.08;
    ctx.beginPath();
    ctx.moveTo(size * 0.1, size * 0.5);
    ctx.quadraticCurveTo(size * 0.3, size * 0.35, size * 0.5, size * 0.5);
    ctx.quadraticCurveTo(size * 0.7, size * 0.65, size * 0.9, size * 0.5);
    ctx.stroke();
  }
  function drawSlitJoy(ctx, size) {
    ctx.clearRect(0, 0, size, size);
    ctx.strokeStyle = '#ff3b30';
    ctx.lineWidth = size * 0.09;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(size * 0.5, size * 0.3, size * 0.34, 0.1 * Math.PI, 0.55 * Math.PI);
    ctx.stroke();
  }

  const MOUTH_DRAWERS = {
    [EXPR.NORMAL]: drawMouthNormal,
    [EXPR.EXCITED]: drawMouthExcited,
    [EXPR.DIZZY]: drawMouthDizzy,
    [EXPR.JOY]: drawMouthJoy,
  };
  const SLIT_DRAWERS = {
    [EXPR.NORMAL]: drawSlitNormal,
    [EXPR.EXCITED]: drawSlitExcited,
    [EXPR.DIZZY]: drawSlitDizzy,
    [EXPR.JOY]: drawSlitJoy,
  };

  // 毎フレームのテクスチャ生成を禁止するため、build()時に4表情ぶんの口/スリットテクスチャを
  // 事前生成してMeshに割り当て、animate()ではvisible切替のみ行う(テクスチャはキャッシュ共有)。
  const texCache = {};
  function getExprTexture(bank, drawers, expr) {
    const key = bank + '_' + expr;
    if (texCache[key]) return texCache[key];
    const size = 64;
    const cv = makeCanvas(size), ctx = cv.getContext('2d');
    drawers[expr](ctx, size);
    const tex = toTexture(cv);
    texCache[key] = tex;
    return tex;
  }

  function addMouthSet(parent, y, z, w, h) {
    const group = new THREE.Group();
    group.position.set(0, y, z);
    const meshes = {};
    for (const expr of Object.keys(MOUTH_DRAWERS)) {
      const m = new THREE.MeshBasicMaterial({ map: getExprTexture('mouth', MOUTH_DRAWERS, expr), transparent: true, depthWrite: false });
      const plane = new THREE.Mesh(new THREE.PlaneGeometry(w, h), m);
      plane.visible = expr === EXPR.NORMAL;
      plane.name = 'mouth_' + expr;
      group.add(plane);
      meshes[expr] = plane;
    }
    parent.add(group);
    return meshes; // { normal: mesh, excited: mesh, dizzy: mesh, joy: mesh }
  }

  // ノワール卿専用: 兜スリットの発光表情セット(mouthsと同じ契約=setExprで共用)
  function addSlitSet(parent, y, z, w, h) {
    const group = new THREE.Group();
    group.position.set(0, y, z);
    const meshes = {};
    for (const expr of Object.keys(SLIT_DRAWERS)) {
      const m = new THREE.MeshBasicMaterial({
        map: getExprTexture('slit', SLIT_DRAWERS, expr), transparent: true, depthWrite: false,
        color: 0xffffff,
      });
      const plane = new THREE.Mesh(new THREE.PlaneGeometry(w, h), m);
      plane.visible = expr === EXPR.NORMAL;
      plane.name = 'slit_' + expr;
      group.add(plane);
      meshes[expr] = plane;
    }
    parent.add(group);
    return meshes;
  }

  // ---- 共通顔パーツ(白目+虹彩+ハイライトの重ね目) ----
  function addEyes(parent, y, z, spacing, eyeR, irisHex) {
    const whiteMat = mat(C_WHITE);
    const irisMat = mat(irisHex || 0x3a2a20);
    const hiMat = mat(C_WHITE);
    const eyes = { left: null, right: null };
    for (const side of [-1, 1]) {
      const eyeGroup = new THREE.Group();
      eyeGroup.position.set(side * spacing, y, z);
      const white = new THREE.Mesh(new THREE.SphereGeometry(eyeR, SEG_LOW, SEG_LOW), whiteMat);
      white.scale.set(1, 1.08, 0.75);
      eyeGroup.add(white);
      const iris = new THREE.Mesh(new THREE.SphereGeometry(eyeR * 0.62, 8, 8), irisMat);
      iris.position.z = eyeR * 0.55;
      eyeGroup.add(iris);
      const hi = new THREE.Mesh(new THREE.SphereGeometry(eyeR * 0.24, 6, 6), hiMat);
      hi.position.set(eyeR * 0.22, eyeR * 0.28, eyeR * 0.85);
      eyeGroup.add(hi);
      parent.add(eyeGroup);
      if (side === -1) eyes.left = eyeGroup; else eyes.right = eyeGroup;
    }
    return eyes;
  }

  // 腕: 名前付きノード(pivotで肩位置に置き、先端に腕メッシュをぶら下げてアニメで回転させる)
  function addArm(parent, x, y, z, len, r, colorHex, side, matFn) {
    const pivot = new THREE.Group();
    pivot.position.set(x, y, z);
    pivot.name = 'arm_' + (side === -1 ? 'L' : 'R') + '_pivot';
    const useMat = (matFn || Game.mats.matte)(colorHex);
    const armMesh = new THREE.Mesh(new THREE.CapsuleGeometry(r, len, 4, 8), useMat);
    armMesh.rotation.z = Math.PI / 2 * (side || 1) * 0.55;
    armMesh.position.set(side * len * 0.35, -len * 0.15, 0);
    armMesh.castShadow = true;
    pivot.add(armMesh);
    parent.add(pivot);
    return pivot;
  }

  function addLeg(parent, x, y, colorHex, matFn) {
    const useMat = (matFn || Game.mats.matte)(colorHex);
    const g = new THREE.Mesh(new THREE.CapsuleGeometry(0.09, 0.22, 4, 8), useMat);
    g.position.set(x, y, 0.02);
    g.castShadow = true;
    parent.add(g);
    return g;
  }

  // ==================== 専用アクセサリー(全てオリジナル意匠) ====================
  // レーシングゴーグル(クルム)
  function addGoggles(parent, y, z, r, lensHex) {
    const strapMat = Game.mats.matte(0x333333);
    const strap = new THREE.Mesh(new THREE.TorusGeometry(r * 1.55, r * 0.12, 6, 16, Math.PI), strapMat);
    strap.rotation.z = Math.PI;
    strap.position.set(0, y + r * 0.2, z - r * 0.5);
    parent.add(strap);
    const lensMat = Game.mats.glass(lensHex || 0x69d1ff, 0.55);
    const frameMat = Game.mats.metal(0xdedede);
    for (const side of [-1, 1]) {
      const frame = new THREE.Mesh(new THREE.TorusGeometry(r * 0.9, r * 0.14, 8, 14), frameMat);
      frame.position.set(side * r * 1.05, y, z);
      parent.add(frame);
      const lens = new THREE.Mesh(new THREE.CircleGeometry(r * 0.78, 14), lensMat);
      lens.position.set(side * r * 1.05, y, z + r * 0.08);
      parent.add(lens);
    }
  }

  // つばの短いレーシングキャップ+スカーフ(クルム)
  function addCapFront(parent, y, colorHex) {
    const capMat = Game.mats.matte(colorHex);
    const dome = new THREE.Mesh(new THREE.SphereGeometry(0.27, SEG_MID, SEG_LOW, 0, Math.PI * 2, 0, Math.PI * 0.55), capMat);
    dome.position.y = y;
    dome.castShadow = true;
    parent.add(dome);
    const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.03, 12, 1, false, 0, Math.PI), capMat);
    brim.position.set(0, y - 0.02, 0.24);
    brim.rotation.x = Math.PI / 2;
    parent.add(brim);
  }
  function addScarf(parent, y, z, colorHex) {
    const scarfMat = Game.mats.matte(colorHex);
    const wrap = new THREE.Mesh(new THREE.TorusGeometry(0.26, 0.06, 8, SEG_MID), scarfMat);
    wrap.rotation.x = Math.PI / 2;
    wrap.position.set(0, y, z);
    wrap.castShadow = true;
    parent.add(wrap);
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.34, 0.04), scarfMat);
    tail.position.set(0.16, y - 0.22, z + 0.06);
    tail.rotation.z = 0.3;
    tail.castShadow = true;
    parent.add(tail);
  }

  // 飛行帽ゴーグル(ルポ)
  function addFlightCap(parent, y, r, colorHex) {
    const capMat = Game.mats.matte(colorHex);
    const cap = new THREE.Mesh(new THREE.SphereGeometry(r, SEG_MID, SEG_LOW, 0, Math.PI * 2, 0, Math.PI * 0.62), capMat);
    cap.position.y = y;
    cap.castShadow = true;
    parent.add(cap);
    for (const side of [-1, 1]) {
      const ear = new THREE.Mesh(new THREE.SphereGeometry(r * 0.32, 8, 8), capMat);
      ear.position.set(side * r * 0.75, y - r * 0.35, -r * 0.05);
      parent.add(ear);
    }
  }
  // 肩掛け配達バッグ(ルポ)
  function addDeliveryBag(parent, y, colorHex) {
    const bagMat = Game.mats.matte(colorHex);
    const strapMat = Game.mats.matte(0x7a4a20);
    const strap = new THREE.Mesh(new THREE.TorusGeometry(0.26, 0.03, 6, 12, Math.PI * 1.1), strapMat);
    strap.rotation.z = 0.5;
    strap.position.set(0, y + 0.1, 0);
    parent.add(strap);
    const bag = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.24, 0.12), bagMat);
    bag.position.set(-0.24, y - 0.14, -0.08);
    bag.rotation.y = 0.3;
    bag.castShadow = true;
    parent.add(bag);
    const flap = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.08, 0.13), Game.mats.matte(0xffffff));
    flap.position.set(-0.24, y - 0.03, -0.08);
    flap.rotation.y = 0.3;
    parent.add(flap);
  }
  // 大きな尻尾(ルポ)
  function addFoxTail(parent, y, colorHex) {
    const tailMat = new THREE.MeshLambertMaterial({ map: texFoxFur(64) });
    const tail = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.5, SEG_MID), tailMat);
    tail.position.set(0, y, -0.32);
    tail.rotation.x = Math.PI / 2.1;
    tail.castShadow = true;
    parent.add(tail);
    const tip = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 8), Game.mats.matte(0xffffff));
    tip.position.set(0, y - 0.02, -0.56);
    parent.add(tip);
    return tail;
  }

  // 岩の拳(ドンガ)
  function addRockFist(parent, x, y, z, r, colorHex) {
    const fistMat = new THREE.MeshLambertMaterial({ map: texCaramelRock(64) });
    const fist = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 0), fistMat);
    fist.position.set(x, y, z);
    fist.castShadow = true;
    parent.add(fist);
    return fist;
  }

  // 王冠(グミラス王)
  function addCrown(parent, y, r) {
    const crownMat = Game.mats.metal(0xd4af37);
    const base = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 1.05, r * 0.5, SEG_MID), crownMat);
    base.position.y = y;
    base.castShadow = true;
    parent.add(base);
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      const spike = new THREE.Mesh(new THREE.ConeGeometry(r * 0.16, r * 0.4, 6), crownMat);
      spike.position.set(Math.cos(a) * r * 0.82, y + r * 0.45, Math.sin(a) * r * 0.82);
      parent.add(spike);
    }
    const jewel = new THREE.Mesh(new THREE.SphereGeometry(r * 0.14, 8, 8), Game.mats.glow(0xff3b6e, 1.0));
    jewel.position.set(0, y + r * 0.15, r * 0.95);
    parent.add(jewel);
  }
  // マント(グミラス王)
  function addCape(parent, y0, y1, colorHex) {
    const capeMat = Game.mats.matte(colorHex);
    const cape = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.5, y0 - y1, SEG_MID, 1, true, Math.PI * 0.3, Math.PI * 1.4), capeMat);
    cape.position.set(0, (y0 + y1) / 2, -0.12);
    cape.rotation.y = Math.PI;
    cape.castShadow = true;
    parent.add(cape);
  }

  // 兜(ノワール卿)
  function addHelm(parent, y, r, colorHex) {
    const helmMat = new THREE.MeshLambertMaterial({ map: texBitterArmor(64) });
    const helm = new THREE.Mesh(new THREE.SphereGeometry(r, SEG_MID, SEG_MID), helmMat);
    helm.castShadow = true;
    helm.position.y = y;
    parent.add(helm);
    const crest = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.24, 0.05), Game.mats.metal(0x9a1c1c));
    crest.position.set(0, y + r * 1.05, -0.02);
    parent.add(crest);
    return helm;
  }

  // 年輪の口ヒゲ+モノクル+革手袋(バウム翁)
  function addMustache(parent, y, z, colorHex) {
    const m = Game.mats.matte(colorHex);
    for (const side of [-1, 1]) {
      const wisp = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.22, 6), m);
      wisp.position.set(side * 0.1, y, z);
      wisp.rotation.z = side * Math.PI / 2.3;
      wisp.rotation.x = 0.2;
      parent.add(wisp);
    }
  }
  function addMonocle(parent, x, y, z, r) {
    const frameMat = Game.mats.metal(0xd4af37);
    const lensMat = Game.mats.glass(0xffffff, 0.3);
    const frame = new THREE.Mesh(new THREE.TorusGeometry(r, 0.016, 6, 14), frameMat);
    frame.position.set(x, y, z);
    parent.add(frame);
    const lens = new THREE.Mesh(new THREE.CircleGeometry(r * 0.85, 12), lensMat);
    lens.position.set(x, y, z + 0.01);
    parent.add(lens);
    const chain = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.006, 4, 8, Math.PI), frameMat);
    chain.position.set(x + 0.05, y - 0.12, z - 0.02);
    chain.rotation.z = Math.PI;
    parent.add(chain);
  }
  function addGloveHand(parent, x, y, z, colorHex) {
    const g = new THREE.Mesh(new THREE.SphereGeometry(0.09, SEG_LOW, SEG_LOW), Game.mats.matte(colorHex));
    g.position.set(x, y, z);
    g.castShadow = true;
    parent.add(g);
    return g;
  }

  // アイシングの隈取り(ジンジャ)+ミントの帯
  function addIcingMarks(parent, y, z, colorHex) {
    const icingMat = Game.mats.matte(colorHex);
    for (const side of [-1, 1]) {
      const mark = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.02, 6, 10, Math.PI * 0.9), icingMat);
      mark.position.set(side * 0.13, y, z);
      mark.rotation.y = Math.PI / 2;
      mark.rotation.z = side > 0 ? Math.PI * 0.15 : Math.PI * 0.85;
      parent.add(mark);
    }
  }
  function addNinjaSash(parent, y, colorHex) {
    const sashMat = Game.mats.matte(colorHex);
    const wrap = new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.045, 6, SEG_MID), sashMat);
    wrap.rotation.x = Math.PI / 2;
    wrap.position.y = y;
    wrap.castShadow = true;
    parent.add(wrap);
    const tailKnot = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.2, 0.03), sashMat);
    tailKnot.position.set(0.14, y - 0.16, -0.14);
    tailKnot.rotation.z = -0.3;
    parent.add(tailKnot);
  }

  // 半透明の雫状下半身(シズク)
  function buildDropletBase(parent, colorHex) {
    const dropMat = Game.mats.glass(colorHex, 0.55);
    const drop = new THREE.Mesh(new THREE.SphereGeometry(0.3, SEG_MID, SEG_MID), dropMat);
    drop.scale.set(1, 1.35, 1);
    drop.position.y = 0.28;
    drop.castShadow = true;
    parent.add(drop);
    return drop;
  }

  // LEDツインアイ(ヴォルト8)/アンテナ
  function addAntenna(parent, y, colorHex) {
    const stalk = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.22, 6), Game.mats.metal());
    stalk.position.y = y;
    parent.add(stalk);
    const tip = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 8), Game.mats.glow(colorHex, 1.6));
    tip.position.y = y + 0.13;
    parent.add(tip);
  }

  // ==================== キャラ定義(DESIGN.md 2-v3表と完全一致) ====================
  const list = [
    { id: 'kurumu', name: 'クルム', motif: 'パン種の妖精。クリームの前髪、キャップ+ゴーグル、赤スカーフ', personality: '主人公気質の元気な小型人外',
      color: 0xe8412f, stats: { speed: 3, accel: 3, handling: 3, weight: 3 } },
    { id: 'rupo', name: 'ルポ', motif: '宅配キツネ。飛行帽ゴーグル、肩掛け配達バッグ、大きな尻尾', personality: '軽快でフレンドリーな配達屋',
      color: 0xff8c2b, stats: { speed: 3, accel: 4, handling: 4, weight: 1 } },
    { id: 'donga', name: 'ドンガ', motif: 'キャラメル岩のゴーレム。ひび割れから溶岩色の光、岩の拳', personality: '寡黙で圧倒的なパワー型',
      color: 0x8a7362, stats: { speed: 5, accel: 1, handling: 1, weight: 5 } },
    { id: 'volt8', name: 'ヴォルト8', motif: 'ワッフル工場製レースロボ。ツインLEDアイ、アンテナ、下半身はマシンと一体化', personality: '合理的で無表情、時々ユーモラス',
      color: 0xb9bec9, stats: { speed: 4, accel: 3, handling: 2, weight: 3 } },
    { id: 'shizuku', name: 'シズク', motif: 'シロップの水精霊。半透明ガラス質の体、オーロラ色の髪、浮遊', personality: '気まぐれで浮遊感のあるマイペース屋',
      color: 0x5ec8f0, stats: { speed: 2, accel: 4, handling: 5, weight: 1 } },
    { id: 'gumiras', name: 'グミラス王', motif: 'グミの王。ゼリー質の恰幅ある体、金の王冠、赤マント、余裕の笑み', personality: '陽気で余裕たっぷりの王様',
      color: 0x9a4fd6, stats: { speed: 4, accel: 2, handling: 2, weight: 4 } },
    { id: 'noir', name: 'ノワール卿', motif: 'ビターカカオの騎士。黒鎧、兜のスリットから赤い目が光る、不敵', personality: '寡黙不敵なライバル',
      color: 0x241512, stats: { speed: 5, accel: 2, handling: 3, weight: 3 } },
    { id: 'baumjii', name: 'バウム翁', motif: '年輪の樹精の長老。クリームの口ヒゲ、モノクル、革手袋', personality: '穏やかで職人気質のベテラン',
      color: 0xa9773f, stats: { speed: 3, accel: 2, handling: 4, weight: 4 } },
    { id: 'ginja', name: 'ジンジャ', motif: 'ジンジャークッキーの忍者。アイシングの隈取り、ミントの帯、ニヤリ顔', personality: '身軽なトリックスター',
      color: 0xa86a34, stats: { speed: 2, accel: 5, handling: 4, weight: 1 } },
  ];

  // ==================== ビルダー群 ====================
  // 各ビルダーは Group を返す。userData.parts に以下を積む(animate()が参照):
  //  { armL, armR, mouths:{normal,excited,dizzy,joy}, eyeL, eyeR, headY(baseY), bodyRoot }
  // (ノワール卿はmouthsの代わりにslitsを持つ。setExprは両方に対応)

  // 1) クルム: パン種の妖精。小柄(身長目安1.1)。赤×クリーム、キャップ+ゴーグル+赤スカーフ
  function buildKurumu() {
    const g = new THREE.Group();
    const doughMat = new THREE.MeshLambertMaterial({ map: texCreamSwirl(64) });
    const bodyMat = Game.mats.matte(0xe8412f);
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.34, SEG_MID, SEG_LOW), bodyMat);
    body.scale.set(1, 1.15, 0.95);
    body.position.y = 0.42;
    body.castShadow = true;
    g.add(body);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.26, SEG_MID, SEG_LOW), doughMat);
    head.position.y = 0.82;
    head.castShadow = true;
    g.add(head);
    const eyes = addEyes(g, 0.85, 0.22, 0.1, 0.06, 0x4a2a1c);
    const mouths = addMouthSet(g, 0.75, 0.25, 0.12, 0.09);
    addGoggles(g, 0.85, 0.24, 0.08, 0x69d1ff);
    addCapFront(g, 1.0, 0xfff6e0);
    addScarf(g, 0.6, 0.1, 0xe8412f);
    const armL = addArm(g, -0.34, 0.52, 0.04, 0.16, 0.06, 0xe8412f, -1);
    const armR = addArm(g, 0.34, 0.52, 0.04, 0.16, 0.06, 0xe8412f, 1);
    addLeg(g, -0.13, 0.13, 0xfff6e0);
    addLeg(g, 0.13, 0.13, 0xfff6e0);
    g.userData.parts = { armL, armR, eyeL: eyes.left, eyeR: eyes.right, mouths, headY: 0.85, bodyRoot: g };
    return g;
  }

  // 2) ルポ: 宅配キツネ。中型、軽量。オレンジ×白、飛行帽+ゴーグル+配達バッグ+尻尾
  function buildRupo() {
    const g = new THREE.Group();
    const furMat = new THREE.MeshLambertMaterial({ map: texFoxFur(64) });
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.26, 0.42, 4, SEG_MID), furMat);
    body.position.y = 0.55;
    body.castShadow = true;
    g.add(body);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.24, SEG_MID, SEG_LOW), furMat);
    head.position.y = 1.02;
    head.castShadow = true;
    g.add(head);
    // キツネの鼻先(円錐)
    const muzzle = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.2, SEG_LOW), Game.mats.matte(0xfff2e0));
    muzzle.position.set(0, 0.98, 0.24);
    muzzle.rotation.x = Math.PI / 2;
    muzzle.castShadow = true;
    g.add(muzzle);
    // 三角の耳
    for (const side of [-1, 1]) {
      const ear = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.2, 6), Game.mats.matte(0xff8c2b));
      ear.position.set(side * 0.14, 1.24, -0.02);
      ear.castShadow = true;
      g.add(ear);
    }
    const eyes = addEyes(g, 1.02, 0.22, 0.09, 0.055, 0x3a2a1c);
    const mouths = addMouthSet(g, 0.94, 0.28, 0.11, 0.08);
    addFlightCap(g, 1.16, 0.22, 0x5a3a20);
    addGoggles(g, 1.02, 0.2, 0.075, 0xffe066);
    addDeliveryBag(g, 0.68, 0xffffff);
    const tail = addFoxTail(g, 0.5, 0xff8c2b);
    const armL = addArm(g, -0.28, 0.56, 0.04, 0.17, 0.06, 0xff8c2b, -1);
    const armR = addArm(g, 0.28, 0.56, 0.04, 0.17, 0.06, 0xff8c2b, 1);
    addLeg(g, -0.12, 0.14, 0xffffff);
    addLeg(g, 0.12, 0.14, 0xffffff);
    g.userData.parts = { armL, armR, eyeL: eyes.left, eyeR: eyes.right, mouths, headY: 1.02, bodyRoot: g, tail };
    return g;
  }

  // 3) ドンガ: キャラメル岩のゴーレム。大柄(身長目安1.6)、重量級。岩グレー×溶岩発光
  function buildDonga() {
    const g = new THREE.Group();
    const rockMat = new THREE.MeshLambertMaterial({ map: texCaramelRock(128) });
    const legL = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 0.4, SEG_MID), rockMat);
    legL.position.set(-0.2, 0.2, 0);
    legL.castShadow = true;
    g.add(legL);
    const legR = legL.clone();
    legR.position.x = 0.2;
    g.add(legR);
    const body = new THREE.Mesh(new THREE.DodecahedronGeometry(0.42, 0), rockMat);
    body.scale.set(1, 1.15, 0.9);
    body.position.y = 0.78;
    body.castShadow = true;
    g.add(body);
    // ひび割れ発光(体表に埋め込む発光ライン)
    for (let i = 0; i < 3; i++) {
      const crack = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.28, 0.02), Game.mats.glow(0xff5a1c, 1.5));
      crack.position.set((-0.15 + i * 0.15), 0.7 + i * 0.06, 0.36);
      crack.rotation.z = (i - 1) * 0.3;
      g.add(crack);
    }
    const head = new THREE.Mesh(new THREE.IcosahedronGeometry(0.28, 0), rockMat);
    head.position.y = 1.32;
    head.castShadow = true;
    g.add(head);
    const eyes = addEyes(g, 1.34, 0.24, 0.12, 0.075, 0xff6a1c);
    const mouths = addMouthSet(g, 1.2, 0.28, 0.15, 0.1);
    const armL = addArm(g, -0.5, 0.86, 0.02, 0.26, 0.11, 0x8a7362, -1);
    const armR = addArm(g, 0.5, 0.86, 0.02, 0.26, 0.11, 0x8a7362, 1);
    const fistL = addRockFist(g, -0.5 - 0.28 * 0.35, 0.86 - 0.26 * 0.15, 0.02, 0.15, 0x8a7362);
    const fistR = addRockFist(g, 0.5 + 0.28 * 0.35, 0.86 - 0.26 * 0.15, 0.02, 0.15, 0x8a7362);
    g.userData.parts = { armL, armR, eyeL: eyes.left, eyeR: eyes.right, mouths, headY: 1.34, bodyRoot: g, fistL, fistR };
    return g;
  }

  // 4) ヴォルト8: レースロボ。機械シルエット。**特例: 下半身なし、胴体がシートに直接接続**
  function buildVolt8() {
    const g = new THREE.Group();
    const metalMat = Game.mats.metal(0xb9bec9);
    const darkMat = Game.mats.matte(0x2c2f36);
    // 胴体(シートへ直結する土台。座標y=0付近から始まる=脚を作らない)
    const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.3, 0.55, SEG_MID), metalMat);
    torso.position.y = 0.4;
    torso.castShadow = true;
    g.add(torso);
    const chestPlate = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.26, 0.12), darkMat);
    chestPlate.position.set(0, 0.5, 0.2);
    chestPlate.castShadow = true;
    g.add(chestPlate);
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.11, 0.12, SEG_LOW), metalMat);
    neck.position.y = 0.72;
    g.add(neck);
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.28, 0.3), metalMat);
    head.position.y = 0.94;
    head.castShadow = true;
    g.add(head);
    // 顔パネル(つや消し暗色)
    const facePanel = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.16, 0.02), darkMat);
    facePanel.position.set(0, 0.94, 0.16);
    g.add(facePanel);
    // LEDツインアイ(発光。表情は色/明滅で表現するため4種メッシュをvisible切替)
    const eyeGeom = new THREE.BoxGeometry(0.06, 0.05, 0.02);
    const eyeColors = {
      [EXPR.NORMAL]: 0x4de0ff, [EXPR.EXCITED]: 0xff9a3c, [EXPR.DIZZY]: 0xff3b6e, [EXPR.JOY]: 0x7fff7f,
    };
    const ledEyes = {};
    for (const expr of Object.keys(eyeColors)) {
      const grp = new THREE.Group();
      grp.visible = expr === EXPR.NORMAL;
      grp.name = 'led_' + expr;
      for (const side of [-1, 1]) {
        const led = new THREE.Mesh(eyeGeom, Game.mats.glow(eyeColors[expr], 1.8));
        led.position.set(side * 0.07, 0.95, 0.17);
        grp.add(led);
      }
      g.add(grp);
      ledEyes[expr] = grp;
    }
    addAntenna(g, 1.1, 0x4de0ff);
    const armL = addArm(g, -0.32, 0.58, 0, 0.2, 0.08, 0xb9bec9, -1, Game.mats.metal);
    const armR = addArm(g, 0.32, 0.58, 0, 0.2, 0.08, 0xb9bec9, 1, Game.mats.metal);
    // 手先はブロック状クローで機械感を強調
    const handL = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.1), darkMat);
    handL.position.set(-0.32 - 0.2 * 0.35, 0.58 - 0.2 * 0.15, 0);
    g.add(handL);
    const handR = handL.clone();
    handR.position.x = 0.32 + 0.2 * 0.35;
    g.add(handR);
    // 下半身の代わり: マシン一体化を示すシアン発光コアリング(座席接続部)
    const core = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.04, 8, SEG_MID), Game.mats.glow(0x4de0ff, 1.2));
    core.rotation.x = Math.PI / 2;
    core.position.y = 0.08;
    g.add(core);
    g.userData.parts = {
      armL, armR, eyeL: null, eyeR: null, mouths: ledEyes, headY: 0.94, bodyRoot: g,
      noBounceLegs: true,
    };
    return g;
  }

  // 5) シズク: シロップの水精霊。半透明ガラス質+オーロラ髪、雫状の下半身で浮遊(脚なし)
  function buildShizuku() {
    const g = new THREE.Group();
    const drop = buildDropletBase(g, 0x5ec8f0);
    const bodyMat = Game.mats.glass(0x8fdcff, 0.5);
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.28, SEG_MID, SEG_MID), bodyMat);
    body.position.y = 0.72;
    body.castShadow = true;
    g.add(body);
    // オーロラ色の髪(複数の細いカプセルを放射状に)
    const auroraColors = [0xff9fd6, 0x9fd6ff, 0xd6ff9f];
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const strand = new THREE.Mesh(new THREE.CapsuleGeometry(0.025, 0.22, 4, 6),
        Game.mats.glow(auroraColors[i % auroraColors.length], 0.9));
      strand.position.set(Math.cos(a) * 0.16, 0.98, Math.sin(a) * 0.16 - 0.05);
      strand.rotation.z = Math.cos(a) * 0.5;
      strand.rotation.x = Math.sin(a) * 0.5 + 0.3;
      g.add(strand);
    }
    const eyes = addEyes(g, 0.76, 0.24, 0.1, 0.06, 0x2c6a8c);
    const mouths = addMouthSet(g, 0.66, 0.27, 0.12, 0.09);
    // 浮遊の泡飾り
    const bubbleMat = Game.mats.glass(0xffffff, 0.75);
    const bubbles = [];
    for (const [x, y, z] of [[0.22, 0.5, 0.18], [-0.2, 0.35, -0.15], [0.14, 0.2, 0.2]]) {
      const b = new THREE.Mesh(new THREE.SphereGeometry(0.035, 6, 6), bubbleMat);
      b.position.set(x, y, z);
      g.add(b);
      bubbles.push(b);
    }
    const armL = addArm(g, -0.26, 0.68, 0.02, 0.15, 0.05, 0x8fdcff, -1, Game.mats.glass);
    const armR = addArm(g, 0.26, 0.68, 0.02, 0.15, 0.05, 0x8fdcff, 1, Game.mats.glass);
    g.userData.parts = {
      armL, armR, eyeL: eyes.left, eyeR: eyes.right, mouths, headY: 0.76, bodyRoot: g,
      bubbles, floating: true, drop,
    };
    return g;
  }

  // 6) グミラス王: グミの王。ゼリー質の恰幅ある大柄体。紫グミ×金、王冠+赤マント
  function buildGumiras() {
    const g = new THREE.Group();
    const jellyMat = Game.mats.glass(0x9a4fd6, 0.72);
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.44, SEG_MID, SEG_MID), jellyMat);
    body.scale.set(1.15, 1.05, 1.05);
    body.position.y = 0.56;
    body.castShadow = true;
    g.add(body);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.28, SEG_MID, SEG_LOW), jellyMat);
    head.position.y = 1.06;
    head.castShadow = true;
    g.add(head);
    addCape(g, 0.98, 0.12, 0xc9273f);
    addCrown(g, 1.28, 0.2);
    const eyes = addEyes(g, 1.08, 0.26, 0.12, 0.075, 0x5a2a70);
    const mouths = addMouthSet(g, 0.96, 0.3, 0.16, 0.11);
    const armL = addArm(g, -0.46, 0.68, 0.05, 0.22, 0.09, 0x9a4fd6, -1, Game.mats.glass);
    const armR = addArm(g, 0.46, 0.68, 0.05, 0.22, 0.09, 0x9a4fd6, 1, Game.mats.glass);
    addLeg(g, -0.18, 0.15, 0x9a4fd6, Game.mats.glass);
    addLeg(g, 0.18, 0.15, 0x9a4fd6, Game.mats.glass);
    g.userData.parts = { armL, armR, eyeL: eyes.left, eyeR: eyes.right, mouths, headY: 1.08, bodyRoot: g, jelly: true };
    return g;
  }

  // 7) ノワール卿: ビターカカオの騎士。縦長シルエット。黒鎧+兜スリット発光
  function buildNoir() {
    const g = new THREE.Group();
    const armorMat = new THREE.MeshLambertMaterial({ map: texBitterArmor(128) });
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.28, 0.6, SEG_MID), armorMat);
    body.position.y = 0.5;
    body.castShadow = true;
    g.add(body);
    const shoulderMat = Game.mats.metal(0x3a1414);
    for (const side of [-1, 1]) {
      const shoulder = new THREE.Mesh(new THREE.SphereGeometry(0.14, SEG_LOW, SEG_LOW, 0, Math.PI * 2, 0, Math.PI / 1.6), shoulderMat);
      shoulder.position.set(side * 0.26, 0.76, 0);
      shoulder.castShadow = true;
      g.add(shoulder);
    }
    const helm = addHelm(g, 1.06, 0.24, 0x241512);
    const slits = addSlitSet(g, 1.06, 0.235, 0.2, 0.06);
    const armL = addArm(g, -0.34, 0.66, 0.02, 0.2, 0.08, 0x241512, -1);
    const armR = addArm(g, 0.34, 0.66, 0.02, 0.2, 0.08, 0x241512, 1);
    addLeg(g, -0.13, 0.15, 0x1a0f0d);
    addLeg(g, 0.13, 0.15, 0x1a0f0d);
    // 腰の金帯(強さの装飾)
    const belt = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 0.07, SEG_MID), Game.mats.metal(0x8a1c1c));
    belt.position.y = 0.32;
    g.add(belt);
    g.userData.parts = { armL, armR, eyeL: null, eyeR: null, mouths: slits, headY: 1.06, bodyRoot: g, isSlit: true };
    return g;
  }

  // 8) バウム翁: 年輪の樹精の長老。縦長シルエット。ウッド茶×モスグリーン
  function buildBaumjii() {
    const g = new THREE.Group();
    const woodMat = new THREE.MeshLambertMaterial({ map: texWoodRing(128) });
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.3, 0.68, SEG_MID), woodMat);
    body.position.y = 0.48;
    body.castShadow = true;
    g.add(body);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.25, SEG_MID, SEG_LOW), Game.mats.matte(0xc79a5e));
    head.position.y = 0.98;
    head.castShadow = true;
    g.add(head);
    // モスグリーンの葉飾り(頭頂)
    const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.2, 6), Game.mats.matte(0x5e8a4a));
    leaf.position.y = 1.2;
    leaf.rotation.x = 0.3;
    g.add(leaf);
    const eyes = addEyes(g, 0.98, 0.22, 0.1, 0.065, 0x5a3a20);
    const mouths = addMouthSet(g, 0.86, 0.27, 0.14, 0.1);
    addMustache(g, 0.9, 0.24, 0xfff6e0);
    addMonocle(g, 0.1, 0.98, 0.24, 0.08);
    const armL = addArm(g, -0.34, 0.58, 0.04, 0.19, 0.08, 0x5e8a4a, -1);
    const armR = addArm(g, 0.34, 0.58, 0.04, 0.19, 0.08, 0x5e8a4a, 1);
    const gloveL = addGloveHand(g, -0.34 - 0.19 * 0.35, 0.58 - 0.19 * 0.15, 0.04, 0x7a4a26);
    const gloveR = addGloveHand(g, 0.34 + 0.19 * 0.35, 0.58 - 0.19 * 0.15, 0.04, 0x7a4a26);
    addLeg(g, -0.14, 0.14, 0x5a3a20);
    addLeg(g, 0.14, 0.14, 0x5a3a20);
    g.userData.parts = { armL, armR, eyeL: eyes.left, eyeR: eyes.right, mouths, headY: 0.98, bodyRoot: g, gloveL, gloveR };
    return g;
  }

  // 9) ジンジャ: ジンジャークッキーの忍者。小柄・軽量。ジンジャー茶×白×ミント
  function buildGinja() {
    const g = new THREE.Group();
    const bodyTexMat = new THREE.MeshLambertMaterial({ map: texGingerBody(64) });
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.2, 0.34, 4, SEG_MID), bodyTexMat);
    body.position.y = 0.42;
    body.castShadow = true;
    g.add(body);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.22, SEG_MID, SEG_LOW), bodyTexMat);
    head.position.y = 0.82;
    head.castShadow = true;
    g.add(head);
    const eyes = addEyes(g, 0.84, 0.19, 0.09, 0.055, 0x3a2410);
    const mouths = addMouthSet(g, 0.76, 0.23, 0.12, 0.08);
    addIcingMarks(g, 0.84, 0.18, 0xffffff);
    addNinjaSash(g, 0.56, 0x7fe0c0);
    const armL = addArm(g, -0.26, 0.5, 0.03, 0.16, 0.06, 0xa86a34, -1);
    const armR = addArm(g, 0.26, 0.5, 0.03, 0.16, 0.06, 0xa86a34, 1);
    addLeg(g, -0.11, 0.12, 0x7fe0c0);
    addLeg(g, 0.11, 0.12, 0x7fe0c0);
    g.userData.parts = { armL, armR, eyeL: eyes.left, eyeR: eyes.right, mouths, headY: 0.84, bodyRoot: g };
    return g;
  }

  const builders = {
    kurumu: buildKurumu,
    rupo: buildRupo,
    donga: buildDonga,
    volt8: buildVolt8,
    shizuku: buildShizuku,
    gumiras: buildGumiras,
    noir: buildNoir,
    baumjii: buildBaumjii,
    ginja: buildGinja,
  };

  function build(id) {
    const fn = builders[id] || buildKurumu;
    const g = fn();
    g.name = 'char_' + id;
    // アニメ用ランタイム状態(kart.jsのupdateVisualから毎フレーム呼ばれるanimate()が使う)
    g.userData.anim = {
      expr: EXPR.NORMAL,
      bounceT: Math.random() * 10, // 個体差(全員が同期して跳ねないように位相をずらす)
      armBase: { L: g.userData.parts.armL.rotation.z, R: g.userData.parts.armR.rotation.z },
      leanX: 0, leanZ: 0,
      joyRaise: 0,
    };
    return g;
  }

  // キャラごとのマウントスケール(小柄0.95〜大柄1.25)
  const MOUNT_SCALE = {
    kurumu: 0.95,
    rupo: 1.0,
    donga: 1.25,
    volt8: 1.05,
    shizuku: 1.0,
    gumiras: 1.22,
    noir: 1.1,
    baumjii: 1.1,
    ginja: 0.95,
  };

  // kart.group内のriderPlaceholderを除去し、同位置にキャラを座らせる
  function mountOn(kart, id) {
    if (!kart || !kart.group) return;
    const placeholder = kart.group.getObjectByName('riderPlaceholder');
    const pos = placeholder ? placeholder.position.clone() : new THREE.Vector3(0, 1.0, -0.25);
    const parent = placeholder ? placeholder.parent : kart._tilt || kart.group;
    if (placeholder && parent) parent.remove(placeholder);

    const charGroup = build(id);
    const scale = MOUNT_SCALE[id] || 1.1;
    charGroup.scale.setScalar(scale);
    charGroup.position.set(pos.x, pos.y - 0.15, pos.z);
    if (parent) parent.add(charGroup);
    else kart.group.add(charGroup);
    charGroup.traverse((o) => { if (o.isMesh) o.castShadow = true; }); // キャラも影を落とす

    kart.charId = id;
    const def = list.find((c) => c.id === id);
    kart.charName = def ? def.name : id;
    kart._charGroup = charGroup;
  }

  // ==================== アニメーション ====================
  // 表情切替はexprが変化した時だけ行う(毎フレームのテクスチャ生成はしない。
  // 表情ごとの口/スリットメッシュはbuild()時に事前生成済みで、ここではvisible切替のみ)
  function setExpr(parts, anim, expr) {
    if (anim.expr === expr) return;
    anim.expr = expr;
    for (const key of Object.keys(parts.mouths)) {
      parts.mouths[key].visible = key === expr;
    }
  }

  // キャラ個性別の走行アニメ調整係数(DESIGN.md要求: ドンガ=重々しい, シズク=浮遊,
  // ジンジャ=素早い小刻み, ノワール=ほぼ動じない, グミラス=ぷるぷる)
  const PERSONA = {
    donga:   { bounceMul: 0.55, freqMul: 0.6,  leanMul: 0.7,  armSwingMul: 0.7 },
    shizuku: { bounceMul: 0,    freqMul: 1.0,  leanMul: 1.0,  armSwingMul: 0.8, hover: true },
    ginja:   { bounceMul: 1.3,  freqMul: 1.9,  leanMul: 1.3,  armSwingMul: 1.4 },
    noir:    { bounceMul: 0.35, freqMul: 0.7,  leanMul: 0.4,  armSwingMul: 0.35 },
    gumiras: { bounceMul: 1.0,  freqMul: 1.0,  leanMul: 1.0,  armSwingMul: 1.0, jiggle: true },
  };
  const DEFAULT_PERSONA = { bounceMul: 1.0, freqMul: 1.0, leanMul: 1.0, armSwingMul: 1.0 };

  function animate(kart, dt, steer) {
    const g = kart._charGroup;
    if (!g || !g.userData || !g.userData.parts) return;
    const parts = g.userData.parts;
    const anim = g.userData.anim;
    const U = Game.U;
    const P = PERSONA[kart.charId] || DEFAULT_PERSONA;

    const spinning = kart.spinT > 0;
    const boosting = kart.boostT > 0;
    const starring = kart.starT > 0;
    const justFinishedWon = kart.finished && kart.rank === 1;

    // ---- 表情切り替え(状態が変わった時だけ) ----
    if (justFinishedWon) setExpr(parts, anim, EXPR.JOY);
    else if (spinning) setExpr(parts, anim, EXPR.DIZZY);
    else if (boosting || starring) setExpr(parts, anim, EXPR.EXCITED);
    else setExpr(parts, anim, EXPR.NORMAL);

    // ---- 速度に応じた上下バウンス(もちもち感)。キャラ個性で係数を変える ----
    const speedRatio = U.clamp(Math.abs(kart.speed) / (Game.config.physics.maxSpeed || 30), 0, 1.6);
    const freq = (ANIM.bounceFreqMin + (ANIM.bounceFreqMax - ANIM.bounceFreqMin) * Math.min(speedRatio, 1)) * P.freqMul;
    anim.bounceT += dt * freq;
    const baseAmp = kart.grounded
      ? ANIM.bounceAmpBase + (boosting || starring ? ANIM.bounceAmpBoost : 0) * (0.6 + 0.4 * Math.sin(anim.bounceT * 2))
      : 0;
    const amp = baseAmp * P.bounceMul;
    let bounceY = spinning ? 0 : Math.abs(Math.sin(anim.bounceT)) * amp;
    // シズクは接地バウンスなしで、ゆったり上下に浮遊する
    if (P.hover) {
      bounceY = 0.06 + Math.sin(anim.bounceT * 0.6) * 0.035;
    }
    g.position.y = -0.15 + bounceY;
    // わずかなスクイーズ(もちもち感の核: 縦伸縮に対し横を逆位相で伸縮)。グミラスはゼリー質でより強く
    const squishAmpMul = P.jiggle ? 2.2 : 1.0;
    const squish = spinning ? 1 : 1 + Math.sin(anim.bounceT) * (amp * 1.6 * squishAmpMul);
    const scaleBase = g.scale.x > 0 ? undefined : undefined; // no-op (scale set on mount; keep relative factor)
    const baseScale = MOUNT_SCALE[kart.charId] || 1.1;
    g.scale.set(baseScale / Math.sqrt(squish), baseScale * squish, baseScale / Math.sqrt(squish));

    // ---- ステア/ドリフト方向へのリーン ----
    let targetLeanZ = -steer * ANIM.leanMax * 0.5 * P.leanMul;
    let targetLeanX = 0;
    if (kart.drift && kart.drift.state === 'drifting') {
      targetLeanZ = -kart.drift.dir * ANIM.leanMax * P.leanMul;
    }
    if (boosting || starring) {
      targetLeanX = ANIM.forwardLeanBoost;
    }
    anim.leanZ = U.damp(anim.leanZ, targetLeanZ, ANIM.leanDamp, dt);
    anim.leanX = U.damp(anim.leanX, targetLeanX, ANIM.leanDamp, dt);
    g.rotation.z = anim.leanZ;
    g.rotation.x = -anim.leanX;

    // ---- 腕アニメーション ----
    const armL = parts.armL, armR = parts.armR;
    if (spinning) {
      // 被弾スピン中: 腕をバタバタ(ノワールは動じないため控えめ)
      const flap = Math.sin(anim.bounceT * ANIM.armFlapFreq) * ANIM.armFlapAmp * P.armSwingMul;
      armL.rotation.x = flap;
      armR.rotation.x = -flap;
      anim.joyRaise = 0;
      // 目を回す表情: 目メッシュを頭部中心にぐるぐる回転(目がないキャラはガード済み)
      const spin = performance.now() * 0.001 * ANIM.dizzyHeadSpin;
      if (parts.eyeL) parts.eyeL.rotation.z = spin;
      if (parts.eyeR) parts.eyeR.rotation.z = -spin;
    } else if (justFinishedWon) {
      // ゴール1位: 両腕を上げる(joy)
      anim.joyRaise = U.damp(anim.joyRaise, 1, ANIM.joyArmUpSpeed, dt);
      armL.rotation.x = -anim.joyRaise * 2.4;
      armR.rotation.x = -anim.joyRaise * 2.4;
      if (parts.eyeL) parts.eyeL.rotation.z = U.damp(parts.eyeL.rotation.z, 0, 10, dt);
      if (parts.eyeR) parts.eyeR.rotation.z = U.damp(parts.eyeR.rotation.z, 0, 10, dt);
    } else {
      anim.joyRaise = U.damp(anim.joyRaise, 0, ANIM.joyArmUpSpeed, dt);
      // 通常時: 走行に合わせて軽く前後に揺らす(ランニングモーション)。キャラごとに速さが違う
      const swing = Math.sin(anim.bounceT) * 0.25 * Math.min(speedRatio, 1) * P.armSwingMul;
      armL.rotation.x = swing - anim.joyRaise * 2.4;
      armR.rotation.x = -swing - anim.joyRaise * 2.4;
      if (parts.eyeL) parts.eyeL.rotation.z = U.damp(parts.eyeL.rotation.z, 0, 10, dt);
      if (parts.eyeR) parts.eyeR.rotation.z = U.damp(parts.eyeR.rotation.z, 0, 10, dt);
    }

    // シズクの泡/髪はふわふわ漂わせる(専用パーツがある場合のみ)
    if (parts.bubbles) {
      const t = anim.bounceT;
      for (let i = 0; i < parts.bubbles.length; i++) {
        parts.bubbles[i].position.y += Math.sin(t * 1.7 + i) * 0.0006;
      }
    }
  }

  // ---- 似顔絵(選択画面カード用): 陰影/ハイライト/輪郭線で品質向上 ----
  function radialBg(ctx, size) {
    const grad = ctx.createRadialGradient(size / 2, size / 2, size * 0.05, size / 2, size / 2, size * 0.62);
    grad.addColorStop(0, '#ffffff');
    grad.addColorStop(1, '#ffe8ef');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);
  }

  // 円形に軽い陰影(下部を暗く、左上をハイライト)を落として立体感を出す
  function shadeCircle(ctx, cx, cy, r, baseColor) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.clip();
    ctx.fillStyle = baseColor;
    ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
    const shade = ctx.createRadialGradient(cx - r * 0.35, cy - r * 0.4, r * 0.1, cx, cy, r * 1.1);
    shade.addColorStop(0, 'rgba(255,255,255,0.45)');
    shade.addColorStop(0.55, 'rgba(255,255,255,0)');
    shade.addColorStop(1, 'rgba(0,0,0,0.22)');
    ctx.fillStyle = shade;
    ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
    ctx.restore();
    // 輪郭線
    ctx.strokeStyle = 'rgba(0,0,0,0.18)';
    ctx.lineWidth = r * 0.045;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();
  }

  function eyesAndMouth(ctx, size, cx, cy, r, irisColor, mouthColor) {
    // 白目
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.ellipse(cx - r * 1.1, cy, r * 0.42, r * 0.46, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(cx + r * 1.1, cy, r * 0.42, r * 0.46, 0, 0, Math.PI * 2); ctx.fill();
    // 虹彩
    ctx.fillStyle = irisColor || '#3a2a20';
    ctx.beginPath(); ctx.arc(cx - r * 1.1, cy + r * 0.05, r * 0.3, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(cx + r * 1.1, cy + r * 0.05, r * 0.3, 0, Math.PI * 2); ctx.fill();
    // 輪郭
    ctx.strokeStyle = 'rgba(0,0,0,0.35)';
    ctx.lineWidth = r * 0.05;
    ctx.beginPath(); ctx.ellipse(cx - r * 1.1, cy, r * 0.42, r * 0.46, 0, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.ellipse(cx + r * 1.1, cy, r * 0.42, r * 0.46, 0, 0, Math.PI * 2); ctx.stroke();
    // ハイライト
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.arc(cx - r * 1.1 + r * 0.12, cy - r * 0.14, r * 0.13, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(cx + r * 1.1 + r * 0.12, cy - r * 0.14, r * 0.13, 0, Math.PI * 2); ctx.fill();
    // 口
    ctx.strokeStyle = mouthColor || '#7a3b2e';
    ctx.lineWidth = size * 0.02;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(cx, cy + r * 1.3, r * 0.75, 0.15 * Math.PI, 0.85 * Math.PI);
    ctx.stroke();
  }

  const portraitDrawers = {
    kurumu(ctx, size) {
      radialBg(ctx, size);
      shadeCircle(ctx, size * 0.5, size * 0.36, size * 0.3, '#fff6e0');
      shadeCircle(ctx, size * 0.5, size * 0.62, size * 0.3, '#e8412f');
      eyesAndMouth(ctx, size, size * 0.5, size * 0.4, size * 0.045, '#4a2a1c');
      // ゴーグル
      ctx.strokeStyle = 'rgba(51,51,51,0.85)';
      ctx.lineWidth = size * 0.02;
      ctx.beginPath(); ctx.arc(size * 0.5 - size * 0.11, size * 0.4, size * 0.07, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.arc(size * 0.5 + size * 0.11, size * 0.4, size * 0.07, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = 'rgba(105,209,255,0.35)';
      ctx.beginPath(); ctx.arc(size * 0.5 - size * 0.11, size * 0.4, size * 0.06, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(size * 0.5 + size * 0.11, size * 0.4, size * 0.06, 0, Math.PI * 2); ctx.fill();
      // キャップ
      ctx.fillStyle = '#fff6e0';
      ctx.beginPath(); ctx.arc(size * 0.5, size * 0.18, size * 0.17, Math.PI, Math.PI * 2); ctx.fill();
      // スカーフ
      ctx.fillStyle = '#e8412f';
      ctx.fillRect(size * 0.36, size * 0.72, size * 0.28, size * 0.08);
    },
    rupo(ctx, size) {
      radialBg(ctx, size);
      shadeCircle(ctx, size * 0.5, size * 0.5, size * 0.32, '#ff8c2b');
      // 耳
      ctx.fillStyle = '#ff8c2b';
      ctx.beginPath(); ctx.moveTo(size * 0.32, size * 0.28); ctx.lineTo(size * 0.26, size * 0.08); ctx.lineTo(size * 0.4, size * 0.22); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(size * 0.68, size * 0.28); ctx.lineTo(size * 0.74, size * 0.08); ctx.lineTo(size * 0.6, size * 0.22); ctx.closePath(); ctx.fill();
      // 鼻先
      ctx.fillStyle = '#fff2e0';
      ctx.beginPath(); ctx.moveTo(size * 0.42, size * 0.56); ctx.lineTo(size * 0.58, size * 0.56); ctx.lineTo(size * 0.5, size * 0.7); ctx.closePath(); ctx.fill();
      // 飛行帽
      ctx.fillStyle = '#5a3a20';
      ctx.beginPath(); ctx.arc(size * 0.5, size * 0.32, size * 0.28, Math.PI, Math.PI * 2); ctx.fill();
      // ゴーグル
      ctx.fillStyle = 'rgba(255,224,102,0.5)';
      ctx.strokeStyle = 'rgba(51,51,51,0.85)';
      ctx.lineWidth = size * 0.018;
      ctx.beginPath(); ctx.arc(size * 0.5 - size * 0.1, size * 0.4, size * 0.065, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.arc(size * 0.5 + size * 0.1, size * 0.4, size * 0.065, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      eyesAndMouth(ctx, size, size * 0.5, size * 0.56, size * 0.04, '#3a2a1c');
    },
    donga(ctx, size) {
      radialBg(ctx, size);
      shadeCircle(ctx, size * 0.5, size * 0.5, size * 0.34, '#8a7362');
      // ひび割れ発光
      ctx.strokeStyle = '#ff5a1c';
      ctx.lineWidth = size * 0.025;
      ctx.beginPath(); ctx.moveTo(size * 0.36, size * 0.3); ctx.lineTo(size * 0.44, size * 0.5); ctx.lineTo(size * 0.34, size * 0.62); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(size * 0.62, size * 0.28); ctx.lineTo(size * 0.58, size * 0.48); ctx.lineTo(size * 0.68, size * 0.6); ctx.stroke();
      eyesAndMouth(ctx, size, size * 0.5, size * 0.48, size * 0.055, '#ff6a1c');
    },
    volt8(ctx, size) {
      radialBg(ctx, size);
      ctx.fillStyle = '#b9bec9';
      ctx.fillRect(size * 0.28, size * 0.24, size * 0.44, size * 0.4);
      const grad = ctx.createLinearGradient(size * 0.28, size * 0.24, size * 0.72, size * 0.64);
      grad.addColorStop(0, 'rgba(255,255,255,0.35)');
      grad.addColorStop(1, 'rgba(0,0,0,0.2)');
      ctx.fillStyle = grad;
      ctx.fillRect(size * 0.28, size * 0.24, size * 0.44, size * 0.4);
      ctx.strokeStyle = 'rgba(0,0,0,0.3)';
      ctx.lineWidth = size * 0.015;
      ctx.strokeRect(size * 0.28, size * 0.24, size * 0.44, size * 0.4);
      // LEDツインアイ
      ctx.fillStyle = '#4de0ff';
      ctx.shadowColor = '#4de0ff';
      ctx.shadowBlur = size * 0.04;
      ctx.fillRect(size * 0.38, size * 0.4, size * 0.06, size * 0.05);
      ctx.fillRect(size * 0.56, size * 0.4, size * 0.06, size * 0.05);
      ctx.shadowBlur = 0;
      // アンテナ
      ctx.strokeStyle = '#8a8f9a';
      ctx.lineWidth = size * 0.015;
      ctx.beginPath(); ctx.moveTo(size * 0.5, size * 0.24); ctx.lineTo(size * 0.5, size * 0.1); ctx.stroke();
      ctx.fillStyle = '#4de0ff';
      ctx.beginPath(); ctx.arc(size * 0.5, size * 0.08, size * 0.025, 0, Math.PI * 2); ctx.fill();
    },
    shizuku(ctx, size) {
      radialBg(ctx, size);
      ctx.fillStyle = 'rgba(94,200,240,0.55)';
      ctx.beginPath();
      ctx.ellipse(size * 0.5, size * 0.5, size * 0.3, size * 0.34, 0, 0, Math.PI * 2);
      ctx.fill();
      // オーロラの髪
      const cols = ['rgba(255,159,214,0.7)', 'rgba(159,214,255,0.7)', 'rgba(214,255,159,0.7)'];
      for (let i = 0; i < 6; i++) {
        ctx.strokeStyle = cols[i % cols.length];
        ctx.lineWidth = size * 0.02;
        const a = (i / 6) * Math.PI * 2;
        ctx.beginPath();
        ctx.moveTo(size * 0.5, size * 0.28);
        ctx.lineTo(size * 0.5 + Math.cos(a) * size * 0.2, size * 0.28 - size * 0.14 + Math.sin(a) * size * 0.06);
        ctx.stroke();
      }
      eyesAndMouth(ctx, size, size * 0.5, size * 0.5, size * 0.045, '#2c6a8c');
    },
    gumiras(ctx, size) {
      radialBg(ctx, size);
      shadeCircle(ctx, size * 0.5, size * 0.54, size * 0.34, '#9a4fd6');
      // マント
      ctx.fillStyle = 'rgba(201,39,63,0.85)';
      ctx.beginPath(); ctx.moveTo(size * 0.2, size * 0.5); ctx.lineTo(size * 0.28, size * 0.85); ctx.lineTo(size * 0.72, size * 0.85); ctx.lineTo(size * 0.8, size * 0.5); ctx.closePath(); ctx.fill();
      // 王冠
      ctx.fillStyle = '#d4af37';
      ctx.beginPath();
      ctx.moveTo(size * 0.32, size * 0.24); ctx.lineTo(size * 0.38, size * 0.1); ctx.lineTo(size * 0.44, size * 0.22);
      ctx.lineTo(size * 0.5, size * 0.06); ctx.lineTo(size * 0.56, size * 0.22); ctx.lineTo(size * 0.62, size * 0.1);
      ctx.lineTo(size * 0.68, size * 0.24); ctx.closePath(); ctx.fill();
      eyesAndMouth(ctx, size, size * 0.5, size * 0.46, size * 0.05, '#5a2a70');
    },
    noir(ctx, size) {
      radialBg(ctx, size);
      shadeCircle(ctx, size * 0.5, size * 0.5, size * 0.34, '#241512');
      // 兜のスリット発光
      ctx.fillStyle = '#ff3b30';
      ctx.shadowColor = '#ff3b30';
      ctx.shadowBlur = size * 0.05;
      ctx.fillRect(size * 0.32, size * 0.47, size * 0.36, size * 0.06);
      ctx.shadowBlur = 0;
      // 兜の頂飾り
      ctx.fillStyle = '#8a1c1c';
      ctx.fillRect(size * 0.48, size * 0.14, size * 0.04, size * 0.14);
    },
    baumjii(ctx, size) {
      radialBg(ctx, size);
      shadeCircle(ctx, size * 0.5, size * 0.5, size * 0.32, '#c79a5e');
      ctx.strokeStyle = 'rgba(110,70,30,0.7)';
      ctx.lineWidth = size * 0.015;
      for (let r = size * 0.08; r < size * 0.3; r += size * 0.05) {
        ctx.beginPath(); ctx.arc(size * 0.5, size * 0.5, r, 0, Math.PI * 2); ctx.stroke();
      }
      // 口ヒゲ
      ctx.strokeStyle = '#fff6e0';
      ctx.lineWidth = size * 0.03;
      ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(size * 0.4, size * 0.6); ctx.lineTo(size * 0.3, size * 0.66); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(size * 0.6, size * 0.6); ctx.lineTo(size * 0.7, size * 0.66); ctx.stroke();
      // モノクル
      ctx.strokeStyle = 'rgba(212,175,55,0.9)';
      ctx.lineWidth = size * 0.02;
      ctx.beginPath(); ctx.arc(size * 0.58, size * 0.48, size * 0.075, 0, Math.PI * 2); ctx.stroke();
      eyesAndMouth(ctx, size, size * 0.5, size * 0.48, size * 0.045, '#5a3a20');
    },
    ginja(ctx, size) {
      radialBg(ctx, size);
      shadeCircle(ctx, size * 0.5, size * 0.5, size * 0.3, '#a86a34');
      // アイシングの隈取り
      ctx.strokeStyle = 'rgba(255,255,255,0.9)';
      ctx.lineWidth = size * 0.025;
      ctx.beginPath(); ctx.arc(size * 0.5 - size * 0.13, size * 0.48, size * 0.1, 0.2 * Math.PI, 0.9 * Math.PI); ctx.stroke();
      ctx.beginPath(); ctx.arc(size * 0.5 + size * 0.13, size * 0.48, size * 0.1, 0.1 * Math.PI, 0.8 * Math.PI); ctx.stroke();
      // ミント帯
      ctx.fillStyle = '#7fe0c0';
      ctx.fillRect(size * 0.3, size * 0.68, size * 0.4, size * 0.07);
      eyesAndMouth(ctx, size, size * 0.5, size * 0.46, size * 0.04, '#3a2410');
    },
  };

  function drawPortrait(ctx, id, size) {
    const fn = portraitDrawers[id] || portraitDrawers.kurumu;
    fn(ctx, size);
  }

  window.Game = window.Game || {};
  window.Game.characters = { list, build, mountOn, drawPortrait, animate };
})();
