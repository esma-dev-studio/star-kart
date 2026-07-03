// パーティクル演出一式。Game.fx として公開する。
// ドリフト火花/ミニターボ/ブースト/オフロード土埃/スター/スピン/着地/ジャンプ/壁ヒット/リスポーン/紙吹雪/爆発等。
// Points(色つき点群)のプールを使い回し、フレームごとにBufferAttributeを更新する。
// new THREE.Vector3等のフレーム内生成は禁止のため、一時変数は関数外(クロージャ)に確保して使い回す。

const FX_TUNING = {
  maxParticles: 400,          // Pointsプールの最大粒数
  particleBaseSize: 0.5,      // PointsMaterialの基準サイズ(sizeAttenuation)

  gravity: 9,                 // 粒に効く重力(下向き)
  dragAir: 0.6,                // 空気抵抗(速度減衰/秒)

  // ドリフト火花(継続放出)
  driftSpawnPerSec: 26,
  driftSpeed: 3.2, driftSpeedVar: 1.6,
  driftUpSpeed: 1.6, driftBackSpeed: 2.2,
  driftLife: 0.45, driftLifeVar: 0.15,
  driftSize: 0.42, driftSizeVar: 0.18,

  // ミニターボ解放バースト+リング
  turboBurstCount: [14, 22, 32],       // レベル1/2/3の粒数
  turboRingCount: [10, 14, 18],
  turboSpeed: 5.5, turboSpeedVar: 2.5,
  turboLife: 0.55, turboLifeVar: 0.2,
  turboSize: 0.55,
  turboRingRadius: 1.2, turboRingUpSpeed: 1.0,

  // ブースト中の後方炎粒
  boostSpawnPerSec: 40,
  boostSpeed: 4.5, boostSpeedVar: 2.0,
  boostLife: 0.35, boostLifeVar: 0.12,
  boostSize: 0.5, boostSizeVar: 0.2,
  boostColors: [0xffcf3d, 0xff8a2b, 0xff5722],

  // オフロード土埃(その場に残って消える)
  offroadSpawnPerSec: 16,
  offroadUpSpeed: 0.6, offroadOutSpeed: 0.8,
  offroadLife: 0.6, offroadLifeVar: 0.2,
  offroadSize: 0.55, offroadSizeVar: 0.2,
  offroadColor: 0xcbb27a,

  // スター中のキラキラ(色相回転)
  starSpawnPerSec: 18,
  starRadius: 1.3, starUpSpeedMin: 0.4, starUpSpeedMax: 1.4,
  starLife: 0.7, starLifeVar: 0.25,
  starSize: 0.4, starSizeVar: 0.18,
  starHueSpeed: 0.5,     // 色相回転速度(周/秒)

  // スピン中、頭上で星がくるくる回る
  spinDuration: 1.0,
  spinStarCount: 3,
  spinRadius: 0.85, spinHeight: 2.3, spinRotSpeed: 7.5,
  spinStarSize: 0.5,
  spinStarColor: 0xffe14d,

  // 着地土埃パフ/ジャンプキラッ
  landPuffCount: 10, landPuffSpeed: 2.6, landPuffUp: 1.4,
  landPuffLife: 0.5, landPuffLifeVar: 0.15, landPuffSize: 0.5,
  landPuffColor: 0xd8cba0,
  jumpSparkleCount: 12, jumpSparkleSpeed: 3.0, jumpSparkleUp: 3.2,
  jumpSparkleLife: 0.5, jumpSparkleLifeVar: 0.15, jumpSparkleSize: 0.45,
  jumpSparkleColor: 0xfff3b0,

  // 壁ヒット白火花
  wallHitCount: 14, wallHitSpeed: 5.0, wallHitSpeedVar: 2.0,
  wallHitLife: 0.35, wallHitLifeVar: 0.1, wallHitSize: 0.4,
  wallHitColor: 0xffffff,

  // リスポーン再出現キラッ
  respawnCount: 20, respawnSpeed: 2.2, respawnUp: 1.6,
  respawnLife: 0.55, respawnLifeVar: 0.15, respawnSize: 0.5,
  respawnColor: 0xaeefff,

  // burst()汎用
  explosionCount: 46, explosionSpeed: 9.0, explosionSpeedVar: 4.0,
  explosionLife: 0.6, explosionLifeVar: 0.2, explosionSize: 0.6,
  explosionColors: [0xffcf3d, 0xff8a2b, 0xff5722, 0xffffff],
  sparkleBurstCount: 18, sparkleBurstSpeed: 3.2, sparkleBurstLife: 0.6,
  sparkleBurstSize: 0.42, sparkleBurstColor: 0xfff3b0,

  // 紙吹雪(Planeメッシュのプール)
  confettiPoolSize: 40,
  confettiColors: [0xff5d8f, 0x6fd8ff, 0xffe14d, 0x8fe37a, 0xd05dff, 0xffa030],
  confettiSize: 0.45,
  confettiFallSpeed: 3.2, confettiFallSpeedVar: 1.4,
  confettiDriftSpeed: 1.6,
  confettiSpinSpeed: 3.0,
  confettiSpawnRadiusX: 26, confettiSpawnHeight: 22, confettiSpawnDepth: 20,
  confettiRainSpawnPerSec: 18,
};

(function () {
  // ---- モジュールレベルの一時変数(フレーム内new禁止対応) ----
  const _tmpColor = new THREE.Color();

  function rand(min, max) { return min + Math.random() * (max - min); }
  function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

  // ---- 粒子プール(THREE.Points 1本) ----
  // slots: { active, px,py,pz, vx,vy,vz, life, maxLife, size, r,g,b, gravity, drag, mode }
  function createPool(max) {
    const geo = new THREE.BufferGeometry();
    const positions = new Float32Array(max * 3);
    const colors = new Float32Array(max * 3);
    const sizes = new Float32Array(max);
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
    const mat = new THREE.PointsMaterial({
      size: FX_TUNING.particleBaseSize,
      vertexColors: true,
      transparent: true,
      depthWrite: false,
      sizeAttenuation: true,
    });
    const points = new THREE.Points(geo, mat);
    points.frustumCulled = false;
    return {
      points, geo, mat, max,
      count: 0, // 現在の末尾(コンパクト管理はしない。free listで管理)
      slots: new Array(max).fill(null).map(() => ({
        active: false,
        px: 0, py: 0, pz: 0,
        vx: 0, vy: 0, vz: 0,
        life: 0, maxLife: 1,
        size: 0.5, r: 1, g: 1, b: 1,
        gravity: FX_TUNING.gravity, drag: FX_TUNING.dragAir,
        fadeMode: 'alpha', // 'alpha'|'size' どちらでフェードするか(頂点colorに直接alphaは無いのでsize/明るさで表現)
        settle: false, // trueの場合、着地(y<=groundY)で速度ゼロにして留まる(土埃向け)
        groundY: 0,
      })),
      cursor: 0,
    };
  }

  function spawnParticle(pool, opts) {
    // 単純なリングバッファ的確保: cursorから空きを探す(全部埋まっていれば最古を上書き)
    const n = pool.max;
    let idx = -1;
    for (let i = 0; i < n; i++) {
      const c = (pool.cursor + i) % n;
      if (!pool.slots[c].active) { idx = c; break; }
    }
    if (idx === -1) { idx = pool.cursor; } // 全部埋まっていたら最古を上書き
    pool.cursor = (idx + 1) % n;
    const s = pool.slots[idx];
    s.active = true;
    s.px = opts.px; s.py = opts.py; s.pz = opts.pz;
    s.vx = opts.vx || 0; s.vy = opts.vy || 0; s.vz = opts.vz || 0;
    s.life = opts.life;
    s.maxLife = opts.life;
    s.size = opts.size;
    s.r = opts.r; s.g = opts.g; s.b = opts.b;
    s.gravity = opts.gravity != null ? opts.gravity : FX_TUNING.gravity;
    s.drag = opts.drag != null ? opts.drag : FX_TUNING.dragAir;
    s.settle = !!opts.settle;
    s.groundY = opts.groundY || 0;
    s.hueRotate = opts.hueRotate || 0; // /秒。0以外なら色相を回す(スター用)
    return s;
  }

  function updatePool(pool, dt) {
    const posAttr = pool.geo.attributes.position;
    const colorAttr = pool.geo.attributes.color;
    const sizeAttr = pool.geo.attributes.size;
    let drawCount = 0;
    for (let i = 0; i < pool.max; i++) {
      const s = pool.slots[i];
      if (!s.active) continue;
      s.life -= dt;
      if (s.life <= 0) { s.active = false; continue; }

      if (s.settle && s.py <= s.groundY) {
        // 土埃: 着地後は横滑りのみゆっくり減衰、上下移動なし
        s.vx *= (1 - Math.min(1, s.drag * dt));
        s.vz *= (1 - Math.min(1, s.drag * dt));
      } else {
        s.vy -= s.gravity * dt;
        const dragF = Math.min(1, s.drag * dt);
        s.vx *= (1 - dragF); s.vz *= (1 - dragF);
        s.px += s.vx * dt; s.py += s.vy * dt; s.pz += s.vz * dt;
        if (s.settle && s.py < s.groundY) { s.py = s.groundY; s.vy = 0; }
      }

      const tLife = Math.max(0, s.life / s.maxLife);
      // 書き込み(this slot -> drawCountの位置。activeな粒だけ前詰め)
      const w = drawCount;
      posAttr.array[w * 3] = s.px;
      posAttr.array[w * 3 + 1] = s.py;
      posAttr.array[w * 3 + 2] = s.pz;

      let r = s.r, g = s.g, b = s.b;
      if (s.hueRotate) {
        _tmpColor.setRGB(r, g, b);
        const hsl = { h: 0, s: 0, l: 0 };
        _tmpColor.getHSL(hsl);
        hsl.h = (hsl.h + s.hueRotate * (s.maxLife - s.life)) % 1;
        _tmpColor.setHSL(hsl.h, Math.max(hsl.s, 0.7), Math.max(hsl.l, 0.6));
        r = _tmpColor.r; g = _tmpColor.g; b = _tmpColor.b;
      }
      // フェードアウト: 終盤で明るさを落として透明感を出す(vertexColorsはalpha非対応のため輝度で表現)
      const fade = tLife < 0.35 ? (tLife / 0.35) : 1;
      colorAttr.array[w * 3] = r * fade;
      colorAttr.array[w * 3 + 1] = g * fade;
      colorAttr.array[w * 3 + 2] = b * fade;

      sizeAttr.array[w] = s.size * (0.4 + 0.6 * tLife);
      drawCount++;
    }
    posAttr.needsUpdate = true;
    colorAttr.needsUpdate = true;
    sizeAttr.needsUpdate = true;
    pool.geo.setDrawRange(0, drawCount);
  }

  // ---- 紙吹雪(Planeメッシュのプール) ----
  function createConfettiPool(size) {
    const group = new THREE.Group();
    const items = [];
    const geo = new THREE.PlaneGeometry(FX_TUNING.confettiSize, FX_TUNING.confettiSize * 0.6);
    for (let i = 0; i < size; i++) {
      const mat = new THREE.MeshBasicMaterial({
        color: pick(FX_TUNING.confettiColors), side: THREE.DoubleSide,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.visible = false;
      group.add(mesh);
      items.push({
        mesh, active: false,
        vy: 0, vx: 0, vz: 0,
        rotSpeedX: 0, rotSpeedZ: 0,
        life: 0, maxLife: 1,
        swayPhase: 0, swaySpeed: 0,
      });
    }
    return { group, geo, items, cursor: 0 };
  }

  function spawnConfetti(pool, px, py, pz, opts = {}) {
    const n = pool.items.length;
    let idx = -1;
    for (let i = 0; i < n; i++) {
      const c = (pool.cursor + i) % n;
      if (!pool.items[c].active) { idx = c; break; }
    }
    if (idx === -1) idx = pool.cursor;
    pool.cursor = (idx + 1) % n;
    const it = pool.items[idx];
    it.active = true;
    it.mesh.visible = true;
    it.mesh.position.set(px, py, pz);
    it.mesh.material.color.setHex(pick(FX_TUNING.confettiColors));
    it.mesh.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
    it.vy = -rand(FX_TUNING.confettiFallSpeed, FX_TUNING.confettiFallSpeed + FX_TUNING.confettiFallSpeedVar);
    it.vx = rand(-1, 1) * FX_TUNING.confettiDriftSpeed;
    it.vz = rand(-1, 1) * FX_TUNING.confettiDriftSpeed;
    it.rotSpeedX = rand(-1, 1) * FX_TUNING.confettiSpinSpeed;
    it.rotSpeedZ = rand(-1, 1) * FX_TUNING.confettiSpinSpeed;
    it.swayPhase = Math.random() * Math.PI * 2;
    it.swaySpeed = rand(1.2, 2.4);
    it.life = opts.life != null ? opts.life : 5;
    it.maxLife = it.life;
    return it;
  }

  function updateConfetti(pool, dt) {
    for (const it of pool.items) {
      if (!it.active) continue;
      it.life -= dt;
      if (it.life <= 0) { it.active = false; it.mesh.visible = false; continue; }
      it.swayPhase += it.swaySpeed * dt;
      const sway = Math.sin(it.swayPhase) * 1.4;
      it.mesh.position.x += (it.vx + sway * 0.5) * dt;
      it.mesh.position.y += it.vy * dt;
      it.mesh.position.z += it.vz * dt;
      it.mesh.rotation.x += it.rotSpeedX * dt;
      it.mesh.rotation.z += it.rotSpeedZ * dt;
      const tLife = Math.max(0, it.life / it.maxLife);
      if (it.mesh.material.opacity !== undefined) {
        it.mesh.material.transparent = true;
        it.mesh.material.opacity = tLife < 0.25 ? tLife / 0.25 : 1;
      }
      if (it.mesh.position.y < -4) { it.active = false; it.mesh.visible = false; }
    }
  }

  Game.fx = {
    init(scene) {
      // 前のプールを破棄
      if (this._pool && this._pool.points && this._pool.points.parent) {
        this._pool.points.parent.remove(this._pool.points);
      }
      if (this._pool) {
        this._pool.geo.dispose();
        this._pool.mat.dispose();
      }
      if (this._confetti && this._confetti.group && this._confetti.group.parent) {
        this._confetti.group.parent.remove(this._confetti.group);
      }
      if (this._confetti) { this._confetti.geo.dispose(); }

      this._scene = scene;
      this._pool = createPool(FX_TUNING.maxParticles);
      scene.add(this._pool.points);

      this._confetti = createConfettiPool(FX_TUNING.confettiPoolSize);
      scene.add(this._confetti.group);

      this._karts = []; // { kart, isPlayer, spinT, spinAngle }
      this._rainT = 0;  // confettiRain残り時間
      this._rainAccum = 0;
    },

    // ---- kartコールバックのチェーン接続 ----
    attachKart(kart, isPlayer) {
      const entry = { kart, isPlayer: !!isPlayer, spinT: 0, spinAngle: 0, driftAccum: 0, boostAccum: 0, offroadAccum: 0, starAccum: 0 };
      this._karts.push(entry);

      const prevOnMiniTurbo = kart.onMiniTurbo;
      kart.onMiniTurbo = (level) => {
        if (prevOnMiniTurbo) prevOnMiniTurbo(level);
        this._burstMiniTurbo(kart, level);
      };

      const prevOnSpin = kart.onSpin;
      kart.onSpin = () => {
        if (prevOnSpin) prevOnSpin();
        entry.spinT = FX_TUNING.spinDuration;
      };

      const prevOnLand = kart.onLand;
      kart.onLand = () => {
        if (prevOnLand) prevOnLand();
        this._puffLand(kart);
      };

      const prevOnJumpPad = kart.onJumpPad;
      kart.onJumpPad = () => {
        if (prevOnJumpPad) prevOnJumpPad();
        this._sparkleJump(kart);
      };

      const prevOnWallHit = kart.onWallHit;
      kart.onWallHit = () => {
        if (prevOnWallHit) prevOnWallHit();
        this._sparkWallHit(kart);
      };

      const prevOnRespawn = kart.onRespawn;
      kart.onRespawn = () => {
        if (prevOnRespawn) prevOnRespawn();
        this._sparkleRespawn(kart);
      };
    },

    // ---- 継続演出のフレーム更新 + 全プールの物理更新 ----
    update(dt) {
      if (!this._pool) return;

      for (let i = this._karts.length - 1; i >= 0; i--) {
        const entry = this._karts[i];
        const kart = entry.kart;
        if (!kart || !kart.group) continue;

        // ドリフト火花(継続放出)
        if (kart.drift && kart.drift.state === 'drifting' && kart.drift.level >= 1) {
          entry.driftAccum += dt * FX_TUNING.driftSpawnPerSec;
          while (entry.driftAccum >= 1) { entry.driftAccum -= 1; this._spawnDriftSpark(kart); }
        } else {
          entry.driftAccum = 0;
        }

        // ブースト中の炎粒
        if (kart.boostT > 0) {
          entry.boostAccum += dt * FX_TUNING.boostSpawnPerSec;
          while (entry.boostAccum >= 1) { entry.boostAccum -= 1; this._spawnBoostFlame(kart); }
        } else {
          entry.boostAccum = 0;
        }

        // オフロード土埃
        const q = kart.lastQuery;
        if (kart.grounded && q && q.surface === 'offroad') {
          entry.offroadAccum += dt * FX_TUNING.offroadSpawnPerSec;
          while (entry.offroadAccum >= 1) { entry.offroadAccum -= 1; this._spawnOffroadDust(kart); }
        } else {
          entry.offroadAccum = 0;
        }

        // スター中のキラキラ
        if (kart.starT > 0) {
          entry.starAccum += dt * FX_TUNING.starSpawnPerSec;
          while (entry.starAccum >= 1) { entry.starAccum -= 1; this._spawnStarSparkle(kart); }
        } else {
          entry.starAccum = 0;
        }

        // スピン中: 頭上で星がくるくる
        if (entry.spinT > 0) {
          entry.spinT -= dt;
          entry.spinAngle += FX_TUNING.spinRotSpeed * dt;
          this._drawSpinStars(kart, entry.spinAngle, entry.spinT);
        }
      }

      updatePool(this._pool, dt);
      updateConfetti(this._confetti, dt);

      // confettiRain継続処理
      if (this._rainT > 0) {
        this._rainT -= dt;
        this._rainAccum += dt * FX_TUNING.confettiRainSpawnPerSec;
        while (this._rainAccum >= 1) {
          this._rainAccum -= 1;
          const px = rand(-FX_TUNING.confettiSpawnRadiusX, FX_TUNING.confettiSpawnRadiusX);
          const pz = rand(-FX_TUNING.confettiSpawnDepth, FX_TUNING.confettiSpawnDepth);
          spawnConfetti(this._confetti, px, FX_TUNING.confettiSpawnHeight, pz, { life: 6 });
        }
      }
    },

    // ---- 個別スポーン処理 ----
    _spawnDriftSpark(kart) {
      const P = Game.config.physics;
      const level = kart.drift.level;
      const colorHex = P.sparkColors[Math.max(0, level - 1)];
      _tmpColor.setHex(colorHex);
      const fwdX = Math.sin(kart.heading), fwdZ = Math.cos(kart.heading);
      const side = pick([-1, 1]);
      const rightX = Math.cos(kart.heading), rightZ = -Math.sin(kart.heading);
      const px = kart.pos.x - fwdX * 1.1 + rightX * side * 0.85;
      const pz = kart.pos.z - fwdZ * 1.1 + rightZ * side * 0.85;
      spawnParticle(this._pool, {
        px, py: kart.pos.y + 0.25, pz,
        vx: -fwdX * FX_TUNING.driftBackSpeed + rand(-1, 1) * FX_TUNING.driftSpeedVar,
        vy: rand(FX_TUNING.driftUpSpeed * 0.5, FX_TUNING.driftUpSpeed),
        vz: -fwdZ * FX_TUNING.driftBackSpeed + rand(-1, 1) * FX_TUNING.driftSpeedVar,
        life: FX_TUNING.driftLife + rand(0, FX_TUNING.driftLifeVar),
        size: FX_TUNING.driftSize + rand(0, FX_TUNING.driftSizeVar),
        r: _tmpColor.r, g: _tmpColor.g, b: _tmpColor.b,
      });
    },

    _burstMiniTurbo(kart, level) {
      const P = Game.config.physics;
      const colorHex = P.sparkColors[Math.max(0, level - 1)];
      _tmpColor.setHex(colorHex);
      const idx = Math.max(0, Math.min(2, level - 1));
      const count = FX_TUNING.turboBurstCount[idx];
      for (let i = 0; i < count; i++) {
        const ang = Math.random() * Math.PI * 2;
        const spd = rand(FX_TUNING.turboSpeed * 0.4, FX_TUNING.turboSpeed + FX_TUNING.turboSpeedVar);
        spawnParticle(this._pool, {
          px: kart.pos.x, py: kart.pos.y + 0.6, pz: kart.pos.z,
          vx: Math.cos(ang) * spd, vy: rand(1.5, 4), vz: Math.sin(ang) * spd,
          life: FX_TUNING.turboLife + rand(0, FX_TUNING.turboLifeVar),
          size: FX_TUNING.turboSize,
          r: _tmpColor.r, g: _tmpColor.g, b: _tmpColor.b,
        });
      }
      // リング(水平に広がる粒の輪)
      const ringCount = FX_TUNING.turboRingCount[idx];
      for (let i = 0; i < ringCount; i++) {
        const ang = (i / ringCount) * Math.PI * 2;
        spawnParticle(this._pool, {
          px: kart.pos.x + Math.cos(ang) * 0.3, py: kart.pos.y + 0.35, pz: kart.pos.z + Math.sin(ang) * 0.3,
          vx: Math.cos(ang) * FX_TUNING.turboRingRadius * 2.4, vy: FX_TUNING.turboRingUpSpeed,
          vz: Math.sin(ang) * FX_TUNING.turboRingRadius * 2.4,
          life: FX_TUNING.turboLife * 0.8,
          size: FX_TUNING.turboSize * 0.8,
          r: _tmpColor.r, g: _tmpColor.g, b: _tmpColor.b,
          gravity: FX_TUNING.gravity * 0.3,
        });
      }
    },

    _spawnBoostFlame(kart) {
      const colorHex = pick(FX_TUNING.boostColors);
      _tmpColor.setHex(colorHex);
      const fwdX = Math.sin(kart.heading), fwdZ = Math.cos(kart.heading);
      const px = kart.pos.x - fwdX * 1.6 + rand(-0.3, 0.3);
      const pz = kart.pos.z - fwdZ * 1.6 + rand(-0.3, 0.3);
      spawnParticle(this._pool, {
        px, py: kart.pos.y + 0.7 + rand(-0.1, 0.1), pz,
        vx: -fwdX * FX_TUNING.boostSpeed + rand(-1, 1) * FX_TUNING.boostSpeedVar,
        vy: rand(-0.3, 0.5),
        vz: -fwdZ * FX_TUNING.boostSpeed + rand(-1, 1) * FX_TUNING.boostSpeedVar,
        life: FX_TUNING.boostLife + rand(0, FX_TUNING.boostLifeVar),
        size: FX_TUNING.boostSize + rand(0, FX_TUNING.boostSizeVar),
        r: _tmpColor.r, g: _tmpColor.g, b: _tmpColor.b,
        gravity: 1.5,
      });
    },

    _spawnOffroadDust(kart) {
      _tmpColor.setHex(FX_TUNING.offroadColor);
      const ang = Math.random() * Math.PI * 2;
      spawnParticle(this._pool, {
        px: kart.pos.x + rand(-0.6, 0.6), py: kart.roadY + 0.1, pz: kart.pos.z + rand(-0.6, 0.6),
        vx: Math.cos(ang) * FX_TUNING.offroadOutSpeed, vy: FX_TUNING.offroadUpSpeed,
        vz: Math.sin(ang) * FX_TUNING.offroadOutSpeed,
        life: FX_TUNING.offroadLife + rand(0, FX_TUNING.offroadLifeVar),
        size: FX_TUNING.offroadSize + rand(0, FX_TUNING.offroadSizeVar),
        r: _tmpColor.r, g: _tmpColor.g, b: _tmpColor.b,
        gravity: FX_TUNING.gravity * 0.5,
        settle: true, groundY: kart.roadY + 0.05,
      });
    },

    _spawnStarSparkle(kart) {
      const hue = Math.random();
      _tmpColor.setHSL(hue, 0.9, 0.7);
      const ang = Math.random() * Math.PI * 2;
      const r = FX_TUNING.starRadius;
      spawnParticle(this._pool, {
        px: kart.pos.x + Math.cos(ang) * r, py: kart.pos.y + rand(0.3, 1.3), pz: kart.pos.z + Math.sin(ang) * r,
        vx: Math.cos(ang) * 0.4, vy: rand(FX_TUNING.starUpSpeedMin, FX_TUNING.starUpSpeedMax), vz: Math.sin(ang) * 0.4,
        life: FX_TUNING.starLife + rand(0, FX_TUNING.starLifeVar),
        size: FX_TUNING.starSize + rand(0, FX_TUNING.starSizeVar),
        r: _tmpColor.r, g: _tmpColor.g, b: _tmpColor.b,
        gravity: 0.5,
        hueRotate: FX_TUNING.starHueSpeed,
      });
    },

    // スピン中: 頭上を回る星(パーティクルではなく毎フレーム位置指定するため、短寿命粒を都度スポーンして表現)
    _drawSpinStars(kart, angle, remainT) {
      _tmpColor.setHex(FX_TUNING.spinStarColor);
      const n = FX_TUNING.spinStarCount;
      for (let i = 0; i < n; i++) {
        const a = angle + (i / n) * Math.PI * 2;
        const px = kart.pos.x + Math.cos(a) * FX_TUNING.spinRadius;
        const pz = kart.pos.z + Math.sin(a) * FX_TUNING.spinRadius;
        spawnParticle(this._pool, {
          px, py: kart.pos.y + FX_TUNING.spinHeight, pz,
          vx: 0, vy: 0, vz: 0,
          life: 0.12, size: FX_TUNING.spinStarSize,
          r: _tmpColor.r, g: _tmpColor.g, b: _tmpColor.b,
          gravity: 0, drag: 0,
        });
      }
    },

    _puffLand(kart) {
      _tmpColor.setHex(FX_TUNING.landPuffColor);
      for (let i = 0; i < FX_TUNING.landPuffCount; i++) {
        const ang = Math.random() * Math.PI * 2;
        spawnParticle(this._pool, {
          px: kart.pos.x, py: kart.roadY + 0.1, pz: kart.pos.z,
          vx: Math.cos(ang) * FX_TUNING.landPuffSpeed, vy: rand(0.2, FX_TUNING.landPuffUp),
          vz: Math.sin(ang) * FX_TUNING.landPuffSpeed,
          life: FX_TUNING.landPuffLife + rand(0, FX_TUNING.landPuffLifeVar),
          size: FX_TUNING.landPuffSize,
          r: _tmpColor.r, g: _tmpColor.g, b: _tmpColor.b,
          gravity: FX_TUNING.gravity * 0.6,
        });
      }
    },

    _sparkleJump(kart) {
      _tmpColor.setHex(FX_TUNING.jumpSparkleColor);
      for (let i = 0; i < FX_TUNING.jumpSparkleCount; i++) {
        const ang = Math.random() * Math.PI * 2;
        spawnParticle(this._pool, {
          px: kart.pos.x, py: kart.roadY + 0.2, pz: kart.pos.z,
          vx: Math.cos(ang) * FX_TUNING.jumpSparkleSpeed, vy: rand(1.5, FX_TUNING.jumpSparkleUp),
          vz: Math.sin(ang) * FX_TUNING.jumpSparkleSpeed,
          life: FX_TUNING.jumpSparkleLife + rand(0, FX_TUNING.jumpSparkleLifeVar),
          size: FX_TUNING.jumpSparkleSize,
          r: _tmpColor.r, g: _tmpColor.g, b: _tmpColor.b,
          gravity: 2,
        });
      }
    },

    _sparkWallHit(kart) {
      _tmpColor.setHex(FX_TUNING.wallHitColor);
      const fwdX = Math.sin(kart.heading), fwdZ = Math.cos(kart.heading);
      for (let i = 0; i < FX_TUNING.wallHitCount; i++) {
        const ang = Math.random() * Math.PI * 2;
        const spd = rand(FX_TUNING.wallHitSpeed * 0.5, FX_TUNING.wallHitSpeed + FX_TUNING.wallHitSpeedVar);
        spawnParticle(this._pool, {
          px: kart.pos.x + fwdX * 1.2, py: kart.pos.y + 0.5, pz: kart.pos.z + fwdZ * 1.2,
          vx: Math.cos(ang) * spd, vy: rand(0.5, 3), vz: Math.sin(ang) * spd,
          life: FX_TUNING.wallHitLife + rand(0, FX_TUNING.wallHitLifeVar),
          size: FX_TUNING.wallHitSize,
          r: _tmpColor.r, g: _tmpColor.g, b: _tmpColor.b,
        });
      }
    },

    _sparkleRespawn(kart) {
      _tmpColor.setHex(FX_TUNING.respawnColor);
      for (let i = 0; i < FX_TUNING.respawnCount; i++) {
        const ang = Math.random() * Math.PI * 2;
        const r = rand(0.3, 1.4);
        spawnParticle(this._pool, {
          px: kart.pos.x + Math.cos(ang) * r, py: kart.pos.y + rand(0.2, 1.6), pz: kart.pos.z + Math.sin(ang) * r,
          vx: Math.cos(ang) * FX_TUNING.respawnSpeed * 0.3, vy: rand(0.5, FX_TUNING.respawnUp),
          vz: Math.sin(ang) * FX_TUNING.respawnSpeed * 0.3,
          life: FX_TUNING.respawnLife + rand(0, FX_TUNING.respawnLifeVar),
          size: FX_TUNING.respawnSize,
          r: _tmpColor.r, g: _tmpColor.g, b: _tmpColor.b,
          gravity: 0.8,
        });
      }
    },

    // ---- 汎用バースト ----
    // type: 'confetti' | 'explosion' | 'sparkle'
    burst(pos, type) {
      if (!this._pool) return;
      const px = pos.x, py = pos.y, pz = pos.z;
      if (type === 'confetti') {
        for (let i = 0; i < 24; i++) {
          spawnConfetti(this._confetti, px + rand(-1, 1), py + rand(0, 1.5), pz + rand(-1, 1), { life: rand(1.5, 3) });
        }
      } else if (type === 'explosion') {
        for (let i = 0; i < FX_TUNING.explosionCount; i++) {
          const colorHex = pick(FX_TUNING.explosionColors);
          _tmpColor.setHex(colorHex);
          const ang = Math.random() * Math.PI * 2;
          const elev = rand(0.2, 1);
          const spd = rand(FX_TUNING.explosionSpeed * 0.4, FX_TUNING.explosionSpeed + FX_TUNING.explosionSpeedVar);
          spawnParticle(this._pool, {
            px, py: py + 0.3, pz,
            vx: Math.cos(ang) * spd * elev, vy: rand(2, 6), vz: Math.sin(ang) * spd * elev,
            life: FX_TUNING.explosionLife + rand(0, FX_TUNING.explosionLifeVar),
            size: FX_TUNING.explosionSize,
            r: _tmpColor.r, g: _tmpColor.g, b: _tmpColor.b,
          });
        }
      } else if (type === 'sparkle') {
        _tmpColor.setHex(FX_TUNING.sparkleBurstColor);
        for (let i = 0; i < FX_TUNING.sparkleBurstCount; i++) {
          const ang = Math.random() * Math.PI * 2;
          const spd = rand(FX_TUNING.sparkleBurstSpeed * 0.4, FX_TUNING.sparkleBurstSpeed);
          spawnParticle(this._pool, {
            px, py: py + rand(0, 1), pz,
            vx: Math.cos(ang) * spd, vy: rand(0.5, 3), vz: Math.sin(ang) * spd,
            life: FX_TUNING.sparkleBurstLife,
            size: FX_TUNING.sparkleBurstSize,
            r: _tmpColor.r, g: _tmpColor.g, b: _tmpColor.b,
            gravity: 1,
          });
        }
      }
    },

    // ---- 表彰式用: 画面上部から紙吹雪を降らせ続ける ----
    confettiRain(sec) {
      this._rainT = Math.max(this._rainT || 0, sec);
    },
  };
})();
