// キャラクター9体 v2: データ定義+プロシージャルモデル生成(THREEプリミティブ+CanvasTexture)
// プレミアム化(Phase 6): Game.mats(paint/matte/metal/rubber/glow/glass)で質感差、
// キャラごとの専用アクセサリーでシルエット強化、表情差分(事前生成メッシュ切替)、
// Game.characters.animate() による走行中のもちもちアニメーションを追加。
// 全キャラ共通: 白目+虹彩+ハイライトの重ね目、表情差分のある口、1.5頭身、原点=足元中央、+Z向き
(function () {
  // ==================== 定数(冒頭集約) ====================
  const SEG_LOW = 8;
  const SEG_MID = 12;
  const SEG_HI = 16;

  const C_IRIS = { macaron: 0x6b3f2a, default: 0x3a2a20 };
  const C_WHITE = 0xffffff;
  const C_BLUSH = 0xff9fb8;
  const C_SKIN_LINE = 0x5a3a2e; // 輪郭線色

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

  // いちごチョコ+スプレー(ドーナツ)
  function texDonut(size) {
    const cv = makeCanvas(size), ctx = cv.getContext('2d');
    ctx.fillStyle = '#ff6f91';
    ctx.fillRect(0, 0, size, size);
    // ツヤの陰影グラデーションを重ねて単色ベタ塗りを回避
    const grad = ctx.createLinearGradient(0, 0, 0, size);
    grad.addColorStop(0, 'rgba(255,255,255,0.35)');
    grad.addColorStop(0.4, 'rgba(255,255,255,0)');
    grad.addColorStop(1, 'rgba(0,0,0,0.18)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);
    const sprinkle = ['#ffe066', '#69d1ff', '#8affc1', '#ffffff', '#ffb3de'];
    for (let i = 0; i < 70; i++) {
      ctx.save();
      ctx.translate(Math.random() * size, Math.random() * size);
      ctx.rotate(Math.random() * Math.PI * 2);
      ctx.fillStyle = sprinkle[i % sprinkle.length];
      ctx.fillRect(-size * 0.02, -size * 0.005, size * 0.04, size * 0.01);
      ctx.restore();
    }
    return toTexture(cv);
  }

  // 格子焼き目(ワッフル)
  function texWaffle(size) {
    const cv = makeCanvas(size), ctx = cv.getContext('2d');
    ctx.fillStyle = '#f2b23a';
    ctx.fillRect(0, 0, size, size);
    ctx.strokeStyle = '#c9871c';
    ctx.lineWidth = size * 0.035;
    const step = size / 6;
    for (let i = 1; i < 6; i++) {
      ctx.beginPath(); ctx.moveTo(i * step, 0); ctx.lineTo(i * step, size); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, i * step); ctx.lineTo(size, i * step); ctx.stroke();
    }
    // 焼き色ムラ
    for (let i = 0; i < 10; i++) {
      ctx.fillStyle = `rgba(180,110,20,${0.05 + Math.random() * 0.08})`;
      ctx.beginPath();
      ctx.arc(Math.random() * size, Math.random() * size, size * (0.08 + Math.random() * 0.1), 0, Math.PI * 2);
      ctx.fill();
    }
    return toTexture(cv);
  }

  // 割れ目溝(板チョコ)
  function texChoco(size) {
    const cv = makeCanvas(size), ctx = cv.getContext('2d');
    ctx.fillStyle = '#4a2b1c';
    ctx.fillRect(0, 0, size, size);
    const grad = ctx.createLinearGradient(0, 0, size, size);
    grad.addColorStop(0, 'rgba(255,255,255,0.16)');
    grad.addColorStop(0.5, 'rgba(255,255,255,0)');
    grad.addColorStop(1, 'rgba(0,0,0,0.22)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);
    ctx.strokeStyle = '#2c1710';
    ctx.lineWidth = size * 0.03;
    const step = size / 4;
    for (let i = 1; i < 4; i++) {
      ctx.beginPath(); ctx.moveTo(i * step, 0); ctx.lineTo(i * step, size); ctx.stroke();
    }
    ctx.beginPath(); ctx.moveTo(0, size / 2); ctx.lineTo(size, size / 2); ctx.stroke();
    return toTexture(cv);
  }

  // 年輪(バウムクーヘン)
  function texBaum(size) {
    const cv = makeCanvas(size), ctx = cv.getContext('2d');
    ctx.fillStyle = '#c9925a';
    ctx.fillRect(0, 0, size, size);
    ctx.strokeStyle = '#8a5a2e';
    ctx.lineWidth = size * 0.025;
    for (let y = 0; y < size; y += size / 8) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(size, y); ctx.stroke();
      ctx.strokeStyle = `rgba(138,90,46,${0.5 + Math.random() * 0.3})`;
    }
    return toTexture(cv);
  }

  // 赤白ストライプ(金平糖)
  function texBonbon(size) {
    const cv = makeCanvas(size), ctx = cv.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, size, size);
    ctx.fillStyle = '#ff5d7a';
    const stripeW = size / 8;
    for (let x = -size; x < size * 2; x += stripeW * 2) {
      ctx.save();
      ctx.translate(x, 0);
      ctx.beginPath();
      ctx.moveTo(0, 0); ctx.lineTo(stripeW, 0); ctx.lineTo(stripeW - size, size); ctx.lineTo(-size, size);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
    return toTexture(cv);
  }

  // マカロンの殻(表面のざらつきトーン)
  function texMacaronShell(size, baseHex) {
    const cv = makeCanvas(size), ctx = cv.getContext('2d');
    ctx.fillStyle = baseHex;
    ctx.fillRect(0, 0, size, size);
    for (let i = 0; i < 400; i++) {
      ctx.fillStyle = `rgba(255,255,255,${Math.random() * 0.1})`;
      ctx.beginPath();
      ctx.arc(Math.random() * size, Math.random() * size, Math.random() * size * 0.01, 0, Math.PI * 2);
      ctx.fill();
    }
    return toTexture(cv);
  }

  function hexToCss(hex) {
    return '#' + hex.toString(16).padStart(6, '0');
  }

  // ==================== 顔テクスチャ(表情差分) ====================
  // 目は「白目球+虹彩球+ハイライト球」の重ね構造メッシュで作り、表情は
  // 口テクスチャの差し替え(Canvas)+目メッシュのスケール/回転で表現する。
  // 毎フレームの生成を禁止するため、build()時に4表情ぶんの口テクスチャを
  // 事前生成してMeshに割り当て、animate()ではvisible切替のみ行う。
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

  const MOUTH_DRAWERS = {
    [EXPR.NORMAL]: drawMouthNormal,
    [EXPR.EXCITED]: drawMouthExcited,
    [EXPR.DIZZY]: drawMouthDizzy,
    [EXPR.JOY]: drawMouthJoy,
  };

  // キャラごとの4表情ぶん口プレートを1枚のプレーンメッシュ+テクスチャ差替(4種)で用意。
  // 4枚別メッシュをvisible切替する方式(GPU負荷極小、テクスチャは共有可能なので使い回す)。
  const mouthTexCache = {};
  function getMouthTexture(expr) {
    if (mouthTexCache[expr]) return mouthTexCache[expr];
    const size = 64;
    const cv = makeCanvas(size), ctx = cv.getContext('2d');
    MOUTH_DRAWERS[expr](ctx, size);
    const tex = toTexture(cv);
    mouthTexCache[expr] = tex;
    return tex;
  }

  function addMouthSet(parent, y, z, w, h) {
    const group = new THREE.Group();
    group.position.set(0, y, z);
    const planeMat = {};
    const meshes = {};
    for (const expr of Object.keys(MOUTH_DRAWERS)) {
      const m = new THREE.MeshBasicMaterial({ map: getMouthTexture(expr), transparent: true, depthWrite: false });
      const plane = new THREE.Mesh(new THREE.PlaneGeometry(w, h), m);
      plane.visible = expr === EXPR.NORMAL;
      plane.name = 'mouth_' + expr;
      group.add(plane);
      planeMat[expr] = m;
      meshes[expr] = plane;
    }
    parent.add(group);
    return meshes; // { normal: mesh, excited: mesh, dizzy: mesh, joy: mesh }
  }

  // ---- 共通顔パーツ(白目+虹彩+ハイライトの重ね目) ----
  function addEyes(parent, y, z, spacing, eyeR, irisHex) {
    const whiteMat = mat(C_WHITE);
    const irisMat = mat(irisHex || C_IRIS.default);
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

  function addBlush(parent, y, z, spacing, r) {
    const blushMat = mat(C_BLUSH, { transparent: true, opacity: 0.7 });
    for (const side of [-1, 1]) {
      const b = new THREE.Mesh(new THREE.SphereGeometry(r, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2), blushMat);
      b.position.set(side * spacing, y, z);
      b.rotation.x = -Math.PI / 2;
      b.lookAt(new THREE.Vector3(side * spacing, y, z + 1));
      parent.add(b);
    }
  }

  // 腕: 名前付きノード(pivotで肩位置に置き、先端に腕メッシュをぶら下げてアニメで回転させる)
  function addArm(parent, x, y, z, len, r, colorHex, side) {
    const pivot = new THREE.Group();
    pivot.position.set(x, y, z);
    pivot.name = 'arm_' + (side === -1 ? 'L' : 'R') + '_pivot';
    const armMesh = new THREE.Mesh(new THREE.CapsuleGeometry(r, len, 4, 8), Game.mats.matte(colorHex));
    armMesh.rotation.z = Math.PI / 2 * (side || 1) * 0.55;
    armMesh.position.set(side * len * 0.35, -len * 0.15, 0);
    armMesh.castShadow = true;
    pivot.add(armMesh);
    parent.add(pivot);
    return pivot;
  }

  function addLeg(parent, x, y, colorHex) {
    const g = new THREE.Mesh(new THREE.CapsuleGeometry(0.09, 0.22, 4, 8), Game.mats.matte(colorHex));
    g.position.set(x, y, 0.02);
    g.castShadow = true;
    parent.add(g);
    return g;
  }

  // ---- 専用アクセサリー(シルエット強化。全てオリジナル意匠) ----
  // レーシングゴーグル(マカロン)
  function addGoggles(parent, y, z, r) {
    const strapMat = Game.mats.matte(0x333333);
    const strap = new THREE.Mesh(new THREE.TorusGeometry(r * 1.55, r * 0.12, 6, 16, Math.PI), strapMat);
    strap.rotation.z = Math.PI;
    strap.position.set(0, y + r * 0.2, z - r * 0.5);
    parent.add(strap);
    const lensMat = Game.mats.glass(0x69d1ff, 0.55);
    const frameMat = Game.mats.metal(0xdedede);
    for (const side of [-1, 1]) {
      const frame = new THREE.Mesh(new THREE.TorusGeometry(r * 0.9, r * 0.14, 8, 14), frameMat);
      frame.position.set(side * r * 1.05, y, z);
      parent.add(frame);
      const lens = new THREE.Mesh(new THREE.CircleGeometry(r * 0.78, 14), lensMat);
      lens.position.set(side * r * 1.05, y, z + r * 0.08);
      parent.add(lens);
    }
    return strap;
  }

  // 後ろ向きスポーツキャップ(ドーナ)
  function addCapBack(parent, y, colorHex) {
    const capMat = Game.mats.matte(colorHex);
    const dome = new THREE.Mesh(new THREE.SphereGeometry(0.27, SEG_MID, SEG_LOW, 0, Math.PI * 2, 0, Math.PI * 0.55), capMat);
    dome.position.y = y;
    dome.castShadow = true;
    parent.add(dome);
    const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.03, 12, 1, false, 0, Math.PI), capMat);
    brim.position.set(0, y - 0.02, -0.24); // 後ろ向き = -Z側に鍔
    brim.rotation.x = Math.PI / 2;
    parent.add(brim);
    const button = new THREE.Mesh(new THREE.SphereGeometry(0.025, 6, 6), Game.mats.metal());
    button.position.set(0, y + 0.26, 0);
    parent.add(button);
  }

  // 蝶ネクタイ(タプリン)
  function addBowtie(parent, x, y, z, colorHex) {
    const bowMat = Game.mats.paint(colorHex);
    for (const side of [-1, 1]) {
      const wing = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.1, 4), bowMat);
      wing.position.set(x + side * 0.06, y, z);
      wing.rotation.z = side * Math.PI / 2;
      wing.rotation.y = Math.PI / 4;
      parent.add(wing);
    }
    const knot = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 8), Game.mats.metal(0xffe066));
    knot.position.set(x, y, z);
    parent.add(knot);
  }

  // サングラス(ソフクリン)
  function addSunglasses(parent, y, z, r) {
    const frameMat = Game.mats.metal(0x2a2a2a);
    const lensMat = Game.mats.glass(0x2a2a2a, 0.85);
    const bridge = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.02, 0.02), frameMat);
    bridge.position.set(0, y, z + r * 0.9);
    parent.add(bridge);
    for (const side of [-1, 1]) {
      const lens = new THREE.Mesh(new THREE.CircleGeometry(r * 0.85, 12), lensMat);
      lens.position.set(side * r * 1.0, y, z + r * 0.92);
      parent.add(lens);
      const frame = new THREE.Mesh(new THREE.TorusGeometry(r * 0.85, 0.015, 6, 14), frameMat);
      frame.position.set(side * r * 1.0, y, z + r * 0.9);
      parent.add(frame);
    }
  }

  // マフラー/スカーフ(ソーダ・シュワリ)
  function addScarf(parent, y, z, colorHex) {
    const scarfMat = Game.mats.matte(colorHex);
    const wrap = new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.07, 8, SEG_MID), scarfMat);
    wrap.rotation.x = Math.PI / 2;
    wrap.position.set(0, y, z);
    wrap.castShadow = true;
    parent.add(wrap);
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.32, 0.04), scarfMat);
    tail.position.set(0.16, y - 0.22, z + 0.1);
    tail.rotation.z = 0.25;
    tail.castShadow = true;
    parent.add(tail);
  }

  // リーダーの飾緒(サッシュ)+丸メガネ(ワッフル)
  function addSash(parent, y0, y1, colorHex) {
    const sashMat = Game.mats.paint(colorHex);
    const sash = new THREE.Mesh(new THREE.BoxGeometry(0.14, y0 - y1, 0.42), sashMat);
    sash.position.set(0.14, (y0 + y1) / 2, 0);
    sash.rotation.z = 0.28;
    sash.castShadow = true;
    parent.add(sash);
    const medal = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.02, 12), Game.mats.metal(0xd4af37));
    medal.position.set(0.1, y1 + 0.02, 0.22);
    medal.rotation.x = Math.PI / 2;
    parent.add(medal);
  }
  function addRoundGlasses(parent, y, z, r) {
    const frameMat = Game.mats.metal(0xd4af37);
    const lensMat = Game.mats.glass(0xffffff, 0.25);
    const bridge = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.015, 0.015), frameMat);
    bridge.position.set(0, y, z + r * 0.95);
    parent.add(bridge);
    for (const side of [-1, 1]) {
      const frame = new THREE.Mesh(new THREE.TorusGeometry(r * 0.7, 0.014, 6, 14), frameMat);
      frame.position.set(side * r * 0.85, y, z + r * 0.92);
      parent.add(frame);
      const lens = new THREE.Mesh(new THREE.CircleGeometry(r * 0.68, 12), lensMat);
      lens.position.set(side * r * 0.85, y, z + r * 0.94);
      parent.add(lens);
    }
  }

  // フード状の襟巻き(ショコラ・ノワール)
  function addHoodCollar(parent, y, colorHex) {
    const hoodMat = Game.mats.matte(colorHex);
    const collar = new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.06, 8, SEG_MID, Math.PI * 1.4), hoodMat);
    collar.rotation.x = Math.PI / 2;
    collar.rotation.z = Math.PI * 0.3;
    collar.position.y = y;
    collar.castShadow = true;
    parent.add(collar);
  }

  // ロングマフラー(バウム・ロール)
  function addLongMuffler(parent, y, colorHex) {
    const mufMat = Game.mats.matte(colorHex);
    const wrap = new THREE.Mesh(new THREE.TorusGeometry(0.29, 0.055, 8, SEG_MID), mufMat);
    wrap.rotation.x = Math.PI / 2;
    wrap.position.y = y;
    wrap.castShadow = true;
    parent.add(wrap);
    for (let i = 0; i < 2; i++) {
      const tail = new THREE.Mesh(new THREE.CapsuleGeometry(0.045, 0.4, 4, 6), mufMat);
      tail.position.set((i === 0 ? -0.12 : 0.16), y - 0.32, -0.12);
      tail.rotation.z = i === 0 ? 0.3 : -0.15;
      tail.rotation.x = 0.2;
      tail.castShadow = true;
      parent.add(tail);
    }
  }

  // ヘッドバンド+パワーグローブ(ボンボン・キャノン)
  function addHeadband(parent, y, r, colorHex) {
    const bandMat = Game.mats.paint(colorHex);
    const band = new THREE.Mesh(new THREE.TorusGeometry(r * 1.02, 0.035, 6, SEG_MID, Math.PI * 1.7), bandMat);
    band.rotation.x = Math.PI / 2;
    band.rotation.z = Math.PI * 0.15;
    band.position.y = y;
    parent.add(band);
  }
  function addPowerGlove(parent, x, y, z, colorHex) {
    const glove = new THREE.Mesh(new THREE.SphereGeometry(0.1, SEG_LOW, SEG_LOW), Game.mats.matte(colorHex));
    glove.position.set(x, y, z);
    glove.castShadow = true;
    parent.add(glove);
    return glove;
  }

  // ==================== キャラ定義(維持: id/name/motif/personality/color/stats) ====================
  const list = [
    { id: 'macaron', name: 'マカロン・ププル', motif: 'マカロン', personality: 'おっとり癒し系',
      color: 0xffb0cc, stats: { speed: 2, accel: 5, handling: 4, weight: 2 } },
    { id: 'donut', name: 'ドーナ・リング', motif: 'ドーナツ', personality: '陽気なお調子者',
      color: 0xe08a4c, stats: { speed: 2, accel: 4, handling: 5, weight: 1 } },
    { id: 'taplin', name: 'タプリン', motif: 'プリン', personality: '臆病だが負けず嫌い',
      color: 0xffd23f, stats: { speed: 3, accel: 4, handling: 4, weight: 2 } },
    { id: 'sofukurin', name: 'ソフクリン', motif: 'ソフトクリーム', personality: 'クールだが根は熱血',
      color: 0xbfe8ff, stats: { speed: 3, accel: 3, handling: 4, weight: 2 } },
    { id: 'sodaShuwari', name: 'ソーダ・シュワリ', motif: 'ラムネソーダ', personality: '泡のようにポジティブ',
      color: 0x7fe0c0, stats: { speed: 3, accel: 3, handling: 3, weight: 3 } },
    { id: 'waffle', name: 'ワッフル・グリッド', motif: 'ワッフル', personality: '几帳面なリーダー',
      color: 0xf2b23a, stats: { speed: 3, accel: 2, handling: 3, weight: 4 } },
    { id: 'chocolat', name: 'ショコラ・ノワール', motif: '板チョコ', personality: '無口な策士',
      color: 0x4a2b1c, stats: { speed: 4, accel: 2, handling: 2, weight: 4 } },
    { id: 'baum', name: 'バウム・ロール', motif: 'バウムクーヘン', personality: '物静かな年長者',
      color: 0xc9925a, stats: { speed: 4, accel: 2, handling: 2, weight: 5 } },
    { id: 'bonbon', name: 'ボンボン・キャノン', motif: '金平糖', personality: '破天荒なパワー型',
      color: 0xff5d7a, stats: { speed: 5, accel: 1, handling: 1, weight: 5 } },
  ];

  // ==================== ビルダー群 ====================
  // 各ビルダーは Group を返す。userData.parts に以下を積む(animate()が参照):
  //  { armL, armR, mouths:{normal,excited,dizzy,joy}, eyeL, eyeR, headY(baseY), bodyRoot }

  function buildMacaron() {
    const g = new THREE.Group();
    const parts = { extras: [] };
    const shellTex = texMacaronShell(64, '#ffb0cc');
    const shellMat = new THREE.MeshLambertMaterial({ map: shellTex });
    const creamMat = Game.mats.matte(0xfff6e0);
    // 下の殻(横に潰れた球)
    const bottom = new THREE.Mesh(new THREE.SphereGeometry(0.42, SEG_MID, SEG_LOW), shellMat);
    bottom.scale.set(1, 0.55, 1);
    bottom.position.y = 0.52;
    bottom.castShadow = true;
    g.add(bottom);
    // クリーム(円柱)
    const cream = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 0.14, SEG_MID), creamMat);
    cream.position.y = 0.72;
    cream.castShadow = true;
    g.add(cream);
    // 上の殻
    const top = new THREE.Mesh(new THREE.SphereGeometry(0.42, SEG_MID, SEG_LOW), shellMat);
    top.scale.set(1, 0.5, 1);
    top.position.y = 0.95;
    top.castShadow = true;
    g.add(top);
    // 頬
    addBlush(g, 0.78, 0.32, 0.28, 0.09);
    // 目・口
    const eyes = addEyes(g, 0.85, 0.36, 0.16, 0.075, 0x6b3f2a);
    const mouths = addMouthSet(g, 0.72, 0.4, 0.16, 0.12);
    // レーシングゴーグル(シルエット強化アクセサリー)
    addGoggles(g, 0.85, 0.4, 0.09);
    // リボン(トーラス)
    const ribbonMat = Game.mats.paint(0xffe066);
    const ribbon = new THREE.Mesh(new THREE.TorusGeometry(0.09, 0.035, 6, 10), ribbonMat);
    ribbon.position.set(0, 1.28, 0);
    ribbon.rotation.x = Math.PI / 2;
    ribbon.castShadow = true;
    g.add(ribbon);
    const ribbonCenter = new THREE.Mesh(new THREE.SphereGeometry(0.045, 6, 6), ribbonMat);
    ribbonCenter.position.set(0, 1.28, 0);
    g.add(ribbonCenter);
    // 短い手足
    const armL = addArm(g, -0.4, 0.68, 0.05, 0.18, 0.08, 0xffb0cc, -1);
    const armR = addArm(g, 0.4, 0.68, 0.05, 0.18, 0.08, 0xffb0cc, 1);
    addLeg(g, -0.15, 0.14, 0xffffff);
    addLeg(g, 0.15, 0.14, 0xffffff);
    g.userData.parts = { armL, armR, eyeL: eyes.left, eyeR: eyes.right, mouths, headY: 0.85, bodyRoot: g };
    return g;
  }

  function buildDonut() {
    const g = new THREE.Group();
    const tex = texDonut(128);
    const bodyMat = new THREE.MeshLambertMaterial({ map: tex });
    const body = new THREE.Mesh(new THREE.TorusGeometry(0.4, 0.22, SEG_MID, 16), bodyMat);
    body.rotation.x = Math.PI / 2; // 縦置き(輪が正面向き+Z観察可)
    body.position.y = 0.62;
    body.castShadow = true;
    g.add(body);
    // 顔(穴の中の球)
    const face = new THREE.Mesh(new THREE.SphereGeometry(0.24, SEG_MID, SEG_LOW), Game.mats.matte(0xfff2e0));
    face.position.set(0, 0.62, 0.02);
    face.castShadow = true;
    g.add(face);
    const eyes = addEyes(g, 0.66, 0.24, 0.1, 0.055, 0x5a2f1c);
    const mouths = addMouthSet(g, 0.56, 0.26, 0.12, 0.09);
    addBlush(g, 0.58, 0.2, 0.17, 0.06);
    // 後ろ向きキャップ(シルエット強化)
    addCapBack(g, 0.82, 0xffb3de);
    const armL = addArm(g, -0.42, 0.5, 0.05, 0.16, 0.07, 0xe08a4c, -1);
    const armR = addArm(g, 0.42, 0.5, 0.05, 0.16, 0.07, 0xe08a4c, 1);
    addLeg(g, -0.15, 0.14, 0xe08a4c);
    addLeg(g, 0.15, 0.14, 0xe08a4c);
    g.userData.parts = { armL, armR, eyeL: eyes.left, eyeR: eyes.right, mouths, headY: 0.66, bodyRoot: g };
    return g;
  }

  function buildTaplin() {
    const g = new THREE.Group();
    const bodyMat = Game.mats.matte(0xffd23f);
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.4, 0.7, SEG_MID), bodyMat);
    body.position.y = 0.45;
    body.castShadow = true;
    g.add(body);
    // とろけるキャラメル(平たい球、glassで艶を出す)
    const caramelMat = Game.mats.glass(0xc98a3a, 0.85);
    const caramel = new THREE.Mesh(new THREE.SphereGeometry(0.26, SEG_MID, SEG_LOW), caramelMat);
    caramel.scale.set(1.1, 0.4, 1.1);
    caramel.position.y = 0.82;
    caramel.castShadow = true;
    g.add(caramel);
    // 皿(薄円柱)
    const plateMat = Game.mats.paint(0xffffff);
    const plate = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.06, SEG_MID), plateMat);
    plate.position.y = 0.06;
    plate.castShadow = true;
    g.add(plate);
    const eyes = addEyes(g, 0.55, 0.36, 0.13, 0.07, 0x8a5a1c);
    const mouths = addMouthSet(g, 0.44, 0.39, 0.14, 0.1);
    addBlush(g, 0.47, 0.33, 0.22, 0.07);
    // 蝶ネクタイ(シルエット強化)
    addBowtie(g, 0, 0.36, 0.42, 0xff5d7a);
    const armL = addArm(g, -0.36, 0.42, 0.05, 0.16, 0.07, 0xffd23f, -1);
    const armR = addArm(g, 0.36, 0.42, 0.05, 0.16, 0.07, 0xffd23f, 1);
    g.userData.parts = { armL, armR, eyeL: eyes.left, eyeR: eyes.right, mouths, headY: 0.55, bodyRoot: g };
    return g;
  }

  function buildSofukurin() {
    const g = new THREE.Group();
    const swirlMat = Game.mats.matte(0xf3fbff);
    const marbleMat = Game.mats.matte(0xbfe8ff);
    // 下半身: 格子コーン(逆円錐)
    const coneTex = texWaffle(64);
    const cone = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.32, 0.45, SEG_MID),
      new THREE.MeshLambertMaterial({ map: coneTex, color: 0xffe0a0 }));
    cone.position.y = 0.23;
    cone.castShadow = true;
    g.add(cone);
    // 渦巻き状の3段(白×水色マーブル交互)
    const sizes = [0.3, 0.24, 0.18];
    let y = 0.5;
    for (let i = 0; i < 3; i++) {
      const m = i % 2 === 0 ? swirlMat : marbleMat;
      const seg = new THREE.Mesh(new THREE.ConeGeometry(sizes[i], 0.28, SEG_MID), m);
      seg.position.y = y + 0.14;
      seg.castShadow = true;
      g.add(seg);
      y += 0.22;
    }
    const tip = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 8), marbleMat);
    tip.position.y = y + 0.18;
    g.add(tip);
    const eyes = addEyes(g, y - 0.05, 0.16, 0.1, 0.065, 0x2c6a8c);
    const mouths = addMouthSet(g, y - 0.16, 0.19, 0.12, 0.09);
    addBlush(g, y - 0.13, 0.14, 0.16, 0.055);
    // サングラス(クールな性格を表現するシルエット強化)
    addSunglasses(g, y - 0.05, 0.14, 0.07);
    const armL = addArm(g, -0.26, y - 0.15, 0.02, 0.16, 0.06, 0xbfe8ff, -1);
    const armR = addArm(g, 0.26, y - 0.15, 0.02, 0.16, 0.06, 0xbfe8ff, 1);
    g.userData.parts = { armL, armR, eyeL: eyes.left, eyeR: eyes.right, mouths, headY: y - 0.05, bodyRoot: g };
    return g;
  }

  function buildSoda() {
    const g = new THREE.Group();
    const bodyMat = Game.mats.glass(0x7fe0c0, 0.75);
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.4, SEG_MID, SEG_MID), bodyMat);
    body.scale.set(1, 1.15, 1);
    body.position.y = 0.62;
    body.castShadow = true;
    g.add(body);
    // ビー玉(頭上の青い小球、metalで硬質な輝き)
    const marble = new THREE.Mesh(new THREE.SphereGeometry(0.12, SEG_LOW, SEG_LOW), Game.mats.glass(0x3d8bff, 0.9));
    marble.position.y = 1.08;
    marble.castShadow = true;
    g.add(marble);
    // 泡(白い極小球を数個浮遊)
    const bubbleMat = Game.mats.glass(0xffffff, 0.8);
    const bubblePos = [
      [0.28, 0.9, 0.2], [-0.26, 0.75, -0.22], [0.2, 0.45, 0.3],
      [-0.22, 0.95, 0.15], [0.05, 0.3, -0.3],
    ];
    const bubbles = [];
    for (const [x, y, z] of bubblePos) {
      const b = new THREE.Mesh(new THREE.SphereGeometry(0.045, 6, 6), bubbleMat);
      b.position.set(x, y, z);
      g.add(b);
      bubbles.push(b);
    }
    const eyes = addEyes(g, 0.68, 0.3, 0.13, 0.07, 0x2c8c6e);
    const mouths = addMouthSet(g, 0.56, 0.34, 0.13, 0.1);
    addBlush(g, 0.6, 0.28, 0.2, 0.06);
    // マフラー(シルエット強化)
    addScarf(g, 0.5, 0.02, 0xffffff);
    const armL = addArm(g, -0.36, 0.55, 0.05, 0.16, 0.06, 0x7fe0c0, -1);
    const armR = addArm(g, 0.36, 0.55, 0.05, 0.16, 0.06, 0x7fe0c0, 1);
    g.userData.parts = { armL, armR, eyeL: eyes.left, eyeR: eyes.right, mouths, headY: 0.68, bodyRoot: g, bubbles };
    return g;
  }

  function buildWaffle() {
    const g = new THREE.Group();
    const tex = texWaffle(128);
    const bodyMat = new THREE.MeshLambertMaterial({ map: tex });
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.5, 0.4), bodyMat);
    body.position.y = 0.42;
    body.castShadow = true;
    g.add(body);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.28, SEG_MID, SEG_LOW), bodyMat);
    head.position.y = 0.86;
    head.castShadow = true;
    g.add(head);
    // 頭頂のはちみつの雫(glassで艶)
    const honeyMat = Game.mats.glass(0xf2a900, 0.8);
    const honey = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.16, 8), honeyMat);
    honey.position.y = 1.16;
    g.add(honey);
    const eyes = addEyes(g, 0.9, 0.24, 0.11, 0.065, 0x8a5a1c);
    const mouths = addMouthSet(g, 0.78, 0.28, 0.13, 0.1);
    addBlush(g, 0.82, 0.22, 0.18, 0.055);
    // リーダーの飾緒+丸メガネ(几帳面なリーダー性を表現)
    addSash(g, 0.62, 0.24, 0xd4af37);
    addRoundGlasses(g, 0.9, 0.24, 0.08);
    const armL = addArm(g, -0.4, 0.5, 0.05, 0.18, 0.08, 0xf2b23a, -1);
    const armR = addArm(g, 0.4, 0.5, 0.05, 0.18, 0.08, 0xf2b23a, 1);
    addLeg(g, -0.15, 0.14, 0xf2b23a);
    addLeg(g, 0.15, 0.14, 0xf2b23a);
    g.userData.parts = { armL, armR, eyeL: eyes.left, eyeR: eyes.right, mouths, headY: 0.9, bodyRoot: g };
    return g;
  }

  function buildChocolat() {
    const g = new THREE.Group();
    const tex = texChoco(128);
    const bodyMat = new THREE.MeshLambertMaterial({ map: tex });
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.7, 0.3), bodyMat);
    body.position.y = 0.5;
    body.castShadow = true;
    g.add(body);
    // 金の帯(metal)
    const beltMat = Game.mats.metal(0xd4af37);
    const belt = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.08, 0.32), beltMat);
    belt.position.y = 0.42;
    belt.castShadow = true;
    g.add(belt);
    // 頭
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.26, SEG_MID, SEG_LOW), new THREE.MeshLambertMaterial({ map: tex }));
    head.position.y = 1.0;
    head.castShadow = true;
    g.add(head);
    // 審査対応: 目を大きく+口を描き表情を強調
    const eyes = addEyes(g, 1.04, 0.22, 0.11, 0.09, 0x2c1710);
    const mouths = addMouthSet(g, 0.9, 0.27, 0.15, 0.11);
    // フード状の襟巻き(無口な策士のミステリアスさを表現)
    addHoodCollar(g, 0.82, 0x2c1710);
    const armL = addArm(g, -0.36, 0.6, 0.05, 0.18, 0.08, 0x4a2b1c, -1);
    const armR = addArm(g, 0.36, 0.6, 0.05, 0.18, 0.08, 0x4a2b1c, 1);
    addLeg(g, -0.14, 0.14, 0x2c1710);
    addLeg(g, 0.14, 0.14, 0x2c1710);
    g.userData.parts = { armL, armR, eyeL: eyes.left, eyeR: eyes.right, mouths, headY: 1.04, bodyRoot: g };
    return g;
  }

  function buildBaum() {
    const g = new THREE.Group();
    const tex = texBaum(128);
    const bodyMat = new THREE.MeshLambertMaterial({ map: tex });
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.32, 0.75, SEG_MID), bodyMat);
    body.position.y = 0.5;
    body.castShadow = true;
    g.add(body);
    // 頭(球+粉砂糖の白い小球)
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.27, SEG_MID, SEG_LOW), Game.mats.matte(0xd9a86a));
    head.position.y = 1.0;
    head.castShadow = true;
    g.add(head);
    const sugarMat = Game.mats.matte(0xffffff);
    for (let i = 0; i < 6; i++) {
      const s = new THREE.Mesh(new THREE.SphereGeometry(0.025, 5, 5), sugarMat);
      const a = (i / 6) * Math.PI * 2, r = 0.24 + (i % 2) * 0.05;
      s.position.set(Math.cos(a) * r, 1.0 + ((i % 3) - 1) * 0.06, Math.sin(a) * r);
      g.add(s);
    }
    // 審査対応: 大きな優しいタレ目
    const eyes = addEyes(g, 1.0, 0.24, 0.1, 0.08, 0x8a5a2e);
    const mouths = addMouthSet(g, 0.88, 0.29, 0.14, 0.1);
    addBlush(g, 0.92, 0.22, 0.18, 0.06);
    // ロングマフラー(物静かな年長者の落ち着きを表現)
    addLongMuffler(g, 0.78, 0xc94f5c);
    const armL = addArm(g, -0.38, 0.6, 0.05, 0.18, 0.08, 0xc9925a, -1);
    const armR = addArm(g, 0.38, 0.6, 0.05, 0.18, 0.08, 0xc9925a, 1);
    addLeg(g, -0.14, 0.14, 0xc9925a);
    addLeg(g, 0.14, 0.14, 0xc9925a);
    g.userData.parts = { armL, armR, eyeL: eyes.left, eyeR: eyes.right, mouths, headY: 1.0, bodyRoot: g };
    return g;
  }

  function buildBonbon() {
    const g = new THREE.Group();
    const tex = texBonbon(128);
    const bodyMat = new THREE.MeshLambertMaterial({ map: tex });
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.42, SEG_MID, SEG_MID), bodyMat);
    body.position.y = 0.55;
    body.castShadow = true;
    g.add(body);
    // 審査対応: 丸い半球の突起を少なめに配置(尖らせず可愛く)
    const bumpMat = Game.mats.paint(0xffe066);
    const bumpDirs = [
      [0, 1, 0], [0.7, 0.5, 0.5], [-0.7, 0.5, 0.5], [0.6, 0.3, -0.6], [-0.6, 0.3, -0.6],
    ];
    for (const [dx, dy, dz] of bumpDirs) {
      const len = Math.hypot(dx, dy, dz) || 1;
      const nx = dx / len, ny = dy / len, nz = dz / len;
      const bump = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2), bumpMat);
      bump.position.set(0.42 * nx, 0.55 + 0.42 * ny, 0.42 * nz);
      bump.lookAt(new THREE.Vector3(0.42 * nx * 2, 0.55 + 0.42 * ny * 2, 0.42 * nz * 2));
      bump.rotateX(Math.PI / 2);
      bump.castShadow = true;
      g.add(bump);
    }
    const eyes = addEyes(g, 0.6, 0.34, 0.14, 0.075, 0x8c1c33);
    const mouths = addMouthSet(g, 0.48, 0.38, 0.14, 0.1);
    addBlush(g, 0.52, 0.32, 0.22, 0.06);
    // ヘッドバンド+パワーグローブ(破天荒なパワー型を表現)
    addHeadband(g, 0.78, 0.32, 0xffe066);
    const armL = addArm(g, -0.4, 0.5, 0.05, 0.18, 0.08, 0xff5d7a, -1);
    const armR = addArm(g, 0.4, 0.5, 0.05, 0.18, 0.08, 0xff5d7a, 1);
    const gloveL = addPowerGlove(g, -0.4 - 0.02, 0.36, 0.1, 0xffe066);
    const gloveR = addPowerGlove(g, 0.4 + 0.02, 0.36, 0.1, 0xffe066);
    addLeg(g, -0.16, 0.12, 0xff5d7a);
    addLeg(g, 0.16, 0.12, 0xff5d7a);
    g.userData.parts = { armL, armR, eyeL: eyes.left, eyeR: eyes.right, mouths, headY: 0.6, bodyRoot: g, gloveL, gloveR };
    return g;
  }

  const builders = {
    macaron: buildMacaron,
    donut: buildDonut,
    taplin: buildTaplin,
    sofukurin: buildSofukurin,
    sodaShuwari: buildSoda,
    waffle: buildWaffle,
    chocolat: buildChocolat,
    baum: buildBaum,
    bonbon: buildBonbon,
  };

  function build(id) {
    const fn = builders[id] || buildMacaron;
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

  // kart.group内のriderPlaceholderを除去し、同位置にキャラを座らせる
  function mountOn(kart, id) {
    if (!kart || !kart.group) return;
    const placeholder = kart.group.getObjectByName('riderPlaceholder');
    const pos = placeholder ? placeholder.position.clone() : new THREE.Vector3(0, 1.0, -0.25);
    const parent = placeholder ? placeholder.parent : kart._tilt || kart.group;
    if (placeholder && parent) parent.remove(placeholder);

    const charGroup = build(id);
    // 身長約1.2 → カートの主役として大きく見せる(カートレースはキャラが顔なので
    // 控えめなスケールだとシートに隠れてしまう。実画面確認で1.1に調整済み)
    const scale = 1.1;
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

  // ==================== アニメーション(Phase 6 新規API) ====================
  // 表情切替はexprが変化した時だけ行う(毎フレームのテクスチャ生成はしない。
  // 表情ごとの口メッシュは build() 時に事前生成済みで、ここではvisible切替のみ)
  function setExpr(parts, anim, expr) {
    if (anim.expr === expr) return;
    anim.expr = expr;
    for (const key of Object.keys(parts.mouths)) {
      parts.mouths[key].visible = key === expr;
    }
  }

  function animate(kart, dt, steer) {
    const g = kart._charGroup;
    if (!g || !g.userData || !g.userData.parts) return;
    const parts = g.userData.parts;
    const anim = g.userData.anim;
    const U = Game.U;

    const spinning = kart.spinT > 0;
    const boosting = kart.boostT > 0;
    const starring = kart.starT > 0;
    const justFinishedWon = kart.finished && kart.rank === 1;

    // ---- 表情切り替え(状態が変わった時だけ) ----
    if (justFinishedWon) setExpr(parts, anim, EXPR.JOY);
    else if (spinning) setExpr(parts, anim, EXPR.DIZZY);
    else if (boosting || starring) setExpr(parts, anim, EXPR.EXCITED);
    else setExpr(parts, anim, EXPR.NORMAL);

    // ---- 速度に応じた上下バウンス(もちもち感) ----
    const speedRatio = U.clamp(Math.abs(kart.speed) / (Game.config.physics.maxSpeed || 30), 0, 1.6);
    const freq = ANIM.bounceFreqMin + (ANIM.bounceFreqMax - ANIM.bounceFreqMin) * Math.min(speedRatio, 1);
    anim.bounceT += dt * freq;
    const amp = kart.grounded
      ? ANIM.bounceAmpBase + (boosting || starring ? ANIM.bounceAmpBoost : 0) * (0.6 + 0.4 * Math.sin(anim.bounceT * 2))
      : 0;
    const bounceY = spinning ? 0 : Math.abs(Math.sin(anim.bounceT)) * amp;
    g.position.y = -0.15 + bounceY;
    // わずかなスクイーズ(もちもち感の核: 縦伸縮に対し横を逆位相で伸縮)
    const squish = spinning ? 1 : 1 + Math.sin(anim.bounceT) * (amp * 1.6);
    g.scale.set(1.1 / Math.sqrt(squish), 1.1 * squish, 1.1 / Math.sqrt(squish));

    // ---- ステア/ドリフト方向へのリーン ----
    let targetLeanZ = -steer * ANIM.leanMax * 0.5;
    let targetLeanX = 0;
    if (kart.drift && kart.drift.state === 'drifting') {
      targetLeanZ = -kart.drift.dir * ANIM.leanMax;
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
      // 被弾スピン中: 腕をバタバタ
      const flap = Math.sin(anim.bounceT * ANIM.armFlapFreq) * ANIM.armFlapAmp;
      armL.rotation.x = flap;
      armR.rotation.x = -flap;
      anim.joyRaise = 0;
      // 目を回す表情: 目メッシュを頭部中心にぐるぐる回転
      const spin = performance.now() * 0.001 * ANIM.dizzyHeadSpin;
      if (parts.eyeL) parts.eyeL.rotation.z = spin;
      if (parts.eyeR) parts.eyeR.rotation.z = -spin;
    } else if (justFinishedWon) {
      // ゴール1位: 両腕を上げる(joy)
      anim.joyRaise = U.damp(anim.joyRaise, 1, ANIM.joyArmUpSpeed, dt);
      armL.rotation.x = -anim.joyRaise * 2.4;
      armR.rotation.x = -anim.joyRaise * 2.4;
      armL.rotation.z = (parts.armL === armL ? -0.3 : 0);
      if (parts.eyeL) parts.eyeL.rotation.z = U.damp(parts.eyeL.rotation.z, 0, 10, dt);
      if (parts.eyeR) parts.eyeR.rotation.z = U.damp(parts.eyeR.rotation.z, 0, 10, dt);
    } else {
      anim.joyRaise = U.damp(anim.joyRaise, 0, ANIM.joyArmUpSpeed, dt);
      // 通常時: 走行に合わせて軽く前後に揺らす(ランニングモーション)
      const swing = Math.sin(anim.bounceT) * 0.25 * Math.min(speedRatio, 1);
      armL.rotation.x = swing - anim.joyRaise * 2.4;
      armR.rotation.x = -swing - anim.joyRaise * 2.4;
      if (parts.eyeL) parts.eyeL.rotation.z = U.damp(parts.eyeL.rotation.z, 0, 10, dt);
      if (parts.eyeR) parts.eyeR.rotation.z = U.damp(parts.eyeR.rotation.z, 0, 10, dt);
    }

    // ソーダの泡はふわふわ漂わせる(専用パーツがある場合のみ)
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

  function eyesAndMouth(ctx, size, cx, cy, r, mouthColor) {
    // 白目
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.ellipse(cx - r * 1.1, cy, r * 0.42, r * 0.46, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(cx + r * 1.1, cy, r * 0.42, r * 0.46, 0, 0, Math.PI * 2); ctx.fill();
    // 虹彩
    ctx.fillStyle = '#3a2a20';
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
    // 頬
    ctx.fillStyle = 'rgba(255,159,184,0.7)';
    ctx.beginPath(); ctx.arc(cx - r * 1.8, cy + r * 0.9, r * 0.28, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(cx + r * 1.8, cy + r * 0.9, r * 0.28, 0, Math.PI * 2); ctx.fill();
  }

  const portraitDrawers = {
    macaron(ctx, size) {
      radialBg(ctx, size);
      shadeCircle(ctx, size * 0.5, size * 0.34, size * 0.32, '#ffb0cc');
      ctx.fillStyle = '#fff6e0';
      ctx.fillRect(size * 0.18, size * 0.42, size * 0.64, size * 0.1);
      shadeCircle(ctx, size * 0.5, size * 0.6, size * 0.32, '#ffb0cc');
      eyesAndMouth(ctx, size, size * 0.5, size * 0.5, size * 0.045);
      // ゴーグル
      ctx.strokeStyle = 'rgba(51,51,51,0.85)';
      ctx.lineWidth = size * 0.02;
      ctx.beginPath(); ctx.arc(size * 0.5 - size * 0.11, size * 0.5, size * 0.07, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.arc(size * 0.5 + size * 0.11, size * 0.5, size * 0.07, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = 'rgba(105,209,255,0.35)';
      ctx.beginPath(); ctx.arc(size * 0.5 - size * 0.11, size * 0.5, size * 0.06, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(size * 0.5 + size * 0.11, size * 0.5, size * 0.06, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#ffe066';
      ctx.beginPath(); ctx.arc(size * 0.5, size * 0.2, size * 0.045, 0, Math.PI * 2); ctx.fill();
    },
    donut(ctx, size) {
      radialBg(ctx, size);
      shadeCircle(ctx, size * 0.5, size * 0.48, size * 0.33, '#e08a4c');
      ctx.fillStyle = '#ff6f91';
      ctx.beginPath(); ctx.arc(size * 0.5, size * 0.42, size * 0.28, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#ffe066';
      ctx.beginPath(); ctx.arc(size * 0.5, size * 0.6, size * 0.12, 0, Math.PI * 2); ctx.fill();
      const sc = ['#69d1ff', '#8affc1', '#ffffff'];
      for (let i = 0; i < 12; i++) {
        ctx.fillStyle = sc[i % sc.length];
        const a = (i / 12) * Math.PI * 2, r = size * 0.2;
        ctx.save();
        ctx.translate(size * 0.5 + Math.cos(a) * r, size * 0.42 + Math.sin(a) * r);
        ctx.rotate(a);
        ctx.fillRect(-size * 0.02, -size * 0.005, size * 0.04, size * 0.01);
        ctx.restore();
      }
      // 後ろ向きキャップ
      ctx.fillStyle = '#ffb3de';
      ctx.beginPath(); ctx.arc(size * 0.5, size * 0.2, size * 0.16, Math.PI, Math.PI * 2); ctx.fill();
      ctx.fillRect(size * 0.5 - size * 0.02, size * 0.1, size * 0.04, size * 0.06);
      eyesAndMouth(ctx, size, size * 0.5, size * 0.62, size * 0.045);
    },
    taplin(ctx, size) {
      radialBg(ctx, size);
      ctx.fillStyle = '#ffd23f';
      ctx.beginPath();
      ctx.moveTo(size * 0.28, size * 0.7);
      ctx.lineTo(size * 0.72, size * 0.7);
      ctx.lineTo(size * 0.6, size * 0.3);
      ctx.lineTo(size * 0.4, size * 0.3);
      ctx.closePath();
      ctx.fill();
      const grad = ctx.createLinearGradient(size * 0.3, size * 0.3, size * 0.7, size * 0.7);
      grad.addColorStop(0, 'rgba(255,255,255,0.35)');
      grad.addColorStop(1, 'rgba(0,0,0,0.12)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.moveTo(size * 0.28, size * 0.7);
      ctx.lineTo(size * 0.72, size * 0.7);
      ctx.lineTo(size * 0.6, size * 0.3);
      ctx.lineTo(size * 0.4, size * 0.3);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#c98a3a';
      ctx.beginPath(); ctx.ellipse(size * 0.5, size * 0.3, size * 0.2, size * 0.07, 0, 0, Math.PI * 2); ctx.fill();
      // 蝶ネクタイ
      ctx.fillStyle = '#ff5d7a';
      ctx.beginPath(); ctx.moveTo(size * 0.5, size * 0.68); ctx.lineTo(size * 0.42, size * 0.62); ctx.lineTo(size * 0.42, size * 0.74); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(size * 0.5, size * 0.68); ctx.lineTo(size * 0.58, size * 0.62); ctx.lineTo(size * 0.58, size * 0.74); ctx.closePath(); ctx.fill();
      eyesAndMouth(ctx, size, size * 0.5, size * 0.48, size * 0.045, '#8a5a1c');
    },
    sofukurin(ctx, size) {
      radialBg(ctx, size);
      ctx.fillStyle = '#f3fbff';
      ctx.beginPath(); ctx.moveTo(size * 0.5, size * 0.2);
      ctx.bezierCurveTo(size * 0.75, size * 0.35, size * 0.7, size * 0.65, size * 0.5, size * 0.8);
      ctx.bezierCurveTo(size * 0.3, size * 0.65, size * 0.25, size * 0.35, size * 0.5, size * 0.2);
      ctx.fill();
      ctx.fillStyle = '#bfe8ff';
      ctx.beginPath(); ctx.arc(size * 0.5, size * 0.5, size * 0.14, 0, Math.PI * 2); ctx.fill();
      // サングラス
      ctx.fillStyle = 'rgba(42,42,42,0.85)';
      ctx.beginPath(); ctx.arc(size * 0.5 - size * 0.1, size * 0.48, size * 0.065, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(size * 0.5 + size * 0.1, size * 0.48, size * 0.065, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = 'rgba(42,42,42,0.85)';
      ctx.lineWidth = size * 0.012;
      ctx.beginPath(); ctx.moveTo(size * 0.5 - size * 0.04, size * 0.48); ctx.lineTo(size * 0.5 + size * 0.04, size * 0.48); ctx.stroke();
      eyesAndMouth(ctx, size, size * 0.5, size * 0.62, size * 0.04, '#5a9ec9');
    },
    sodaShuwari(ctx, size) {
      radialBg(ctx, size);
      shadeCircle(ctx, size * 0.5, size * 0.5, size * 0.32, 'rgba(127,224,192,0.9)');
      ctx.fillStyle = '#3d8bff';
      ctx.beginPath(); ctx.arc(size * 0.5, size * 0.24, size * 0.07, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      for (const [dx, dy, r] of [[0.15, -0.1, 0.03], [-0.15, 0.05, 0.025], [0.1, 0.2, 0.02]]) {
        ctx.beginPath(); ctx.arc(size * (0.5 + dx), size * (0.5 + dy), size * r, 0, Math.PI * 2); ctx.fill();
      }
      // マフラー
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(size * 0.34, size * 0.68, size * 0.32, size * 0.08);
      eyesAndMouth(ctx, size, size * 0.5, size * 0.52, size * 0.045, '#2c8c6e');
    },
    waffle(ctx, size) {
      radialBg(ctx, size);
      shadeCircle(ctx, size * 0.5, size * 0.5, size * 0.32, '#f2b23a');
      ctx.strokeStyle = 'rgba(201,135,28,0.8)';
      ctx.lineWidth = size * 0.02;
      for (let i = -2; i <= 2; i++) {
        ctx.beginPath(); ctx.moveTo(size * (0.5 + i * 0.1), size * 0.2); ctx.lineTo(size * (0.5 + i * 0.1), size * 0.8); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(size * 0.2, size * (0.5 + i * 0.1)); ctx.lineTo(size * 0.8, size * (0.5 + i * 0.1)); ctx.stroke();
      }
      ctx.fillStyle = 'rgba(242,169,0,0.75)';
      ctx.beginPath(); ctx.arc(size * 0.5, size * 0.2, size * 0.04, 0, Math.PI * 2); ctx.fill();
      // 丸メガネ
      ctx.strokeStyle = 'rgba(212,175,55,0.9)';
      ctx.lineWidth = size * 0.018;
      ctx.beginPath(); ctx.arc(size * 0.5 - size * 0.1, size * 0.48, size * 0.06, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.arc(size * 0.5 + size * 0.1, size * 0.48, size * 0.06, 0, Math.PI * 2); ctx.stroke();
      eyesAndMouth(ctx, size, size * 0.5, size * 0.5, size * 0.045, '#8a5a1c');
    },
    chocolat(ctx, size) {
      radialBg(ctx, size);
      ctx.fillStyle = '#4a2b1c';
      ctx.fillRect(size * 0.2, size * 0.2, size * 0.6, size * 0.6);
      const grad = ctx.createLinearGradient(size * 0.2, size * 0.2, size * 0.8, size * 0.8);
      grad.addColorStop(0, 'rgba(255,255,255,0.18)');
      grad.addColorStop(1, 'rgba(0,0,0,0.25)');
      ctx.fillStyle = grad;
      ctx.fillRect(size * 0.2, size * 0.2, size * 0.6, size * 0.6);
      ctx.strokeStyle = '#2c1710';
      ctx.lineWidth = size * 0.018;
      ctx.beginPath(); ctx.moveTo(size * 0.5, size * 0.2); ctx.lineTo(size * 0.5, size * 0.8); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(size * 0.2, size * 0.5); ctx.lineTo(size * 0.8, size * 0.5); ctx.stroke();
      // フード襟巻き
      ctx.strokeStyle = 'rgba(44,23,16,0.9)';
      ctx.lineWidth = size * 0.03;
      ctx.beginPath(); ctx.arc(size * 0.5, size * 0.7, size * 0.16, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke();
      // 大きめの目で表情強調
      eyesAndMouth(ctx, size, size * 0.5, size * 0.5, size * 0.06, '#ffd166');
    },
    baum(ctx, size) {
      radialBg(ctx, size);
      shadeCircle(ctx, size * 0.5, size * 0.5, size * 0.32, '#c9925a');
      ctx.strokeStyle = 'rgba(138,90,46,0.85)';
      ctx.lineWidth = size * 0.02;
      for (let r = size * 0.08; r < size * 0.3; r += size * 0.06) {
        ctx.beginPath(); ctx.arc(size * 0.5, size * 0.5, r, 0, Math.PI * 2); ctx.stroke();
      }
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.beginPath(); ctx.arc(size * 0.5, size * 0.24, size * 0.05, 0, Math.PI * 2); ctx.fill();
      // ロングマフラー
      ctx.fillStyle = '#c94f5c';
      ctx.fillRect(size * 0.32, size * 0.72, size * 0.36, size * 0.07);
      // 大きな優しいタレ目
      eyesAndMouth(ctx, size, size * 0.5, size * 0.54, size * 0.055, '#8a5a2e');
    },
    bonbon(ctx, size) {
      radialBg(ctx, size);
      shadeCircle(ctx, size * 0.5, size * 0.5, size * 0.32, '#ffffff');
      ctx.fillStyle = '#ff5d7a';
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        ctx.save();
        ctx.translate(size * 0.5 + Math.cos(a) * size * 0.16, size * 0.5 + Math.sin(a) * size * 0.16);
        ctx.rotate(a);
        ctx.fillRect(-size * 0.03, -size * 0.12, size * 0.06, size * 0.12);
        ctx.restore();
      }
      // 丸い突起(少なめ)
      ctx.fillStyle = '#ffe066';
      for (const [dx, dy] of [[0, -0.3], [0.24, -0.1], [-0.24, -0.1]]) {
        ctx.beginPath(); ctx.arc(size * (0.5 + dx), size * (0.5 + dy), size * 0.05, 0, Math.PI * 2); ctx.fill();
      }
      // ヘッドバンド
      ctx.strokeStyle = 'rgba(255,224,102,0.9)';
      ctx.lineWidth = size * 0.03;
      ctx.beginPath(); ctx.arc(size * 0.5, size * 0.5, size * 0.34, Math.PI * 1.15, Math.PI * 1.85); ctx.stroke();
      eyesAndMouth(ctx, size, size * 0.5, size * 0.52, size * 0.045, '#d63b5c');
    },
  };

  function drawPortrait(ctx, id, size) {
    const fn = portraitDrawers[id] || portraitDrawers.macaron;
    fn(ctx, size);
  }

  window.Game = window.Game || {};
  window.Game.characters = { list, build, mountOn, drawPortrait, animate };
})();
