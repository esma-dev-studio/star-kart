// 有機的ジオメトリ生成ライブラリ。
// キャラ/カートの「素のプリミティブ見え」を廃止するための基盤。
// ルール: 頭・胴・手足などの主要形状は lathe/blob/tube/extrude で作り、
// Sphere/Box/Cylinderの直使用は極小の装飾(目のハイライト、ボタン等)に限る。
(function () {
  Game.geo = {
    // 回転体。profile: [[radius, y], ...] を下から上へ
    lathe(profile, segments = 24) {
      const pts = profile.map(([r, y]) => new THREE.Vector2(Math.max(0.0001, r), y));
      return new THREE.LatheGeometry(pts, segments);
    },

    // Catmull-Rom補間つき滑らか回転体。少ない制御点で有機的な輪郭を作る
    // (くびれ・洋ナシ型・雫型・ベル型など、キャラの胴体はこれが基本)
    latheSmooth(profile, segments = 28, samples = 24) {
      const curve = new THREE.CatmullRomCurve3(
        profile.map(([r, y]) => new THREE.Vector3(Math.max(0.0001, r), y, 0)));
      const pts = curve.getPoints(samples).map((p) => new THREE.Vector2(Math.max(0.0001, p.x), p.y));
      return new THREE.LatheGeometry(pts, segments);
    },

    // 曲がったチューブ(腕・尻尾・角・マフラー・枝)。points: [[x,y,z],...]
    tube(points, radius = 0.1, segments = 20, radialSegments = 8, closed = false) {
      const curve = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p)));
      return new THREE.TubeGeometry(curve, segments, radius, radialSegments, closed);
    },

    // 有機的な塊(頂点ノイズ+非等方スケール)。岩・もこもこ・非対称ボディに
    blob(radius = 1, opts = {}) {
      const {
        noise = 0.12, seed = 1, sx = 1, sy = 1, sz = 1,
        widthSeg = 20, heightSeg = 16,
      } = opts;
      const geo = new THREE.SphereGeometry(radius, widthSeg, heightSeg);
      const pos = geo.attributes.position;
      const v = new THREE.Vector3();
      for (let i = 0; i < pos.count; i++) {
        v.fromBufferAttribute(pos, i);
        const n = Math.sin(v.x * 3.1 + seed) * Math.cos(v.y * 2.7 + seed * 1.7)
          * Math.sin(v.z * 3.7 + seed * 0.6);
        const f = 1 + n * noise;
        pos.setXYZ(i, v.x * f * sx, v.y * f * sy, v.z * f * sz);
      }
      geo.computeVertexNormals();
      return geo;
    },

    // 2D輪郭の押し出し(耳・ヒレ・マント・クレスト・帯)。ptsXY: [[x,y],...]
    extrude(ptsXY, depth = 0.12, bevel = 0.03) {
      const shape = new THREE.Shape(ptsXY.map(([x, y]) => new THREE.Vector2(x, y)));
      return new THREE.ExtrudeGeometry(shape, {
        depth, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel,
        bevelSegments: 2, steps: 1,
      });
    },

    // 滑らかな閉曲線から押し出す(制御点少なめで有機的な板/シルエットを作る)
    extrudeSmooth(ptsXY, depth = 0.12, bevel = 0.03, samples = 32) {
      const curve = new THREE.CatmullRomCurve3(
        ptsXY.map(([x, y]) => new THREE.Vector3(x, y, 0)), true);
      const pts = curve.getPoints(samples);
      const shape = new THREE.Shape(pts.map((p) => new THREE.Vector2(p.x, p.y)));
      return new THREE.ExtrudeGeometry(shape, {
        depth, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel,
        bevelSegments: 2, steps: 1,
      });
    },

    // 角丸ボックス(Box代替。カウル・ポッド・パネル用)
    roundedBox(w, h, d, r = 0.08) {
      const hw = Math.max(0.001, w / 2 - r), hh = Math.max(0.001, h / 2 - r);
      const s = new THREE.Shape();
      s.moveTo(-hw, -hh - r);
      s.lineTo(hw, -hh - r); s.absarc(hw, -hh, r, -Math.PI / 2, 0, false);
      s.lineTo(hw + r, hh); s.absarc(hw, hh, r, 0, Math.PI / 2, false);
      s.lineTo(-hw, hh + r); s.absarc(-hw, hh, r, Math.PI / 2, Math.PI, false);
      s.lineTo(-hw - r, -hh); s.absarc(-hw, -hh, r, Math.PI, Math.PI * 1.5, false);
      const geo = new THREE.ExtrudeGeometry(s, {
        depth: Math.max(0.001, d - r * 2), bevelEnabled: true,
        bevelThickness: r, bevelSize: r, bevelSegments: 3, steps: 1,
      });
      geo.translate(0, 0, -Math.max(0.001, d - r * 2) / 2);
      return geo;
    },
  };
})();
