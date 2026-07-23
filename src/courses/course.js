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
    // ギャップ+連動ジャンプ台+助走域は「復帰不能ストリップ」として一括で扱う。
    // この範囲のどこに湧いても、(a)台の内側=発射されない (b)台とギャップの間=助走ゼロ
    // (c)ギャップ内=路面なし で再落下ループになる(シンギュラリティで実際に発生。
    // 落下は進行度がギャップ前縁のことが多く、-4/countの戻しだけでは旧来の
    // 「ギャップ内判定→手前へ」すら発動しないケースがあった)。
    // ストリップに入っていたら、その先頭(台の手前12ユニット=助走確保)まで巻き戻す。
    const runup = 12 / s.total;
    for (const gap of this.gaps) {
      let stripStart = (gap.t0 - 0.01 + 1) % 1;
      for (const p of this.pads) {
        if (p.type !== 'jump') continue;
        // ギャップの手前0.05以内で終わる台=このギャップ用の発射台
        if (p.t1 <= gap.t0 + 1e-6 && (gap.t0 - p.t0) < 0.05) {
          stripStart = Math.min(stripStart, (p.t0 - runup + 1) % 1);
        }
      }
      // ※現状の全コースでストリップは0-1の内側に収まる(t=0跨ぎのギャップは無い)
      if (t >= stripStart && t <= gap.t1) { t = stripStart; break; }
    }
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

    // コースごとの時間帯/光の色調(def.lighting)。昼・夕方・幻想など空気を変える
    const L = this.def.lighting;
    if (L && Game.app) {
      if (Game.app.hemi) {
        if (L.hemiSky != null) Game.app.hemi.color.setHex(L.hemiSky);
        if (L.hemiGround != null) Game.app.hemi.groundColor.setHex(L.hemiGround);
        if (L.hemiIntensity != null) Game.app.hemi.intensity = L.hemiIntensity;
      }
      if (Game.app.sun) {
        if (L.sunColor != null) Game.app.sun.color.setHex(L.sunColor);
        if (L.sunIntensity != null) Game.app.sun.intensity = L.sunIntensity;
      }
      if (Game.app.rim && L.rimColor != null) Game.app.rim.color.setHex(L.rimColor);
      if (Game.app.renderer && L.exposure != null) Game.app.renderer.toneMappingExposure = L.exposure;
    } else if (Game.app && Game.app.renderer) {
      Game.app.renderer.toneMappingExposure = 1.15; // デフォルトに戻す
    }

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
    const offMat = new THREE.MeshLambertMaterial({
      color: Game.mats ? Game.mats.col(c.offroad) : c.offroad, side: THREE.DoubleSide,
    });
    const skirtOk = (t) => !this.inZone(this.gaps, t) && !this.inZone(this.fallZones, t);
    const skirtR = this.buildStrip(1, 1 + this.offroadWidth / 7, offMat, -0.02, skirtOk, true);
    const skirtL = this.buildStrip(-1 - this.offroadWidth / 7, -1, offMat, -0.02, skirtOk, true);
    g.add(skirtR); g.add(skirtL);

    // ブースト/ジャンプパッド
    this._padAnim = [];
    const padMeshes = this.pads.map((p) => this.buildPadMesh(p));
    for (const m of padMeshes) g.add(m);

    // スタートライン(チェッカー)とゲート
    const startLine = this.buildStartLine();
    g.add(startLine);
    g.add(this.buildGate());

    // 構造検証(問題があればconsole.warnに詳細を出す)
    this.validate();

    // 走行ルートの視線誘導一式(すべて中心線から生成し、見た目と判定のズレを防ぐ)
    for (const m of this.buildCornerSigns()) g.add(m); // カーブ外側のシェブロン(手前から)
    g.add(this.buildGuardrails());                     // 急カーブ外側の連続ガードレール
    g.add(this.buildRoadArrows());                     // 路面の進行方向矢印
    g.add(this.buildCrossingDecor());                  // 立体交差の橋脚・縁梁(橋として明確化)

    if (this.def.decorate) this.def.decorate(g, this);

    // 遠景シルエットリング(地平線の世界観。静的メッシュのみ)
    if (Game.horizon) {
      let hcx = 0, hcz = 0;
      for (const p of s.pts) { hcx += p.x; hcz += p.z; }
      g.add(Game.horizon.build(this.def, { x: hcx / s.count, z: hcz / s.count }));
    }
    // フェイクブルーム: 発光メッシュへ光暈Spriteを自動付与(装飾・遠景の後に走査)
    if (Game.bloomSprites) Game.bloomSprites.build(g);

    // 動的シャドウ: 装飾・ゲート・看板は影を落とし、路面・地面は受けるだけにする
    g.traverse((o) => {
      // userData.noShadow: 遠景シルエット等、影計算から外す軽量メッシュの印
      if (o.isMesh && !o.userData.noShadow) { o.castShadow = true; o.receiveShadow = true; }
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
    // 星を描くため横にも解像度を持たせる(生成は一度きりなので負荷なし)
    cv.width = 512; cv.height = 256;
    const x = cv.getContext('2d');
    const grad = x.createLinearGradient(0, 0, 0, 256);
    grad.addColorStop(0, '#' + top.getHexString());
    grad.addColorStop(0.55, '#' + base.getHexString());
    grad.addColorStop(1, '#' + horizon.getHexString());
    x.fillStyle = grad;
    x.fillRect(0, 0, 512, 256);

    // 星屑: 暗い空ほど濃く自動で入れる(STAR KARTの宇宙感の要)。
    // colors.stars で明示上書きも可(0=なし〜1=満天)
    const starAmt = c.stars != null ? c.stars
      : hsl.l < 0.16 ? 1 : hsl.l < 0.3 ? 0.7 : hsl.l < 0.45 ? 0.25 : 0;
    if (starAmt > 0) {
      let seed = 20260712;
      const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return (seed % 10000) / 10000; };
      // 星雲: 最暗の空にだけ、ごく薄い色斑を2つ(空の色相±で馴染ませる)
      if (hsl.l < 0.2) {
        for (let i = 0; i < 2; i++) {
          const nx = 80 + rnd() * 350, ny = 30 + rnd() * 90, nr = 60 + rnd() * 50;
          const ncol = new THREE.Color().setHSL((hsl.h + (i === 0 ? 0.08 : -0.09) + 1) % 1, 0.55, 0.42);
          const ng = x.createRadialGradient(nx, ny, 0, nx, ny, nr);
          ng.addColorStop(0, `rgba(${ncol.r * 255 | 0},${ncol.g * 255 | 0},${ncol.b * 255 | 0},0.16)`);
          ng.addColorStop(1, 'rgba(0,0,0,0)');
          x.fillStyle = ng;
          x.beginPath(); x.arc(nx, ny, nr, 0, Math.PI * 2); x.fill();
        }
      }
      // 星: 上空70%に、明るさ/大きさをばらして。数個は十字の輝きを持つ一等星
      const n = Math.round(230 * starAmt);
      for (let i = 0; i < n; i++) {
        const sx = rnd() * 512, sy = rnd() * 175;
        const alt = 1 - sy / 175; // 上ほどくっきり
        const a = (0.25 + rnd() * 0.75) * (0.4 + alt * 0.6);
        x.fillStyle = `rgba(255,255,255,${a.toFixed(2)})`;
        const sz = rnd() < 0.16 ? 2 : 1;
        x.fillRect(sx, sy, sz, sz);
      }
      const bright = Math.round(7 * starAmt);
      for (let i = 0; i < bright; i++) {
        const sx = 10 + rnd() * 492, sy = 6 + rnd() * 130;
        x.fillStyle = 'rgba(255,255,255,0.95)';
        x.fillRect(sx - 0.5, sy - 3, 1.4, 6.4);
        x.fillRect(sx - 3, sy - 0.5, 6.4, 1.4);
      }
    }
    const tex = new THREE.CanvasTexture(cv);
    const dome = new THREE.Mesh(
      new THREE.SphereGeometry(950, 20, 14, 0, Math.PI * 2, 0, Math.PI * 0.62),
      new THREE.MeshBasicMaterial({
        map: tex, side: THREE.BackSide, fog: false, depthWrite: false,
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
    // 真っ白のままだと夜/夕暮れコースで浮くため、空の色へ少し寄せて大気に馴染ませる
    const tint = new THREE.Color(0xffffff).lerp(new THREE.Color(this.def.colors.fog ?? this.def.colors.sky), 0.3);
    let seed = 99;
    const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    for (let i = 0; i < 10; i++) {
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({
        map: tex, transparent: true, opacity: 0.85, fog: false, depthWrite: false, color: tint,
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
        new THREE.MeshLambertMaterial({
          color: gcol.clone().lerp(fcol, 0.45 + rnd() * 0.2).convertSRGBToLinear(),
        })
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
    let seed = 7;
    const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    // 大きな明暗ブロッチ(地形の起伏感)
    for (let i = 0; i < 8; i++) {
      const px = 60 + rnd() * 392, py = 60 + rnd() * 392, r = 46 + rnd() * 70;
      const g2 = x.createRadialGradient(px, py, 0, px, py, r);
      g2.addColorStop(0, rnd() < 0.5 ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.05)');
      g2.addColorStop(1, 'rgba(0,0,0,0)');
      x.fillStyle = g2;
      x.fillRect(px - r, py - r, r * 2, r * 2);
    }
    // 二色の斑点でのっぺり感を消す
    const darker = '#' + gcol.clone().multiplyScalar(0.90).getHexString();
    const lc = gcol.clone().multiplyScalar(1.08);
    lc.r = Math.min(1, lc.r); lc.g = Math.min(1, lc.g); lc.b = Math.min(1, lc.b); // getHexは1超で桁あふれする
    const lighter = '#' + lc.getHexString();
    for (let i = 0; i < 380; i++) {
      x.fillStyle = rnd() < 0.62 ? darker : lighter;
      const px = rnd() * 512, py = rnd() * 512, r = 1.6 + rnd() * 5.5;
      if (Math.hypot(px - 256, py - 256) > 235) continue;
      x.globalAlpha = 0.5 + rnd() * 0.5;
      x.beginPath(); x.arc(px, py, r, 0, Math.PI * 2); x.fill();
    }
    x.globalAlpha = 1;
    return new THREE.CanvasTexture(cv);
  }

  // 路面テクスチャv2(512px): 摩耗レーン・スキッド跡・補修パッチ・発光ハロー付き
  // センターライン・ベベル縁石で「走り込まれたサーキット」の情報量を出す。
  // 生成は一度きりなので実行時コストはゼロ
  roadTexture(c) {
    const cv = document.createElement('canvas');
    cv.width = 512; cv.height = 512;
    const x = cv.getContext('2d');
    x.fillStyle = c.road; x.fillRect(0, 0, 512, 512);
    let seed = 42;
    const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    const CURB_W = 36, ROAD_L = CURB_W, ROAD_R = 512 - CURB_W;

    // 大きめの舗装ムラ(うっすら明暗のまだら)
    for (let i = 0; i < 14; i++) {
      const px = ROAD_L + rnd() * (ROAD_R - ROAD_L), py = rnd() * 512, r = 40 + rnd() * 60;
      const g2 = x.createRadialGradient(px, py, 0, px, py, r);
      const dark = rnd() < 0.5;
      g2.addColorStop(0, dark ? 'rgba(0,0,0,0.045)' : 'rgba(255,255,255,0.035)');
      g2.addColorStop(1, 'rgba(0,0,0,0)');
      x.fillStyle = g2;
      x.fillRect(px - r, py - r, r * 2, r * 2);
    }
    // 補修パッチ(色味の違う四角い舗装)
    for (let i = 0; i < 5; i++) {
      const pw = 40 + rnd() * 70, ph = 70 + rnd() * 120;
      const px = ROAD_L + 10 + rnd() * (ROAD_R - ROAD_L - pw - 20), py = rnd() * 512;
      x.fillStyle = 'rgba(0,0,0,0.05)';
      x.fillRect(px, py, pw, ph);
      x.strokeStyle = 'rgba(255,255,255,0.04)'; x.lineWidth = 2;
      x.strokeRect(px, py, pw, ph);
    }
    // 舗装の粒状ノイズ
    for (let i = 0; i < 1600; i++) {
      x.fillStyle = rnd() < 0.5 ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.06)';
      const px = rnd() * 512, py = rnd() * 512, r = 0.6 + rnd() * 1.8;
      x.beginPath(); x.arc(px, py, r, 0, Math.PI * 2); x.fill();
    }
    // 舗装の敷設方向の細い筋
    for (let i = 0; i < 26; i++) {
      x.fillStyle = `rgba(${rnd() < 0.5 ? '255,255,255' : '0,0,0'},0.025)`;
      x.fillRect(ROAD_L + rnd() * (ROAD_R - ROAD_L), 0, 1 + rnd() * 1.5, 512);
    }
    // タイヤの走行帯(端がソフトに消える摩耗レーン)
    for (const bandCx of [156, 356]) {
      const bw = 110;
      const g2 = x.createLinearGradient(bandCx - bw / 2, 0, bandCx + bw / 2, 0);
      g2.addColorStop(0, 'rgba(0,0,0,0)');
      g2.addColorStop(0.5, 'rgba(0,0,0,0.11)');
      g2.addColorStop(1, 'rgba(0,0,0,0)');
      x.fillStyle = g2;
      x.fillRect(bandCx - bw / 2, 0, bw, 512);
    }
    // スキッド跡(ブレーキング痕。低アルファの短い弧)
    x.lineCap = 'round';
    for (let i = 0; i < 9; i++) {
      const nearLeft = rnd() < 0.5;
      let sx = nearLeft ? 70 + rnd() * 90 : 350 + rnd() * 90;
      let sy = rnd() * 512;
      const bend = (rnd() - 0.5) * 60;
      x.strokeStyle = `rgba(8,6,10,${0.10 + rnd() * 0.08})`;
      x.lineWidth = 3.5 + rnd() * 2.5;
      x.beginPath();
      x.moveTo(sx, sy);
      x.quadraticCurveTo(sx + bend, sy + 45 + rnd() * 40, sx + bend * 1.6, sy + 90 + rnd() * 70);
      x.stroke();
    }
    // 舗装のひび
    x.strokeStyle = 'rgba(0,0,0,0.10)'; x.lineWidth = 1.6;
    for (let cI = 0; cI < 7; cI++) {
      x.beginPath();
      let cx0 = ROAD_L + 20 + rnd() * (ROAD_R - ROAD_L - 40), cy0 = rnd() * 512;
      x.moveTo(cx0, cy0);
      for (let sI = 0; sI < 4; sI++) { cx0 += (rnd() - 0.5) * 50; cy0 += 20 + rnd() * 40; x.lineTo(cx0, cy0); }
      x.stroke();
    }
    // センターの破線(ソフトなハロー→コア→白のハイライトの3層でネオン管に見せる)
    const clCol = c.centerLine || '#fff5e0';
    for (let yPos = 16; yPos < 512; yPos += 128) {
      x.globalAlpha = 0.16; x.fillStyle = clCol;
      x.fillRect(240, yPos - 6, 32, 80);   // ハロー
      x.globalAlpha = 0.95;
      x.fillRect(249, yPos, 14, 68);        // コア
      x.globalAlpha = 0.55; x.fillStyle = '#ffffff';
      x.fillRect(254, yPos + 4, 4, 60);     // 芯のハイライト
      x.globalAlpha = 1;
    }
    // 縁石の内側: エッジライン+路肩の汚れだまり
    const edgeCol = c.edge || '#ffffff';
    for (const [ex, gdir] of [[ROAD_L + 4, 1], [ROAD_R - 8, -1]]) {
      x.globalAlpha = 0.5; x.fillStyle = edgeCol;
      x.fillRect(ex, 0, 4, 512);
      x.globalAlpha = 1;
      const g2 = x.createLinearGradient(ex + gdir * 4, 0, ex + gdir * 26, 0);
      g2.addColorStop(0, 'rgba(0,0,0,0.16)');
      g2.addColorStop(1, 'rgba(0,0,0,0)');
      x.fillStyle = g2;
      x.fillRect(Math.min(ex + gdir * 4, ex + gdir * 26), 0, 22, 512);
    }
    // ベベル付き縁石(ストライプごとに下端へ影を落として立体に見せる)
    const curb = c.curb || '#ff6f91';
    const drawCurb = (x0, outerDir) => {
      x.save();
      x.beginPath(); x.rect(x0, 0, CURB_W, 512); x.clip();
      const base = x.createLinearGradient(x0, 0, x0 + CURB_W, 0);
      if (outerDir < 0) { base.addColorStop(0, '#cfcfd4'); base.addColorStop(0.45, '#ffffff'); base.addColorStop(1, '#f2f2f5'); }
      else { base.addColorStop(0, '#f2f2f5'); base.addColorStop(0.55, '#ffffff'); base.addColorStop(1, '#cfcfd4'); }
      x.fillStyle = base; x.fillRect(x0, 0, CURB_W, 512);
      for (let yPos = -64; yPos < 576; yPos += 64) {
        x.fillStyle = curb;
        x.beginPath();
        x.moveTo(x0, yPos); x.lineTo(x0 + CURB_W, yPos + 28);
        x.lineTo(x0 + CURB_W, yPos + 60); x.lineTo(x0, yPos + 32);
        x.closePath(); x.fill();
        x.fillStyle = 'rgba(0,0,0,0.22)';   // ストライプ下端の落ち影
        x.beginPath();
        x.moveTo(x0, yPos + 26); x.lineTo(x0 + CURB_W, yPos + 54);
        x.lineTo(x0 + CURB_W, yPos + 60); x.lineTo(x0, yPos + 32);
        x.closePath(); x.fill();
      }
      x.restore();
    };
    drawCurb(0, -1); drawCurb(512 - CURB_W, 1);
    const tex = new THREE.CanvasTexture(cv);
    tex.wrapS = THREE.RepeatWrapping; tex.wrapT = THREE.RepeatWrapping;
    tex.anisotropy = 8;
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
    // パッド表面(128px): 発光ハロー付きシェブロン。テクスチャはtick()で流動する
    const cv = document.createElement('canvas');
    cv.width = 128; cv.height = 128;
    const x = cv.getContext('2d');
    if (p.type === 'boost') {
      const bg = x.createLinearGradient(0, 0, 0, 128);
      bg.addColorStop(0, '#0f7d8c'); bg.addColorStop(0.5, '#28d9e8'); bg.addColorStop(1, '#0f7d8c');
      x.fillStyle = bg; x.fillRect(0, 0, 128, 128);
      const chev = (yy, col, alpha, lw) => {
        x.globalAlpha = alpha; x.strokeStyle = col; x.lineWidth = lw;
        x.lineJoin = 'round'; x.lineCap = 'round';
        x.beginPath(); x.moveTo(18, yy); x.lineTo(64, yy + 40); x.lineTo(110, yy);
        x.stroke();
      };
      chev(24, '#bffcff', 0.35, 26); // ハロー
      chev(24, '#eafffe', 0.95, 12); // コア
      chev(24, '#ffffff', 0.8, 4);   // 芯
      x.globalAlpha = 1;
    } else {
      const bg = x.createLinearGradient(0, 0, 0, 128);
      bg.addColorStop(0, '#9c4f10'); bg.addColorStop(0.5, '#ff9d3c'); bg.addColorStop(1, '#9c4f10');
      x.fillStyle = bg; x.fillRect(0, 0, 128, 128);
      x.globalAlpha = 0.35; x.fillStyle = '#ffe6c2';
      x.fillRect(0, 40, 128, 48);   // ハロー帯
      x.globalAlpha = 0.95;
      x.fillRect(0, 52, 128, 24);   // コア帯
      x.globalAlpha = 0.7; x.fillStyle = '#ffffff';
      x.fillRect(0, 61, 128, 6);    // 芯
      x.globalAlpha = 1;
    }
    const tex = new THREE.CanvasTexture(cv);
    tex.wrapS = THREE.RepeatWrapping; tex.wrapT = THREE.RepeatWrapping;
    this._padAnim.push({ tex, type: p.type });
    return new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: tex }));
  }

  // 毎フレームの軽量アニメ(パッドのシェブロン流動)。screensのレース更新から呼ばれる。
  // テクスチャoffsetの書き換えのみで頂点・Canvasの再生成はしない
  tick(time) {
    for (const pa of this._padAnim) {
      pa.tex.offset.y = -time * (pa.type === 'boost' ? 1.5 : 0.9);
    }
  }

  // ==================== コース検証(CourseValidator) ====================
  // 生成後に構造品質を自動チェックする。問題があればconsole.warnし、レポートを返す。
  // チェック項目: 自己近接(立体交差の高さ余白)/急ヘアピン曲率/急勾配/高曲率区間の道幅
  validate() {
    const s = this.spline;
    const issues = [];
    this._crossings = [];
    // 1) 自己近接: 離れた区間同士がXZで接近している箇所
    //    Y差6以上=正常な立体交差(橋演出の対象)、6未満=不正な重なり
    for (let i = 0; i < s.count; i += 2) {
      for (let j = i + 26; j < s.count; j += 2) {
        const gap = Math.min(j - i, s.count - (j - i));
        if (gap < 26) continue;
        const a = s.pts[i], b = s.pts[j];
        const dXZ = Math.hypot(a.x - b.x, a.z - b.z);
        if (dXZ < s.w[i] + s.w[j] + 1.5) {
          const dy = Math.abs(a.y - b.y);
          // 問題になるのは2パターン:
          //  A) ほぼ同じ高さで並走/交差(dy<3)= どちらの道か分からない・ちらつき
          //  B) ほぼ真上を通る(路面同士が重なる距離)のにクリアランス不足(dy<6)= 天井スレスレ
          const directlyOver = dXZ < (s.w[i] + s.w[j]) * 0.6;
          // ヘアピンの両脚(接線が反平行で、コース上の距離が近い)は頂点付近で近づくのが正常。
          // 路面同士が実際に重なる場合のみ問題として扱う
          const dot = s.tan[i].x * s.tan[j].x + s.tan[i].z * s.tan[j].z;
          const isHairpinLegs = dot < -0.5 && gap < 90;
          const tooClose = isHairpinLegs ? dXZ < (s.w[i] + s.w[j]) * 0.55 : true;
          if (dy < 3 && tooClose) {
            issues.push({ type: 'overlap', at: [i, j], dXZ: +dXZ.toFixed(1), dy: +dy.toFixed(1),
              msg: `区間${i}と${j}が同一高度(差${dy.toFixed(1)})で近接している` });
          } else if (dy < 6 && directlyOver) {
            issues.push({ type: 'lowClearance', at: [i, j], dXZ: +dXZ.toFixed(1), dy: +dy.toFixed(1),
              msg: `区間${i}の真上を区間${j}が高さ差${dy.toFixed(1)}で跨いでいる(6以上必要)` });
          } else if (dy >= 6 && directlyOver) {
            this._crossings.push({ low: a.y < b.y ? i : j, high: a.y < b.y ? j : i, dy });
          }
        }
      }
    }
    // 2) ヘアピン曲率: 5サンプル窓の回転半径 r=ds/dθ が8未満なら急すぎ
    for (let i = 0; i < s.count; i += 2) {
      const a0 = s.tangentAngle((i - 3 + s.count) % s.count);
      const a1 = s.tangentAngle((i + 3) % s.count);
      const dTheta = Math.abs(Game.U.wrapAngle(a1 - a0));
      if (dTheta > 0.01) {
        const r = (6 * s.step) / dTheta;
        if (r < 8) {
          issues.push({ type: 'tightCurve', at: i, radius: +r.toFixed(1),
            msg: `サンプル${i}付近の回転半径${r.toFixed(1)}が急すぎる(8以上推奨)` });
          i += 10;
        } else if (r < 14 && s.w[i] < 6.5) {
          issues.push({ type: 'narrowCurve', at: i, w: +s.w[i].toFixed(1),
            msg: `サンプル${i}付近: 急カーブなのに道幅${s.w[i].toFixed(1)}(6.5以上推奨)` });
          i += 10;
        }
      }
    }
    // 3) 急勾配
    for (let i = 0; i < s.count; i += 2) {
      const a = s.pts[i], b = s.pts[(i + 2) % s.count];
      const slope = Math.abs(b.y - a.y) / (2 * s.step);
      if (slope > 0.35) {
        issues.push({ type: 'steep', at: i, slope: +slope.toFixed(2),
          msg: `サンプル${i}付近の勾配${(slope * 100).toFixed(0)}%が急すぎる` });
        i += 8;
      }
    }
    if (issues.length) {
      console.warn(`[CourseValidator] ${this.name}: ${issues.length}件の問題`, issues);
    }
    this.validationIssues = issues;
    return issues;
  }

  // コーナー検出(シェブロン/ガードレール/路面矢印が共用)
  detectCorners() {
    if (this._corners) return this._corners;
    const s = this.spline;
    const SPAN = 8, THRESH = 0.55;
    const out = [];
    let i = 0;
    while (i < s.count) {
      const a0 = s.tangentAngle((i - SPAN + s.count) % s.count);
      const a1 = s.tangentAngle((i + SPAN) % s.count);
      const k = Game.U.wrapAngle(a1 - a0);
      if (Math.abs(k) > THRESH) {
        out.push({ idx: i, k });
        i += 40;
        continue;
      }
      i += 4;
    }
    this._corners = out;
    return out;
  }

  // 急コーナー外側の連続ガードレール(支柱+レール。中心線から生成)
  buildGuardrails() {
    const s = this.spline;
    const grp = new THREE.Group();
    const postMat = Game.mats ? Game.mats.metal(0xc8ccd4) : new THREE.MeshLambertMaterial({ color: 0xc8ccd4 });
    const railMat = Game.mats ? Game.mats.paint(0xe84860) : new THREE.MeshLambertMaterial({ color: 0xe84860 });
    for (const c of this.detectCorners()) {
      const outSide = c.k > 0 ? 1 : -1;
      // カーブ入口の約25ユニット手前(≈16サンプル)からレールを張る
      const from = (c.idx - 16 + s.count) % s.count;
      const len = 30;
      const pts = [];
      for (let n = 0; n <= len; n += 2) {
        const idx = (from + n) % s.count;
        const t = idx / s.count;
        if (this.inZone(this.gaps, t) || this.inZone(this.fallZones, t)) continue;
        const p = s.pts[idx], nr = s.nrm[idx], w = s.w[idx];
        const off = (w + this.offroadWidth * 0.45) * outSide;
        pts.push([p.x + nr.x * off, p.y + 0.52, p.z + nr.z * off]);
        if (n % 6 === 0) {
          const post = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, 0.55, 8), postMat);
          post.position.set(p.x + nr.x * off, p.y + 0.27, p.z + nr.z * off);
          grp.add(post);
        }
      }
      if (pts.length >= 3) {
        const rail = new THREE.Mesh(Game.geo.tube(pts, 0.07, pts.length * 2, 8), railMat);
        grp.add(rail);
      }
    }
    return grp;
  }

  // カーブ手前の路面矢印(曲がる方向を路面に直接描く)
  buildRoadArrows() {
    const s = this.spline;
    const grp = new THREE.Group();
    const texL = this.roadArrowTexture(true);
    const texR = this.roadArrowTexture(false);
    for (const c of this.detectCorners()) {
      const tex = c.k > 0 ? texL : texR;
      for (let n = 0; n < 3; n++) {
        const idx = (c.idx - 18 + n * 7 + s.count) % s.count;
        const t = idx / s.count;
        if (this.inZone(this.gaps, t)) continue;
        const p = s.pts[idx];
        const arrow = new THREE.Mesh(
          new THREE.PlaneGeometry(2.6, 2.6),
          new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false })
        );
        arrow.rotation.order = 'YXZ';
        arrow.rotation.y = s.tangentAngle(idx) + Math.PI; // 進行方向に正対
        arrow.rotation.x = -Math.PI / 2;
        arrow.position.set(p.x, p.y + 0.06, p.z);
        grp.add(arrow);
      }
    }
    return grp;
  }

  roadArrowTexture(left) {
    const cv = document.createElement('canvas');
    cv.width = 64; cv.height = 64;
    const x = cv.getContext('2d');
    x.strokeStyle = 'rgba(255,250,235,0.85)';
    x.lineWidth = 10; x.lineCap = 'round'; x.lineJoin = 'round';
    x.beginPath();
    x.moveTo(32, 56);
    x.lineTo(32, 26);
    x.quadraticCurveTo(32, 14, left ? 18 : 46, 14);
    x.stroke();
    // 矢尻
    x.beginPath();
    if (left) { x.moveTo(26, 24); x.lineTo(14, 14); x.lineTo(26, 6); }
    else { x.moveTo(38, 24); x.lineTo(50, 14); x.lineTo(38, 6); }
    x.stroke();
    return new THREE.CanvasTexture(cv);
  }

  // 正常な立体交差(validateで検出)を「橋」として明確化: 橋脚+縁の梁+下面パネル
  buildCrossingDecor() {
    const s = this.spline;
    const grp = new THREE.Group();
    const pierMat = Game.mats ? Game.mats.matte(0xb9a58c) : new THREE.MeshLambertMaterial({ color: 0xb9a58c });
    const beamMat = Game.mats ? Game.mats.paint(0xfff0d8) : new THREE.MeshLambertMaterial({ color: 0xfff0d8 });
    const used = [];
    for (const c of (this._crossings || [])) {
      if (used.some((u) => Math.abs(u - c.high) < 14)) continue;
      used.push(c.high);
      // 上側の道の両縁に橋脚を立て、縁に梁を渡す(±2箇所)
      for (const dIdx of [-6, 6]) {
        const idx = (c.high + dIdx + s.count) % s.count;
        const p = s.pts[idx], nr = s.nrm[idx], w = s.w[idx];
        const lowY = s.pts[c.low].y;
        for (const side of [-1, 1]) {
          const px = p.x + nr.x * side * (w + 0.6);
          const pz = p.z + nr.z * side * (w + 0.6);
          const h = Math.max(1, p.y - lowY + 1.2);
          const pier = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.62, h, 12), pierMat);
          pier.position.set(px, p.y - h / 2, pz);
          grp.add(pier);
        }
      }
      // 縁の梁(上の道の縁を強調して「橋」に見せる)
      for (const side of [-1, 1]) {
        const pts = [];
        for (let n = -8; n <= 8; n += 2) {
          const idx = (c.high + n + s.count) % s.count;
          const p = s.pts[idx], nr = s.nrm[idx], w = s.w[idx];
          pts.push([p.x + nr.x * side * (w + 0.2), p.y + 0.3, p.z + nr.z * side * (w + 0.2)]);
        }
        const beam = new THREE.Mesh(Game.geo.tube(pts, 0.16, 24, 8), beamMat);
        grp.add(beam);
      }
    }
    return grp;
  }

  // 急コーナーを検出し、外側にシェブロン(矢印)看板を並べる
  buildCornerSigns() {
    const s = this.spline;
    const out = [];
    const postMat = new THREE.MeshLambertMaterial({ color: 0x9a97a8 });
    // カーブの「手前」から並べる(-16,-8,0サンプル ≒ 入口25ユニット手前から予告)
    const LEAD_OFFSETS = [-16, -8, 0];
    for (const c of this.detectCorners()) {
      const t0 = c.idx / s.count;
      if (this.inZone(this.gaps, t0) || this.inZone(this.fallZones, t0)) continue;
      const outSide = c.k > 0 ? 1 : -1; // 左コーナー(k>0)の外側=右(lateral正)
      const mat = new THREE.MeshLambertMaterial({ map: this.chevronTexture(c.k > 0) });
      for (const b of LEAD_OFFSETS) {
        const idx = (c.idx + b + s.count) % s.count;
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

  // カウントダウン連動のシグナル制御。n=3/2/1(赤が1つずつ増える)、n=0(GO、全灯グリーン)
  setStartSignal(n) {
    if (!this._signalLights) return;
    this._signalLights.forEach((lamp, i) => {
      if (n === 0) lamp.material = this._sigGreen;
      else lamp.material = i < (4 - n) ? this._sigRed : this._sigOff;
    });
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
    x.fillText('STAR KART GP', 256, 48);
    const texMat = new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(cv) });
    const pinkMat = new THREE.MeshLambertMaterial({ color: 0xff8fb0 });
    const banner = new THREE.Mesh(
      new THREE.BoxGeometry(w * 2 + 4.5, 1.8, 0.5),
      [pinkMat, pinkMat, pinkMat, pinkMat, texMat, texMat]
    );
    banner.position.set(p.x, p.y + 6.8, p.z);
    banner.rotation.y = Math.atan2(-n.z, n.x);
    grp.add(banner);

    // スタートシグナル(3灯): カウントダウンで赤が増え、GOで全灯グリーン
    this._sigOff = Game.mats ? Game.mats.matte(0x3a2a35) : new THREE.MeshLambertMaterial({ color: 0x3a2a35 });
    this._sigRed = Game.mats ? Game.mats.glow(0xff3355, 1.8) : new THREE.MeshBasicMaterial({ color: 0xff3355 });
    this._sigGreen = Game.mats ? Game.mats.glow(0x54ff7a, 1.8) : new THREE.MeshBasicMaterial({ color: 0x54ff7a });
    this._signalLights = [];
    const sigGeo = new THREE.SphereGeometry(0.34, 12, 10);
    const housing = new THREE.Mesh(
      new THREE.BoxGeometry(4.2, 1.0, 0.6),
      Game.mats ? Game.mats.matte(0x2c2430) : new THREE.MeshLambertMaterial({ color: 0x2c2430 })
    );
    housing.position.set(p.x, p.y + 5.55, p.z);
    housing.rotation.y = Math.atan2(-n.z, n.x);
    grp.add(housing);
    for (let i = -1; i <= 1; i++) {
      const lamp = new THREE.Mesh(sigGeo, this._sigOff);
      lamp.position.set(p.x + n.x * i * 1.25, p.y + 5.55, p.z + n.z * i * 1.25);
      grp.add(lamp);
      this._signalLights.push(lamp);
    }
    return grp;
  }
};
