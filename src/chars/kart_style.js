// カート外装v3(ロスター刷新Phase7)。kart.js の buildMesh() 冒頭フックから委譲される。
// 目標: 4バリアント巡回をやめ、DESIGN.md「## 2-v3」の9キャラそれぞれに完全専用のカートを与える。
// 共有マテリアル(Game.mats)で質感差を作り、コンセプト(配達バイク/重戦車/ホバー/ソリ/ロイヤル/
// ブレード/ウッドクラシック/忍者/赤ヒーロー)をシルエットレベルで differentiate する。
//
// 契約(kart.jsのupdateVisualが毎フレーム参照/操作。変更禁止):
//   kart.group / kart._tilt / kart._wheels[{pivot,spinner,front}]×4 /
//   kart._flames[] / kart._sparks[]×2 / kart._shadow / 'riderPlaceholder'ノード(y≈0.95, z≈-0.32)
//   kart.color/number/charId が undefined でも安全に動作すること
(function () {
  const KS = {
    // ---- 共通物理寸法(全長≈2.8, 幅≈1.9。riderPlaceholder位置は固定) ----
    bodyLen: 2.3, bodyWid: 1.35, bodyHt: 0.34, bodyY: 0.5,
    riderPos: [0, 0.95, -0.32],
    shadowRadius: 1.5, shadowOpacity: 0.1,
    wheelFrontR: 0.34, wheelFrontW: 0.28, wheelRearR: 0.46, wheelRearW: 0.4,
    wheelFrontX: 0.88, wheelFrontZ: 0.95, wheelRearX: 0.92, wheelRearZ: -0.92,
    hubScale: 0.45,
    engineY: 0.66, engineZ: -1.15,
    numberCanvasSize: 128,
  };

  // ==================== 共通ヘルパ ====================

  function numberTexture(number, accentColor, faceColor) {
    const cv = document.createElement('canvas');
    cv.width = KS.numberCanvasSize; cv.height = KS.numberCanvasSize;
    const cx = cv.getContext('2d');
    const R = KS.numberCanvasSize / 2;
    cx.fillStyle = faceColor || '#ffffff';
    cx.beginPath(); cx.arc(R, R, R - 4, 0, Math.PI * 2); cx.fill();
    cx.lineWidth = 10;
    cx.strokeStyle = '#' + new THREE.Color(accentColor).getHexString();
    cx.beginPath(); cx.arc(R, R, R - 10, 0, Math.PI * 2); cx.stroke();
    cx.fillStyle = '#3a2b32';
    cx.font = 'bold 64px sans-serif';
    cx.textAlign = 'center'; cx.textBaseline = 'middle';
    cx.fillText(String(number ?? 1), R, R + 4);
    return new THREE.CanvasTexture(cv);
  }

  function makeRoundel(number, accentColor, faceColor) {
    const roundel = new THREE.Mesh(new THREE.CircleGeometry(0.3, 20),
      new THREE.MeshBasicMaterial({ map: numberTexture(number, accentColor, faceColor), transparent: true }));
    roundel.position.set(0, 0.68, 1.28);
    roundel.rotation.x = -Math.PI / 2 + 0.12;
    return roundel;
  }

  function makeShadow() {
    const shadow = new THREE.Mesh(new THREE.CircleGeometry(KS.shadowRadius, 20),
      new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: KS.shadowOpacity, depthWrite: false }));
    shadow.rotation.x = -Math.PI / 2;
    shadow.castShadow = false;
    return shadow;
  }

  function makeSparks(tilt) {
    const sparks = [];
    for (const x of [-0.8, 0.8]) {
      const spark = new THREE.Mesh(new THREE.SphereGeometry(0.17, 8, 8),
        new THREE.MeshBasicMaterial({ color: 0x55c8ff }));
      spark.position.set(x, 0.22, -1.15);
      spark.visible = false;
      tilt.add(spark);
      sparks.push(spark);
    }
    return sparks;
  }

  // 通常の丸タイヤ4輪(前細・後太)。戻り値をkart._wheelsへ。
  function makeRoundWheels(tilt, rimMat, rubberMat) {
    const wheels = [];
    const wheelDefs = [
      [-KS.wheelFrontX, KS.wheelFrontZ, true],
      [KS.wheelFrontX, KS.wheelFrontZ, true],
      [-KS.wheelRearX, KS.wheelRearZ, false],
      [KS.wheelRearX, KS.wheelRearZ, false],
    ];
    for (const [x, z, front] of wheelDefs) {
      const r = front ? KS.wheelFrontR : KS.wheelRearR;
      const w = front ? KS.wheelFrontW : KS.wheelRearW;
      const pivot = new THREE.Group();
      pivot.position.set(x, r, z);
      const spinner = new THREE.Group();
      const wheel = new THREE.Mesh(new THREE.CylinderGeometry(r, r, w, 14), rubberMat);
      wheel.rotation.z = Math.PI / 2;
      spinner.add(wheel);
      const hub = new THREE.Mesh(
        new THREE.CylinderGeometry(r * KS.hubScale, r * KS.hubScale, w + 0.04, 10), rimMat);
      hub.rotation.z = Math.PI / 2;
      spinner.add(hub);
      pivot.add(spinner);
      tilt.add(pivot);
      wheels.push({ pivot, spinner, front });
    }
    return wheels;
  }

  // 契約上4つの「ホイール相当」ノードが必要だが見た目はカスタムなケース向け。
  // buildFn(x,z,front) が {pivot,spinner} を返す想定。
  function makeCustomWheels(tilt, positions, buildFn) {
    const wheels = [];
    for (const [x, z, front] of positions) {
      const pivot = new THREE.Group();
      pivot.position.set(x, 0, z);
      const spinner = new THREE.Group();
      buildFn(spinner, x, z, front);
      pivot.add(spinner);
      tilt.add(pivot);
      wheels.push({ pivot, spinner, front });
    }
    return wheels;
  }

  function buildFlamesAt(tilt, positions, kart) {
    kart._flames = [];
    for (const [x, y, z, rotX] of positions) {
      const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.13, 0.5, 10), Game.mats.glow(0xffb060, 0.5));
      pipe.position.set(x, y, z);
      pipe.rotation.x = rotX ?? Math.PI / 2.4;
      tilt.add(pipe);
      const flame = new THREE.Mesh(new THREE.ConeGeometry(0.15, 0.85, 8), Game.mats.glow(0xffa030, 1.6));
      flame.material.transparent = true;
      flame.material.opacity = 0.9;
      flame.position.set(x, y - 0.02, z - 0.43);
      flame.rotation.x = Math.PI / 2;
      flame.visible = false;
      tilt.add(flame);
      kart._flames.push(flame);
    }
  }

  function finalize(kart, g, tilt) {
    const shadow = makeShadow();
    kart._shadow = shadow;
    g.add(shadow);
    if (!kart._sparks) kart._sparks = makeSparks(tilt);
    g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    shadow.castShadow = false;
    kart.group = g;
    kart._tilt = tilt;
    return g;
  }

  function addRider(tilt) {
    const rider = new THREE.Mesh(new THREE.SphereGeometry(0.5, 12, 10),
      new THREE.MeshBasicMaterial({ visible: false }));
    rider.position.set(KS.riderPos[0], KS.riderPos[1], KS.riderPos[2]);
    rider.name = 'riderPlaceholder';
    tilt.add(rider);
    return rider;
  }

  // ==================== キャラ別ビルダー ====================
  // 各ビルダー: (kart, baseColor, accentColor, number) => { g, tilt }
  // 50メッシュ以内、riderPlaceholder位置固定、_wheels×4/_flames/_sparks/_shadow を用意すること。

  // ---- kurumu: 王道の赤いヒーローレーサー(クリーム色ストライプ) ----
  function buildKurumu(kart, baseColor, accentColor, number) {
    const g = new THREE.Group(); const tilt = new THREE.Group(); g.add(tilt);
    const paintMat = Game.mats.paint(baseColor.getHex());
    const creamMat = Game.mats.matte(0xfff3dc);
    const metalMat = Game.mats.metal();
    const rimMat = Game.mats.metal(0xffe08a);
    const rubberMat = Game.mats.rubber();
    const glassMat = Game.mats.glass(0xdff3ff, 0.35);

    const body = new THREE.Mesh(new THREE.BoxGeometry(KS.bodyWid, KS.bodyHt, KS.bodyLen), paintMat);
    body.position.y = KS.bodyY; tilt.add(body);

    const nose = new THREE.Mesh(new THREE.ConeGeometry(0.58, 1.25, 4), paintMat);
    nose.rotation.x = Math.PI / 2; nose.rotation.y = Math.PI / 4;
    nose.position.set(0, 0.52, 1.42);
    tilt.add(nose);

    for (const sx of [-0.82, 0.82]) {
      const pod = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.3, 1.3), paintMat);
      pod.position.set(sx, 0.48, -0.15);
      tilt.add(pod);
    }
    // クリームストライプ(センター+サイド)
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.03, 2.6), creamMat);
    stripe.position.set(0, 0.685, -0.05); tilt.add(stripe);
    const chevron = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.02, 0.3), creamMat);
    chevron.position.set(0, 0.52, 1.55); chevron.rotation.x = 0.5;
    tilt.add(chevron);

    const fWing = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.08, 0.4), creamMat);
    fWing.position.set(0, 0.3, 1.78); tilt.add(fWing);

    tilt.add(makeRoundel(number, 0xd4302f, '#fff3dc'));

    const light = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.08, 0.08), Game.mats.glow(0xfff2b0, 0.9));
    light.position.set(0, 0.5, 1.9); tilt.add(light);

    const seatBack = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.55, 0.16), Game.mats.matte(0x2c2c33));
    seatBack.position.set(0, 0.9, -0.85); tilt.add(seatBack);
    const headrest = new THREE.Mesh(new THREE.SphereGeometry(0.24, 12, 10, 0, Math.PI * 2, 0, Math.PI / 1.6), Game.mats.matte(0x2c2c33));
    headrest.position.set(0, 1.2, -0.9); tilt.add(headrest);
    const column = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.44, 8), metalMat);
    column.position.set(0, 0.82, 0.42); column.rotation.x = 0.9; tilt.add(column);
    const wheelRing = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.05, 8, 14), creamMat);
    wheelRing.position.set(0, 0.98, 0.3); wheelRing.rotation.x = -0.65; tilt.add(wheelRing);
    const windscreen = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.32, 0.05), glassMat);
    windscreen.position.set(0, 1.02, 0.12); windscreen.rotation.x = -0.55; tilt.add(windscreen);

    addRider(tilt);

    const wing = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.08, 0.44), creamMat);
    wing.position.set(0, 1.14, -1.28); tilt.add(wing);
    const strut = new THREE.Mesh(new THREE.BoxGeometry(1.08, 0.34, 0.08), metalMat);
    strut.position.set(0, 0.93, -1.28); tilt.add(strut);

    const engineBlock = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.4, 0.5), metalMat);
    engineBlock.position.set(0, KS.engineY, KS.engineZ + 0.1); tilt.add(engineBlock);
    buildFlamesAt(tilt, [[-0.28, KS.engineY - 0.04, -1.42], [0.28, KS.engineY - 0.04, -1.42]], kart);

    kart._wheels = makeRoundWheels(tilt, rimMat, rubberMat);
    return { g, tilt };
  }

  // ---- rupo: 配達バイク風(後部に小包の荷台、細身で軽快) ----
  function buildRupo(kart, baseColor, accentColor, number) {
    const g = new THREE.Group(); const tilt = new THREE.Group(); g.add(tilt);
    const paintMat = Game.mats.paint(baseColor.getHex());
    const whiteMat = Game.mats.matte(0xfaf6ee);
    const metalMat = Game.mats.metal();
    const rimMat = Game.mats.metal(0xe8e8ea);
    const rubberMat = Game.mats.rubber();

    // 細身シャシー(全幅は共通契約内だが視覚的に絞る)
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.3, 2.1), paintMat);
    body.position.y = 0.48; tilt.add(body);
    const nose = new THREE.Mesh(new THREE.ConeGeometry(0.42, 1.0, 6), paintMat);
    nose.rotation.x = Math.PI / 2; nose.position.set(0, 0.5, 1.35);
    tilt.add(nose);

    // 荷台(後部の小包ボックス)
    const cargo = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.55, 0.7), whiteMat);
    cargo.position.set(0, 0.78, -1.15); tilt.add(cargo);
    const cargoStrap = new THREE.Mesh(new THREE.BoxGeometry(0.94, 0.06, 0.74), accentMat_(accentColor));
    cargoStrap.position.set(0, 0.78, -1.15); tilt.add(cargoStrap);
    const parcel = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.3, 0.4), Game.mats.matte(0xd9a066));
    parcel.position.set(0, 1.18, -1.15); tilt.add(parcel);

    // フェンダー(前後、軽快なバイク感)
    const fenderF = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 0.22, 12, 1, false, 0, Math.PI), paintMat);
    fenderF.rotation.z = Math.PI / 2; fenderF.position.set(0, 0.7, 1.0);
    tilt.add(fenderF);

    tilt.add(makeRoundel(number, accentColor, '#fff9ef'));

    const light = new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 8), Game.mats.glow(0xfff2b0, 0.9));
    light.position.set(0, 0.55, 1.75); tilt.add(light);

    const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.03, 1.8), whiteMat);
    stripe.position.set(0, 0.64, 0.1); tilt.add(stripe);

    // 簡易ハンドル(バイク風、フォーク2本)
    const forkL = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.5, 6), metalMat);
    forkL.position.set(-0.25, 0.85, 0.95); forkL.rotation.x = 0.3; tilt.add(forkL);
    const forkR = forkL.clone(); forkR.position.x = 0.25; tilt.add(forkR);
    const handlebar = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.62, 8), metalMat);
    handlebar.rotation.z = Math.PI / 2; handlebar.position.set(0, 1.05, 0.95);
    tilt.add(handlebar);

    const seat = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.16, 0.7), Game.mats.matte(0x2c2c33));
    seat.position.set(0, 0.72, -0.35); tilt.add(seat);

    addRider(tilt);

    const engineBlock = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.4, 10), metalMat);
    engineBlock.rotation.z = Math.PI / 2;
    engineBlock.position.set(0, 0.5, -0.05); tilt.add(engineBlock);
    buildFlamesAt(tilt, [[0, 0.5, -1.55]], kart);
    // 荷台があるため単一排気(配列長1でもkart._flamesは配列なのでOK)

    // 細身の前後2輪+補助輪相当2輪(契約の4輪を維持しつつ軽快な単車感を出すため小径統一)
    kart._wheels = makeCustomWheels(tilt,
      [[0, 0.95, true], [0, -0.9, false], [-0.05, 0.95, true], [0.05, -0.9, false]],
      (spinner, x, z, front) => {
        const r = front ? 0.32 : 0.34, w = 0.16;
        const wheel = new THREE.Mesh(new THREE.CylinderGeometry(r, r, w, 14), rubberMat);
        wheel.rotation.z = Math.PI / 2; wheel.position.y = r;
        spinner.add(wheel);
        const hub = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.4, r * 0.4, w + 0.03, 8), rimMat);
        hub.rotation.z = Math.PI / 2; hub.position.y = r;
        spinner.add(hub);
      });
    return { g, tilt };
  }
  function accentMat_(accentColor) { return Game.mats.paint(accentColor.getHex ? accentColor.getHex() : accentColor); }

  // ---- donga: 岩塊装甲の重戦車カート(極太タイヤ、前面ラム板、ひび発光) ----
  function buildDonga(kart, baseColor, accentColor, number) {
    const g = new THREE.Group(); const tilt = new THREE.Group(); g.add(tilt);
    const rockMat = Game.mats.matte(baseColor.getHex());
    const rockDarkMat = Game.mats.matte(accentColor.getHex());
    const metalMat = Game.mats.metal(0x8a8f98);
    const rubberMat = Game.mats.rubber(0x1b1b1f);
    const rimMat = Game.mats.metal(0x6b6f78);
    const lavaMat = Game.mats.glow(0xff6a2e, 1.6);

    // 太く低い岩装甲ボディ
    const body = new THREE.Mesh(new THREE.BoxGeometry(1.75, 0.5, 2.1), rockMat);
    body.position.y = 0.5; tilt.add(body);
    // 岩の凹凸(側面ブロック2個)
    for (const sx of [-0.95, 0.95]) {
      const chunk = new THREE.Mesh(new THREE.DodecahedronGeometry(0.32, 0), rockDarkMat);
      chunk.position.set(sx, 0.62, 0.1); tilt.add(chunk);
    }
    // 前面ラム板(押し合い用の分厚い装甲)
    const ram = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.7, 0.35), metalMat);
    ram.position.set(0, 0.5, 1.55); tilt.add(ram);
    const ramRivet = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.06, 0.06), lavaMat);
    ramRivet.position.set(0, 0.5, 1.73); tilt.add(ramRivet);

    // ひび割れ発光ライン(センター+側面)
    const crack = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.06, 2.0), lavaMat);
    crack.position.set(0, 0.76, -0.1); tilt.add(crack);
    const crackSide = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.35, 0.08), lavaMat);
    crackSide.position.set(0.9, 0.5, -0.6); crackSide.rotation.z = 0.4; tilt.add(crackSide);

    tilt.add(makeRoundel(number, 0xff6a2e, '#e7e2da'));

    const seatBack = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.6, 0.22), rockDarkMat);
    seatBack.position.set(0, 0.95, -0.85); tilt.add(seatBack);
    const column = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.4, 8), metalMat);
    column.position.set(0, 0.85, 0.4); column.rotation.x = 0.9; tilt.add(column);
    const wheelRing = new THREE.Mesh(new THREE.TorusGeometry(0.18, 0.055, 8, 14), metalMat);
    wheelRing.position.set(0, 1.0, 0.3); wheelRing.rotation.x = -0.65; tilt.add(wheelRing);

    addRider(tilt);

    // リア: 岩の背もたれウィング代わりの巨大岩塊
    const rearRock = new THREE.Mesh(new THREE.IcosahedronGeometry(0.4, 0), rockMat);
    rearRock.position.set(0, 1.1, -1.25); tilt.add(rearRock);

    const engineBlock = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.4, 0.4), metalMat);
    engineBlock.position.set(0, KS.engineY, KS.engineZ); tilt.add(engineBlock);
    buildFlamesAt(tilt, [[-0.35, KS.engineY - 0.04, -1.42], [0.35, KS.engineY - 0.04, -1.42]], kart);

    // 極太タイヤ(前後とも大径・幅広)
    kart._wheels = makeCustomWheels(tilt,
      [[-0.95, 0.85, true], [0.95, 0.85, true], [-0.98, -0.85, false], [0.98, -0.85, false]],
      (spinner, x, z, front) => {
        const r = 0.5, w = 0.55;
        const wheel = new THREE.Mesh(new THREE.CylinderGeometry(r, r, w, 12), rubberMat);
        wheel.rotation.z = Math.PI / 2; wheel.position.y = r;
        spinner.add(wheel);
        const hub = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.4, r * 0.4, w + 0.05, 8), rimMat);
        hub.rotation.z = Math.PI / 2; hub.position.y = r;
        spinner.add(hub);
      });
    return { g, tilt };
  }

  // ---- volt8: ホバー風一体型マシン(車輪の代わりに発光ホイールコア+スラスター) ----
  function buildVolt8(kart, baseColor, accentColor, number) {
    const g = new THREE.Group(); const tilt = new THREE.Group(); g.add(tilt);
    const metalMat = Game.mats.metal(0xc7cdd6);
    const darkMetalMat = Game.mats.metal(0x565a63);
    const cyanGlow = Game.mats.glow(0x5be8ff, 1.5);
    const cyanGlowSoft = Game.mats.glow(0x5be8ff, 0.7);

    // 一体型シャシー(下半身融合なので車体自体が滑らかな流線)
    const body = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.32, 2.2), metalMat);
    body.position.y = 0.5; tilt.add(body);
    const noseCanopy = new THREE.Mesh(new THREE.ConeGeometry(0.5, 1.1, 8), metalMat);
    noseCanopy.rotation.x = Math.PI / 2; noseCanopy.position.set(0, 0.55, 1.35);
    tilt.add(noseCanopy);
    // サイドスラスターハウジング
    for (const sx of [-0.8, 0.8]) {
      const pod = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.24, 1.3, 10), darkMetalMat);
      pod.rotation.x = Math.PI / 2; pod.position.set(sx, 0.42, -0.1);
      tilt.add(pod);
    }

    tilt.add(makeRoundel(number, 0x5be8ff, '#eef6ff'));

    const light = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.06, 0.06), cyanGlow);
    light.position.set(0, 0.52, 1.85); tilt.add(light);
    const antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.5, 6), darkMetalMat);
    antenna.position.set(0.15, 1.35, -0.6); tilt.add(antenna);
    const antennaTip = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), cyanGlow);
    antennaTip.position.set(0.15, 1.6, -0.6); tilt.add(antennaTip);

    const seatBack = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.5, 0.16), darkMetalMat);
    seatBack.position.set(0, 0.88, -0.85); tilt.add(seatBack);
    const column = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.4, 8), metalMat);
    column.position.set(0, 0.8, 0.4); column.rotation.x = 0.9; tilt.add(column);
    const wheelRing = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.045, 8, 14), cyanGlowSoft);
    wheelRing.position.set(0, 0.96, 0.3); wheelRing.rotation.x = -0.65; tilt.add(wheelRing);

    addRider(tilt);

    // リアフィン(翼の代わりに機械的なフィン)
    const fin = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.5, 0.1), darkMetalMat);
    fin.position.set(0, 1.0, -1.25); tilt.add(fin);
    const finGlow = new THREE.Mesh(new THREE.BoxGeometry(1.32, 0.06, 0.11), cyanGlow);
    finGlow.position.set(0, 0.8, -1.25); tilt.add(finGlow);

    // 車体下スラスターglow(ホバー浮遊の演出)
    const thruster = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.6, 0.12, 16), cyanGlowSoft);
    thruster.position.set(0, 0.12, -0.1); tilt.add(thruster);

    buildFlamesAt(tilt, [[-0.3, 0.5, -1.42], [0.3, 0.5, -1.42]], kart);

    // 「車輪」= 発光コア球+リングを4隅に配置(spinnerが回ると光が回る)
    kart._wheels = makeCustomWheels(tilt,
      [[-KS.wheelFrontX, KS.wheelFrontZ, true], [KS.wheelFrontX, KS.wheelFrontZ, true],
       [-KS.wheelRearX, KS.wheelRearZ, false], [KS.wheelRearX, KS.wheelRearZ, false]],
      (spinner, x, z, front) => {
        const r = front ? 0.3 : 0.36;
        const core = new THREE.Mesh(new THREE.SphereGeometry(r * 0.5, 10, 8), cyanGlow);
        core.position.y = r;
        spinner.add(core);
        const ring = new THREE.Mesh(new THREE.TorusGeometry(r * 0.7, 0.05, 8, 12), cyanGlowSoft);
        ring.rotation.y = Math.PI / 2; ring.position.y = r;
        spinner.add(ring);
      });
    return { g, tilt };
  }

  // ---- shizuku: 魔法のソリ型(クリスタル製、車輪=光のリング) ----
  function buildShizuku(kart, baseColor, accentColor, number) {
    const g = new THREE.Group(); const tilt = new THREE.Group(); g.add(tilt);
    const glassMat = Game.mats.glass(baseColor.getHex(), 0.5);
    const glassAccentMat = Game.mats.glass(0xffffff, 0.65);
    const metalMat = Game.mats.metal(0xd8e8ff);
    const iridescentGlow = Game.mats.glow(0xb6f0ff, 1.2);

    // クリスタルボディ(半透明ガラス質)
    const body = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.4, 2.15), glassMat);
    body.position.y = 0.52; tilt.add(body);
    const noseCrystal = new THREE.Mesh(new THREE.ConeGeometry(0.5, 1.2, 6), glassMat);
    noseCrystal.rotation.x = Math.PI / 2; noseCrystal.position.set(0, 0.55, 1.4);
    tilt.add(noseCrystal);
    // 側面の氷結晶飾り
    for (const sx of [-0.7, 0.7]) {
      const shard = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.5, 5), glassAccentMat);
      shard.position.set(sx, 0.75, -0.2); shard.rotation.z = Math.sign(sx) * 0.4;
      tilt.add(shard);
    }

    tilt.add(makeRoundel(number, 0x6fd8ff, '#f2fbff'));

    const light = new THREE.Mesh(new THREE.SphereGeometry(0.1, 10, 8), iridescentGlow);
    light.position.set(0, 0.58, 1.9); tilt.add(light);

    const seatBack = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.5, 0.14), glassAccentMat);
    seatBack.position.set(0, 0.9, -0.8); tilt.add(seatBack);
    const column = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.4, 8), metalMat);
    column.position.set(0, 0.82, 0.4); column.rotation.x = 0.9; tilt.add(column);
    const wheelRing = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.045, 8, 14), iridescentGlow);
    wheelRing.position.set(0, 0.98, 0.3); wheelRing.rotation.x = -0.65; tilt.add(wheelRing);

    addRider(tilt);

    // 背もたれ後方の結晶ウィング
    const wing = new THREE.Mesh(new THREE.ConeGeometry(0.5, 0.9, 5), glassMat);
    wing.rotation.x = Math.PI / 2; wing.rotation.z = Math.PI;
    wing.position.set(0, 1.05, -1.15); tilt.add(wing);

    // ソリ足(左右の細長い滑走レール、車体下)
    for (const sx of [-0.55, 0.55]) {
      const rail = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 2.6, 8), metalMat);
      rail.rotation.z = Math.PI / 2; rail.position.set(sx, 0.12, -0.1);
      tilt.add(rail);
      const railTip = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.035, 6, 10, Math.PI), metalMat);
      railTip.position.set(sx, 0.12, 1.35); railTip.rotation.y = Math.PI / 2;
      tilt.add(railTip);
    }

    buildFlamesAt(tilt, [[0, 0.4, -1.45]], kart);

    // 車輪=光のリング(glowトーラス)。ソリ足の位置に合わせて4基配置
    kart._wheels = makeCustomWheels(tilt,
      [[-KS.wheelFrontX, KS.wheelFrontZ, true], [KS.wheelFrontX, KS.wheelFrontZ, true],
       [-KS.wheelRearX, KS.wheelRearZ, false], [KS.wheelRearX, KS.wheelRearZ, false]],
      (spinner, x, z, front) => {
        const r = front ? 0.28 : 0.32;
        const ring = new THREE.Mesh(new THREE.TorusGeometry(r, 0.06, 8, 14), iridescentGlow);
        ring.rotation.y = Math.PI / 2; ring.position.y = r * 0.6;
        spinner.add(ring);
      });
    return { g, tilt };
  }

  // ---- gumiras: ロイヤルカート(金装飾、玉座風シート、小さな旗) ----
  function buildGumiras(kart, baseColor, accentColor, number) {
    const g = new THREE.Group(); const tilt = new THREE.Group(); g.add(tilt);
    const paintMat = Game.mats.paint(baseColor.getHex());
    const goldMat = Game.mats.metal(0xe8c14d);
    const velvetMat = Game.mats.matte(0x6a2740);
    const rubberMat = Game.mats.rubber();

    // 恰幅よく重厚なボディ(幅広)
    const body = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.42, 2.15), paintMat);
    body.position.y = 0.5; tilt.add(body);
    const nose = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.32, 0.9), paintMat);
    nose.position.set(0, 0.54, 1.4); tilt.add(nose);
    // 金の縁取り(車体外周ライン)
    const trim = new THREE.Mesh(new THREE.BoxGeometry(1.64, 0.06, 2.2), goldMat);
    trim.position.set(0, 0.71, -0.05); tilt.add(trim);
    const frontTrim = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.24, 8), goldMat);
    frontTrim.rotation.z = Math.PI / 2; frontTrim.position.set(0, 0.7, 1.4);
    tilt.add(frontTrim);

    tilt.add(makeRoundel(number, 0xe8c14d, '#f4e6c9'));

    const light = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.08, 0.08), Game.mats.glow(0xfff2b0, 0.9));
    light.position.set(0, 0.5, 1.87); tilt.add(light);

    // 玉座風シート(高い背もたれ+アームレスト)
    const throneBack = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.75, 0.18), velvetMat);
    throneBack.position.set(0, 1.0, -0.85); tilt.add(throneBack);
    const throneTop = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8, 0, Math.PI * 2, 0, Math.PI / 2), goldMat);
    throneTop.position.set(0, 1.4, -0.85); tilt.add(throneTop);
    for (const sx of [-0.42, 0.42]) {
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.3, 0.5), goldMat);
      arm.position.set(sx, 0.82, -0.5); tilt.add(arm);
    }
    const column = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.4, 8), goldMat);
    column.position.set(0, 0.85, 0.4); column.rotation.x = 0.9; tilt.add(column);
    const wheelRing = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.05, 8, 14), goldMat);
    wheelRing.position.set(0, 1.0, 0.3); wheelRing.rotation.x = -0.65; tilt.add(wheelRing);

    addRider(tilt);

    // 小さな旗(リア、布のマット質感)
    const flagPole = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.9, 6), goldMat);
    flagPole.position.set(0.55, 1.15, -1.2); tilt.add(flagPole);
    const flag = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.24, 0.02), velvetMat);
    flag.position.set(0.73, 1.45, -1.2); tilt.add(flag);

    const engineBlock = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.36, 0.4), goldMat);
    engineBlock.position.set(0, KS.engineY - 0.05, KS.engineZ); tilt.add(engineBlock);
    buildFlamesAt(tilt, [[-0.3, KS.engineY - 0.08, -1.4], [0.3, KS.engineY - 0.08, -1.4]], kart);

    kart._wheels = makeCustomWheels(tilt,
      [[-KS.wheelFrontX, KS.wheelFrontZ, true], [KS.wheelFrontX, KS.wheelFrontZ, true],
       [-KS.wheelRearX, KS.wheelRearZ, false], [KS.wheelRearX, KS.wheelRearZ, false]],
      (spinner, x, z, front) => {
        const r = front ? KS.wheelFrontR : KS.wheelRearR;
        const w = front ? KS.wheelFrontW : KS.wheelRearW;
        const wheel = new THREE.Mesh(new THREE.CylinderGeometry(r, r, w, 14), rubberMat);
        wheel.rotation.z = Math.PI / 2; wheel.position.y = r;
        spinner.add(wheel);
        const hub = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.45, r * 0.45, w + 0.04, 10), goldMat);
        hub.rotation.z = Math.PI / 2; hub.position.y = r;
        spinner.add(hub);
      });
    return { g, tilt };
  }

  // ---- noir: 黒×赤のブレードマシン(鋭角ノーズ、赤い発光ライン) ----
  function buildNoir(kart, baseColor, accentColor, number) {
    const g = new THREE.Group(); const tilt = new THREE.Group(); g.add(tilt);
    const blackMat = Game.mats.matte(0x18181c);
    const metalMat = Game.mats.metal(0x2a2a30);
    const redGlow = Game.mats.glow(0xff2138, 1.5);
    const rubberMat = Game.mats.rubber();
    const rimMat = Game.mats.metal(0x3a1418);

    // 低く鋭い車体
    const body = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.28, 2.25), blackMat);
    body.position.y = 0.46; tilt.add(body);
    // 鋭角ノーズ(細長い刃状)
    const nose = new THREE.Mesh(new THREE.ConeGeometry(0.4, 1.5, 4), blackMat);
    nose.rotation.x = Math.PI / 2; nose.rotation.y = Math.PI / 4;
    nose.position.set(0, 0.46, 1.55); tilt.add(nose);
    // サイドブレード(側面の刃状パネル)
    for (const sx of [-0.78, 0.78]) {
      const blade = new THREE.Mesh(new THREE.ConeGeometry(0.18, 1.4, 3), blackMat);
      blade.rotation.x = Math.PI / 2; blade.rotation.z = Math.sign(sx) * 0.15;
      blade.position.set(sx, 0.42, -0.1);
      tilt.add(blade);
    }

    tilt.add(makeRoundel(number, 0xff2138, '#1c1c20'));

    // 赤い発光ライン(センター+ノーズ)
    const lineC = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.03, 2.2), redGlow);
    lineC.position.set(0, 0.62, -0.05); tilt.add(lineC);
    const eyeLight = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.05, 0.05), redGlow);
    eyeLight.position.set(0, 0.5, 1.95); tilt.add(eyeLight);

    const seatBack = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.5, 0.14), blackMat);
    seatBack.position.set(0, 0.86, -0.82); tilt.add(seatBack);
    const column = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.4, 8), metalMat);
    column.position.set(0, 0.8, 0.4); column.rotation.x = 0.9; tilt.add(column);
    const wheelRing = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.045, 8, 14), redGlow);
    wheelRing.position.set(0, 0.96, 0.3); wheelRing.rotation.x = -0.65; tilt.add(wheelRing);

    addRider(tilt);

    // リアブレードウィング(鋭角三角形2枚)
    for (const sx of [-0.45, 0.45]) {
      const finBlade = new THREE.Mesh(new THREE.ConeGeometry(0.32, 0.9, 3), blackMat);
      finBlade.rotation.x = -Math.PI / 2; finBlade.rotation.z = Math.PI / 6 * Math.sign(sx);
      finBlade.position.set(sx, 1.05, -1.25);
      tilt.add(finBlade);
    }
    const wingGlow = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.04, 0.08), redGlow);
    wingGlow.position.set(0, 0.85, -1.28); tilt.add(wingGlow);

    const engineBlock = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.36, 0.45), metalMat);
    engineBlock.position.set(0, KS.engineY - 0.05, KS.engineZ); tilt.add(engineBlock);
    buildFlamesAt(tilt, [[-0.28, KS.engineY - 0.08, -1.42], [0.28, KS.engineY - 0.08, -1.42]], kart);

    kart._wheels = makeRoundWheels(tilt, rimMat, rubberMat);
    return { g, tilt };
  }

  // ---- baumjii: ウッド調クラシックカー(真鍮パーツ、丸型ヘッドライト) ----
  function buildBaumjii(kart, baseColor, accentColor, number) {
    const g = new THREE.Group(); const tilt = new THREE.Group(); g.add(tilt);
    const woodMat = Game.mats.matte(baseColor.getHex());
    const woodDarkMat = Game.mats.matte(accentColor.getHex());
    const brassMat = Game.mats.metal(0xc99a44);
    const rubberMat = Game.mats.rubber();
    const glassMat = Game.mats.glass(0xfff6dd, 0.4);

    // クラシックな縦長・丸みのあるボディ
    const body = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.4, 2.25), woodMat);
    body.position.y = 0.5; tilt.add(body);
    const hood = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.55, 1.1, 10, 1, false, 0, Math.PI), woodMat);
    hood.rotation.z = Math.PI / 2; hood.rotation.y = Math.PI / 2;
    hood.position.set(0, 0.62, 1.1); tilt.add(hood);
    // 木目パネルライン(年輪感の帯を側面に)
    const grain = new THREE.Mesh(new THREE.BoxGeometry(1.32, 0.05, 2.2), woodDarkMat);
    grain.position.set(0, 0.68, -0.05); tilt.add(grain);

    // 丸型ヘッドライト2灯(真鍮フレーム)
    for (const sx of [-0.35, 0.35]) {
      const rim = new THREE.Mesh(new THREE.TorusGeometry(0.14, 0.03, 8, 14), brassMat);
      rim.position.set(sx, 0.62, 1.75); tilt.add(rim);
      const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.11, 10, 8), Game.mats.glow(0xfff2b0, 0.9));
      lamp.position.set(sx, 0.62, 1.76); tilt.add(lamp);
    }

    tilt.add(makeRoundel(number, 0xc99a44, '#f6ecd6'));

    // 真鍮パイプフレーム(前後を縁取り)
    const frontBumper = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.3, 8), brassMat);
    frontBumper.rotation.z = Math.PI / 2; frontBumper.position.set(0, 0.34, 1.55);
    tilt.add(frontBumper);

    const seatBack = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.55, 0.18), woodDarkMat);
    seatBack.position.set(0, 0.92, -0.85); tilt.add(seatBack);
    const column = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.42, 8), brassMat);
    column.position.set(0, 0.84, 0.4); column.rotation.x = 0.9; tilt.add(column);
    const wheelRing = new THREE.Mesh(new THREE.TorusGeometry(0.19, 0.04, 8, 14), brassMat);
    wheelRing.position.set(0, 1.0, 0.3); wheelRing.rotation.x = -0.65; tilt.add(wheelRing);
    const windscreen = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.3, 0.05), glassMat);
    windscreen.position.set(0, 1.04, 0.15); windscreen.rotation.x = -0.55; tilt.add(windscreen);

    addRider(tilt);

    // トランク風リア(ウィングの代わりに角丸ボックス+真鍮ラック)
    const trunk = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.4, 0.5), woodMat);
    trunk.position.set(0, 0.86, -1.15); tilt.add(trunk);
    const rack = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.04, 0.4), brassMat);
    rack.position.set(0, 1.08, -1.15); tilt.add(rack);

    const engineBlock = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.45, 10), brassMat);
    engineBlock.rotation.z = Math.PI / 2;
    engineBlock.position.set(0, KS.engineY - 0.08, KS.engineZ + 0.15); tilt.add(engineBlock);
    buildFlamesAt(tilt, [[-0.3, KS.engineY - 0.1, -1.4], [0.3, KS.engineY - 0.1, -1.4]], kart);

    kart._wheels = makeCustomWheels(tilt,
      [[-KS.wheelFrontX, KS.wheelFrontZ, true], [KS.wheelFrontX, KS.wheelFrontZ, true],
       [-KS.wheelRearX, KS.wheelRearZ, false], [KS.wheelRearX, KS.wheelRearZ, false]],
      (spinner, x, z, front) => {
        const r = front ? KS.wheelFrontR : KS.wheelRearR;
        const w = front ? KS.wheelFrontW : KS.wheelRearW;
        const wheel = new THREE.Mesh(new THREE.CylinderGeometry(r, r, w, 16), rubberMat);
        wheel.rotation.z = Math.PI / 2; wheel.position.y = r;
        spinner.add(wheel);
        const hub = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.5, r * 0.5, w + 0.05, 12), brassMat);
        hub.rotation.z = Math.PI / 2; hub.position.y = r;
        spinner.add(hub);
        // 木製クラシックホイールのスポーク(真鍮の細い十字)
        const spoke = new THREE.Mesh(new THREE.BoxGeometry(w * 0.8, r * 1.5, 0.03), brassMat);
        spoke.rotation.z = Math.PI / 2; spoke.position.y = r;
        spinner.add(spoke);
      });
    return { g, tilt };
  }

  // ---- ginja: 忍者マシン(低く平たい、手裏剣風リム、ミントの排気) ----
  function buildGinja(kart, baseColor, accentColor, number) {
    const g = new THREE.Group(); const tilt = new THREE.Group(); g.add(tilt);
    const paintMat = Game.mats.paint(baseColor.getHex());
    const whiteMat = Game.mats.matte(0xf4f0e8);
    const mintMat = Game.mats.matte(accentColor.getHex());
    const mintGlow = Game.mats.glow(0x8fe8c8, 1.2);
    const metalMat = Game.mats.metal(0x555a5f);
    const rubberMat = Game.mats.rubber();

    // 低く平たい車体
    const body = new THREE.Mesh(new THREE.BoxGeometry(1.35, 0.22, 2.3), paintMat);
    body.position.y = 0.34; tilt.add(body);
    const nose = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.16, 0.9), paintMat);
    nose.position.set(0, 0.34, 1.5); nose.rotation.x = 0.1; tilt.add(nose);
    // ミントの帯(側面ストライプ)
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(1.37, 0.06, 2.35), mintMat);
    stripe.position.set(0, 0.42, -0.02); tilt.add(stripe);
    const whiteBand = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.04, 2.3), whiteMat);
    whiteBand.position.set(0, 0.46, -0.02); tilt.add(whiteBand);

    tilt.add(makeRoundel(number, 0x8fe8c8, '#2c231f'));

    const light = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.05, 0.05), mintGlow);
    light.position.set(0, 0.36, 1.94); tilt.add(light);

    // 低いシート(忍者の伏せ姿勢に合わせて背もたれも低め)
    const seatBack = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.34, 0.14), Game.mats.matte(0x22201e));
    seatBack.position.set(0, 0.62, -0.8); tilt.add(seatBack);
    const column = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.34, 8), metalMat);
    column.position.set(0, 0.58, 0.4); column.rotation.x = 0.9; tilt.add(column);
    // 手裏剣風ステアリング(4枚羽根の薄い十字)
    const shurikenHub = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.03, 4), metalMat);
    shurikenHub.rotation.x = -0.65; shurikenHub.rotation.y = Math.PI / 4;
    shurikenHub.position.set(0, 0.74, 0.28); tilt.add(shurikenHub);

    addRider(tilt);

    // リア: 低い小型フィン+ミントの排気口
    const fin = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.22, 0.06), mintMat);
    fin.position.set(0, 0.55, -1.22); tilt.add(fin);

    const engineBlock = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.24, 0.4), metalMat);
    engineBlock.position.set(0, 0.36, -1.1); tilt.add(engineBlock);
    // ミントの排気(発光色をミントに変更)
    kart._flames = [];
    for (const x of [-0.3, 0.3]) {
      const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 0.4, 10), Game.mats.glow(0x8fe8c8, 0.6));
      pipe.position.set(x, 0.3, -1.42); pipe.rotation.x = Math.PI / 2.4;
      tilt.add(pipe);
      const flame = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.7, 8), Game.mats.glow(0x8fe8c8, 1.6));
      flame.material.transparent = true; flame.material.opacity = 0.85;
      flame.position.set(x, 0.28, -1.8); flame.rotation.x = Math.PI / 2;
      flame.visible = false; tilt.add(flame);
      kart._flames.push(flame);
    }

    // 手裏剣風リム(スポークを星型に)
    kart._wheels = makeCustomWheels(tilt,
      [[-KS.wheelFrontX, 0.85, true], [KS.wheelFrontX, 0.85, true],
       [-KS.wheelRearX, KS.wheelRearZ, false], [KS.wheelRearX, KS.wheelRearZ, false]],
      (spinner, x, z, front) => {
        const r = front ? 0.3 : 0.36, w = front ? 0.22 : 0.26;
        const wheel = new THREE.Mesh(new THREE.CylinderGeometry(r, r, w, 14), rubberMat);
        wheel.rotation.z = Math.PI / 2; wheel.position.y = r;
        spinner.add(wheel);
        const star = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.75, r * 0.75, w + 0.03, 4), metalMat);
        star.rotation.z = Math.PI / 2; star.rotation.x = Math.PI / 4; star.position.y = r;
        spinner.add(star);
      });
    return { g, tilt };
  }

  // ---- フォールバック(現行classicベース。未知/undefined charId向け) ----
  function buildClassic(kart, baseColor, accentColor, number) {
    const g = new THREE.Group(); const tilt = new THREE.Group(); g.add(tilt);
    const paintMat = Game.mats.paint(baseColor.getHex());
    const accentPaintMat = Game.mats.paint(accentColor.getHex());
    const metalMat = Game.mats.metal();
    const rimMat = Game.mats.metal(0xf2c94c);
    const matteMat = Game.mats.matte(0x2c2c33);
    const rubberMat = Game.mats.rubber();
    const glassMat = Game.mats.glass(0xdff3ff, 0.35);

    const body = new THREE.Mesh(new THREE.BoxGeometry(KS.bodyWid, KS.bodyHt, KS.bodyLen), paintMat);
    body.position.y = KS.bodyY; tilt.add(body);

    const frame = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, KS.bodyLen + 0.3, 6), metalMat);
    frame.rotation.x = Math.PI / 2; frame.position.set(0, KS.bodyY - KS.bodyHt / 2, 0);
    tilt.add(frame);

    const nose = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.26, 1.05), paintMat);
    nose.position.set(0, 0.52, 1.35); nose.rotation.x = 0.12; tilt.add(nose);

    for (const sx of [-0.82, 0.82]) {
      const pod = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.3, 1.3), accentPaintMat);
      pod.position.set(sx, 0.48, -0.15); tilt.add(pod);
    }
    const splitter = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.045, 0.5), metalMat);
    splitter.position.set(0, 0.2, 1.7); tilt.add(splitter);
    const fWing = new THREE.Mesh(new THREE.BoxGeometry(1.99, 0.09, 0.44), metalMat);
    fWing.position.set(0, 0.3, 1.78); tilt.add(fWing);

    tilt.add(makeRoundel(number, accentColor.getHex(), '#ffffff'));

    const light = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.08, 0.08), Game.mats.glow(0xfff2b0, 0.9));
    light.position.set(0, 0.5, 1.85); tilt.add(light);
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.03, 2.2), Game.mats.matte(0xfff6ee));
    stripe.position.set(0, 0.685, -0.1); tilt.add(stripe);

    const seatBack = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.55, 0.16), matteMat);
    seatBack.position.set(0, 0.9, -0.85); tilt.add(seatBack);
    const headrest = new THREE.Mesh(new THREE.SphereGeometry(0.24, 12, 10, 0, Math.PI * 2, 0, Math.PI / 1.6), matteMat);
    headrest.position.set(0, 1.2, -0.9); tilt.add(headrest);
    const column = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.44, 8), metalMat);
    column.position.set(0, 0.82, 0.42); column.rotation.x = 0.9; tilt.add(column);
    const wheelRing = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.05, 8, 14), matteMat);
    wheelRing.position.set(0, 0.98, 0.3); wheelRing.rotation.x = -0.65; tilt.add(wheelRing);
    const windscreen = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.32, 0.05), glassMat);
    windscreen.position.set(0, 1.02, 0.12); windscreen.rotation.x = -0.55; tilt.add(windscreen);

    addRider(tilt);

    const wing = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.08, 0.44), accentPaintMat);
    wing.position.set(0, 1.14, -1.28); tilt.add(wing);
    const strut = new THREE.Mesh(new THREE.BoxGeometry(1.08, 0.34, 0.08), metalMat);
    strut.position.set(0, 0.93, -1.28); tilt.add(strut);

    const engineBlock = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.4, 0.5), metalMat);
    engineBlock.position.set(0, KS.engineY, KS.engineZ + 0.1); tilt.add(engineBlock);
    buildFlamesAt(tilt, [[-0.28, KS.engineY - 0.04, -1.42], [0.28, KS.engineY - 0.04, -1.42]], kart);

    kart._wheels = makeRoundWheels(tilt, rimMat, rubberMat);
    return { g, tilt };
  }

  const BUILDERS = {
    kurumu: buildKurumu,
    rupo: buildRupo,
    donga: buildDonga,
    volt8: buildVolt8,
    shizuku: buildShizuku,
    gumiras: buildGumiras,
    noir: buildNoir,
    baumjii: buildBaumjii,
    ginja: buildGinja,
  };

  function buildMesh(kart) {
    const color = kart.color ?? 0xff8fb0;
    const number = kart.number ?? 1;
    const baseColor = new THREE.Color(color);
    const accentColor = baseColor.clone().multiplyScalar(0.55);

    const builder = BUILDERS[kart.charId] || buildClassic;
    const { g, tilt } = builder(kart, baseColor, accentColor, number);

    return finalize(kart, g, tilt);
  }

  window.Game = window.Game || {};
  window.Game.kartStyle = { buildMesh, KS };
})();
