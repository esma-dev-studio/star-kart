// キャラクターモデル生成(Phase8 パイプライン分割 2/4)。
// 役割: Game.charBuilder.build(id) → THREE.Group。
// 造形基準v3.5(DESIGN.md)厳守: 主要形状(頭/胴/腕/脚/尻尾)は Game.geo
// (latheSmooth/tube/blob/extrudeSmooth/roundedBox)経由でのみ作る。
// Sphere/Box/Cylinder/Capsuleの直接使用は半径0.15未満の極小装飾のみ許可。
// 原点=足元中央、+Z向き。userData.parts に character_rig.js が参照するノードを格納する:
//   { armL, armR (pivotグループ), eyeL, eyeR, mouths:{normal,excited,dizzy,joy}(またはslits),
//     headY, bodyRoot, ...キャラ固有パーツ }
(function () {
  const SEG_LO = 10;
  const SEG_HI = 16;
  const LATHE_SEG = 26;

  // ---- Canvasテクスチャ小道具(表情+胸ゼッケンパッチ用。頻度が低いためbuild時1回のみ生成) ----
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

  const EXPR_KEYS = ['normal', 'excited', 'dizzy', 'joy'];

  function drawMouth(ctx, size, expr, lineHex) {
    ctx.clearRect(0, 0, size, size);
    const line = '#' + lineHex.toString(16).padStart(6, '0');
    if (expr === 'normal') {
      ctx.strokeStyle = line; ctx.lineWidth = size * 0.09; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.arc(size * 0.5, size * 0.32, size * 0.34, 0.15 * Math.PI, 0.85 * Math.PI); ctx.stroke();
    } else if (expr === 'excited') {
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
    } else if (expr === 'dizzy') {
      ctx.strokeStyle = line; ctx.lineWidth = size * 0.08; ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(size * 0.2, size * 0.35);
      ctx.quadraticCurveTo(size * 0.35, size * 0.2, size * 0.5, size * 0.35);
      ctx.quadraticCurveTo(size * 0.65, size * 0.5, size * 0.8, size * 0.35);
      ctx.stroke();
    } else { // joy
      ctx.fillStyle = '#7a3b2e';
      ctx.beginPath(); ctx.ellipse(size * 0.5, size * 0.4, size * 0.28, size * 0.32, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath(); ctx.ellipse(size * 0.5, size * 0.28, size * 0.22, size * 0.1, 0, 0, Math.PI * 2); ctx.fill();
    }
  }

  function drawBrow(ctx, size, expr) {
    ctx.clearRect(0, 0, size, size);
    ctx.strokeStyle = '#3a2a20'; ctx.lineWidth = size * 0.14; ctx.lineCap = 'round';
    ctx.beginPath();
    if (expr === 'excited') {
      ctx.moveTo(size * 0.15, size * 0.65); ctx.lineTo(size * 0.85, size * 0.35);
    } else if (expr === 'dizzy') {
      ctx.moveTo(size * 0.15, size * 0.4); ctx.quadraticCurveTo(size * 0.5, size * 0.75, size * 0.85, size * 0.4);
    } else if (expr === 'joy') {
      ctx.moveTo(size * 0.15, size * 0.55); ctx.quadraticCurveTo(size * 0.5, size * 0.2, size * 0.85, size * 0.55);
    } else {
      ctx.moveTo(size * 0.15, size * 0.5); ctx.lineTo(size * 0.85, size * 0.5);
    }
    ctx.stroke();
  }

  function drawSlit(ctx, size, expr) {
    ctx.clearRect(0, 0, size, size);
    ctx.fillStyle = '#ff3b30';
    if (expr === 'normal') {
      ctx.fillRect(size * 0.1, size * 0.46, size * 0.8, size * 0.08);
    } else if (expr === 'excited') {
      ctx.save(); ctx.translate(size * 0.5, size * 0.5); ctx.rotate(-0.12);
      ctx.fillRect(-size * 0.42, -size * 0.05, size * 0.84, size * 0.1); ctx.restore();
    } else if (expr === 'dizzy') {
      ctx.strokeStyle = '#ff3b30'; ctx.lineWidth = size * 0.08;
      ctx.beginPath();
      ctx.moveTo(size * 0.1, size * 0.5);
      ctx.quadraticCurveTo(size * 0.3, size * 0.35, size * 0.5, size * 0.5);
      ctx.quadraticCurveTo(size * 0.7, size * 0.65, size * 0.9, size * 0.5);
      ctx.stroke();
    } else { // joy
      ctx.strokeStyle = '#ff3b30'; ctx.lineWidth = size * 0.09; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.arc(size * 0.5, size * 0.3, size * 0.34, 0.1 * Math.PI, 0.55 * Math.PI); ctx.stroke();
    }
  }

  const texCache = {};
  function exprTexture(bank, expr, drawFn, extra) {
    const key = bank + '_' + expr + '_' + (extra || '');
    if (texCache[key]) return texCache[key];
    const size = 64;
    const cv = makeCanvas(size), ctx = cv.getContext('2d');
    drawFn(ctx, size, expr, extra);
    const tex = toTexture(cv);
    texCache[key] = tex;
    return tex;
  }

  // 胸ゼッケンパッチ(レーシングスーツ標準装備)。数字+キャラ色の縁取り
  function patchTexture(num, accentHex) {
    const key = 'patch_' + num + '_' + accentHex;
    if (texCache[key]) return texCache[key];
    const size = 64;
    const cv = makeCanvas(size), ctx = cv.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.arc(size / 2, size / 2, size * 0.46, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#' + accentHex.toString(16).padStart(6, '0');
    ctx.lineWidth = size * 0.09;
    ctx.beginPath(); ctx.arc(size / 2, size / 2, size * 0.4, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = '#33261e';
    ctx.font = 'bold ' + Math.round(size * 0.5) + 'px sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(String(num), size / 2, size * 0.54);
    const tex = toTexture(cv);
    texCache[key] = tex;
    return tex;
  }

  function addMouthSet(parent, y, z, w, h) {
    const group = new THREE.Group();
    group.position.set(0, y, z);
    const meshes = {};
    for (const expr of EXPR_KEYS) {
      const m = new THREE.MeshBasicMaterial({ map: exprTexture('mouth', expr, drawMouth, 0x4a3226), transparent: true, depthWrite: false });
      const plane = new THREE.Mesh(new THREE.PlaneGeometry(w, h), m);
      plane.visible = expr === 'normal';
      plane.name = 'mouth_' + expr;
      group.add(plane);
      meshes[expr] = plane;
    }
    parent.add(group);
    return meshes;
  }

  function addBrowSet(parent, y, z, spacing, w, h) {
    const group = new THREE.Group();
    group.position.set(0, y, z);
    const meshes = {};
    for (const expr of EXPR_KEYS) {
      const tex = exprTexture('brow', expr, drawBrow);
      const mL = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false }));
      mL.position.set(-spacing, 0, 0);
      const mR = mL.clone();
      mR.position.set(spacing, 0, 0);
      mR.scale.x = -1;
      const grp = new THREE.Group();
      grp.add(mL); grp.add(mR);
      grp.visible = expr === 'normal';
      grp.name = 'brow_' + expr;
      group.add(grp);
      meshes[expr] = grp;
    }
    parent.add(group);
    return meshes;
  }

  function addSlitSet(parent, y, z, w, h) {
    const group = new THREE.Group();
    group.position.set(0, y, z);
    const meshes = {};
    for (const expr of EXPR_KEYS) {
      const m = new THREE.MeshBasicMaterial({ map: exprTexture('slit', expr, drawSlit), transparent: true, depthWrite: false });
      const plane = new THREE.Mesh(new THREE.PlaneGeometry(w, h), m);
      plane.visible = expr === 'normal';
      plane.name = 'slit_' + expr;
      group.add(plane);
      meshes[expr] = plane;
    }
    parent.add(group);
    return meshes;
  }

  // 白目+虹彩+ハイライトの重ね目(極小装飾=プリミティブ許可域: 半径0.15未満)
  function addEyes(parent, y, z, spacing, eyeR, irisHex) {
    const whiteMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5 });
    const irisMat = new THREE.MeshStandardMaterial({ color: irisHex || 0x3a2a20, roughness: 0.5 });
    const hiMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const eyes = { left: null, right: null };
    for (const side of [-1, 1]) {
      const grp = new THREE.Group();
      grp.position.set(side * spacing, y, z);
      const white = new THREE.Mesh(new THREE.SphereGeometry(eyeR, SEG_LO, SEG_LO), whiteMat);
      white.scale.set(1, 1.08, 0.7);
      grp.add(white);
      const iris = new THREE.Mesh(new THREE.SphereGeometry(eyeR * 0.6, 8, 8), irisMat);
      iris.position.z = eyeR * 0.55;
      grp.add(iris);
      const hi = new THREE.Mesh(new THREE.SphereGeometry(eyeR * 0.22, 6, 6), hiMat);
      hi.position.set(eyeR * 0.22, eyeR * 0.28, eyeR * 0.82);
      grp.add(hi);
      parent.add(grp);
      if (side === -1) eyes.left = grp; else eyes.right = grp;
    }
    return eyes;
  }

  // 曲がった腕(tube)。ハンドルへ伸びる曲線を持つ。pivotに名前付け(rig契約)
  function addArm(parent, x, y, z, side, mat, opts) {
    const o = opts || {};
    const len = o.len ?? 0.34;
    const radius = o.radius ?? 0.06;
    const bend = o.bend ?? 0.16; // ハンドルへ向かう内向きの曲がり
    const pivot = new THREE.Group();
    pivot.position.set(x, y, z);
    pivot.name = 'arm_' + (side === -1 ? 'L' : 'R') + '_pivot';
    // ローカル座標: 肩(0,0,0)→肘(外→内)→手(前方・内側=ハンドル方向)
    const pts = [
      [0, 0, 0],
      [side * len * 0.32, -len * 0.42, len * 0.12],
      [side * len * 0.18 * bend / 0.16, -len * 0.82, len * 0.5],
    ];
    const geo = Game.geo.tube(pts, radius, 12, 8, false);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.castShadow = true;
    pivot.add(mesh);
    // 手先(極小装飾: グローブの丸み。半径0.15未満)
    const hand = new THREE.Mesh(new THREE.SphereGeometry(radius * 1.35, 8, 8), mat);
    hand.position.set(pts[2][0], pts[2][1], pts[2][2]);
    hand.castShadow = true;
    pivot.add(hand);
    parent.add(pivot);
    return pivot;
  }

  // 脚(latheSmoothの短いブーツ型)。標準装備のブーツ/足カバー
  function addLeg(parent, x, colorMat, opts) {
    const o = opts || {};
    const h = o.h ?? 0.26;
    const topR = o.topR ?? 0.085;
    const geo = Game.geo.latheSmooth([
      [topR * 0.7, h], [topR, h * 0.6], [topR * 0.92, h * 0.22], [topR * 1.05, 0.02], [topR * 0.9, 0],
    ], 16, 12);
    const mesh = new THREE.Mesh(geo, colorMat);
    mesh.position.set(x, 0, 0.02);
    mesh.castShadow = true;
    parent.add(mesh);
    return mesh;
  }

  // 襟(extrudeSmooth輪状の板を首元に)
  function addCollar(parent, y, r, depth, mat) {
    const pts = [];
    const n = 10;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      pts.push([Math.cos(a) * r, Math.sin(a) * r * 0.5]);
    }
    const geo = Game.geo.extrudeSmooth(pts, depth, 0.015, 20);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.rotation.x = Math.PI / 2;
    mesh.position.y = y;
    mesh.castShadow = true;
    parent.add(mesh);
    return mesh;
  }

  // ベルト(latheの薄い輪)+金具(極小装飾)
  function addBelt(parent, y, r, mat, gearMat) {
    const geo = Game.geo.latheSmooth([[r * 0.95, -0.035], [r, 0], [r * 0.95, 0.035]], 18, 6);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.y = y;
    mesh.castShadow = true;
    parent.add(mesh);
    const buckle = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.06, 0.03), gearMat);
    buckle.position.set(0, y, r * 0.96);
    parent.add(buckle);
    return mesh;
  }

  // 胸ゼッケンパッチ(Canvasテクスチャの円形パネル。標準装備)
  function addChestPatch(parent, y, z, r, num, accentHex) {
    const tex = patchTexture(num, accentHex);
    const mesh = new THREE.Mesh(new THREE.CircleGeometry(r, 16),
      new THREE.MeshBasicMaterial({ map: tex, transparent: true }));
    mesh.position.set(0, y, z);
    parent.add(mesh);
    return mesh;
  }

  // グローブ(手袋。極小装飾扱い=既にaddArmで手先を作っているため未使用の予備ヘルパーは持たない)

  // ==================== 各キャラビルダー ====================
  // 1) クルム: 雫型の小さな胴+赤スーツ+クリームの胸パネル、スカーフ、キャップ+ゴーグル
  function buildKurumu() {
    const M = Game.charMats.get('kurumu');
    const g = new THREE.Group();

    // 雫型の胴(latheSmooth: 下広がりで上すぼまり)
    const bodyGeo = Game.geo.latheSmooth([
      [0.01, 0.06], [0.24, 0.18], [0.30, 0.34], [0.27, 0.5], [0.19, 0.62], [0.12, 0.68],
    ], LATHE_SEG);
    const body = new THREE.Mesh(bodyGeo, M.suit);
    body.castShadow = true;
    g.add(body);

    // クリームの胸パネル(非対称: 右肩寄りにパッチを重ねる=非対称要素)
    addChestPatch(g, 0.42, 0.28, 0.1, 1, 0xfff2da);

    // 頭(latheSmoothの丸い頭)
    const headGeo = Game.geo.latheSmooth([
      [0.01, 0.0], [0.2, 0.06], [0.25, 0.16], [0.24, 0.26], [0.16, 0.33], [0.01, 0.36],
    ], LATHE_SEG);
    const head = new THREE.Mesh(headGeo, M.skin);
    head.position.y = 0.68;
    head.castShadow = true;
    g.add(head);

    const eyes = addEyes(g, 0.85, 0.2, 0.095, 0.06, M.eyeIris);
    const mouths = addMouthSet(g, 0.76, 0.23, 0.12, 0.09);

    // クリームの前髪ひと房(tube、頭頂から額へ垂れる非対称の房)
    const swirl = new THREE.Mesh(Game.geo.tube([
      [0.03, 0.99, -0.05], [-0.05, 0.94, 0.12], [0.02, 0.88, 0.22], [-0.03, 0.84, 0.24],
    ], 0.045, 12, 8), M.cream);
    swirl.castShadow = true;
    g.add(swirl);

    // ゴーグル(額)
    for (const side of [-1, 1]) {
      const frame = new THREE.Mesh(new THREE.TorusGeometry(0.075, 0.014, 8, 14), M.gear);
      frame.position.set(side * 0.09, 0.84, 0.22);
      g.add(frame);
      const lens = new THREE.Mesh(new THREE.CircleGeometry(0.062, 14), M.lens);
      lens.position.set(side * 0.09, 0.84, 0.234);
      g.add(lens);
    }
    const strap = new THREE.Mesh(new THREE.TorusGeometry(0.14, 0.012, 6, 16, Math.PI), M.gear);
    strap.rotation.z = Math.PI;
    strap.position.set(0, 0.87, 0.1);
    g.add(strap);

    // キャップ(latheの浅いドーム+extrudeSmoothのつば)
    const capGeo = Game.geo.latheSmooth([[0.005, 0.0], [0.2, 0.02], [0.22, 0.1], [0.15, 0.16]], 20);
    const cap = new THREE.Mesh(capGeo, M.trim);
    cap.position.y = 0.97;
    cap.castShadow = true;
    g.add(cap);
    const brim = new THREE.Mesh(Game.geo.extrudeSmooth([
      [-0.13, -0.02], [0, 0.03], [0.13, -0.02], [0, -0.03],
    ], 0.02, 0.005, 12), M.trim);
    brim.position.set(0, 0.95, 0.19);
    brim.rotation.x = 0.15;
    g.add(brim);

    // 襟+スカーフ(extrudeSmooth: ふわっと曲がる帯)
    addCollar(g, 0.58, 0.17, 0.03, M.suitAccent);
    const scarf = new THREE.Mesh(Game.geo.extrudeSmooth([
      [-0.1, 0.02], [0.02, 0.08], [0.14, -0.02], [0.1, -0.14], [-0.04, -0.12], [-0.12, -0.04],
    ], 0.05, 0.01, 16), M.suit);
    scarf.position.set(0.05, 0.5, 0.16);
    scarf.rotation.y = 0.3;
    scarf.castShadow = true;
    g.add(scarf);

    // ベルト
    addBelt(g, 0.28, 0.24, M.suitAccent, M.gear);

    const armL = addArm(g, -0.27, 0.44, 0.03, -1, M.suit, { len: 0.3, radius: 0.055 });
    const armR = addArm(g, 0.27, 0.44, 0.03, 1, M.suit, { len: 0.3, radius: 0.055 });
    addLeg(g, -0.11, M.trim, { h: 0.22, topR: 0.07 });
    addLeg(g, 0.11, M.trim, { h: 0.22, topR: 0.07 });

    g.userData.parts = { armL, armR, eyeL: eyes.left, eyeR: eyes.right, mouths, headY: 0.85, bodyRoot: g };
    return g;
  }

  // 2) ルポ: 豆型の胴(前傾)+キツネ頭(latheの吻+extrudeの大耳、左右非対称)+太いtube尻尾+片肩バッグ
  function buildRupo() {
    const M = Game.charMats.get('rupo');
    const g = new THREE.Group();

    // 豆型の胴(latheSmooth、前傾させる)
    const bodyGeo = Game.geo.latheSmooth([
      [0.02, 0.02], [0.22, 0.12], [0.27, 0.3], [0.25, 0.46], [0.18, 0.56], [0.08, 0.6],
    ], LATHE_SEG);
    const body = new THREE.Mesh(bodyGeo, M.suit);
    body.rotation.x = -0.12;
    body.castShadow = true;
    g.add(body);

    const head = new THREE.Mesh(Game.geo.latheSmooth([
      [0.01, 0.0], [0.17, 0.05], [0.2, 0.14], [0.17, 0.24], [0.09, 0.3], [0.01, 0.32],
    ], LATHE_SEG), M.skin);
    head.position.set(0, 0.72, 0.02);
    head.castShadow = true;
    g.add(head);

    // 吻(latheのすぼまり)
    const muzzle = new THREE.Mesh(Game.geo.latheSmooth([
      [0.09, 0], [0.08, 0.06], [0.05, 0.14], [0.005, 0.18],
    ], 14), M.muzzle);
    muzzle.rotation.x = -Math.PI / 2;
    muzzle.position.set(0, 0.68, 0.22);
    muzzle.castShadow = true;
    g.add(muzzle);

    // 大きな三角耳(extrudeSmooth、左右で角度差=非対称要素)
    const earShape = [[-0.09, 0], [0, 0.24], [0.09, 0]];
    const earL = new THREE.Mesh(Game.geo.extrudeSmooth(earShape, 0.04, 0.008, 10), M.suit);
    earL.position.set(-0.11, 0.92, -0.02);
    earL.rotation.z = 0.18;
    earL.rotation.y = -0.15;
    earL.castShadow = true;
    g.add(earL);
    const earR = new THREE.Mesh(Game.geo.extrudeSmooth(earShape, 0.04, 0.008, 10), M.suit);
    earR.position.set(0.11, 0.94, -0.02);
    earR.rotation.z = -0.3; // 非対称: 右耳だけ傾ける
    earR.rotation.y = 0.15;
    earR.castShadow = true;
    g.add(earR);

    const eyes = addEyes(g, 0.72, 0.2, 0.085, 0.055, M.eyeIris);
    const mouths = addMouthSet(g, 0.63, 0.26, 0.11, 0.08);

    // 飛行帽(latheのドーム)+耳当て
    const cap = new THREE.Mesh(Game.geo.latheSmooth([[0.005, 0], [0.18, 0.03], [0.2, 0.13], [0.16, 0.2]], 20), M.cap);
    cap.position.y = 0.86;
    cap.castShadow = true;
    g.add(cap);
    for (const side of [-1, 1]) {
      const flap = new THREE.Mesh(Game.geo.extrudeSmooth([[-0.05, 0.06], [0.05, 0.06], [0.03, -0.08], [-0.03, -0.08]], 0.02, 0.006, 8), M.cap);
      flap.position.set(side * 0.15, 0.72, 0.02);
      g.add(flap);
    }
    // ゴーグル
    for (const side of [-1, 1]) {
      const frame = new THREE.Mesh(new THREE.TorusGeometry(0.065, 0.013, 8, 14), M.gear);
      frame.position.set(side * 0.08, 0.72, 0.2);
      g.add(frame);
      const lens = new THREE.Mesh(new THREE.CircleGeometry(0.052, 14), M.lens);
      lens.position.set(side * 0.08, 0.72, 0.213);
      g.add(lens);
    }

    // 片肩の配達バッグ(非対称要素。ベルト帯=extrudeSmooth)
    const strap = new THREE.Mesh(Game.geo.extrudeSmooth([
      [-0.03, 0.2], [0.03, 0.2], [0.05, -0.2], [-0.05, -0.2],
    ], 0.03, 0.006, 8), M.bag);
    strap.position.set(-0.12, 0.4, 0.08);
    strap.rotation.z = 0.5;
    g.add(strap);
    const bag = new THREE.Mesh(Game.geo.roundedBox(0.22, 0.22, 0.12, 0.03), M.bag);
    bag.position.set(-0.24, 0.32, -0.06);
    bag.rotation.y = 0.3;
    bag.castShadow = true;
    g.add(bag);
    const flap = new THREE.Mesh(Game.geo.roundedBox(0.24, 0.08, 0.13, 0.02), M.bagFlap);
    flap.position.set(-0.24, 0.42, -0.06);
    flap.rotation.y = 0.3;
    g.add(flap);

    // 太いtube尻尾+先端blobのふさふさ
    const tail = new THREE.Mesh(Game.geo.tube([
      [0, 0.4, -0.2], [0, 0.32, -0.42], [0.04, 0.4, -0.62], [0.02, 0.5, -0.78],
    ], 0.11, 16, 10), M.suit);
    tail.castShadow = true;
    g.add(tail);
    const tip = new THREE.Mesh(Game.geo.blob(0.1, { noise: 0.22, seed: 4, widthSeg: 12, heightSeg: 10 }), M.suitAccent);
    tip.position.set(0.02, 0.52, -0.86);
    tip.castShadow = true;
    g.add(tip);

    const armL = addArm(g, -0.23, 0.5, 0.05, -1, M.suit, { len: 0.28, radius: 0.055 });
    const armR = addArm(g, 0.23, 0.5, 0.05, 1, M.suit, { len: 0.28, radius: 0.055 });
    addLeg(g, -0.1, M.suitAccent, { h: 0.2, topR: 0.075 });
    addLeg(g, 0.1, M.suitAccent, { h: 0.2, topR: 0.075 });

    g.userData.parts = { armL, armR, eyeL: eyes.left, eyeR: eyes.right, mouths, headY: 0.72, bodyRoot: g, tail };
    return g;
  }

  // 3) ドンガ: 大小blob岩を積んだ非対称ボディ。右腕だけ巨大。ひび=glow extrude。肩に岩プロテクター
  function buildDonga() {
    const M = Game.charMats.get('donga');
    const g = new THREE.Group();

    const legGeoL = Game.geo.latheSmooth([[0.16, 0], [0.19, 0.14], [0.16, 0.3], [0.12, 0.36]], 18);
    const legL = new THREE.Mesh(legGeoL, M.rock);
    legL.position.set(-0.21, 0, 0);
    legL.castShadow = true;
    g.add(legL);
    const legR = new THREE.Mesh(legGeoL.clone(), M.rock);
    legR.position.set(0.21, 0, 0);
    legR.scale.set(1.08, 1, 1.08); // 非対称の微差
    legR.castShadow = true;
    g.add(legR);

    // 大小blob岩を積む(下段大きめ+上段やや小さめでズラす=非対称ボディ)
    const bodyLower = new THREE.Mesh(Game.geo.blob(0.4, { noise: 0.16, seed: 2, sy: 1.05, widthSeg: 20, heightSeg: 16 }), M.rock);
    bodyLower.position.set(0.03, 0.68, 0);
    bodyLower.castShadow = true;
    g.add(bodyLower);
    const bodyUpper = new THREE.Mesh(Game.geo.blob(0.3, { noise: 0.2, seed: 5, sy: 0.95, sx: 1.1, widthSeg: 18, heightSeg: 14 }), M.rockDark);
    bodyUpper.position.set(-0.05, 1.02, 0.02);
    bodyUpper.castShadow = true;
    g.add(bodyUpper);

    // ひび割れ発光(extrudeの細い板を表面に貼る)
    for (let i = 0; i < 3; i++) {
      const crack = new THREE.Mesh(Game.geo.extrudeSmooth([
        [-0.015, -0.12], [0.015, -0.1], [0.02, 0.05], [-0.005, 0.13], [-0.02, 0.02],
      ], 0.02, 0.004, 8), M.crack);
      crack.position.set((-0.14 + i * 0.14), 0.66 + i * 0.05, 0.34);
      crack.rotation.z = (i - 1) * 0.25;
      g.add(crack);
    }

    const head = new THREE.Mesh(Game.geo.blob(0.24, { noise: 0.14, seed: 8, widthSeg: 16, heightSeg: 12 }), M.rock);
    head.position.y = 1.34;
    head.castShadow = true;
    g.add(head);
    const eyes = addEyes(g, 1.35, 0.22, 0.11, 0.07, M.eyeIris);
    const mouths = addMouthSet(g, 1.22, 0.26, 0.14, 0.1);

    // 肩の岩プロテクター(非対称: 左肩のみ)
    const shoulderProt = new THREE.Mesh(Game.geo.blob(0.14, { noise: 0.2, seed: 9, widthSeg: 12, heightSeg: 10 }), M.rockDark);
    shoulderProt.position.set(-0.42, 0.94, 0.06);
    shoulderProt.castShadow = true;
    g.add(shoulderProt);

    // 左腕: 標準サイズ / 右腕: 巨大(非対称要素の核)
    const armL = addArm(g, -0.46, 0.84, 0, -1, M.rock, { len: 0.3, radius: 0.11 });
    const armR = addArm(g, 0.5, 0.9, 0, 1, M.rock, { len: 0.44, radius: 0.16 });
    // 拳(blobの岩)
    const fistL = new THREE.Mesh(Game.geo.blob(0.12, { noise: 0.22, seed: 11, widthSeg: 12, heightSeg: 10 }), M.rockDark);
    fistL.position.set(-0.6, 0.32, 0.12);
    fistL.castShadow = true;
    g.add(fistL);
    const fistR = new THREE.Mesh(Game.geo.blob(0.19, { noise: 0.22, seed: 12, widthSeg: 14, heightSeg: 10 }), M.rockDark);
    fistR.position.set(0.62, 0.16, 0.22);
    fistR.castShadow = true;
    g.add(fistR);

    g.userData.parts = {
      armL, armR, eyeL: eyes.left, eyeR: eyes.right, mouths, headY: 1.35, bodyRoot: g, fistL, fistR,
    };
    return g;
  }

  // 4) ヴォルト8: lathe旋盤加工風の胴体+金属関節tube腕。単眼バイザー。背面冷却フィン。傾いたアンテナ(非対称)
  // 特例: 下半身なし(下端が発光コアリングでカートに一体化)
  function buildVolt8() {
    const M = Game.charMats.get('volt8');
    const g = new THREE.Group();

    // lathe旋盤加工風の胴体(段差のあるリング状輪郭)
    const torsoGeo = Game.geo.lathe([
      [0.22, 0.0], [0.26, 0.04], [0.24, 0.08], [0.27, 0.14], [0.25, 0.2], [0.28, 0.28],
      [0.24, 0.36], [0.2, 0.44], [0.14, 0.5],
    ], 22);
    const torso = new THREE.Mesh(torsoGeo, M.metal);
    torso.position.y = 0.2;
    torso.castShadow = true;
    g.add(torso);

    const chestPanel = new THREE.Mesh(Game.geo.roundedBox(0.26, 0.22, 0.05, 0.02), M.panel);
    chestPanel.position.set(0, 0.42, 0.24);
    chestPanel.castShadow = true;
    g.add(chestPanel);

    const neck = new THREE.Mesh(Game.geo.lathe([[0.09, 0], [0.11, 0.06], [0.09, 0.12]], 14), M.metal);
    neck.position.y = 0.72;
    g.add(neck);

    // 頭部(latheの角ばった箱風だが回転体で構成=roundedBoxベース、直方体直接使用を回避)
    const head = new THREE.Mesh(Game.geo.roundedBox(0.3, 0.26, 0.28, 0.045), M.metal);
    head.position.y = 0.92;
    head.castShadow = true;
    g.add(head);

    // 単眼バイザー(曲面extrude)
    const visor = new THREE.Mesh(Game.geo.extrudeSmooth([
      [-0.11, -0.05], [-0.06, 0.06], [0.06, 0.06], [0.11, -0.05], [0.06, -0.08], [-0.06, -0.08],
    ], 0.03, 0.006, 16), M.panel);
    visor.position.set(0, 0.92, 0.15);
    g.add(visor);

    const eyeColors = { normal: M.led, excited: M.ledExcited, dizzy: M.ledDizzy, joy: M.ledJoy };
    const ledEyes = {};
    for (const expr of EXPR_KEYS) {
      const grp = new THREE.Group();
      grp.visible = expr === 'normal';
      grp.name = 'led_' + expr;
      const bar = new THREE.Mesh(Game.geo.roundedBox(0.16, 0.045, 0.02, 0.01), eyeColors[expr]);
      bar.position.set(0, 0.92, 0.17);
      grp.add(bar);
      g.add(grp);
      ledEyes[expr] = grp;
    }

    // 背面冷却フィン(extrudeの列)
    for (let i = 0; i < 4; i++) {
      const fin = new THREE.Mesh(Game.geo.roundedBox(0.2, 0.1, 0.015, 0.01), M.metalDark);
      fin.position.set(0, 0.3 + i * 0.09, -0.22);
      fin.castShadow = true;
      g.add(fin);
    }

    // 傾いたアンテナ(非対称要素)
    const antStalk = new THREE.Mesh(Game.geo.tube([[0, 1.05, 0], [0.05, 1.22, -0.02], [0.09, 1.34, -0.03]], 0.014, 10, 6), M.metalDark);
    g.add(antStalk);
    const antTip = new THREE.Mesh(new THREE.SphereGeometry(0.032, 8, 8), M.led);
    antTip.position.set(0.09, 1.35, -0.03);
    g.add(antTip);

    const armL = addArm(g, -0.3, 0.5, 0, -1, M.metal, { len: 0.28, radius: 0.075 });
    const armR = addArm(g, 0.3, 0.5, 0, 1, M.metal, { len: 0.28, radius: 0.075 });
    // クロー状の手(roundedBoxで機械感)
    const handL = new THREE.Mesh(Game.geo.roundedBox(0.1, 0.1, 0.1, 0.02), M.panel);
    handL.position.set(-0.41, 0.14, 0.13);
    g.add(handL);
    const handR = new THREE.Mesh(Game.geo.roundedBox(0.1, 0.1, 0.1, 0.02), M.panel);
    handR.position.set(0.41, 0.14, 0.13);
    g.add(handR);

    // 下半身の代わり: マシン一体化の発光コアリング
    const core = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.035, 8, 22), M.led);
    core.rotation.x = Math.PI / 2;
    core.position.y = 0.02;
    g.add(core);

    g.userData.parts = {
      armL, armR, eyeL: null, eyeR: null, mouths: ledEyes, headY: 0.92, bodyRoot: g, noBounceLegs: true,
    };
    return g;
  }

  // 5) シズク: 雫型の半透明ボディ(latheSmooth+glass)。オーロラ髪=波打つextrudeSmooth3枚重ね。
  //    頭頂に雫の王冠。体内に光る核。特例: 脚の代わりに雫状の下半身で浮遊
  function buildShizuku() {
    const M = Game.charMats.get('shizuku');
    const g = new THREE.Group();

    // 雫状の下半身(latheSmooth: 下すぼまり=浮遊感)
    const dropGeo = Game.geo.latheSmooth([
      [0.005, 0.0], [0.16, 0.1], [0.24, 0.24], [0.22, 0.4], [0.14, 0.5],
    ], LATHE_SEG);
    const drop = new THREE.Mesh(dropGeo, M.drop);
    drop.position.y = 0.14;
    drop.castShadow = true;
    g.add(drop);

    const bodyGeo = Game.geo.latheSmooth([
      [0.01, 0.0], [0.2, 0.1], [0.26, 0.24], [0.22, 0.4], [0.13, 0.5], [0.01, 0.54],
    ], LATHE_SEG);
    const body = new THREE.Mesh(bodyGeo, M.body);
    body.position.y = 0.5;
    body.castShadow = true;
    g.add(body);

    // 体内の光る核
    const core = new THREE.Mesh(new THREE.SphereGeometry(0.09, 12, 12), M.core);
    core.position.y = 0.68;
    g.add(core);

    const eyes = addEyes(g, 0.86, 0.2, 0.09, 0.058, M.eyeIris);
    const mouths = addMouthSet(g, 0.78, 0.24, 0.11, 0.08);

    // オーロラの髪(波打つextrudeSmoothを3枚重ね)
    const auroraMats = [M.auroraA, M.auroraB, M.auroraC];
    for (let i = 0; i < 3; i++) {
      const wave = new THREE.Mesh(Game.geo.extrudeSmooth([
        [-0.03, 0.02], [0.08, 0.14], [-0.02, 0.26], [0.1, 0.36], [0.02, 0.42], [-0.06, 0.3], [0.02, 0.18], [-0.05, 0.08],
      ], 0.012, 0.004, 20), auroraMats[i]);
      wave.position.set((i - 1) * 0.09, 0.92, -0.03 + i * 0.01);
      wave.rotation.y = (i - 1) * 0.35;
      g.add(wave);
    }

    // 雫の王冠(小さなlathe)
    const crown = new THREE.Mesh(Game.geo.lathe([[0.01, 0], [0.1, 0.03], [0.11, 0.1], [0.06, 0.16], [0.005, 0.19]], 16), M.crown);
    crown.position.y = 0.98;
    g.add(crown);

    const armL = addArm(g, -0.23, 0.62, 0.03, -1, M.body, { len: 0.24, radius: 0.05 });
    const armR = addArm(g, 0.23, 0.62, 0.03, 1, M.body, { len: 0.24, radius: 0.05 });

    // 浮遊の泡飾り(極小装飾、半径0.15未満)
    const bubbles = [];
    for (const [x, y, z] of [[0.19, 0.42, 0.16], [-0.17, 0.3, -0.13], [0.12, 0.18, 0.18]]) {
      const b = new THREE.Mesh(new THREE.SphereGeometry(0.03, 8, 8), M.crown);
      b.position.set(x, y, z);
      g.add(b);
      bubbles.push(b);
    }

    g.userData.parts = {
      armL, armR, eyeL: eyes.left, eyeR: eyes.right, mouths, headY: 0.86, bodyRoot: g,
      bubbles, floating: true, drop, noLegs: true,
    };
    return g;
  }

  // 6) グミラス王: 洋ナシ型グミ胴(latheSmooth+glass)。金の王冠(lathe)+緋色マント(extrudeSmooth曲面)。
  //    白いクリームの襟
  function buildGumiras() {
    const M = Game.charMats.get('gumiras');
    const g = new THREE.Group();

    // 洋ナシ型(下広がりで恰幅よく)
    const bodyGeo = Game.geo.latheSmooth([
      [0.02, 0.0], [0.3, 0.12], [0.42, 0.32], [0.4, 0.5], [0.28, 0.66], [0.16, 0.74],
    ], LATHE_SEG);
    const body = new THREE.Mesh(bodyGeo, M.jelly);
    body.castShadow = true;
    g.add(body);

    const head = new THREE.Mesh(Game.geo.latheSmooth([
      [0.01, 0], [0.22, 0.08], [0.27, 0.2], [0.24, 0.32], [0.15, 0.4], [0.01, 0.44],
    ], LATHE_SEG), M.jelly);
    head.position.y = 0.78;
    head.castShadow = true;
    g.add(head);

    // 緋色マント(extrudeSmooth曲面、背中に流す)
    const cape = new THREE.Mesh(Game.geo.extrudeSmooth([
      [-0.26, 0.3], [0.26, 0.3], [0.34, -0.1], [0.2, -0.5], [0, -0.58], [-0.2, -0.5], [-0.34, -0.1],
    ], 0.04, 0.01, 24), M.cape);
    cape.position.set(0, 0.5, -0.28);
    cape.castShadow = true;
    g.add(cape);

    // 金の王冠(lathe)
    const crownBase = new THREE.Mesh(Game.geo.lathe([[0.16, 0], [0.19, 0.05], [0.18, 0.12], [0.15, 0.15]], 18), M.crown);
    crownBase.position.y = 1.02;
    crownBase.castShadow = true;
    g.add(crownBase);
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      const spike = new THREE.Mesh(Game.geo.tube([[0, 0, 0], [0, 0.09, 0]], 0.018, 6, 6), M.crown);
      spike.position.set(Math.cos(a) * 0.13, 1.15, Math.sin(a) * 0.13);
      g.add(spike);
    }
    const jewel = new THREE.Mesh(new THREE.SphereGeometry(0.025, 8, 8), M.jewel);
    jewel.position.set(0, 1.06, 0.17);
    g.add(jewel);

    // 白いクリームの襟
    addCollar(g, 0.72, 0.2, 0.035, M.collar);

    const eyes = addEyes(g, 0.86, 0.24, 0.11, 0.07, M.eyeIris);
    const mouths = addMouthSet(g, 0.74, 0.28, 0.15, 0.1);

    const armL = addArm(g, -0.4, 0.56, 0.05, -1, M.jelly, { len: 0.3, radius: 0.09 });
    const armR = addArm(g, 0.4, 0.56, 0.05, 1, M.jelly, { len: 0.3, radius: 0.09 });
    addLeg(g, -0.16, M.jellyDark, { h: 0.2, topR: 0.1 });
    addLeg(g, 0.16, M.jellyDark, { h: 0.2, topR: 0.1 });

    g.userData.parts = { armL, armR, eyeL: eyes.left, eyeR: eyes.right, mouths, headY: 0.86, bodyRoot: g, jelly: true };
    return g;
  }

  // 7) ノワール卿: 縦長lathe鎧胴+肩ポールドロン(lathe半割)。兜(lathe)に片側だけクレストフィン(非対称)。
  //    マントは後方extrudeSmooth。スリット目=glowライン
  function buildNoir() {
    const M = Game.charMats.get('noir');
    const g = new THREE.Group();

    const bodyGeo = Game.geo.latheSmooth([
      [0.02, 0], [0.22, 0.06], [0.25, 0.24], [0.22, 0.42], [0.17, 0.56], [0.1, 0.64],
    ], LATHE_SEG);
    const body = new THREE.Mesh(bodyGeo, M.armor);
    body.castShadow = true;
    g.add(body);

    // 肩ポールドロン(lathe半割: 半円回転体)
    for (const side of [-1, 1]) {
      const geo = new THREE.LatheGeometry(
        [[0, -0.1], [0.14, -0.08], [0.16, 0], [0.12, 0.08], [0, 0.1]].map(([r, y]) => new THREE.Vector2(Math.max(0.0001, r), y)),
        12, 0, Math.PI,
      );
      const pauldron = new THREE.Mesh(geo, M.pauldron);
      pauldron.rotation.y = side > 0 ? Math.PI / 2 : -Math.PI / 2;
      pauldron.position.set(side * 0.25, 0.58, 0);
      pauldron.castShadow = true;
      g.add(pauldron);
    }

    // 兜(latheの角ばった曲面)
    const helm = new THREE.Mesh(Game.geo.latheSmooth([
      [0.01, 0], [0.2, 0.06], [0.23, 0.18], [0.19, 0.3], [0.1, 0.36], [0.01, 0.38],
    ], LATHE_SEG), M.armor);
    helm.position.y = 0.94;
    helm.castShadow = true;
    g.add(helm);

    // 片側だけのクレストフィン(非対称要素)
    const crest = new THREE.Mesh(Game.geo.extrudeSmooth([
      [-0.015, 0], [0.015, 0], [0.05, 0.16], [-0.01, 0.24], [-0.03, 0.1],
    ], 0.02, 0.004, 12), M.trim);
    crest.position.set(0.09, 1.28, -0.04);
    crest.rotation.z = -0.12;
    g.add(crest);

    const slits = addSlitSet(g, 0.98, 0.205, 0.18, 0.055);

    // マント(後方へ流れるextrudeSmooth)
    const cape = new THREE.Mesh(Game.geo.extrudeSmooth([
      [-0.2, 0.24], [0.2, 0.24], [0.26, -0.14], [0.14, -0.5], [0, -0.56], [-0.14, -0.5], [-0.26, -0.14],
    ], 0.03, 0.008, 22), M.cape);
    cape.position.set(0, 0.5, -0.22);
    cape.castShadow = true;
    g.add(cape);

    const armL = addArm(g, -0.28, 0.5, 0, -1, M.armor, { len: 0.26, radius: 0.07 });
    const armR = addArm(g, 0.28, 0.5, 0, 1, M.armor, { len: 0.26, radius: 0.07 });
    addLeg(g, -0.1, M.armorDark, { h: 0.24, topR: 0.09 });
    addLeg(g, 0.1, M.armorDark, { h: 0.24, topR: 0.09 });

    addBelt(g, 0.26, 0.2, M.trim, M.trim);

    g.userData.parts = {
      armL, armR, eyeL: null, eyeR: null, mouths: slits, headY: 0.94, bodyRoot: g, isSlit: true,
    };
    return g;
  }

  // 8) バウム翁: 年輪latheの上細り幹ボディ。枝の腕=節のあるtube。頭頂に若葉(extrude)。モノクル+革グローブ
  function buildBaumjii() {
    const M = Game.charMats.get('baumjii');
    const g = new THREE.Group();

    const bodyGeo = Game.geo.latheSmooth([
      [0.24, 0], [0.26, 0.16], [0.22, 0.36], [0.19, 0.5], [0.15, 0.6], [0.11, 0.66],
    ], LATHE_SEG);
    const body = new THREE.Mesh(bodyGeo, M.wood);
    body.castShadow = true;
    g.add(body);

    const head = new THREE.Mesh(Game.geo.latheSmooth([
      [0.01, 0], [0.19, 0.06], [0.22, 0.16], [0.19, 0.26], [0.12, 0.32], [0.01, 0.34],
    ], LATHE_SEG), M.skin);
    head.position.y = 0.86;
    head.castShadow = true;
    g.add(head);

    // 頭頂の若葉(extrude)
    const leaf = new THREE.Mesh(Game.geo.extrudeSmooth([
      [-0.05, 0], [0, 0.14], [0.06, 0.02], [0.02, -0.03],
    ], 0.02, 0.005, 10), M.leaf);
    leaf.position.set(0.02, 1.16, 0);
    leaf.rotation.x = 0.2;
    g.add(leaf);

    const eyes = addEyes(g, 0.86, 0.2, 0.1, 0.065, M.eyeIris);
    const mouths = addMouthSet(g, 0.76, 0.24, 0.13, 0.09);

    // 口ヒゲ(左右対称の小tube)
    for (const side of [-1, 1]) {
      const wisp = new THREE.Mesh(Game.geo.tube([[0, 0, 0], [side * 0.08, -0.03, 0.02], [side * 0.15, -0.01, 0.01]], 0.018, 8, 6), M.mustache);
      wisp.position.set(side * 0.05, 0.79, 0.19);
      g.add(wisp);
    }
    // モノクル
    const monoFrame = new THREE.Mesh(new THREE.TorusGeometry(0.075, 0.012, 6, 14), M.gear);
    monoFrame.position.set(0.09, 0.87, 0.21);
    g.add(monoFrame);
    const monoLens = new THREE.Mesh(new THREE.CircleGeometry(0.062, 12), M.lens);
    monoLens.position.set(0.09, 0.87, 0.222);
    g.add(monoLens);
    const chain = new THREE.Mesh(new THREE.TorusGeometry(0.09, 0.006, 4, 8, Math.PI), M.gear);
    chain.position.set(0.14, 0.76, 0.19);
    chain.rotation.z = Math.PI;
    g.add(chain);

    // 枝の腕(節のあるtube。複数制御点で節目を作る)
    const armL = addArm(g, -0.29, 0.5, 0.02, -1, M.wood, { len: 0.3, radius: 0.06 });
    const armR = addArm(g, 0.29, 0.5, 0.02, 1, M.wood, { len: 0.3, radius: 0.06 });
    // 革グローブ(極小装飾)
    const gloveL = new THREE.Mesh(new THREE.SphereGeometry(0.075, 10, 10), M.glove);
    gloveL.position.set(-0.42, 0.16, 0.14);
    gloveL.castShadow = true;
    g.add(gloveL);
    const gloveR = new THREE.Mesh(new THREE.SphereGeometry(0.075, 10, 10), M.glove);
    gloveR.position.set(0.42, 0.16, 0.14);
    gloveR.castShadow = true;
    g.add(gloveR);

    addLeg(g, -0.12, M.woodDark, { h: 0.22, topR: 0.09 });
    addLeg(g, 0.12, M.woodDark, { h: 0.22, topR: 0.09 });

    g.userData.parts = {
      armL, armR, eyeL: eyes.left, eyeR: eyes.right, mouths, headY: 0.86, bodyRoot: g, gloveL, gloveR,
    };
    return g;
  }

  // 9) ジンジャ: 厚みのあるextrudeSmoothでクッキーシルエット(忍者頭巾つき輪郭)一体成形。
  //    アイシング縁取り=白tube。ミント帯・手甲
  function buildGinja() {
    const M = Game.charMats.get('ginja');
    const g = new THREE.Group();

    // 忍者頭巾つき輪郭を一体成形(extrudeSmooth: 頭から胴までの厚みあるシルエット)
    const silhouette = [
      [-0.19, 0.02], [-0.22, 0.24], [-0.16, 0.48], [-0.13, 0.62],
      [-0.16, 0.72], [-0.1, 0.86], [0, 0.92], [0.1, 0.86], [0.16, 0.72],
      [0.13, 0.62], [0.16, 0.48], [0.22, 0.24], [0.19, 0.02],
    ];
    const bodyMesh = new THREE.Mesh(Game.geo.extrudeSmooth(silhouette, 0.22, 0.02, 32), M.cookie);
    bodyMesh.rotation.x = 0; // 正面向きのまま(押し出し方向=Z)
    bodyMesh.position.z = -0.11;
    bodyMesh.castShadow = true;
    g.add(bodyMesh);

    const eyes = addEyes(g, 0.78, 0.15, 0.085, 0.052, M.eyeIris);
    const mouths = addMouthSet(g, 0.7, 0.17, 0.1, 0.075);

    // アイシングの縁取り(白tubeを輪郭に沿わせる。頭巾の縁のみ=上半分)
    const icingPts = silhouette.slice(4, 10).map(([x, y]) => [x, y, 0.11]);
    const icing = new THREE.Mesh(Game.geo.tube(icingPts, 0.022, 16, 8), M.icing);
    icing.castShadow = true;
    g.add(icing);

    // ミントの帯(胴に巻く)
    addBelt(g, 0.42, 0.19, M.sash, M.gear);
    // ミントの手甲(袖口の帯)
    // (腕そのものはtube、手甲は帯として袖口に追加)

    const armL = addArm(g, -0.2, 0.56, 0.05, -1, M.cookie, { len: 0.24, radius: 0.05 });
    const armR = addArm(g, 0.2, 0.56, 0.05, 1, M.cookie, { len: 0.24, radius: 0.05 });
    for (const side of [-1, 1]) {
      const cuff = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.014, 6, 12), M.sash);
      cuff.position.set(side * 0.2 + side * 0.14, 0.2, 0.19);
      cuff.rotation.x = Math.PI / 2;
      g.add(cuff);
    }
    addLeg(g, -0.09, M.cookieDark, { h: 0.18, topR: 0.065 });
    addLeg(g, 0.09, M.cookieDark, { h: 0.18, topR: 0.065 });

    g.userData.parts = { armL, armR, eyeL: eyes.left, eyeR: eyes.right, mouths, headY: 0.78, bodyRoot: g };
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
    return g;
  }

  window.Game = window.Game || {};
  window.Game.charBuilder = { build, EXPR_KEYS };
})();
