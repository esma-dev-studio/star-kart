// コース基盤クラス。
// コース定義(def)の形式:
// {
//   name, controlPoints: [{x,y,z,w?}],   // wは路面半幅
//   offroadWidth?,                        // 路肩(減速地帯)の幅
//   colors: { sky, fog?, ground, road, edge, offroad },
//   boostPads?: [{t0,t1,l0?,l1?}],        // t=進行度0..1, l=-1..1(半幅比)
//   jumpPads?:  [{t0,t1,l0?,l1?,impulse?}],
//   gaps?:      [{t0,t1}],                // 路面が存在しない区間(浮遊足場の切れ目)
//   fallZones?: [{t0,t1}],                // 路肩が無く縁から落下する区間
//   decorate?(group, course)              // テーマ装飾の追加フック
// }
Game.Course = class Course {
  constructor(def) {
    this.def = def;
    this.name = def.name;
    this.spline = new Game.Spline(def.controlPoints, def.samples || 512);
    this.offroadWidth = def.offroadWidth ?? 6;
    this.gaps = def.gaps || [];
    this.fallZones = def.fallZones || [];
    this.pads = [];
    for (const p of (def.boostPads || [])) this.pads.push({ type: 'boost', l0: -1, l1: 1, ...p });
    for (const p of (def.jumpPads || [])) this.pads.push({ type: 'jump', impulse: Game.config.physics.jumpImpulse, l0: -1, l1: 1, ...p });
    this.group = null;
    this.minimap = null;
  }

  static inRange(z, t) { return z.t0 <= z.t1 ? (t >= z.t0 && t <= z.t1) : (t >= z.t0 || t <= z.t1); }
  inZone(zones, t) {
    for (const z of zones) if (Course.inRange(z, t)) return z;
    return null;
  }
  padAt(t, latRatio) {
    for (const p of this.pads) {
      if (Course.inRange(p, t) && latRatio >= p.l0 && latRatio <= p.l1) return p;
    }
    return null;
  }

  // 路面クエリ。kartは前回のidxをhintとして渡し続けること(立体交差対策)。
  query(pos, hint = null) {
    const s = this.spline;
    const idx = s.closest(pos, hint);
    const p = s.pts[idx], tan = s.tan[idx], nrm = s.nrm[idx];
    const lateral = (pos.x - p.x) * nrm.x + (pos.z - p.z) * nrm.z;
    const halfWidth = s.w[idx];
    const progress = s.progress(idx);
    const inGap = this.inZone(this.gaps, progress);
    const inFall = this.inZone(this.fallZones, progress);
    const abs = Math.abs(lateral);

    let surface = 'road', ground = true, wall = true;
    let limit = halfWidth + this.offroadWidth;
    let pad = null;
    if (abs <= halfWidth) {
      if (inGap) { surface = 'gap'; ground = false; wall = false; }
      else {
        pad = this.padAt(progress, lateral / halfWidth);
        surface = pad ? pad.type : 'road';
      }
    } else if (inGap || inFall) {
      surface = 'fall'; ground = false; wall = false; limit = halfWidth;
    } else {
      surface = 'offroad';
    }
    return {
      idx, progress, point: p, tangent: tan, normal: nrm,
      roadY: p.y, lateral, halfWidth, limit, surface, ground, wall, pad,
      tangentAngle: s.tangentAngle(idx),
    };
  }

  respawnPoint(progress) {
    const s = this.spline;
    // 少しだけ手前の路面上に戻す。fallZoneは縁の外に落ちるだけで路面自体は存在するので
    // 進行度は保持する(ゾーン先頭まで巻き戻すと落下のたびに大幅後退が蓄積してしまう)。
    let t = (progress - 4 / s.count + 1) % 1;
    // ギャップ(路面が無い区間)だけはその手前へ
    const gap = this.inZone(this.gaps, t);
    if (gap) t = (gap.t0 - 0.01 + 1) % 1;
    const idx = Math.floor(t * s.count) % s.count;
    return {
      pos: s.pts[idx].clone().add(new THREE.Vector3(0, 0.2, 0)),
      heading: s.tangentAngle(idx),
      hint: idx,
    };
  }

  startPositions(n) {
    const s = this.spline;
    const out = [];
    for (let k = 0; k < n; k++) {
      const row = Math.floor(k / 2), side = k % 2;
      const idx = (s.count - (10 + row * 8)) % s.count;
      const p = s.pts[idx], nrm = s.nrm[idx];
      const lat = (side === 0 ? -0.42 : 0.42) * s.w[idx];
      out.push({
        pos: new THREE.Vector3(p.x + nrm.x * lat, p.y, p.z + nrm.z * lat),
        heading: s.tangentAngle(idx),
        hint: idx,
      });
    }
    return out;
  }

  // ---- メッシュ生成 ----

  build(scene) {
    const g = new THREE.Group();
    const s = this.spline, c = this.def.colors;
    const U = Game.U;

    scene.background = new THREE.Color(c.sky);
    scene.fog = new THREE.FogExp2(c.fog ?? c.sky, this.def.fogDensity ?? 0.0038);
    const dome = this.buildSkyDome(c);
    g.add(dome);
    const clouds = this.def.clouds === false ? null : this.buildClouds();
    if (clouds) g.add(clouds);
    const horizon = this.def.horizon === false ? null : this.buildHorizon(c);
    if (horizon) g.add(horizon);

    // 地面: 中心=地面色→外周=フォグ色のラジアルグラデーションで地平線に溶かす
    let minY = Infinity;
    for (const p of s.pts) minY = Math.min(minY, p.y);
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(2400, 2400),
      new THREE.MeshLambertMaterial({ map: this.groundTexture(c) })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = minY - 1.6;
    g.add(ground);

    // 路面 + 路肩
    const roadMesh = this.buildStrip(-1, 1, this.roadTexture(c), 0, (t) => !this.inZone(this.gaps, t));
    g.add(roadMesh);
    const offMat = new THREE.MeshLambertMaterial({ color: c.offroad, side: THREE.DoubleSide });
    const skirtOk = (t) => !this.inZone(this.gaps, t) && !this.inZone(this.fallZones, t);
    const skirtR = this.buildStrip(1, 1 + this.offroadWidth / 7, offMat, -0.02, skirtOk, true);
    const skirtL = this.buildStrip(-1 - this.offroadWidth / 7, -1, offMat, -0.02, skirtOk, true);
    g.add(skirtR); g.add(skirtL);

    // ブースト/ジャンプパッド
    const padMeshes = this.pads.map((p) => this.buildPadMesh(p));
    for (const m of padMeshes) g.add(m);

    // スタートライン(チェッカー)とゲート
    const startLine = this.buildStartLine();
    g.add(startLine);
    g.add(this.buildGate());

    // 急コーナーの外側にシェブロン看板(コーナー予告+レース感)
    for (const m of this.buildCornerSigns()) g.add(m);

    if (this.def.decorate) this.def.decorate(g, this);

    // 動的シャドウ: 装飾・ゲート・看板は影を落とし、路面・地面は受けるだけにする
    g.traverse((o) => {
      if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; }
    });
    const noCast = [dome, ground, roadMesh, skirtR, skirtL, startLine, ...padMeshes];
    if (horizon) noCast.push(...horizon.children);
    for (const m of noCast) { m.castShadow = false; }

    // ミニマップ用外形
    const mm = [];
    for (let i = 0; i < s.count; i += 4) mm.push({ x: s.pts[i].x, z: s.pts[i].z });
    this.minimap = mm;

    this.group = g;
    scene.add(g);
    return g;
  }

  // 中心線から l0..l1 (半幅比、offroadは比を拡張) の帯メッシュを作る
  buildStrip(r0, r1, matOrTex, yOff, includeFn, isSkirt = false) {
    const s = this.spline;
    const pos = [], uv = [], idxArr = [];
    let vi = 0;
    for (let i = 0; i < s.count; i++) {
      const j = (i + 1) % s.count;
      const tMid = ((i + 0.5) / s.count) % 1;
      if (includeFn && !includeFn(tMid)) continue;
      const add = (k, r) => {
        const p = s.pts[k], n = s.nrm[k], w = s.w[k];
        // 路肩は半幅+固定幅で計算する(比だと幅がコース幅に比例してしまう)
        const off = isSkirt
          ? Math.sign(r) * (w + (Math.abs(r) - 1) * 7)
          : r * w;
        pos.push(p.x + n.x * off, p.y + yOff, p.z + n.z * off);
      };
      add(i, r0); add(i, r1); add(j, r0); add(j, r1);
      const v0 = (i / s.count) * s.total / 6, v1 = ((i + 1) / s.count) * s.total / 6;
      uv.push(0, v0, 1, v0, 0, v1, 1, v1);
      // 巻き順は「上から見て反時計回り」= 法線が上向きになるようにする
      // (逆順だと背面カリングで路面が上から見えなくなる)
      idxArr.push(vi, vi + 1, vi + 2, vi + 2, vi + 1, vi + 3);
      vi += 4;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    geo.setIndex(idxArr);
    geo.computeVertexNormals();
    const mat = matOrTex.isMaterial ? matOrTex
      : new THREE.MeshLambertMaterial({ map: matOrTex, side: THREE.DoubleSide });
    return new THREE.Mesh(geo, mat);
  }

  // 空: 上=深い色→地平線=明るい色のグラデーションドーム
  buildSkyDome(c) {
    const base = new THREE.Color(c.sky);
    const hsl = { h: 0, s: 0, l: 0 };
    base.getHSL(hsl);
    const top = new THREE.Color().setHSL(hsl.h, Math.min(1, hsl.s + 0.18), Math.max(0, hsl.l - 0.16));
    const horizon = new THREE.Color().setHSL(hsl.h, Math.max(0, hsl.s - 0.05), Math.min(1, hsl.l + 0.14));
    const cv = document.createElement('canvas');
    cv.width = 4; cv.height = 256;
    const x = cv.getContext('2d');
    const grad = x.createLinearGradient(0, 0, 0, 256);
    grad.addColorStop(0, '#' + top.getHexString());
    grad.addColorStop(0.55, '#' + base.getHexString());
    grad.addColorStop(1, '#' + horizon.getHexString());
    x.fillStyle = grad;
    x.fillRect(0, 0, 4, 256);
    const dome = new THREE.Mesh(
      new THREE.SphereGeometry(950, 20, 14, 0, Math.PI * 2, 0, Math.PI * 0.62),
      new THREE.MeshBasicMaterial({
        map: new THREE.CanvasTexture(cv), side: THREE.BackSide, fog: false, depthWrite: false,
      })
    );
    dome.position.y = -40;
    dome.renderOrder = -10;
    return dome;
  }

  // ふわふわの雲(ビルボード)。def.clouds === false で無効
  buildClouds() {
    const grp = new THREE.Group();
    const cv = document.createElement('canvas');
    cv.width = 128; cv.height = 64;
    const x = cv.getContext('2d');
    const blob = (bx, by, r) => {
      const gr = x.createRadialGradient(bx, by, 0, bx, by, r);
      gr.addColorStop(0, 'rgba(255,255,255,0.95)');
      gr.addColorStop(1, 'rgba(255,255,255,0)');
      x.fillStyle = gr;
      x.beginPath(); x.arc(bx, by, r, 0, Math.PI * 2); x.fill();
    };
    blob(40, 40, 26); blob(64, 32, 30); blob(90, 42, 24); blob(60, 46, 20);
    const tex = new THREE.CanvasTexture(cv);
    let seed = 99;
    const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    for (let i = 0; i < 10; i++) {
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({
        map: tex, transparent: true, opacity: 0.85, fog: false, depthWrite: false,
      }));
      const a = rnd() * Math.PI * 2, r = 320 + rnd() * 280;
      sp.position.set(Math.cos(a) * r, 95 + rnd() * 80, Math.sin(a) * r);
      const sc = 70 + rnd() * 70;
      sp.scale.set(sc, sc * 0.5, 1);
      grp.add(sp);
    }
    return grp;
  }

  // 地平線の山並み(遠景の奥行き)。def.horizon === false で無効
  buildHorizon(c) {
    const grp = new THREE.Group();
    const gcol = new THREE.Color(c.ground), fcol = new THREE.Color(c.fog ?? c.sky);
    let seed = 31;
    const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    for (let i = 0; i < 14; i++) {
      const a = (i / 14 + rnd() * 0.03) * Math.PI * 2;
      const r = 480 + rnd() * 160;
      const h = 34 + rnd() * 55;
      const cone = new THREE.Mesh(
        new THREE.ConeGeometry(45 + rnd() * 55, h, 7),
        new THREE.MeshLambertMaterial({ color: gcol.clone().lerp(fcol, 0.45 + rnd() * 0.2) })
      );
      cone.position.set(Math.cos(a) * r, h / 2 - 8, Math.sin(a) * r);
      grp.add(cone);
    }
    return grp;
  }

  groundTexture(c) {
    const cv = document.createElement('canvas');
    cv.width = 512; cv.height = 512;
    const x = cv.getContext('2d');
    const gcol = new THREE.Color(c.ground), fcol = new THREE.Color(c.fog ?? c.sky);
    const grad = x.createRadialGradient(256, 256, 40, 256, 256, 256);
    grad.addColorStop(0, '#' + gcol.getHexString());
    grad.addColorStop(0.55, '#' + gcol.getHexString());
    grad.addColorStop(1, '#' + fcol.getHexString());
    x.fillStyle = grad;
    x.fillRect(0, 0, 512, 512);
    // うっすら斑点でのっぺり感を消す
    x.fillStyle = '#' + gcol.clone().multiplyScalar(0.93).getHexString();
    let seed = 7;
    const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    for (let i = 0; i < 260; i++) {
      const px = rnd() * 512, py = rnd() * 512, r = 2 + rnd() * 6;
      if (Math.hypot(px - 256, py - 256) > 235) continue;
      x.beginPath(); x.arc(px, py, r, 0, Math.PI * 2); x.fill();
    }
    return new THREE.CanvasTexture(cv);
  }

  roadTexture(c) {
    const cv = document.createElement('canvas');
    cv.width = 256; cv.height = 256;
    const x = cv.getContext('2d');
    x.fillStyle = c.road; x.fillRect(0, 0, 256, 256);
    let seed = 42;
    const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    // 舗装の粒状ノイズ(細かく大量に)
    for (let i = 0; i < 900; i++) {
      x.fillStyle = rnd() < 0.5 ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.06)';
      const px = rnd() * 256, py = rnd() * 256, r = 0.6 + rnd() * 1.6;
      x.beginPath(); x.arc(px, py, r, 0, Math.PI * 2); x.fill();
    }
    // タイヤの走行帯(車輪が通るラインがうっすら暗い)
    x.fillStyle = 'rgba(0,0,0,0.07)';
    x.fillRect(56, 0, 44, 256);
    x.fillRect(156, 0, 44, 256);
    // 舗装のひび
    x.strokeStyle = 'rgba(0,0,0,0.12)'; x.lineWidth = 1.4;
    for (let cI = 0; cI < 5; cI++) {
      x.beginPath();
      let cx0 = 30 + rnd() * 196, cy0 = rnd() * 256;
      x.moveTo(cx0, cy0);
      for (let sI = 0; sI < 4; sI++) { cx0 += (rnd() - 0.5) * 30; cy0 += 12 + rnd() * 22; x.lineTo(cx0, cy0); }
      x.stroke();
    }
    // センターの破線(色はコース定義で変更可)
    x.fillStyle = c.centerLine || 'rgba(255,250,235,0.6)';
    for (let yPos = 8; yPos < 256; yPos += 64) x.fillRect(124, yPos, 8, 34);
    // 両端のキャンディ縁石(斜めストライプ。レース感と世界観を両立)
    const curb = c.curb || '#ff6f91';
    const curbW = 18;
    const drawCurb = (x0) => {
      x.save();
      x.beginPath(); x.rect(x0, 0, curbW, 256); x.clip();
      x.fillStyle = '#fff6f0'; x.fillRect(x0, 0, curbW, 256);
      x.fillStyle = curb;
      for (let yPos = -32; yPos < 288; yPos += 32) {
        x.beginPath();
        x.moveTo(x0, yPos); x.lineTo(x0 + curbW, yPos + 14);
        x.lineTo(x0 + curbW, yPos + 30); x.lineTo(x0, yPos + 16);
        x.closePath(); x.fill();
      }
      x.restore();
    };
    drawCurb(0); drawCurb(256 - curbW);
    const tex = new THREE.CanvasTexture(cv);
    tex.wrapS = THREE.RepeatWrapping; tex.wrapT = THREE.RepeatWrapping;
    tex.anisotropy = 4;
    return tex;
  }

  buildPadMesh(p) {
    const s = this.spline;
    const pos = [], uv = [], idxArr = [];
    let vi = 0;
    const i0 = Math.floor(p.t0 * s.count), i1 = Math.floor(p.t1 * s.count);
    const n = (i1 - i0 + s.count) % s.count;
    for (let k = 0; k <= n; k++) {
      const i = (i0 + k) % s.count;
      const pt = s.pts[i], nr = s.nrm[i], w = s.w[i];
      const a = p.l0 * w, b = p.l1 * w;
      pos.push(pt.x + nr.x * a, pt.y + 0.07, pt.z + nr.z * a);
      pos.push(pt.x + nr.x * b, pt.y + 0.07, pt.z + nr.z * b);
      uv.push(0, k / 2, 1, k / 2);
      if (k < n) { idxArr.push(vi, vi + 1, vi + 2, vi + 2, vi + 1, vi + 3); }
      vi += 2;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    geo.setIndex(idxArr);
    const cv = document.createElement('canvas');
    cv.width = 64; cv.height = 64;
    const x = cv.getContext('2d');
    if (p.type === 'boost') {
      x.fillStyle = '#28d9e8'; x.fillRect(0, 0, 64, 64);
      x.fillStyle = '#eafffe';
      x.beginPath(); x.moveTo(8, 12); x.lineTo(32, 34); x.lineTo(56, 12);
      x.lineTo(56, 26); x.lineTo(32, 50); x.lineTo(8, 26); x.closePath(); x.fill();
    } else {
      x.fillStyle = '#ff9d3c'; x.fillRect(0, 0, 64, 64);
      x.fillStyle = '#ffe6c2'; x.fillRect(0, 24, 64, 16);
    }
    const tex = new THREE.CanvasTexture(cv);
    tex.wrapS = THREE.RepeatWrapping; tex.wrapT = THREE.RepeatWrapping;
    return new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: tex }));
  }

  // 急コーナーを検出し、外側にシェブロン(矢印)看板を並べる
  buildCornerSigns() {
    const s = this.spline;
    const out = [];
    const SPAN = 8;        // 曲率評価スパン(サンプル数)
    const THRESH = 0.55;   // この角度変化(rad)以上を「急コーナー」とみなす
    const postMat = new THREE.MeshLambertMaterial({ color: 0x9a97a8 });
    let i = 0, placed = 0;
    while (i < s.count && placed < 6) {
      const a0 = s.tangentAngle((i - SPAN + s.count) % s.count);
      const a1 = s.tangentAngle((i + SPAN) % s.count);
      const k = Game.U.wrapAngle(a1 - a0);
      const t = i / s.count;
      if (Math.abs(k) > THRESH && !this.inZone(this.gaps, t) && !this.inZone(this.fallZones, t)) {
        const outSide = k > 0 ? 1 : -1; // 左コーナー(k>0)の外側=右(lateral正)
        const mat = new THREE.MeshLambertMaterial({ map: this.chevronTexture(k > 0) });
        for (let b = -1; b <= 1; b++) {
          const idx = (i + b * 6 + s.count) % s.count;
          const p = s.pts[idx], n = s.nrm[idx], w = s.w[idx];
          const off = (w + this.offroadWidth + 1.4) * outSide;
          const board = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.5, 0.14), mat);
          board.position.set(p.x + n.x * off, p.y + 1.2, p.z + n.z * off);
          board.rotation.y = s.tangentAngle(idx) + Math.PI; // 進行方向に正対させる
          out.push(board);
          const post = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 1.0, 6), postMat);
          post.position.set(board.position.x, p.y + 0.5, board.position.z);
          out.push(post);
        }
        placed++;
        i += 40; // 同じコーナーへの重複配置を防ぐ
        continue;
      }
      i += 4;
    }
    return out;
  }

  chevronTexture(pointLeft) {
    const cv = document.createElement('canvas');
    cv.width = 256; cv.height = 160;
    const x = cv.getContext('2d');
    x.fillStyle = '#ff5f8a'; x.fillRect(0, 0, 256, 160);
    x.strokeStyle = '#ffffff'; x.lineWidth = 18; x.lineJoin = 'miter';
    for (let a = 0; a < 3; a++) {
      const cx = 52 + a * 76;
      x.beginPath();
      if (pointLeft) { x.moveTo(cx + 22, 28); x.lineTo(cx - 22, 80); x.lineTo(cx + 22, 132); }
      else { x.moveTo(cx - 22, 28); x.lineTo(cx + 22, 80); x.lineTo(cx - 22, 132); }
      x.stroke();
    }
    return new THREE.CanvasTexture(cv);
  }

  buildStartLine() {
    const s = this.spline;
    const p = s.pts[0], n = s.nrm[0], t = s.tan[0], w = s.w[0];
    const cv = document.createElement('canvas');
    cv.width = 128; cv.height = 32;
    const x = cv.getContext('2d');
    for (let i = 0; i < 8; i++) for (let j = 0; j < 2; j++) {
      x.fillStyle = (i + j) % 2 ? '#faf7f0' : '#453b33';
      x.fillRect(i * 16, j * 16, 16, 16);
    }
    const tex = new THREE.CanvasTexture(cv);
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(w * 2, 3),
      new THREE.MeshBasicMaterial({ map: tex })
    );
    // ヨー角φでローカルX軸は(cosφ,0,-sinφ)を向く → 法線nに合わせるにはφ=atan2(-nz,nx)
    mesh.rotation.order = 'YXZ';
    mesh.rotation.y = Math.atan2(-n.z, n.x);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(p.x, p.y + 0.08, p.z);
    return mesh;
  }

  buildGate() {
    const s = this.spline;
    const p = s.pts[2], n = s.nrm[2], w = s.w[2];
    const grp = new THREE.Group();
    // 支柱: 白×ピンクのストライプ(レースゲートらしく)
    const postCv = document.createElement('canvas');
    postCv.width = 32; postCv.height = 128;
    const px = postCv.getContext('2d');
    for (let i = 0; i < 8; i++) {
      px.fillStyle = i % 2 ? '#ffffff' : '#ff6f91';
      px.fillRect(0, i * 16, 32, 16);
    }
    const postTex = new THREE.CanvasTexture(postCv);
    const postMat = new THREE.MeshLambertMaterial({ map: postTex });
    for (const side of [-1, 1]) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.6, 7.5, 10), postMat);
      post.position.set(p.x + n.x * side * (w + 1.2), p.y + 3.75, p.z + n.z * side * (w + 1.2));
      grp.add(post);
    }
    const cv = document.createElement('canvas');
    cv.width = 512; cv.height = 96;
    const x = cv.getContext('2d');
    x.fillStyle = '#ff8fb0'; x.fillRect(0, 0, 512, 96);
    // 上下にチェッカー模様の帯
    for (let i = 0; i < 32; i++) {
      x.fillStyle = i % 2 ? '#ffffff' : '#41333b';
      x.fillRect(i * 16, 0, 16, 14);
      x.fillStyle = i % 2 ? '#41333b' : '#ffffff';
      x.fillRect(i * 16, 82, 16, 14);
    }
    x.fillStyle = '#fff6fa';
    x.font = 'bold 50px sans-serif';
    x.textAlign = 'center'; x.textBaseline = 'middle';
    x.fillText('SUGARIA GP', 256, 48);
    const texMat = new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(cv) });
    const pinkMat = new THREE.MeshLambertMaterial({ color: 0xff8fb0 });
    const banner = new THREE.Mesh(
      new THREE.BoxGeometry(w * 2 + 4.5, 1.8, 0.5),
      [pinkMat, pinkMat, pinkMat, pinkMat, texMat, texMat]
    );
    banner.position.set(p.x, p.y + 6.8, p.z);
    banner.rotation.y = Math.atan2(-n.z, n.x);
    grp.add(banner);
    return grp;
  }
};
