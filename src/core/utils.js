// 数学ヘルパーと閉Catmull-Romスプライン
Game.U = {
  clamp(v, a, b) { return v < a ? a : (v > b ? b : v); },
  lerp(a, b, t) { return a + (b - a) * t; },
  wrapAngle(a) {
    while (a > Math.PI) a -= Math.PI * 2;
    while (a < -Math.PI) a += Math.PI * 2;
    return a;
  },
  // フレームレート非依存の減衰補間
  damp(cur, target, rate, dt) {
    return Game.U.lerp(cur, target, 1 - Math.exp(-rate * dt));
  },
  angleDamp(cur, target, rate, dt) {
    return cur + Game.U.wrapAngle(target - cur) * (1 - Math.exp(-rate * dt));
  },
  angleLerp(a, b, t) { return a + Game.U.wrapAngle(b - a) * t; },
};

// 閉ループのCatmull-Romスプライン。等弧長でリサンプルし、路面クエリの基盤になる。
// ctrl: [{x, y, z, w?}] wは路面半幅(省略時8)
Game.Spline = class Spline {
  constructor(ctrl, sampleCount = 512) {
    const n = ctrl.length;
    const cr = (p0, p1, p2, p3, t) => 0.5 * (
      (2 * p1) + (-p0 + p2) * t +
      (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t +
      (-p0 + 3 * p1 - 3 * p2 + p3) * t * t * t
    );
    // 生サンプル
    const OS = 24;
    const raw = [];
    for (let i = 0; i < n; i++) {
      const p0 = ctrl[(i - 1 + n) % n], p1 = ctrl[i];
      const p2 = ctrl[(i + 1) % n], p3 = ctrl[(i + 2) % n];
      const w0 = p0.w ?? 8, w1 = p1.w ?? 8, w2 = p2.w ?? 8, w3 = p3.w ?? 8;
      for (let j = 0; j < OS; j++) {
        const t = j / OS;
        raw.push({
          x: cr(p0.x, p1.x, p2.x, p3.x, t),
          y: cr(p0.y, p1.y, p2.y, p3.y, t),
          z: cr(p0.z, p1.z, p2.z, p3.z, t),
          w: cr(w0, w1, w2, w3, t),
        });
      }
    }
    // 累積長
    const m = raw.length;
    const cum = new Float64Array(m + 1);
    for (let i = 0; i < m; i++) {
      const a = raw[i], b = raw[(i + 1) % m];
      cum[i + 1] = cum[i] + Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z);
    }
    this.total = cum[m];
    // 等弧長リサンプル
    this.count = sampleCount;
    this.pts = []; this.tan = []; this.nrm = []; this.w = new Float64Array(sampleCount);
    let ri = 0;
    for (let i = 0; i < sampleCount; i++) {
      const target = (i / sampleCount) * this.total;
      while (ri < m - 1 && cum[ri + 1] < target) ri++;
      const segLen = cum[ri + 1] - cum[ri];
      const f = segLen > 0 ? (target - cum[ri]) / segLen : 0;
      const a = raw[ri], b = raw[(ri + 1) % m];
      this.pts.push(new THREE.Vector3(
        Game.U.lerp(a.x, b.x, f), Game.U.lerp(a.y, b.y, f), Game.U.lerp(a.z, b.z, f)));
      this.w[i] = Game.U.lerp(a.w, b.w, f);
    }
    // 接線・左法線(XZ平面)
    for (let i = 0; i < sampleCount; i++) {
      const a = this.pts[(i - 1 + sampleCount) % sampleCount];
      const b = this.pts[(i + 1) % sampleCount];
      const t = new THREE.Vector3().subVectors(b, a).normalize();
      this.tan.push(t);
      const l = Math.hypot(t.x, t.z) || 1;
      this.nrm.push(new THREE.Vector3(-t.z / l, 0, t.x / l));
    }
    this.step = this.total / sampleCount;
  }

  progress(i) { return i / this.count; }
  tangentAngle(i) { const t = this.tan[i]; return Math.atan2(t.x, t.z); }

  // posに最も近いサンプル番号。hint近傍のみ探索(立体交差でも連続追跡できる)
  closest(pos, hint = null, window = 24) {
    let best = -1, bestD = Infinity;
    const c = this.count;
    const check = (i) => {
      const p = this.pts[i];
      const dx = pos.x - p.x, dy = (pos.y - p.y) * 0.8, dz = pos.z - p.z;
      const d = dx * dx + dy * dy + dz * dz;
      if (d < bestD) { bestD = d; best = i; }
    };
    if (hint == null) {
      for (let i = 0; i < c; i++) check(i);
    } else {
      for (let k = -window; k <= window; k++) check((hint + k + c * 4) % c);
    }
    return best;
  }
};
