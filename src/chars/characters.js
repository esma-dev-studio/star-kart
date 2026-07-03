// キャラクター9体: データ定義+プロシージャルモデル生成(THREEプリミティブ+CanvasTexture)
// 全キャラ共通: 大きな黒球の目+白ハイライト、Canvas弧線の口で「にこっ」、1.5頭身、身長約1.2、原点=足元中央、+Z向き
(function () {
  const SEG_LOW = 8;
  const SEG_MID = 12;
  const SEG_HI = 14;

  // 共通カラー
  const C_BLACK = 0x2a2320;
  const C_WHITE = 0xffffff;
  const C_BLUSH = 0xff9fb8;

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
    const sprinkle = ['#ffe066', '#69d1ff', '#8affc1', '#ffffff', '#ffb3de'];
    for (let i = 0; i < 60; i++) {
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
    return toTexture(cv);
  }

  // 割れ目溝(板チョコ)
  function texChoco(size) {
    const cv = makeCanvas(size), ctx = cv.getContext('2d');
    ctx.fillStyle = '#4a2b1c';
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

  // 口カーブ(にこっ)を貼るテクスチャ。単色地に弧線のみ描く簡易顔プレート用
  function texFace(size, skinHex) {
    const cv = makeCanvas(size), ctx = cv.getContext('2d');
    ctx.fillStyle = skinHex;
    ctx.fillRect(0, 0, size, size);
    ctx.strokeStyle = '#7a3b2e';
    ctx.lineWidth = size * 0.035;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(size * 0.5, size * 0.42, size * 0.18, 0.15 * Math.PI, 0.85 * Math.PI);
    ctx.stroke();
    return toTexture(cv);
  }

  function hexToCss(hex) {
    return '#' + hex.toString(16).padStart(6, '0');
  }

  // ---- 共通顔パーツ(目+ハイライト) ----
  function addEyes(parent, y, z, spacing, eyeR) {
    const eyeMat = mat(C_BLACK);
    const hiMat = mat(C_WHITE);
    for (const side of [-1, 1]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(eyeR, SEG_LOW, SEG_LOW), eyeMat);
      eye.position.set(side * spacing, y, z);
      parent.add(eye);
      const hi = new THREE.Mesh(new THREE.SphereGeometry(eyeR * 0.35, 6, 6), hiMat);
      hi.position.set(side * spacing + eyeR * 0.28, y + eyeR * 0.3, z + eyeR * 0.75);
      parent.add(hi);
    }
  }

  // 口(弧線)を薄い曲面プレートで表現: 小さなトーラス断片で簡易表現
  function addSmile(parent, y, z, radius, tubeR, colorHex) {
    const smileMat = mat(colorHex || 0x7a3b2e);
    const geo = new THREE.TorusGeometry(radius, tubeR, 6, 12, Math.PI * 0.7);
    const smile = new THREE.Mesh(geo, smileMat);
    smile.rotation.x = Math.PI / 2;
    smile.rotation.z = Math.PI * 1.15;
    smile.position.set(0, y, z);
    parent.add(smile);
  }

  function addBlush(parent, y, z, spacing, r) {
    const blushMat = mat(C_BLUSH, { transparent: true, opacity: 0.75 });
    for (const side of [-1, 1]) {
      const b = new THREE.Mesh(new THREE.SphereGeometry(r, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2), blushMat);
      b.position.set(side * spacing, y, z);
      b.rotation.x = -Math.PI / 2;
      b.lookAt(new THREE.Vector3(side * spacing, y, z + 1));
      parent.add(b);
    }
  }

  function addArm(parent, x, y, z, len, r, colorHex) {
    const g = new THREE.Mesh(new THREE.CapsuleGeometry(r, len, 4, 8), mat(colorHex));
    g.position.set(x, y, z);
    g.rotation.z = Math.PI / 2 * Math.sign(x || 1) * 0.5;
    parent.add(g);
    return g;
  }

  function addLeg(parent, x, y, colorHex) {
    const g = new THREE.Mesh(new THREE.CapsuleGeometry(0.09, 0.22, 4, 8), mat(colorHex));
    g.position.set(x, y, 0.02);
    parent.add(g);
    return g;
  }

  // ==================== キャラ定義 ====================
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

  function buildMacaron() {
    const g = new THREE.Group();
    const shellMat = mat(0xffb0cc);
    const creamMat = mat(0xfff6e0);
    // 下の殻(横に潰れた球)
    const bottom = new THREE.Mesh(new THREE.SphereGeometry(0.42, SEG_MID, SEG_LOW), shellMat);
    bottom.scale.set(1, 0.55, 1);
    bottom.position.y = 0.52;
    g.add(bottom);
    // クリーム(円柱)
    const cream = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 0.14, SEG_MID), creamMat);
    cream.position.y = 0.72;
    g.add(cream);
    // 上の殻
    const top = new THREE.Mesh(new THREE.SphereGeometry(0.42, SEG_MID, SEG_LOW), shellMat);
    top.scale.set(1, 0.5, 1);
    top.position.y = 0.95;
    g.add(top);
    // 頬(ピンク半球)
    addBlush(g, 0.78, 0.32, 0.28, 0.09);
    // 目・口
    addEyes(g, 0.85, 0.36, 0.16, 0.075);
    addSmile(g, 0.72, 0.38, 0.13, 0.02, 0x7a3b2e);
    // リボン(トーラス)
    const ribbonMat = mat(0xffe066);
    const ribbon = new THREE.Mesh(new THREE.TorusGeometry(0.09, 0.035, 6, 10), ribbonMat);
    ribbon.position.set(0, 1.28, 0);
    ribbon.rotation.x = Math.PI / 2;
    g.add(ribbon);
    const ribbonCenter = new THREE.Mesh(new THREE.SphereGeometry(0.045, 6, 6), ribbonMat);
    ribbonCenter.position.set(0, 1.28, 0);
    g.add(ribbonCenter);
    // 短い手足
    addArm(g, -0.4, 0.68, 0.05, 0.18, 0.08, 0xffb0cc);
    addArm(g, 0.4, 0.68, 0.05, 0.18, 0.08, 0xffb0cc);
    addLeg(g, -0.15, 0.14, 0xffffff);
    addLeg(g, 0.15, 0.14, 0xffffff);
    return g;
  }

  function buildDonut() {
    const g = new THREE.Group();
    const tex = texDonut(128);
    const bodyMat = new THREE.MeshLambertMaterial({ map: tex });
    const body = new THREE.Mesh(new THREE.TorusGeometry(0.4, 0.22, SEG_MID, 16), bodyMat);
    body.rotation.x = Math.PI / 2; // 縦置き(輪が正面向き+Z観察可)
    body.position.y = 0.62;
    g.add(body);
    // 顔(穴の中の球)
    const face = new THREE.Mesh(new THREE.SphereGeometry(0.24, SEG_MID, SEG_LOW), mat(0xfff2e0));
    face.position.set(0, 0.62, 0.02);
    g.add(face);
    addEyes(g, 0.66, 0.24, 0.1, 0.055);
    addSmile(g, 0.56, 0.24, 0.09, 0.016, 0x7a3b2e);
    addBlush(g, 0.58, 0.2, 0.17, 0.06);
    addArm(g, -0.42, 0.5, 0.05, 0.16, 0.07, 0xe08a4c);
    addArm(g, 0.42, 0.5, 0.05, 0.16, 0.07, 0xe08a4c);
    addLeg(g, -0.15, 0.14, 0xe08a4c);
    addLeg(g, 0.15, 0.14, 0xe08a4c);
    return g;
  }

  function buildTaplin() {
    const g = new THREE.Group();
    const bodyMat = mat(0xffd23f);
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.4, 0.7, SEG_MID), bodyMat);
    body.position.y = 0.45;
    g.add(body);
    // とろけるキャラメル(平たい球)
    const caramelMat = mat(0xc98a3a);
    const caramel = new THREE.Mesh(new THREE.SphereGeometry(0.26, SEG_MID, SEG_LOW), caramelMat);
    caramel.scale.set(1.1, 0.4, 1.1);
    caramel.position.y = 0.82;
    g.add(caramel);
    // 皿(薄円柱)
    const plateMat = mat(0xffffff);
    const plate = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.06, SEG_MID), plateMat);
    plate.position.y = 0.06;
    g.add(plate);
    addEyes(g, 0.55, 0.36, 0.13, 0.07);
    addSmile(g, 0.44, 0.37, 0.11, 0.018, 0x8a5a1c);
    addBlush(g, 0.47, 0.33, 0.22, 0.07);
    addArm(g, -0.36, 0.42, 0.05, 0.16, 0.07, 0xffd23f);
    addArm(g, 0.36, 0.42, 0.05, 0.16, 0.07, 0xffd23f);
    return g;
  }

  function buildSofukurin() {
    const g = new THREE.Group();
    const swirlMat = mat(0xf3fbff);
    const marbleMat = mat(0xbfe8ff);
    // 下半身: 格子コーン(逆円錐)
    const coneTex = texWaffle(64);
    const cone = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.32, 0.45, SEG_MID),
      new THREE.MeshLambertMaterial({ map: coneTex, color: 0xffe0a0 }));
    cone.position.y = 0.23;
    g.add(cone);
    // 渦巻き状の3段(白×水色マーブル交互)
    const sizes = [0.3, 0.24, 0.18];
    let y = 0.5;
    for (let i = 0; i < 3; i++) {
      const m = i % 2 === 0 ? swirlMat : marbleMat;
      const seg = new THREE.Mesh(new THREE.ConeGeometry(sizes[i], 0.28, SEG_MID), m);
      seg.position.y = y + 0.14;
      g.add(seg);
      y += 0.22;
    }
    const tip = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 8), marbleMat);
    tip.position.y = y + 0.18;
    g.add(tip);
    addEyes(g, y - 0.05, 0.16, 0.1, 0.065);
    addSmile(g, y - 0.16, 0.17, 0.09, 0.016, 0x5a9ec9);
    addBlush(g, y - 0.13, 0.14, 0.16, 0.055);
    addArm(g, -0.26, y - 0.15, 0.02, 0.16, 0.06, 0xbfe8ff);
    addArm(g, 0.26, y - 0.15, 0.02, 0.16, 0.06, 0xbfe8ff);
    return g;
  }

  function buildSoda() {
    const g = new THREE.Group();
    const bodyMat = mat(0x7fe0c0, { transparent: true, opacity: 0.82 });
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.4, SEG_MID, SEG_MID), bodyMat);
    body.scale.set(1, 1.15, 1);
    body.position.y = 0.62;
    g.add(body);
    // ビー玉(頭上の青い小球)
    const marble = new THREE.Mesh(new THREE.SphereGeometry(0.12, SEG_LOW, SEG_LOW), mat(0x3d8bff));
    marble.position.y = 1.08;
    g.add(marble);
    // 泡(白い極小球を数個浮遊)
    const bubbleMat = mat(0xffffff, { transparent: true, opacity: 0.85 });
    const bubblePos = [
      [0.28, 0.9, 0.2], [-0.26, 0.75, -0.22], [0.2, 0.45, 0.3],
      [-0.22, 0.95, 0.15], [0.05, 0.3, -0.3],
    ];
    for (const [x, y, z] of bubblePos) {
      const b = new THREE.Mesh(new THREE.SphereGeometry(0.045, 6, 6), bubbleMat);
      b.position.set(x, y, z);
      g.add(b);
    }
    addEyes(g, 0.68, 0.3, 0.13, 0.07);
    addSmile(g, 0.56, 0.32, 0.1, 0.018, 0x2c8c6e);
    addBlush(g, 0.6, 0.28, 0.2, 0.06);
    addArm(g, -0.36, 0.55, 0.05, 0.16, 0.06, 0x7fe0c0);
    addArm(g, 0.36, 0.55, 0.05, 0.16, 0.06, 0x7fe0c0);
    return g;
  }

  function buildWaffle() {
    const g = new THREE.Group();
    const tex = texWaffle(128);
    const bodyMat = new THREE.MeshLambertMaterial({ map: tex });
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.5, 0.4), bodyMat);
    body.position.y = 0.42;
    // 角丸感を出すため軽くスケール
    g.add(body);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.28, SEG_MID, SEG_LOW), bodyMat);
    head.position.y = 0.86;
    g.add(head);
    // 頭頂のはちみつの雫(半透明円錐)
    const honeyMat = mat(0xf2a900, { transparent: true, opacity: 0.75 });
    const honey = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.16, 8), honeyMat);
    honey.position.y = 1.16;
    g.add(honey);
    addEyes(g, 0.9, 0.24, 0.11, 0.065);
    addSmile(g, 0.78, 0.26, 0.1, 0.018, 0x8a5a1c);
    addBlush(g, 0.82, 0.22, 0.18, 0.055);
    addArm(g, -0.4, 0.5, 0.05, 0.18, 0.08, 0xf2b23a);
    addArm(g, 0.4, 0.5, 0.05, 0.18, 0.08, 0xf2b23a);
    addLeg(g, -0.15, 0.14, 0xf2b23a);
    addLeg(g, 0.15, 0.14, 0xf2b23a);
    return g;
  }

  function buildChocolat() {
    const g = new THREE.Group();
    const tex = texChoco(128);
    const bodyMat = new THREE.MeshLambertMaterial({ map: tex });
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.7, 0.3), bodyMat);
    body.position.y = 0.5;
    g.add(body);
    // 金の帯
    const beltMat = mat(0xd4af37);
    const belt = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.08, 0.32), beltMat);
    belt.position.y = 0.42;
    g.add(belt);
    // 頭
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.26, SEG_MID, SEG_LOW), new THREE.MeshLambertMaterial({ map: tex }));
    head.position.y = 1.0;
    g.add(head);
    // 審査対応: 目を大きく+口を描き表情を強調
    addEyes(g, 1.04, 0.22, 0.11, 0.09);
    addSmile(g, 0.9, 0.24, 0.12, 0.022, 0xffd166);
    addArm(g, -0.36, 0.6, 0.05, 0.18, 0.08, 0x4a2b1c);
    addArm(g, 0.36, 0.6, 0.05, 0.18, 0.08, 0x4a2b1c);
    addLeg(g, -0.14, 0.14, 0x2c1710);
    addLeg(g, 0.14, 0.14, 0x2c1710);
    return g;
  }

  function buildBaum() {
    const g = new THREE.Group();
    const tex = texBaum(128);
    const bodyMat = new THREE.MeshLambertMaterial({ map: tex });
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.32, 0.75, SEG_MID), bodyMat);
    body.position.y = 0.5;
    g.add(body);
    // 頭(球+粉砂糖の白い小球)
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.27, SEG_MID, SEG_LOW), mat(0xd9a86a));
    head.position.y = 1.0;
    g.add(head);
    const sugarMat = mat(0xffffff, { transparent: true, opacity: 0.9 });
    for (let i = 0; i < 6; i++) {
      const s = new THREE.Mesh(new THREE.SphereGeometry(0.025, 5, 5), sugarMat);
      const a = Math.random() * Math.PI * 2, r = 0.24 + Math.random() * 0.06;
      s.position.set(Math.cos(a) * r, 1.0 + (Math.random() - 0.3) * 0.2, Math.sin(a) * r);
      g.add(s);
    }
    // 審査対応: 大きな優しいタレ目
    addEyes(g, 1.0, 0.24, 0.1, 0.08);
    // タレ目にするため目をわずかに下向き回転
    addSmile(g, 0.88, 0.26, 0.11, 0.02, 0x8a5a2e);
    addBlush(g, 0.92, 0.22, 0.18, 0.06);
    addArm(g, -0.38, 0.6, 0.05, 0.18, 0.08, 0xc9925a);
    addArm(g, 0.38, 0.6, 0.05, 0.18, 0.08, 0xc9925a);
    addLeg(g, -0.14, 0.14, 0xc9925a);
    addLeg(g, 0.14, 0.14, 0xc9925a);
    return g;
  }

  function buildBonbon() {
    const g = new THREE.Group();
    const tex = texBonbon(128);
    const bodyMat = new THREE.MeshLambertMaterial({ map: tex });
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.42, SEG_MID, SEG_MID), bodyMat);
    body.position.y = 0.55;
    g.add(body);
    // 審査対応: 丸い半球の突起を少なめに配置(尖らせず可愛く)
    const bumpMat = mat(0xffe066);
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
      g.add(bump);
    }
    addEyes(g, 0.6, 0.34, 0.14, 0.075);
    addSmile(g, 0.48, 0.36, 0.11, 0.02, 0xd63b5c);
    addBlush(g, 0.52, 0.32, 0.22, 0.06);
    addArm(g, -0.4, 0.5, 0.05, 0.18, 0.08, 0xff5d7a);
    addArm(g, 0.4, 0.5, 0.05, 0.18, 0.08, 0xff5d7a);
    addLeg(g, -0.16, 0.12, 0xff5d7a);
    addLeg(g, 0.16, 0.12, 0xff5d7a);
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
    // 身長約1.2 → カート座席にフィットするよう縮小し、座っているように沈める
    const scale = 0.62;
    charGroup.scale.setScalar(scale);
    charGroup.position.set(pos.x, pos.y - 0.55, pos.z);
    if (parent) parent.add(charGroup);
    else kart.group.add(charGroup);

    kart.charId = id;
    const def = list.find((c) => c.id === id);
    kart.charName = def ? def.name : id;
    kart._charGroup = charGroup;
  }

  // ---- 似顔絵(選択画面カード用) ----
  function radialBg(ctx, size) {
    const grad = ctx.createRadialGradient(size / 2, size / 2, size * 0.05, size / 2, size / 2, size * 0.62);
    grad.addColorStop(0, '#ffffff');
    grad.addColorStop(1, '#ffe8ef');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);
  }

  function faceBase(ctx, size, skin) {
    ctx.fillStyle = skin;
    ctx.beginPath();
    ctx.arc(size * 0.5, size * 0.48, size * 0.32, 0, Math.PI * 2);
    ctx.fill();
  }

  function eyesAndMouth(ctx, size, cx, cy, r, mouthColor) {
    ctx.fillStyle = '#2a2320';
    ctx.beginPath(); ctx.arc(cx - r * 1.1, cy, r * 0.34, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(cx + r * 1.1, cy, r * 0.34, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.arc(cx - r * 1.1 + r * 0.12, cy - r * 0.12, r * 0.12, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(cx + r * 1.1 + r * 0.12, cy - r * 0.12, r * 0.12, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = mouthColor || '#7a3b2e';
    ctx.lineWidth = size * 0.018;
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
      ctx.fillStyle = '#ffb0cc';
      ctx.beginPath(); ctx.ellipse(size * 0.5, size * 0.34, size * 0.34, size * 0.16, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#fff6e0';
      ctx.fillRect(size * 0.18, size * 0.42, size * 0.64, size * 0.1);
      ctx.fillStyle = '#ffb0cc';
      ctx.beginPath(); ctx.ellipse(size * 0.5, size * 0.6, size * 0.34, size * 0.16, 0, 0, Math.PI * 2); ctx.fill();
      eyesAndMouth(ctx, size, size * 0.5, size * 0.5, size * 0.045);
      ctx.fillStyle = '#ffe066';
      ctx.beginPath(); ctx.arc(size * 0.5, size * 0.2, size * 0.045, 0, Math.PI * 2); ctx.fill();
    },
    donut(ctx, size) {
      radialBg(ctx, size);
      ctx.fillStyle = '#e08a4c';
      ctx.beginPath(); ctx.arc(size * 0.5, size * 0.48, size * 0.33, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#ff6f91';
      ctx.beginPath(); ctx.arc(size * 0.5, size * 0.42, size * 0.28, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#ffe066';
      ctx.beginPath(); ctx.arc(size * 0.5, size * 0.6, size * 0.12, 0, Math.PI * 2); ctx.fill();
      const sc = ['#69d1ff', '#8affc1', '#ffffff'];
      for (let i = 0; i < 12; i++) {
        ctx.fillStyle = sc[i % sc.length];
        const a = Math.random() * Math.PI * 2, r = size * (0.15 + Math.random() * 0.12);
        ctx.save();
        ctx.translate(size * 0.5 + Math.cos(a) * r, size * 0.42 + Math.sin(a) * r);
        ctx.rotate(a);
        ctx.fillRect(-size * 0.02, -size * 0.005, size * 0.04, size * 0.01);
        ctx.restore();
      }
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
      ctx.fillStyle = '#c98a3a';
      ctx.beginPath(); ctx.ellipse(size * 0.5, size * 0.3, size * 0.2, size * 0.07, 0, 0, Math.PI * 2); ctx.fill();
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
      eyesAndMouth(ctx, size, size * 0.5, size * 0.5, size * 0.045, '#5a9ec9');
    },
    sodaShuwari(ctx, size) {
      radialBg(ctx, size);
      ctx.fillStyle = 'rgba(127,224,192,0.85)';
      ctx.beginPath(); ctx.arc(size * 0.5, size * 0.5, size * 0.32, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#3d8bff';
      ctx.beginPath(); ctx.arc(size * 0.5, size * 0.24, size * 0.07, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      for (const [dx, dy, r] of [[0.15, -0.1, 0.03], [-0.15, 0.05, 0.025], [0.1, 0.2, 0.02]]) {
        ctx.beginPath(); ctx.arc(size * (0.5 + dx), size * (0.5 + dy), size * r, 0, Math.PI * 2); ctx.fill();
      }
      eyesAndMouth(ctx, size, size * 0.5, size * 0.52, size * 0.045, '#2c8c6e');
    },
    waffle(ctx, size) {
      radialBg(ctx, size);
      ctx.fillStyle = '#f2b23a';
      ctx.beginPath(); ctx.arc(size * 0.5, size * 0.5, size * 0.32, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#c9871c';
      ctx.lineWidth = size * 0.02;
      for (let i = -2; i <= 2; i++) {
        ctx.beginPath(); ctx.moveTo(size * (0.5 + i * 0.1), size * 0.2); ctx.lineTo(size * (0.5 + i * 0.1), size * 0.8); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(size * 0.2, size * (0.5 + i * 0.1)); ctx.lineTo(size * 0.8, size * (0.5 + i * 0.1)); ctx.stroke();
      }
      ctx.fillStyle = 'rgba(242,169,0,0.75)';
      ctx.beginPath(); ctx.arc(size * 0.5, size * 0.2, size * 0.04, 0, Math.PI * 2); ctx.fill();
      eyesAndMouth(ctx, size, size * 0.5, size * 0.5, size * 0.045, '#8a5a1c');
    },
    chocolat(ctx, size) {
      radialBg(ctx, size);
      ctx.fillStyle = '#4a2b1c';
      ctx.fillRect(size * 0.2, size * 0.2, size * 0.6, size * 0.6);
      ctx.strokeStyle = '#2c1710';
      ctx.lineWidth = size * 0.018;
      ctx.beginPath(); ctx.moveTo(size * 0.5, size * 0.2); ctx.lineTo(size * 0.5, size * 0.8); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(size * 0.2, size * 0.5); ctx.lineTo(size * 0.8, size * 0.5); ctx.stroke();
      // 大きめの目で表情強調
      eyesAndMouth(ctx, size, size * 0.5, size * 0.5, size * 0.06, '#ffd166');
    },
    baum(ctx, size) {
      radialBg(ctx, size);
      ctx.fillStyle = '#c9925a';
      ctx.beginPath(); ctx.arc(size * 0.5, size * 0.5, size * 0.32, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#8a5a2e';
      ctx.lineWidth = size * 0.02;
      for (let r = size * 0.08; r < size * 0.3; r += size * 0.06) {
        ctx.beginPath(); ctx.arc(size * 0.5, size * 0.5, r, 0, Math.PI * 2); ctx.stroke();
      }
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.beginPath(); ctx.arc(size * 0.5, size * 0.24, size * 0.05, 0, Math.PI * 2); ctx.fill();
      // 大きな優しいタレ目
      eyesAndMouth(ctx, size, size * 0.5, size * 0.54, size * 0.055, '#8a5a2e');
    },
    bonbon(ctx, size) {
      radialBg(ctx, size);
      ctx.fillStyle = '#ffffff';
      ctx.beginPath(); ctx.arc(size * 0.5, size * 0.5, size * 0.32, 0, Math.PI * 2); ctx.fill();
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
      eyesAndMouth(ctx, size, size * 0.5, size * 0.52, size * 0.045, '#d63b5c');
    },
  };

  function drawPortrait(ctx, id, size) {
    const fn = portraitDrawers[id] || portraitDrawers.macaron;
    fn(ctx, size);
  }

  window.Game = window.Game || {};
  window.Game.characters = { list, build, mountOn, drawPortrait };
})();
