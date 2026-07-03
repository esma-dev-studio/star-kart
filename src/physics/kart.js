// カート物理。手触りの核なので変更時は必ず実走確認すること。
// 座標系: heading=ヨー角, 前方ベクトル=(sin h, 0, cos h), steer +1=左旋回
// 速度は「向きvelAngle+スカラーspeed」で持ち、velAngleがheadingへgrip速度で追従する。
// ドリフト中はgripを下げて「滑り」を作る。
Game.Kart = class Kart {
  constructor(opts = {}) {
    const P = Game.config.physics, SM = Game.config.statsMap;
    const st = opts.stats || { speed: 3, accel: 3, handling: 3, weight: 3 };
    this.stats = st;
    this.isPlayer = !!opts.isPlayer;
    this.color = opts.color ?? 0xff8fb0;
    this.charId = opts.charId ?? null;
    this.number = opts.number ?? 1; // ゼッケン番号

    this.maxSpeed = P.maxSpeed * (1 + (st.speed - 3) * SM.speed);
    this.baseMaxSpeed = this.maxSpeed; // AIラバーバンドはmaxSpeedを毎フレーム上書きする
    this.accel = P.accel * (1 + (st.accel - 3) * SM.accel);
    this.turnMul = 1 + (st.handling - 3) * SM.handling;
    this.mass = 1 + (st.weight - 3) * SM.weightStep;

    this.pos = new THREE.Vector3();
    this.heading = 0;
    this.velAngle = 0;
    this.speed = 0;
    this.vy = 0;
    this.grounded = true;
    this.roadY = 0;

    this.drift = { state: 'none', dir: 0, charge: 0, level: 0 };
    this.boostT = 0;
    this.spinT = 0;
    this.lockT = 0;       // リスポーン直後の操作ロック
    this.starT = 0;       // 無敵(スターゼリー)
    this.shield = false;  // 防御(クッキーシールド)
    this.autoT = 0;       // 自動走行(レインボースプリンクル)
    this.slowT = 0;       // 減速デバフ(キャラメルトラップ等)
    this.items = [];      // 所持アイテムキュー(idの配列)

    this.progressHint = null;
    this.lastQuery = null;

    // レース進行用(Phase2でRaceManagerが使用)
    this.lap = 0;
    this.raceProgress = 0;
    this.rank = 1;
    this.finished = false;

    this.group = null;
    this._visual = { driftYaw: 0, pitch: 0, roll: 0, spinYaw: 0, wheelSpin: 0 };
  }

  // ---- 状態変更API(アイテム等から呼ばれる) ----
  applyBoost(duration) { this.boostT = Math.max(this.boostT, duration); }
  applySpin() {
    if (this.starT > 0 || this.autoT > 0 || this.spinT > 0) return;
    if (this.shield) { this.shield = false; if (this.onShieldBreak) this.onShieldBreak(); return; }
    this.spinT = Game.config.physics.spinDuration;
    this.cancelDrift(false);
    if (this.onSpin) this.onSpin();
  }
  applyHit(power = 1) { // 爆発など強めの被弾
    if (this.starT > 0 || this.autoT > 0) return;
    if (this.shield) { this.shield = false; if (this.onShieldBreak) this.onShieldBreak(); return; }
    this.spinT = Game.config.physics.spinDuration * 1.3;
    this.speed *= 0.2;
    this.vy = 6 * power;
    this.grounded = false;
    this.cancelDrift(false);
    if (this.onSpin) this.onSpin();
  }

  cancelDrift(applyBoostIfCharged) {
    const P = Game.config.physics;
    if (this.drift.state === 'drifting' && applyBoostIfCharged && this.drift.level > 0) {
      this.applyBoost(P.miniTurbo[this.drift.level - 1].boost);
      if (this.onMiniTurbo) this.onMiniTurbo(this.drift.level);
    }
    this.drift.state = 'none';
    this.drift.dir = 0;
    this.drift.charge = 0;
    this.drift.level = 0;
  }

  resetAt(pos, heading, hint = null) {
    this.pos.copy(pos);
    this.heading = heading;
    this.velAngle = heading;
    this.speed = 0; this.vy = 0;
    this.grounded = true;
    this._padFlight = false;
    this.progressHint = hint;
    this.cancelDrift(false);
    this.boostT = 0; this.spinT = 0;
    this.autoT = 0; this.slowT = 0;
    this.items = []; this.shield = false; this.starT = 0;
  }

  respawn(course) {
    const q = this.lastQuery;
    const r = course.respawnPoint(q ? q.progress : 0);
    this.resetAt(r.pos, r.heading, r.hint);
    this.lockT = Game.config.physics.respawnLockTime;
    if (this.onRespawn) this.onRespawn();
  }

  // ---- メイン更新 ----
  update(dt, rawInput, course) {
    const P = Game.config.physics, U = Game.U;
    const input = this.lockT > 0
      ? { throttle: 0, brake: 0, steer: 0, drift: false, driftPressed: false }
      : rawInput;

    if (this.boostT > 0) this.boostT -= dt;
    if (this.spinT > 0) this.spinT -= dt;
    if (this.lockT > 0) this.lockT -= dt;
    if (this.starT > 0) this.starT -= dt;
    if (this.autoT > 0) this.autoT -= dt;
    if (this.slowT > 0) this.slowT -= dt;

    const q = course.query(this.pos, this.progressHint);
    this.progressHint = q.idx;
    this.lastQuery = q;
    this.roadY = q.roadY;
    const offroad = q.surface === 'offroad';

    // --- 速度上限と加減速 ---
    let cap = this.maxSpeed;
    if (this.autoT > 0) cap *= P.boostMultiplier * 1.12;
    else if (this.boostT > 0 || this.starT > 0) cap *= P.boostMultiplier;
    else if (offroad) cap *= P.offroadMultiplier;
    if (this.slowT > 0) cap *= P.itemSlowFactor;
    if (this.spinT > 0) cap *= 0.3;

    const th = this.spinT > 0 ? 0 : input.throttle;
    if (th > 0 && this.speed < cap) {
      this.speed += this.accel * (1 - Math.max(0, this.speed) / cap) * th * dt;
    } else if (input.brake > 0 && this.spinT <= 0) {
      this.speed -= P.brakeDecel * dt;
      this.speed = Math.max(this.speed, -P.reverseMaxSpeed);
    } else if (this.speed > 0) {
      this.speed = Math.max(0, this.speed - P.coastDecel * dt);
    } else if (this.speed < 0) {
      this.speed = Math.min(0, this.speed + P.coastDecel * dt);
    }
    if (this.speed > cap) this.speed = Math.max(cap, this.speed - P.overSpeedDecel * dt);
    if (this.boostT > 0 && th > 0) {
      // ブースト中は上限まで素早く到達させる
      this.speed = Math.min(cap, this.speed + this.accel * 1.6 * dt);
    }

    // --- ドリフト状態機械 ---
    const steer = this.spinT > 0 ? 0 : input.steer;
    const d = this.drift;
    if (d.state === 'none') {
      if (input.driftPressed && this.grounded && this.speed > P.driftMinSpeed) {
        this.vy = P.hopImpulse;
        this.grounded = false;
        d.state = 'hop';
        d.dir = 0;
        if (this.onHop) this.onHop();
      }
    } else if (d.state === 'hop') {
      if (steer !== 0) d.dir = Math.sign(steer);
      if (!input.drift) d.state = 'none';
    } else if (d.state === 'drifting') {
      if (!input.drift || this.speed < P.driftMinSpeed * 0.6) {
        this.cancelDrift(true);
      } else {
        const inward = (steer * d.dir + 1) / 2; // 0=外側フル 1=内側フル
        d.charge += dt * (P.driftChargeBase + P.driftChargeSteer * inward);
        d.level = 0;
        for (let i = 0; i < P.miniTurbo.length; i++) {
          if (d.charge >= P.miniTurbo[i].time) d.level = i + 1;
        }
      }
    }

    // --- 旋回 ---
    let turnRate = 0;
    if (d.state === 'drifting') {
      const inward = (steer * d.dir + 1) / 2;
      turnRate = d.dir * U.lerp(P.driftTurnMin, P.driftTurnMax, inward) * this.turnMul;
    } else if (Math.abs(this.speed) > 0.3) {
      const spd = Math.abs(this.speed);
      const sf = U.clamp(spd / 8, 0, 1) * U.lerp(1, P.highSpeedSteerScale, U.clamp(spd / this.maxSpeed, 0, 1));
      turnRate = steer * P.baseTurnRate * this.turnMul * sf * Math.sign(this.speed);
    }
    this.heading = U.wrapAngle(this.heading + turnRate * dt);

    // --- 速度方向の追従(グリップ) ---
    let grip = d.state === 'drifting' ? P.gripDrift : P.gripNormal;
    if (!this.grounded) grip = P.gripAir;
    this.velAngle = U.angleDamp(this.velAngle, this.heading, grip, dt);

    // --- 移動 ---
    this.pos.x += Math.sin(this.velAngle) * this.speed * dt;
    this.pos.z += Math.cos(this.velAngle) * this.speed * dt;

    // --- 上下(接地・ジャンプ・落下) ---
    const q2 = course.query(this.pos, this.progressHint);
    this.progressHint = q2.idx;
    this.lastQuery = q2;
    if (this.grounded) {
      if (!q2.ground) {
        this.grounded = false;
        this.vy = 0;
      } else {
        this.pos.y = q2.roadY;
      }
    }
    if (!this.grounded) {
      this.vy -= P.gravity * dt;
      this.pos.y += this.vy * dt;
      // ジャンプ台からの飛行中は路面中央へ緩やかに吸い寄せる(狭い足場への着地救済)
      if (this._padFlight) {
        const pull = Math.min(1, P.padFlightCenter * dt);
        this.pos.x -= q2.normal.x * q2.lateral * pull;
        this.pos.z -= q2.normal.z * q2.lateral * pull;
      }
      // 深く沈み込んでいる時は吸着着地させない(ギャップ落下中に路面へワープするのを防ぐ)
      if (q2.ground && this.vy <= 0 && this.pos.y <= q2.roadY && this.pos.y >= q2.roadY - 2) {
        this.pos.y = q2.roadY;
        this.vy = 0;
        this.grounded = true;
        this._padFlight = false;
        // 着地: ホップ中にドリフト成立判定
        if (d.state === 'hop') {
          const dir = d.dir !== 0 ? d.dir : Math.sign(steer);
          if (input.drift && dir !== 0 && this.speed > P.driftMinSpeed) {
            d.state = 'drifting';
            d.dir = dir;
            d.charge = 0;
            d.level = 0;
            if (this.onDriftStart) this.onDriftStart();
          } else {
            d.state = 'none';
          }
        }
        if (this.onLand) this.onLand();
      }
    }

    // --- 壁クランプ(接地時のみ。空中はジャンプ軌道を優先) ---
    if (this.grounded && q2.wall && Math.abs(q2.lateral) > q2.limit) {
      const over = Math.abs(q2.lateral) - q2.limit;
      const sgn = Math.sign(q2.lateral);
      this.pos.x -= q2.normal.x * sgn * over;
      this.pos.z -= q2.normal.z * sgn * over;
      // 進行方向を接線に寄せ、当たり角に応じて減速
      const tanA = q2.tangentAngle;
      const along = Math.cos(U.wrapAngle(this.velAngle - tanA)) >= 0 ? tanA : U.wrapAngle(tanA + Math.PI);
      const impact = Math.abs(U.wrapAngle(this.velAngle - along));
      this.velAngle = along;
      const keep = U.lerp(1, P.wallRestitution, U.clamp(impact / (Math.PI / 2), 0, 1));
      if (this.speed > 0) this.speed *= keep;
      if (this.onWallHit && impact > 0.5 && Math.abs(this.speed) > 8) this.onWallHit();
    }

    // --- パッド効果(イベントは踏んだ瞬間のみ発火) ---
    if (this.grounded && q2.pad) {
      if (q2.pad.type === 'boost') {
        this.applyBoost(P.padBoostTime);
        if (this.onPadBoost && !this._onPad) this.onPadBoost();
      } else if (q2.pad.type === 'jump' && this.vy <= 0) {
        this.vy = q2.pad.impulse;
        this.speed = Math.max(this.speed, P.jumpPadMinSpeed); // 低速進入でもギャップを渡り切れる
        this.grounded = false;
        this._padFlight = true; // 飛行中はセンタリング補正が効く
        if (this.onJumpPad) this.onJumpPad();
      }
      this._onPad = true;
    } else {
      this._onPad = false;
    }

    // --- 落下リスポーン ---
    if (this.pos.y < q2.roadY - P.fallRespawnDepth) {
      this.respawn(course);
      if (this.onFell) this.onFell();
    }

    this.updateVisual(dt, q2, steer);
  }

  // ---- カート同士の衝突(全カートペアに対して1回呼ぶ) ----
  static collide(karts) {
    const P = Game.config.physics;
    for (let i = 0; i < karts.length; i++) {
      for (let j = i + 1; j < karts.length; j++) {
        const a = karts[i], b = karts[j];
        const dx = b.pos.x - a.pos.x, dz = b.pos.z - a.pos.z;
        const dy = Math.abs(b.pos.y - a.pos.y);
        if (dy > 2) continue;
        const dist = Math.hypot(dx, dz);
        const minD = P.kartRadius * 2;
        if (dist >= minD || dist < 1e-4) continue;
        const nx = dx / dist, nz = dz / dist;
        const push = (minD - dist);
        const total = a.mass + b.mass;
        // 無敵カートは押し勝ち、相手をスピンさせる
        const aStar = a.starT > 0, bStar = b.starT > 0;
        if (aStar && !bStar) b.applySpin();
        if (bStar && !aStar) a.applySpin();
        const aShare = aStar ? 0 : (bStar ? 1 : b.mass / total);
        const bShare = bStar ? 0 : (aStar ? 1 : a.mass / total);
        a.pos.x -= nx * push * aShare; a.pos.z -= nz * push * aShare;
        b.pos.x += nx * push * bShare; b.pos.z += nz * push * bShare;
        if (a.onBump && (Math.abs(a.speed) + Math.abs(b.speed)) > 10) a.onBump();
      }
    }
  }

  // ---- 見た目 ----
  buildMesh() {
    const g = new THREE.Group();
    const tilt = new THREE.Group();
    g.add(tilt);

    const bodyMat = new THREE.MeshLambertMaterial({ color: this.color });
    const darker = new THREE.Color(this.color).multiplyScalar(0.72);
    const accentMat = new THREE.MeshLambertMaterial({ color: darker });
    const darkMat = new THREE.MeshLambertMaterial({ color: 0x3a3a3a });

    // 低く構えた流線型シャシー
    const body = new THREE.Mesh(new THREE.BoxGeometry(1.35, 0.34, 2.3), bodyMat);
    body.position.y = 0.5;
    tilt.add(body);
    // ウェッジノーズ(前傾)
    const noseWedge = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.26, 1.05), bodyMat);
    noseWedge.position.set(0, 0.52, 1.35);
    noseWedge.rotation.x = 0.12;
    tilt.add(noseWedge);
    // サイドポッド
    for (const sx of [-0.82, 0.82]) {
      const pod = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.3, 1.3), accentMat);
      pod.position.set(sx, 0.48, -0.15);
      tilt.add(pod);
    }
    // フロントウィング+翼端板
    const fWing = new THREE.Mesh(new THREE.BoxGeometry(1.85, 0.07, 0.44), accentMat);
    fWing.position.set(0, 0.3, 1.78);
    tilt.add(fWing);
    for (const sx of [-0.92, 0.92]) {
      const plate = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.18, 0.44), accentMat);
      plate.position.set(sx, 0.36, 1.78);
      tilt.add(plate);
    }
    // ゼッケン(ノーズのナンバーサークル)
    const numCv = document.createElement('canvas');
    numCv.width = 128; numCv.height = 128;
    const nx = numCv.getContext('2d');
    nx.fillStyle = '#ffffff';
    nx.beginPath(); nx.arc(64, 64, 60, 0, Math.PI * 2); nx.fill();
    nx.lineWidth = 10;
    nx.strokeStyle = '#' + darker.getHexString();
    nx.beginPath(); nx.arc(64, 64, 54, 0, Math.PI * 2); nx.stroke();
    nx.fillStyle = '#41333b';
    nx.font = 'bold 64px sans-serif';
    nx.textAlign = 'center'; nx.textBaseline = 'middle';
    nx.fillText(String(this.number), 64, 68);
    const roundel = new THREE.Mesh(new THREE.CircleGeometry(0.3, 20),
      new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(numCv), transparent: true }));
    roundel.position.set(0, 0.68, 1.3);
    roundel.rotation.x = -Math.PI / 2 + 0.12;
    tilt.add(roundel);
    // シートとステアリング
    const seatBack = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.55, 0.22), bodyMat);
    seatBack.position.set(0, 0.9, -0.85);
    tilt.add(seatBack);
    const column = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.44, 6), darkMat);
    column.position.set(0, 0.82, 0.42);
    column.rotation.x = 0.9;
    tilt.add(column);
    const wheelRing = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.045, 8, 14), darkMat);
    wheelRing.position.set(0, 0.98, 0.3);
    wheelRing.rotation.x = -0.65;
    tilt.add(wheelRing);
    // 乗り手プレースホルダ(characters.mountOnでキャラモデルに差し替わる)
    const rider = new THREE.Mesh(new THREE.SphereGeometry(0.55, 14, 12),
      new THREE.MeshLambertMaterial({ color: 0xfff2e8 }));
    rider.position.set(0, 0.95, -0.32);
    rider.name = 'riderPlaceholder';
    tilt.add(rider);

    // リアウィング/センターストライプ/ヘッドライト
    const wing = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.08, 0.44), accentMat);
    wing.position.set(0, 1.14, -1.28);
    tilt.add(wing);
    for (const sx of [-0.5, 0.5]) {
      const strut = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.34, 0.08), accentMat);
      strut.position.set(sx, 0.93, -1.28);
      tilt.add(strut);
    }
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.03, 2.2),
      new THREE.MeshLambertMaterial({ color: 0xfff6ee }));
    stripe.position.set(0, 0.685, -0.1);
    tilt.add(stripe);
    for (const sx of [-0.42, 0.42]) {
      const light = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 8),
        new THREE.MeshBasicMaterial({ color: 0xfffbe0 }));
      light.position.set(sx, 0.5, 1.85);
      tilt.add(light);
    }

    // ホイール: レーシングカートらしく前細・後太
    this._wheels = [];
    for (const [x, z, front] of [[-0.88, 0.95, true], [0.88, 0.95, true], [-0.92, -0.92, false], [0.92, -0.92, false]]) {
      const r = front ? 0.34 : 0.46, w = front ? 0.28 : 0.4;
      const pivot = new THREE.Group();
      pivot.position.set(x, r, z);
      const spinner = new THREE.Group();
      const wheel = new THREE.Mesh(new THREE.CylinderGeometry(r, r, w, 12), darkMat);
      wheel.rotation.z = Math.PI / 2;
      spinner.add(wheel);
      const hub = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.45, r * 0.45, w + 0.04, 8),
        new THREE.MeshLambertMaterial({ color: 0xffd166 }));
      hub.rotation.z = Math.PI / 2;
      spinner.add(hub);
      pivot.add(spinner);
      tilt.add(pivot);
      this._wheels.push({ pivot, spinner, front });
    }

    // 排気口とブースト炎
    this._flames = [];
    for (const x of [-0.32, 0.32]) {
      const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.13, 0.5, 8), darkMat);
      pipe.position.set(x, 0.62, -1.3);
      pipe.rotation.x = Math.PI / 2.4;
      tilt.add(pipe);
      const flame = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.9, 8),
        new THREE.MeshBasicMaterial({ color: 0xffa030, transparent: true, opacity: 0.9 }));
      flame.position.set(x, 0.56, -1.85);
      flame.rotation.x = Math.PI / 2;
      flame.visible = false;
      tilt.add(flame);
      this._flames.push(flame);
    }

    // ドリフト火花(色は充填レベルで変化)
    this._sparks = [];
    for (const x of [-0.8, 0.8]) {
      const spark = new THREE.Mesh(new THREE.SphereGeometry(0.17, 8, 8),
        new THREE.MeshBasicMaterial({ color: 0x55c8ff }));
      spark.position.set(x, 0.22, -1.15);
      spark.visible = false;
      tilt.add(spark);
      this._sparks.push(spark);
    }

    // 丸影(動的シャドウの補助として薄く残す。ジャンプ中の接地感に効く)
    const shadow = new THREE.Mesh(new THREE.CircleGeometry(1.5, 20),
      new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.1, depthWrite: false }));
    shadow.rotation.x = -Math.PI / 2;
    this._shadow = shadow;
    g.add(shadow);

    // カート一式は動的シャドウを落とす
    g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    shadow.castShadow = false;

    this.group = g;
    this._tilt = tilt;
    return g;
  }

  updateVisual(dt, q, steer) {
    if (!this.group) return;
    const P = Game.config.physics, U = Game.U;
    const v = this._visual;

    this.group.position.copy(this.pos);

    // ドリフト中は車体を余分に内へ向けて滑り感を出す
    const targetDriftYaw = this.drift.state === 'drifting' ? this.drift.dir * 0.32 : 0;
    v.driftYaw = U.damp(v.driftYaw, targetDriftYaw, 8, dt);
    // スピン演出(1回転)
    v.spinYaw = this.spinT > 0 ? (1 - this.spinT / (P.spinDuration * 1.3)) * Math.PI * 2 : 0;
    this.group.rotation.y = this.heading + v.driftYaw + v.spinYaw;

    // 坂に合わせたピッチ
    const dirAlign = Math.cos(U.wrapAngle(this.heading - q.tangentAngle)) >= 0 ? 1 : -1;
    const slope = Math.asin(U.clamp(q.tangent.y * dirAlign, -0.9, 0.9));
    v.pitch = U.damp(v.pitch, this.grounded ? -slope : U.clamp(-this.vy * 0.04, -0.35, 0.5), 6, dt);
    const targetRoll = this.drift.state === 'drifting' ? -this.drift.dir * 0.1 : -steer * 0.05;
    v.roll = U.damp(v.roll, targetRoll, 6, dt);
    this._tilt.rotation.x = v.pitch;
    this._tilt.rotation.z = v.roll;

    // ホイール
    v.wheelSpin += (this.speed / 0.42) * dt;
    for (const w of this._wheels) {
      w.spinner.rotation.x = v.wheelSpin;
      if (w.front) w.pivot.rotation.y = U.damp(w.pivot.rotation.y, steer * 0.35, 10, dt);
    }

    // ブースト炎/ドリフト火花
    const boosting = this.boostT > 0;
    for (const f of this._flames) {
      f.visible = boosting;
      if (boosting) f.scale.setScalar(0.8 + Math.random() * 0.5);
    }
    const sparking = this.drift.state === 'drifting' && this.drift.level > 0;
    for (const s of this._sparks) {
      s.visible = sparking;
      if (sparking) {
        s.material.color.setHex(P.sparkColors[this.drift.level - 1]);
        s.scale.setScalar(0.8 + Math.random() * 0.7);
      }
    }

    // 影は路面に貼り付く
    this._shadow.position.y = (this.roadY - this.pos.y) + 0.04;
    const sh = U.clamp(1 - (this.pos.y - this.roadY) * 0.06, 0.4, 1);
    this._shadow.scale.setScalar(sh);

    // リスポーン直後は点滅
    this.group.visible = this.lockT > 0 ? (Math.floor(this.lockT * 12) % 2 === 0) : true;
  }
};
