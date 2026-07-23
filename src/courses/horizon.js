// 遠景シルエットリング(horizon.js)
// 各コースの地平線に、そのコースの世界観を語る低ポリシルエット群を配置するモジュール。
// Game.horizon.build(def, centroid) が THREE.Group を返し、呼び出し側がコースグループにaddする。
//
// 設計方針(iPad動作を最優先にした軽量設計):
// - 静的メッシュのみ。per-frame処理・テクスチャ生成は一切持たない(単色MeshBasicMaterialのみ)。
// - リングは内層(半径260〜320)/外層(半径380〜440)の2層。
//   内層=コースを象徴する具体的な意匠(灯台・メサ・尖塔など)、外層=fog色に溶ける霞んだ埋め草。
// - 色はコース定義のsky/fogから自動導出する(色そのものはコースごとに個別指定しない)。
// - 配置・形状の揺らぎはすべて決定的LCG乱数(Math.random不使用)。同じコースは常に同じ見た目になる。
// - 1コースあたりのメッシュ総数は60以下、発光アクセント(窓灯・コア等)は内層のみ合計20以下。
//   どちらもCtxクラスが予算管理し、上限に達したら以降の追加を無視する(安全側に倒す)。
(function () {
  // ==================== 定数 ====================
  const RING = { inMin: 260, inMax: 320, outMin: 380, outMax: 440 };
  const MESH_CAP = 60;    // 1コースあたりのメッシュ総数上限
  const GLOW_CAP = 20;    // 発光アクセント(内層のみ)の総数上限
  const OUTER_COUNT = 16; // 外層の埋め草シルエット数(全スタイル共通)

  // ==================== 決定的乱数 ====================
  // コース群(cookie_town.js等)と同方式のLCG。Math.randomは使わない。
  function makeRnd(seed) {
    let s = (seed >>> 0) || 1;
    return function rnd() {
      s = (s * 1103515245 + 12345) & 0x7fffffff;
      return (s % 10000) / 10000;
    };
  }

  // def.id文字列から決定的にシード値を作る(FNV-1a風の簡易ハッシュ)
  function hashSeed(str) {
    let h = 0x811c9dc5;
    const s = String(str || 'horizon');
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = (h * 0x01000193) >>> 0;
    }
    return h || 1;
  }

  // ==================== 色 ====================
  function clampNum(v, a, b) { return v < a ? a : (v > b ? b : v); }

  // sky/fogの中間をやや暗くした基調色。t=0(内層)〜1(外層)でfog側へ寄せる(遠いほど霞む)
  function baseColor(sky, fog, t) {
    const mid = new THREE.Color(sky).lerp(new THREE.Color(fog), 0.5).multiplyScalar(0.6);
    return mid.lerp(new THREE.Color(fog), clampNum(0.15 + t * 0.55, 0, 1));
  }

  // 明度を±amtだけ揺らした色を返す(単色メッシュが並んだ時の塗り絵感を消す)
  function vary(color, rnd, amt) {
    const k = clampNum(1 + (rnd() - 0.5) * amt, 0.6, 1.4);
    return color.clone().multiplyScalar(k);
  }

  // ==================== 配置 ====================
  // centroidを中心に、半径[rMin,rMax]・角度均等+ジッターでn個のスロット({x,z})を返す
  function ringSlots(centroid, n, rMin, rMax, rnd, phase) {
    const out = [];
    const step = (Math.PI * 2) / Math.max(1, n);
    for (let i = 0; i < n; i++) {
      const angle = phase + i * step + (rnd() - 0.5) * step * 0.7;
      const radius = rMin + rnd() * (rMax - rMin);
      out.push({
        x: centroid.x + Math.sin(angle) * radius,
        z: centroid.z + Math.cos(angle) * radius,
      });
    }
    return out;
  }

  // ==================== メッシュ生成 ====================
  function addRawMesh(group, geo, mat, x, y, z, ry, rx, rz) {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    if (ry) m.rotation.y = ry;
    if (rx) m.rotation.x = rx;
    if (rz) m.rotation.z = rz;
    // 影計算から完全に除外する(呼び出し側のtraverseはuserData.noShadowを見て
    // castShadow/receiveShadowの上書きをスキップするため、メッシュ単位で立てる必要がある)
    m.castShadow = false;
    m.receiveShadow = false;
    m.userData.noShadow = true;
    group.add(m);
    return m;
  }

  // メッシュ数/発光アクセント数の上限を守りながら追加していくコンテキスト
  class Ctx {
    constructor(group, rnd) {
      this.group = group;
      this.rnd = rnd;
      this.meshLeft = MESH_CAP;
      this.glowLeft = GLOW_CAP;
    }

    // 単色シルエットメッシュを1個追加(上限超過時は何もせずnullを返す)
    solid(geo, color, x, y, z, ry = 0, rx = 0, rz = 0) {
      if (this.meshLeft <= 0) return null;
      this.meshLeft--;
      const mat = new THREE.MeshBasicMaterial({ color, fog: true });
      return addRawMesh(this.group, geo, mat, x, y, z, ry, rx, rz);
    }

    // 発光アクセント(直径0.5〜1.5のSphere/Box)を1個追加。内層専用。
    // メッシュ数・発光数の両方の予算を消費する。
    accent(x, y, z, size, color) {
      if (this.meshLeft <= 0 || this.glowLeft <= 0) return null;
      this.meshLeft--; this.glowLeft--;
      const geo = this.rnd() < 0.5
        ? new THREE.SphereGeometry(Math.max(0.25, size / 2), 6, 5)
        : new THREE.BoxGeometry(size, size, size);
      const mat = new THREE.MeshBasicMaterial({ color, fog: true });
      return addRawMesh(this.group, geo, mat, x, y, z, 0, 0, 0);
    }
  }

  // ==================== スタイル別ビルダー ====================
  // 各スタイルは (ctx, centroid, sky, fog) を受け取り、内層(意匠)+外層(埋め草)を組み立てる。

  // ---- cookieTown: 夕暮れ港町(ガントリークレーン+コンテナ+灯台+倉庫群) ----
  function buildCrane(ctx, x, z, col, glowCol, rnd) {
    const h = 22 + rnd() * 14;
    const boomLen = 10 + rnd() * 6;
    const side = rnd() < 0.5 ? 1 : -1;
    const ry = rnd() * Math.PI * 2;
    ctx.solid(new THREE.BoxGeometry(1.6, h, 1.6), col, x, h / 2, z, ry);
    const dx = Math.cos(ry) * boomLen * side, dz = Math.sin(ry) * boomLen * side;
    ctx.solid(new THREE.BoxGeometry(boomLen, 1.3, 1.3), col, x + dx * 0.5, h - 1.5, z + dz * 0.5, ry);
    if (rnd() < 0.6) ctx.accent(x + dx, h - 1, z + dz, 0.8 + rnd() * 0.5, glowCol);
  }
  function buildContainers(ctx, x, z, col, rnd) {
    const w = 6 + rnd() * 3, d = 3 + rnd() * 1.5;
    const ry = rnd() * Math.PI * 2;
    const h1 = 3 + rnd() * 1.4, h2 = 2 + rnd() * 1.2;
    ctx.solid(new THREE.BoxGeometry(w, h1, d), col, x, h1 / 2, z, ry);
    ctx.solid(new THREE.BoxGeometry(w * 0.6, h2, d), col,
      x + Math.cos(ry) * w * 0.15, h1 + h2 / 2, z + Math.sin(ry) * w * 0.15, ry);
  }
  function buildWarehouse(ctx, x, z, col, glowCol, rnd) {
    const w = 9 + rnd() * 5, d = 6 + rnd() * 3, h = 5 + rnd() * 3;
    const ry = rnd() * Math.PI * 2;
    ctx.solid(new THREE.BoxGeometry(w, h, d), col, x, h / 2, z, ry);
    ctx.solid(new THREE.BoxGeometry(w * 1.05, 1.1, d * 1.05), col, x, h + 0.4, z, ry);
    if (rnd() < 0.65) {
      const nx = Math.cos(ry + Math.PI / 2) * d * 0.4, nz = Math.sin(ry + Math.PI / 2) * d * 0.4;
      ctx.accent(x + nx, h * 0.5, z + nz, 0.7, glowCol);
    }
  }
  function buildLighthouse(ctx, x, z, col, glowCol) {
    const h = 26;
    ctx.solid(new THREE.CylinderGeometry(1.4, 2.2, h, 7), col, x, h / 2, z);
    ctx.solid(new THREE.ConeGeometry(2.6, 3, 7), col, x, h + 1.2, z);
    ctx.accent(x, h + 2.6, z, 1.3, glowCol);
  }
  function styleCookieTown(ctx, centroid, sky, fog) {
    const rnd = ctx.rnd;
    const innerCol = baseColor(sky, fog, 0.05), outerCol = baseColor(sky, fog, 0.85);
    const glowLamp = new THREE.Color(0xffb15c);
    const glowWindow = new THREE.Color(0xffe6a0);

    // 内層: クレーン5+コンテナ3+倉庫3を輪番で並べ、灯台1を目立つ位置に挿入
    const craneN = 5, containerN = 3, warehouseN = 3;
    const counts = { crane: craneN, container: containerN, warehouse: warehouseN };
    const order = ['crane', 'warehouse', 'container'];
    const roles = [];
    let remaining = craneN + containerN + warehouseN, oi = 0;
    while (remaining > 0) {
      const name = order[oi % order.length]; oi++;
      if (counts[name] > 0) { roles.push(name); counts[name]--; remaining--; }
    }
    roles.splice(1, 0, 'lighthouse');

    const slots = ringSlots(centroid, roles.length, RING.inMin, RING.inMax, rnd, rnd() * Math.PI * 2);
    for (let i = 0; i < roles.length; i++) {
      const { x, z } = slots[i], role = roles[i], col = vary(innerCol, rnd, 0.25);
      if (role === 'crane') buildCrane(ctx, x, z, col, glowLamp, rnd);
      else if (role === 'container') buildContainers(ctx, x, z, col, rnd);
      else if (role === 'warehouse') buildWarehouse(ctx, x, z, col, glowWindow, rnd);
      else buildLighthouse(ctx, x, z, col, glowLamp);
    }

    // 外層: 霞んだ港のシルエット(クレーン風/倉庫風を1メッシュで簡略化)
    const outer = ringSlots(centroid, OUTER_COUNT, RING.outMin, RING.outMax, rnd, rnd() * Math.PI * 2);
    for (const { x, z } of outer) {
      const col = vary(outerCol, rnd, 0.15);
      if (rnd() < 0.45) {
        const h = 16 + rnd() * 20;
        ctx.solid(new THREE.BoxGeometry(1.4, h, 1.4), col, x, h / 2, z);
      } else {
        const w = 6 + rnd() * 6, h = 4 + rnd() * 5, d = 5 + rnd() * 5;
        ctx.solid(new THREE.BoxGeometry(w, h, d), col, x, h / 2, z, rnd() * Math.PI * 2);
      }
    }
  }

  // ---- chocoCanyon: 隕石の尾根(台形メサを高さ違いで) ----
  function styleChocoCanyon(ctx, centroid, sky, fog) {
    const rnd = ctx.rnd;
    const innerCol = baseColor(sky, fog, 0.05), outerCol = baseColor(sky, fog, 0.85);
    const mesaN = 7 + Math.floor(rnd() * 3); // 7〜9枚

    const slots = ringSlots(centroid, mesaN, RING.inMin, RING.inMax, rnd, rnd() * Math.PI * 2);
    for (const { x, z } of slots) {
      const col = vary(innerCol, rnd, 0.3);
      const rBot = 14 + rnd() * 10, rTop = rBot * (0.55 + rnd() * 0.25);
      const h = 20 + rnd() * 40; // 高さ違い
      const seg = rnd() < 0.5 ? 5 : 6;
      ctx.solid(new THREE.CylinderGeometry(rTop, rBot, h, seg), col, x, h / 2, z, rnd() * Math.PI * 2);
      if (rnd() < 0.5) {
        // 頂部の岩塊でシルエットの起伏を追加
        const capR = rTop * (0.4 + rnd() * 0.3);
        ctx.solid(new THREE.BoxGeometry(capR * 1.6, h * 0.18, capR * 1.6), col,
          x, h + h * 0.09, z, rnd() * Math.PI * 2);
      }
    }

    const outer = ringSlots(centroid, OUTER_COUNT, RING.outMin, RING.outMax, rnd, rnd() * Math.PI * 2);
    for (const { x, z } of outer) {
      const col = vary(outerCol, rnd, 0.2);
      const rBot = 16 + rnd() * 12, rTop = rBot * 0.6, h = 14 + rnd() * 26;
      ctx.solid(new THREE.CylinderGeometry(rTop, rBot, h, 5), col, x, h / 2, z, rnd() * Math.PI * 2);
    }
  }

  // ---- skyCastle: 天空都市(浮遊する細塔。下端は空中で切る) ----
  function styleSkyCastle(ctx, centroid, sky, fog) {
    const rnd = ctx.rnd;
    const innerCol = baseColor(sky, fog, 0.05), outerCol = baseColor(sky, fog, 0.85);
    const spireN = 4 + Math.floor(rnd() * 3); // 4〜6本

    const slots = ringSlots(centroid, spireN, RING.inMin, RING.inMax, rnd, rnd() * Math.PI * 2);
    for (const { x, z } of slots) {
      const col = vary(innerCol, rnd, 0.25);
      const baseY = 8 + rnd() * 8; // 下端(y=8〜16、空中で切れる)
      const h = 14 + rnd() * 12;
      const rBot = 2.2 + rnd() * 1.4, rTop = rBot * 0.35;
      ctx.solid(new THREE.CylinderGeometry(rTop, rBot, h, 6), col, x, baseY + h / 2, z, rnd() * Math.PI * 2);
      ctx.solid(new THREE.ConeGeometry(rTop * 1.3, h * 0.3, 6), col, x, baseY + h + h * 0.15, z);
      if (rnd() < 0.5) {
        // 中腹の張り出し(バルコニー状の輪)
        ctx.solid(new THREE.CylinderGeometry(rBot * 1.3, rBot * 1.3, h * 0.08, 6), col, x, baseY + h * 0.4, z);
      }
    }

    const outer = ringSlots(centroid, OUTER_COUNT, RING.outMin, RING.outMax, rnd, rnd() * Math.PI * 2);
    for (const { x, z } of outer) {
      const col = vary(outerCol, rnd, 0.2);
      const baseY = 6 + rnd() * 10, h = 10 + rnd() * 10;
      ctx.solid(new THREE.CylinderGeometry(0.8, 1.6, h, 5), col, x, baseY + h / 2, z);
    }
  }

  // ---- auroraFrost: 氷の惑星(ギザギザ氷峰。先端やや明るい色) ----
  function styleAuroraFrost(ctx, centroid, sky, fog) {
    const rnd = ctx.rnd;
    const innerCol = baseColor(sky, fog, 0.05), outerCol = baseColor(sky, fog, 0.85);
    const tipCol = new THREE.Color(0xe8fbff).lerp(innerCol, 0.2); // 先端の明るい氷色
    const peakN = 8 + Math.floor(rnd() * 3); // 8〜10枚

    const slots = ringSlots(centroid, peakN, RING.inMin, RING.inMax, rnd, rnd() * Math.PI * 2);
    for (const { x, z } of slots) {
      const col = vary(innerCol, rnd, 0.25);
      const r = 5 + rnd() * 5, h = 26 + rnd() * 30; // 細長い峰
      const tilt = (rnd() - 0.5) * 0.12;
      ctx.solid(new THREE.ConeGeometry(r, h, 5), col, x, h / 2, z, rnd() * Math.PI * 2, 0, tilt);
      if (rnd() < 0.7) ctx.accent(x, h - 0.6, z, 0.7 + rnd() * 0.6, tipCol);
      if (rnd() < 0.4) {
        // 隣接する小峰でギザギザ感を強める
        const r2 = r * 0.5, h2 = h * (0.4 + rnd() * 0.3);
        ctx.solid(new THREE.ConeGeometry(r2, h2, 5), vary(innerCol, rnd, 0.25),
          x + (rnd() - 0.5) * r * 1.6, h2 / 2, z + (rnd() - 0.5) * r * 1.6,
          rnd() * Math.PI * 2, 0, (rnd() - 0.5) * 0.15);
      }
    }

    const outer = ringSlots(centroid, OUTER_COUNT, RING.outMin, RING.outMax, rnd, rnd() * Math.PI * 2);
    for (const { x, z } of outer) {
      const col = vary(outerCol, rnd, 0.2);
      const r = 5 + rnd() * 5, h = 18 + rnd() * 22;
      ctx.solid(new THREE.ConeGeometry(r, h, 5), col, x, h / 2, z);
    }
  }

  // ---- solarForge: 恒星炉工業(製錬塔+煙突。一部の頂部にオレンジ発光点) ----
  function styleSolarForge(ctx, centroid, sky, fog) {
    const rnd = ctx.rnd;
    const innerCol = baseColor(sky, fog, 0.05), outerCol = baseColor(sky, fog, 0.85);
    const glowCol = new THREE.Color(0xff8a2a);
    const towerN = 6 + Math.floor(rnd() * 3); // 6〜8本

    const slots = ringSlots(centroid, towerN, RING.inMin, RING.inMax, rnd, rnd() * Math.PI * 2);
    for (const { x, z } of slots) {
      const col = vary(innerCol, rnd, 0.25);
      if (rnd() < 0.5) {
        // 煙突(細く高い)
        const r = 1.4 + rnd() * 1, h = 20 + rnd() * 24;
        ctx.solid(new THREE.CylinderGeometry(r * 0.7, r, h, 6), col, x, h / 2, z);
        if (rnd() < 0.45) ctx.accent(x, h + 0.4, z, 0.8 + rnd() * 0.5, glowCol);
      } else {
        // 製錬塔(太い胴+上部タンク)
        const r = 3 + rnd() * 1.6, h = 14 + rnd() * 10, capH = 3 + rnd() * 2;
        ctx.solid(new THREE.CylinderGeometry(r * 0.85, r, h, 6), col, x, h / 2, z);
        ctx.solid(new THREE.CylinderGeometry(r * 0.5, r * 0.85, capH, 6), col, x, h + capH / 2, z);
        if (rnd() < 0.45) ctx.accent(x, h + capH + 0.4, z, 0.9 + rnd() * 0.5, glowCol);
      }
    }

    const outer = ringSlots(centroid, OUTER_COUNT, RING.outMin, RING.outMax, rnd, rnd() * Math.PI * 2);
    for (const { x, z } of outer) {
      const col = vary(outerCol, rnd, 0.2);
      const r = 1.4 + rnd() * 1.6, h = 14 + rnd() * 22;
      ctx.solid(new THREE.CylinderGeometry(r * 0.7, r, h, 5), col, x, h / 2, z);
    }
  }

  // ---- voidSpiral: 次元の裂け目(浮遊する壊れた島=逆円錐+上面Box) ----
  function styleVoidSpiral(ctx, centroid, sky, fog) {
    const rnd = ctx.rnd;
    const innerCol = baseColor(sky, fog, 0.05), outerCol = baseColor(sky, fog, 0.85);
    const islandN = 4 + Math.floor(rnd() * 3); // 4〜6個

    const slots = ringSlots(centroid, islandN, RING.inMin, RING.inMax, rnd, rnd() * Math.PI * 2);
    for (const { x, z } of slots) {
      const col = vary(innerCol, rnd, 0.3);
      const y = 6 + rnd() * 18; // 6〜24
      const r = 4 + rnd() * 4, h = 5 + rnd() * 6;
      const ry = rnd() * Math.PI * 2, tilt = (rnd() - 0.5) * 0.5;
      // 逆円錐(X軸180°回転で尖端を下向きに)
      ctx.solid(new THREE.ConeGeometry(r, h, 6), col, x, y, z, ry, Math.PI, tilt);
      // 上面に乗る瓦礫Box
      ctx.solid(new THREE.BoxGeometry(r * 1.1, h * 0.5, r * 1.1), col, x, y + h * 0.5, z, ry, 0, tilt);
    }

    const outer = ringSlots(centroid, OUTER_COUNT - 2, RING.outMin, RING.outMax, rnd, rnd() * Math.PI * 2);
    for (const { x, z } of outer) {
      const col = vary(outerCol, rnd, 0.2);
      const y = 6 + rnd() * 20, r = 3 + rnd() * 4, h = 4 + rnd() * 5;
      ctx.solid(new THREE.ConeGeometry(r, h, 5), col, x, y, z, 0, Math.PI, 0);
    }
  }

  // ---- singularity: 事象の地平線(傾いたモノリス。クリムゾンの発光点少々) ----
  function styleSingularity(ctx, centroid, sky, fog) {
    const rnd = ctx.rnd;
    const innerCol = baseColor(sky, fog, 0.05), outerCol = baseColor(sky, fog, 0.85);
    const crimson = new THREE.Color(0xff2a44);
    const monoN = 6 + Math.floor(rnd() * 3); // 6〜8本

    const slots = ringSlots(centroid, monoN, RING.inMin, RING.inMax, rnd, rnd() * Math.PI * 2);
    let glowGiven = 0;
    for (const { x, z } of slots) {
      const col = vary(innerCol, rnd, 0.2);
      const h = 24 + rnd() * 30, w = 2.2 + rnd() * 1.4;
      const tiltDeg = 5 + rnd() * 10; // 5〜15°
      const tilt = tiltDeg * Math.PI / 180 * (rnd() < 0.5 ? 1 : -1);
      ctx.solid(new THREE.BoxGeometry(w, h, w * 0.85), col, x, h / 2, z, rnd() * Math.PI * 2, 0, tilt);
      if (glowGiven < 4 && rnd() < 0.5) { // クリムゾンの発光点は控えめに数個だけ
        ctx.accent(x, h * (0.5 + rnd() * 0.4), z, 0.6 + rnd() * 0.5, crimson);
        glowGiven++;
      }
    }

    const outer = ringSlots(centroid, OUTER_COUNT, RING.outMin, RING.outMax, rnd, rnd() * Math.PI * 2);
    for (const { x, z } of outer) {
      const col = vary(outerCol, rnd, 0.2);
      const h = 16 + rnd() * 24, w = 1.6 + rnd() * 1.2;
      const tilt = (5 + rnd() * 10) * Math.PI / 180 * (rnd() < 0.5 ? 1 : -1);
      ctx.solid(new THREE.BoxGeometry(w, h, w * 0.8), col, x, h / 2, z, rnd() * Math.PI * 2, 0, tilt);
    }
  }

  // ---- generic: 未知idのフォールバック(丘のシルエット=半球) ----
  function styleGeneric(ctx, centroid, sky, fog) {
    const rnd = ctx.rnd;
    const innerCol = baseColor(sky, fog, 0.05), outerCol = baseColor(sky, fog, 0.85);
    const hillN = 6 + Math.floor(rnd() * 3); // 6〜8個

    const slots = ringSlots(centroid, hillN, RING.inMin, RING.inMax, rnd, rnd() * Math.PI * 2);
    for (const { x, z } of slots) {
      const col = vary(innerCol, rnd, 0.25);
      const r = 20 + rnd() * 30;
      // 半球(上半分のみのSphereで、平らな底面をy=0の地面に埋める)
      ctx.solid(new THREE.SphereGeometry(r, 8, 5, 0, Math.PI * 2, 0, Math.PI / 2), col, x, 0, z);
    }

    const outer = ringSlots(centroid, OUTER_COUNT, RING.outMin, RING.outMax, rnd, rnd() * Math.PI * 2);
    for (const { x, z } of outer) {
      const col = vary(outerCol, rnd, 0.2);
      const r = 18 + rnd() * 26;
      ctx.solid(new THREE.SphereGeometry(r, 7, 4, 0, Math.PI * 2, 0, Math.PI / 2), col, x, 0, z);
    }
  }

  const STYLES = {
    cookieTown: styleCookieTown,
    chocoCanyon: styleChocoCanyon,
    skyCastle: styleSkyCastle,
    auroraFrost: styleAuroraFrost,
    solarForge: styleSolarForge,
    voidSpiral: styleVoidSpiral,
    singularity: styleSingularity,
  };

  // ==================== 公開API ====================
  Game.horizon = {
    // def: コース定義(def.id / def.colors.sky・fog を使用)
    // centroid: {x, z} コース重心(呼び出し側が算出して渡す)
    // 戻り値: THREE.Group(呼び出し側がコースグループにaddする)
    build(def, centroid) {
      const group = new THREE.Group();
      group.name = 'horizonRing';
      group.userData.noShadow = true; // 影計算対象外の印(個々のメッシュにも同じ印を付与済み)

      const colors = (def && def.colors) || {};
      const sky = colors.sky != null ? colors.sky : 0x445566;
      const fog = colors.fog != null ? colors.fog : sky;
      const cx = (centroid && centroid.x) || 0, cz = (centroid && centroid.z) || 0;

      const rnd = makeRnd(hashSeed(def && def.id));
      const ctx = new Ctx(group, rnd);
      const styleFn = STYLES[def && def.id] || styleGeneric;
      styleFn(ctx, { x: cx, z: cz }, sky, fog);

      return group;
    },
  };
})();
