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
  }

  snapTo(kart) {
    this.angle = kart.heading;
    this.updatePos(kart, 1);
    this.camera.position.copy(this.pos);
    this.initialized = true;
  }

  updatePos(kart, f) {
    const C = Game.config.cameraCfg;
    const tx = kart.pos.x - Math.sin(this.angle) * C.dist;
    const tz = kart.pos.z - Math.cos(this.angle) * C.dist;
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
    this.updatePos(kart, 1 - Math.exp(-C.posDamp * dt));
    this.camera.position.copy(this.pos);

    const look = new THREE.Vector3(
      kart.pos.x + Math.sin(this.angle) * C.lookAhead,
      kart.pos.y + C.lookHeight,
      kart.pos.z + Math.cos(this.angle) * C.lookAhead);
    this.camera.lookAt(look);

    const spd = Math.abs(kart.speed) / Game.config.physics.maxSpeed;
    const fov = C.fovBase + spd * C.fovSpeed + (kart.boostT > 0 ? C.fovBoost : 0);
    if (Math.abs(this.camera.fov - fov) > 0.05) {
      this.camera.fov = U.damp(this.camera.fov, fov, 6, dt);
      this.camera.updateProjectionMatrix();
    }
  }
};
