// レンダラ初期化・追従カメラ・メインループ
Game.app = {
  renderer: null,
  scene: null,
  camera: null,
  clock: null,
  updateFn: null,

  init(container) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    // リアル寄りの画作り: sRGB出力+フィルミックトーンマップ+ソフトシャドウ
    this.renderer.outputEncoding = THREE.sRGBEncoding;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(this.renderer.domElement);

    this.camera = new THREE.PerspectiveCamera(
      Game.config.cameraCfg.fovBase, window.innerWidth / window.innerHeight, 0.1, 1200);

    window.addEventListener('resize', () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    });

    this.clock = new THREE.Clock();
    Game.input.init();
  },

  // コースごとにシーンを作り直す
  newScene() {
    if (this.scene) {
      this.scene.traverse((o) => {
        if (o.geometry) o.geometry.dispose();
        if (o.material) {
          const mats = Array.isArray(o.material) ? o.material : [o.material];
          mats.forEach((m) => { if (m.map) m.map.dispose(); m.dispose(); });
        }
      });
    }
    this.scene = new THREE.Scene();
    const hemi = new THREE.HemisphereLight(0xffffff, 0xd8c5a8, 0.55);
    this.scene.add(hemi);
    this.hemi = hemi;
    // リムライト(後方から輪郭を照らす。シャドウなしの安い1灯で立体感が増す)
    const rim = new THREE.DirectionalLight(0xcfe4ff, 0.35);
    rim.position.set(-40, 60, -80);
    this.scene.add(rim);
    this.rim = rim;
    const sun = new THREE.DirectionalLight(0xfff3dd, 0.85);
    sun.position.set(60, 95, 35);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    sun.shadow.camera.near = 10;
    sun.shadow.camera.far = 280;
    const d = 55; // プレイヤー周辺だけをカバーする(updateSunで追従)
    sun.shadow.camera.left = -d; sun.shadow.camera.right = d;
    sun.shadow.camera.top = d; sun.shadow.camera.bottom = -d;
    sun.shadow.bias = -0.0006;
    this.scene.add(sun);
    this.scene.add(sun.target);
    this.sun = sun;
    return this.scene;
  },

  // 影のカバー範囲(シャドウカメラ)をプレイヤーに追従させる
  updateSun(target) {
    if (!this.sun) return;
    this.sun.position.set(target.x + 60, target.y + 95, target.z + 35);
    this.sun.target.position.set(target.x, target.y, target.z);
    this.sun.target.updateMatrixWorld();
  },

  start(updateFn) {
    this.updateFn = updateFn;
    const loop = () => {
      requestAnimationFrame(loop);
      const dt = Math.min(this.clock.getDelta(), 1 / 30);
      if (this.updateFn) this.updateFn(dt);
      Game.input.endFrame();
      if (this.scene) this.renderer.render(this.scene, this.camera);
    };
    loop();
  },
};

// 追従カメラ。速度方向とheadingをブレンドした角度を減衰追従し、速度でFOVが広がる。
Game.CameraCtrl = class CameraCtrl {
  constructor(camera) {
    this.camera = camera;
    this.angle = 0;
    this.pos = new THREE.Vector3();
    this.initialized = false;
    this.roll = 0;        // ドリフト時のカメラ傾き
    this._shake = 0;      // 衝突シェイク残量
    this._orbitA = 0;     // 勝利オービット角
  }

  addShake(m) { this._shake = Math.max(this._shake, m); }

  snapTo(kart) {
    this.angle = kart.heading;
    this.updatePos(kart, 1, Game.config.cameraCfg.dist);
    this.camera.position.copy(this.pos);
    this.initialized = true;
  }

  updatePos(kart, f, dist) {
    const C = Game.config.cameraCfg;
    const tx = kart.pos.x - Math.sin(this.angle) * dist;
    const tz = kart.pos.z - Math.cos(this.angle) * dist;
    const ty = kart.pos.y + C.height;
    this.pos.set(
      Game.U.lerp(this.pos.x, tx, f),
      Game.U.lerp(this.pos.y, ty, f),
      Game.U.lerp(this.pos.z, tz, f));
  }

  update(dt, kart) {
    const C = Game.config.cameraCfg, U = Game.U;
    if (!this.initialized) this.snapTo(kart);
    // ドリフト中も進行方向が見えるよう、velAngle寄りにブレンド
    const target = U.angleLerp(kart.heading, kart.velAngle, 0.45);
    this.angle = U.angleDamp(this.angle, target, C.angDamp, dt);

    // 速度でカメラを引く(スピード感+ブースト時はさらに)
    const spd = Math.abs(kart.speed) / Game.config.physics.maxSpeed;
    const dist = C.dist * (1 + spd * 0.22) + (kart.boostT > 0 ? 0.6 : 0);
    this.updatePos(kart, 1 - Math.exp(-C.posDamp * dt), dist);
    this.camera.position.copy(this.pos);

    // 衝突シェイク
    if (this._shake > 0.001) {
      this.camera.position.x += (Math.random() - 0.5) * this._shake * 0.5;
      this.camera.position.y += (Math.random() - 0.5) * this._shake * 0.35;
      this._shake = Math.max(0, this._shake - dt * 1.6);
    }

    const look = new THREE.Vector3(
      kart.pos.x + Math.sin(this.angle) * C.lookAhead,
      kart.pos.y + C.lookHeight,
      kart.pos.z + Math.cos(this.angle) * C.lookAhead);
    this.camera.lookAt(look);

    // ドリフト時にわずかにロール(疾走感)
    const rollTarget = kart.drift && kart.drift.state === 'drifting' ? -kart.drift.dir * 0.05 : 0;
    this.roll = U.damp(this.roll, rollTarget, 5, dt);
    if (Math.abs(this.roll) > 0.001) this.camera.rotateZ(this.roll);

    const fov = C.fovBase + spd * C.fovSpeed + (kart.boostT > 0 ? C.fovBoost : 0);
    if (Math.abs(this.camera.fov - fov) > 0.05) {
      this.camera.fov = U.damp(this.camera.fov, fov, 6, dt);
      this.camera.updateProjectionMatrix();
    }
  }

  // スタート演出: カウントダウン中、正面からグリッドを見せつつ背後へ回り込む(t: 0→1)
  startSweep(kart, t) {
    const U = Game.U;
    const e = U.clamp(t, 0, 1);
    const s = e * e * (3 - 2 * e); // easeInOut
    const a = kart.heading + Math.PI * (1 - s); // 正面(+heading)→背後
    const dist = 9.5 - s * 2.2;
    const camA = kart.heading + Math.PI - (Math.PI * (1 - s)); // 位置角: 前→後
    this.pos.set(
      kart.pos.x - Math.sin(camA) * dist,
      kart.pos.y + 2.1 + s * 1.3,
      kart.pos.z - Math.cos(camA) * dist);
    this.camera.position.copy(this.pos);
    this.camera.lookAt(kart.pos.x, kart.pos.y + 1.0, kart.pos.z);
    this.angle = kart.heading; // GO直後の通常カメラへ滑らかに接続
    this.initialized = true;
  }

  // ゴール演出: プレイヤーの周りをゆっくり回る
  victoryOrbit(kart, dt) {
    this._orbitA += dt * 0.6;
    const d = 7.2;
    this.camera.position.set(
      kart.pos.x + Math.sin(this._orbitA) * d,
      kart.pos.y + 2.9,
      kart.pos.z + Math.cos(this._orbitA) * d);
    this.camera.lookAt(kart.pos.x, kart.pos.y + 1.0, kart.pos.z);
    if (this.camera.fov !== Game.config.cameraCfg.fovBase) {
      this.camera.fov = Game.config.cameraCfg.fovBase;
      this.camera.updateProjectionMatrix();
    }
  }
};
