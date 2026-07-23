// フェイクブルーム。ポストプロセス(UnrealBloomPass等)を使わず、発光メッシュに
// 加算ブレンドのSpriteを重ねるだけで光暈(ハロー)を表現する軽量モジュール。
// iPadでの動作を最優先にするため、per-frame処理は一切持たない(生成して置くだけ)。
// Game.bloomSprites として公開する。
(function () {
  // ---- 共有の光暈テクスチャ(遅延生成・1回だけ) ----
  let _tex = null;

  // 放射グラデーションのCanvasTexture(64×64)を返す。中心は白(不透明)、
  // 0.35あたりで急減衰させたあとは外周までなだらかに透明へ落とし、
  // 「芯が明るく、まわりに柔らかく滲む」光の見た目にする。
  function texture() {
    if (_tex) return _tex;
    const size = 64;
    const cv = document.createElement('canvas');
    cv.width = size; cv.height = size;
    const ctx = cv.getContext('2d');
    const c = size / 2;
    const grad = ctx.createRadialGradient(c, c, 0, c, c, c);
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    grad.addColorStop(0.3, 'rgba(255,255,255,0.75)');
    grad.addColorStop(0.35, 'rgba(255,255,255,0.28)'); // ここで急減衰
    grad.addColorStop(0.6, 'rgba(255,255,255,0.08)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);
    _tex = new THREE.CanvasTexture(cv);
    return _tex;
  }

  // ---- 色ごとに共有するSpriteMaterialのキャッシュ ----
  const matCache = new Map();

  // color(hex数値 or THREE.Color)を整数hexキーへ正規化する
  function colorKey(color) {
    if (typeof color === 'number') return color;
    if (color && color.isColor) return color.getHex();
    return new THREE.Color(color).getHex();
  }

  function getMaterial(color) {
    const key = colorKey(color);
    let mat = matCache.get(key);
    if (!mat) {
      mat = new THREE.SpriteMaterial({
        map: texture(),
        color: key,
        blending: THREE.AdditiveBlending,
        transparent: true,
        depthWrite: false,
        opacity: 0.55,
        // フォグ必須OFF: 加算スプライトにフォグが乗ると「黒=不可視」のはずの光暈が
        // 遠距離でフォグ色の巨大な円盤として浮かび上がる(実地で発生した不具合)
        fog: false,
      });
      matCache.set(key, mat);
    }
    return mat;
  }

  // 加算ブレンドの光暈Spriteを1個作る。マテリアルは色ごとに共有し、Sprite自体は毎回新規に作る。
  // ※SpriteMaterialはsRGB変換不要(加算グローなので生の色をそのまま使えばよい)
  function make(color, worldSize) {
    const sprite = new THREE.Sprite(getMaterial(color));
    sprite.scale.set(worldSize, worldSize, 1);
    sprite.renderOrder = 5;
    return sprite;
  }

  // ---- コースグループを走査して発光メッシュに光暈を自動付与 ----
  const MIN_RADIUS = 0.12;   // これ未満の半径(米粒サイズ)には光暈をつけない
  const SIZE_FACTOR = 3.2;   // 光暈のサイズ = メッシュのバウンディング半径 × この係数
  const MAX_SPRITES = 40;    // 1回のbuild()で付与する上限(超過分は無視)
  const DEDUP_DIST_SQ = 1;   // 同一親内でこの距離未満(距離1未満なので二乗も1)なら重複とみなす

  // 材質のemissive色×emissiveIntensityを0〜1にクランプし、hex値として返す。
  // Game.matsのemissiveはリニア空間に変換済みの値なので、Sprite用にsRGBへ戻す
  // (戻さないと光暈だけ暗くくすむ)
  function glowHex(mat) {
    const c = mat.emissive.clone().multiplyScalar(mat.emissiveIntensity);
    c.r = Math.min(1, Math.max(0, c.r));
    c.g = Math.min(1, Math.max(0, c.g));
    c.b = Math.min(1, Math.max(0, c.b));
    if (c.convertLinearToSRGB) c.convertLinearToSRGB();
    return c.getHex();
  }

  // 採用済み(kept)の中に、同じ親を持ち位置がほぼ同じ(距離1未満)ものが無いか調べる
  function isDuplicate(mesh, kept) {
    for (let i = 0; i < kept.length; i++) {
      const other = kept[i];
      if (other.parent !== mesh.parent) continue;
      const dx = other.position.x - mesh.position.x;
      const dy = other.position.y - mesh.position.y;
      const dz = other.position.z - mesh.position.z;
      if (dx * dx + dy * dy + dz * dz < DEDUP_DIST_SQ) return true;
    }
    return false;
  }

  // コースグループ(group)を走査し、発光メッシュ(material.emissiveIntensity >= 0.7)に
  // 光暈Spriteを自動付与する。付与したSprite数を返す。生成後は一切のper-frame処理を持たない。
  function build(group) {
    if (!group || typeof group.traverse !== 'function') return 0;

    // 1. 対象メッシュを収集(発光判定・InstancedMesh除外・小物除外)
    const candidates = [];
    group.traverse((obj) => {
      if (!obj.isMesh || obj.isInstancedMesh) return;
      const mat = obj.material;
      if (!mat || Array.isArray(mat)) return;
      if (!mat.emissive || !(mat.emissiveIntensity >= 0.7)) return;
      // 重要: Lambert/Standard材質はemissive黒でもemissiveIntensity=1がデフォルト。
      // 実際に光っている(emissiveに明るさがある)ものだけを対象にする
      const e = mat.emissive;
      if (e.r + e.g + e.b < 0.02) return;

      const geo = obj.geometry;
      if (!geo) return;
      if (!geo.boundingSphere) geo.computeBoundingSphere();
      const sphere = geo.boundingSphere;
      if (!sphere || sphere.radius < MIN_RADIUS) return;

      candidates.push({ mesh: obj, mat, radius: sphere.radius });
    });
    if (candidates.length === 0) return 0;

    // 2. 半径の大きい順にソートし、上限40だけを採用(数より質。超過分は無視)
    candidates.sort((a, b) => b.radius - a.radius);
    const top = candidates.length > MAX_SPRITES ? candidates.slice(0, MAX_SPRITES) : candidates;

    // 3. 同一親グループ内の重複(位置がほぼ同じ)を除いて光暈を付与
    let count = 0;
    const kept = [];
    for (let i = 0; i < top.length; i++) {
      const item = top[i];
      if (isDuplicate(item.mesh, kept)) continue;
      kept.push(item.mesh);

      // 上限8: 万一大きな発光メッシュがあっても画面を覆う光暈にはしない
      const worldSize = Math.min(8, item.radius * SIZE_FACTOR);
      const sprite = make(glowHex(item.mat), worldSize);
      sprite.position.set(0, 0, 0);
      item.mesh.add(sprite); // 親(発光メッシュ)のワールド変換に追従させる
      count++;
    }
    return count;
  }

  Game.bloomSprites = { texture, make, build };
})();
