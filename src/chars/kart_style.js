// カート外装v2(プレミアム化)。kart.js の buildMesh() 冒頭フックから委譲される。
// 目標: 「箱」から「プレミアムなレーシングマシン」へ。共有マテリアル(Game.mats)で質感差を作る。
// 契約(kart.jsのupdateVisualが毎フレーム参照/操作):
//   kart.group / kart._tilt / kart._wheels[{pivot,spinner,front}]×4 /
//   kart._flames[] / kart._sparks[]×2 / kart._shadow / 'riderPlaceholder'ノード
(function () {
  const KS = {
    // ---- 定数(マジックナンバー禁止: ここに集約) ----
    bodyLen: 2.3, bodyWid: 1.35, bodyHt: 0.34, bodyY: 0.5,
    noseWid: 0.95, noseHt: 0.26, noseLen: 1.05, noseY: 0.52, noseZ: 1.35, noseTilt: 0.12,
    podWid: 0.34, podHt: 0.3, podLen: 1.3, podX: 0.82, podY: 0.48, podZ: -0.15,
    frameR: 0.045,
    seatBackHt: 0.55, seatBackWid: 0.72, seatBackThick: 0.16,
    headrestR: 0.24,
    wheelFrontR: 0.34, wheelFrontW: 0.28, wheelRearR: 0.46, wheelRearW: 0.4,
    wheelFrontX: 0.88, wheelFrontZ: 0.95, wheelRearX: 0.92, wheelRearZ: -0.92,
    hubScale: 0.45,
    riderPos: [0, 0.95, -0.32],
    shadowRadius: 1.5, shadowOpacity: 0.1,
    engineY: 0.66, engineZ: -1.15,
    numberCanvasSize: 128,

    // 4バリアント(charIdをロスター順indexで割り当て、ウィング形状/ノズル数/リム色/ノーズ形状を差別化)
    variants: [
      { name: 'classic', nozzles: 2, wingStyle: 'flat', noseStyle: 'wedge', rim: 0xf2c94c },
      { name: 'aero', nozzles: 3, wingStyle: 'split', noseStyle: 'sharp', rim: 0xe0e4ea },
      { name: 'brute', nozzles: 2, wingStyle: 'high', noseStyle: 'blunt', rim: 0xd9673a },
      { name: 'stinger', nozzles: 3, wingStyle: 'twin', noseStyle: 'fang', rim: 0x7fd6ff },
    ],
    // ロスター順(characters.js定義順)に対応する4バリアントの割り当て(巡回)
    rosterOrder: ['macaron', 'donut', 'taplin', 'sofukurin', 'sodaShuwari', 'waffle', 'chocolat', 'baum', 'bonbon'],
  };

  function pickVariant(kart) {
    const idx = KS.rosterOrder.indexOf(kart.charId);
    const i = idx >= 0 ? idx % KS.variants.length : (Math.abs(hashStr(kart.charId || 'x')) % KS.variants.length);
    return KS.variants[i];
  }
  function hashStr(s) {
    let h = 0;
    for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
    return h;
  }

  function numberTexture(number, accentColor) {
    const cv = document.createElement('canvas');
    cv.width = KS.numberCanvasSize; cv.height = KS.numberCanvasSize;
    const cx = cv.getContext('2d');
    const R = KS.numberCanvasSize / 2;
    cx.fillStyle = '#ffffff';
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

  function buildMesh(kart) {
    const color = kart.color ?? 0xff8fb0;
    const number = kart.number ?? 1;
    const variant = pickVariant(kart);
    const baseColor = new THREE.Color(color);
    const accentColor = baseColor.clone().multiplyScalar(0.55);

    const g = new THREE.Group();
    const tilt = new THREE.Group();
    g.add(tilt);

    // 共有マテリアル(このカート専用インスタンス。色はkart.color依存のため共有プールは使わない)
    const paintMat = Game.mats.paint(baseColor.getHex());
    const accentMat = Game.mats.paint(accentColor.getHex());
    const metalMat = Game.mats.metal();
    const rimMat = Game.mats.metal(variant.rim);
    const matteMat = Game.mats.matte(0x2c2c33);
    const rubberMat = Game.mats.rubber();
    const glassMat = Game.mats.glass(0xdff3ff, 0.35);

    // ---- シャシー本体(レイヤー: メイン塗装 + アクセントパネル + 金属フレーム) ----
    const body = new THREE.Mesh(new THREE.BoxGeometry(KS.bodyWid, KS.bodyHt, KS.bodyLen), paintMat);
    body.position.y = KS.bodyY;
    tilt.add(body);

    // 金属アンダーフレーム(車体下端の縁取りで「箱」感を消す)
    const frame = new THREE.Mesh(
      new THREE.CylinderGeometry(KS.frameR, KS.frameR, KS.bodyLen + 0.3, 6),
      metalMat);
    frame.rotation.x = Math.PI / 2;
    frame.position.set(0, KS.bodyY - KS.bodyHt / 2, 0);
    tilt.add(frame);

    // ノーズ(バリアント形状違い)
    const nose = buildNose(variant.noseStyle, accentMat, paintMat);
    tilt.add(nose);

    // サイドポッド(アクセントパネル)
    for (const sx of [-KS.podX, KS.podX]) {
      const pod = new THREE.Mesh(new THREE.BoxGeometry(KS.podWid, KS.podHt, KS.podLen), accentMat);
      pod.position.set(sx, KS.podY, KS.podZ);
      tilt.add(pod);
    }
    // フロントスプリッター
    const splitter = new THREE.Mesh(new THREE.BoxGeometry(KS.noseWid * 1.5, 0.045, 0.5), metalMat);
    splitter.position.set(0, 0.2, KS.noseZ + 0.35);
    tilt.add(splitter);

    // フロントウィング(金属翼端は縁の細い帯で表現し1メッシュに集約)
    const fWing = new THREE.Mesh(new THREE.BoxGeometry(1.99, 0.09, 0.44), metalMat);
    fWing.position.set(0, 0.3, 1.78);
    tilt.add(fWing);

    // ゼッケンサークル(Canvas)
    const roundel = new THREE.Mesh(new THREE.CircleGeometry(0.3, 20),
      new THREE.MeshBasicMaterial({ map: numberTexture(number, accentColor.getHex()), transparent: true }));
    roundel.position.set(0, 0.68, 1.28);
    roundel.rotation.x = -Math.PI / 2 + 0.12;
    tilt.add(roundel);

    // ヘッドライト(発光。左右一体の横長バーでメッシュ数を節約)
    const light = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.08, 0.08), Game.mats.glow(0xfff2b0, 0.9));
    light.position.set(0, 0.5, 1.85);
    tilt.add(light);

    // センターストライプ
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.03, 2.2), Game.mats.matte(0xfff6ee));
    stripe.position.set(0, 0.685, -0.1);
    tilt.add(stripe);

    // ---- シート(ヘッドレスト付き)+ステアリング ----
    const seatBack = new THREE.Mesh(
      new THREE.BoxGeometry(KS.seatBackWid, KS.seatBackHt, KS.seatBackThick), matteMat);
    seatBack.position.set(0, 0.9, -0.85);
    tilt.add(seatBack);
    const headrest = new THREE.Mesh(new THREE.SphereGeometry(KS.headrestR, 12, 10, 0, Math.PI * 2, 0, Math.PI / 1.6), matteMat);
    headrest.position.set(0, 1.2, -0.9);
    tilt.add(headrest);
    const column = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.44, 8), metalMat);
    column.position.set(0, 0.82, 0.42);
    column.rotation.x = 0.9;
    tilt.add(column);
    const wheelRing = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.05, 8, 14), matteMat);
    wheelRing.position.set(0, 0.98, 0.3);
    wheelRing.rotation.x = -0.65;
    tilt.add(wheelRing);

    // 風防(ガラス質感。shared matsのglassを活用し質感差を明確化)
    const windscreen = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.32, 0.05), glassMat);
    windscreen.position.set(0, 1.02, 0.12);
    windscreen.rotation.x = -0.55;
    tilt.add(windscreen);

    // 乗り手プレースホルダ(characters.mountOnで差し替え)
    const rider = new THREE.Mesh(new THREE.SphereGeometry(0.5, 12, 10),
      new THREE.MeshBasicMaterial({ visible: false }));
    rider.position.set(KS.riderPos[0], KS.riderPos[1], KS.riderPos[2]);
    rider.name = 'riderPlaceholder';
    tilt.add(rider);

    // ---- リアウィング(バリアント形状) ----
    const wing = buildWing(variant.wingStyle, accentMat, metalMat);
    tilt.add(wing);

    // ---- 露出エンジンブロック+発光ブースターノズル ----
    const engineBlock = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.4, 0.5), metalMat);
    engineBlock.position.set(0, KS.engineY, KS.engineZ + 0.1);
    tilt.add(engineBlock);

    buildFlames(tilt, variant.nozzles, kart, KS);

    // ---- ホイール: 前細・後太 + サスペンションアーム ----
    kart._wheels = [];
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
      // リムスポーク(層感。前輪のみ1枚追加し視認負荷とメッシュ数を抑える。後輪はhubの金属質感で表現)
      if (front) {
        const spokeR = new THREE.Mesh(new THREE.BoxGeometry(w * 0.9, r * 1.5, 0.04), rimMat);
        spokeR.rotation.z = Math.PI / 2;
        spinner.add(spokeR);
      }
      pivot.add(spinner);
      tilt.add(pivot);

      // サスペンションアーム(細い金属シリンダーで車体と接続)
      const armLen = Math.hypot(Math.abs(x) - KS.bodyWid / 2 + 0.15, 0.1) + 0.25;
      const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, armLen, 6), metalMat);
      arm.position.set(
        Math.sign(x) * (KS.bodyWid / 2 + Math.abs(x)) / 2 * 0.6,
        r + 0.05,
        z);
      arm.rotation.z = Math.PI / 2;
      tilt.add(arm);

      kart._wheels.push({ pivot, spinner, front });
    }

    // ---- 丸影 ----
    const shadow = new THREE.Mesh(new THREE.CircleGeometry(KS.shadowRadius, 20),
      new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: KS.shadowOpacity, depthWrite: false }));
    shadow.rotation.x = -Math.PI / 2;
    kart._shadow = shadow;
    g.add(shadow);

    // ---- ドリフト火花(非共有マテリアル: color書き換え用) ----
    kart._sparks = [];
    for (const x of [-0.8, 0.8]) {
      const spark = new THREE.Mesh(new THREE.SphereGeometry(0.17, 8, 8),
        new THREE.MeshBasicMaterial({ color: 0x55c8ff }));
      spark.position.set(x, 0.22, -1.15);
      spark.visible = false;
      tilt.add(spark);
      kart._sparks.push(spark);
    }

    // castShadow(丸影は除外)
    g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    shadow.castShadow = false;

    kart.group = g;
    kart._tilt = tilt;
    return g;
  }

  // ノーズ形状バリアント
  function buildNose(style, accentMat, paintMat) {
    const group = new THREE.Group();
    if (style === 'sharp') {
      const nose = new THREE.Mesh(new THREE.ConeGeometry(0.55, 1.3, 4), paintMat);
      nose.rotation.x = Math.PI / 2;
      nose.rotation.y = Math.PI / 4;
      nose.position.set(0, KS.noseY, KS.noseZ + 0.1);
      group.add(nose);
    } else if (style === 'blunt') {
      const nose = new THREE.Mesh(new THREE.BoxGeometry(KS.noseWid * 1.15, KS.noseHt * 1.3, KS.noseLen * 0.75), paintMat);
      nose.position.set(0, KS.noseY, KS.noseZ - 0.08);
      nose.rotation.x = 0.06;
      group.add(nose);
      const bumper = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, KS.noseWid * 1.1, 10), accentMat);
      bumper.rotation.z = Math.PI / 2;
      bumper.position.set(0, KS.noseY - 0.06, KS.noseZ + 0.32);
      group.add(bumper);
    } else if (style === 'fang') {
      const nose = new THREE.Mesh(new THREE.BoxGeometry(KS.noseWid, KS.noseHt, KS.noseLen), paintMat);
      nose.position.set(0, KS.noseY, KS.noseZ);
      nose.rotation.x = KS.noseTilt;
      group.add(nose);
      // 牙飾り(中央1本の突出コーンで代表させメッシュ数を節約)
      const fang = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.5, 6), accentMat);
      fang.position.set(0, KS.noseY - 0.16, KS.noseZ + 0.55);
      fang.rotation.x = Math.PI / 2 + 0.3;
      group.add(fang);
    } else { // 'wedge' デフォルト
      const nose = new THREE.Mesh(new THREE.BoxGeometry(KS.noseWid, KS.noseHt, KS.noseLen), paintMat);
      nose.position.set(0, KS.noseY, KS.noseZ);
      nose.rotation.x = KS.noseTilt;
      group.add(nose);
    }
    return group;
  }

  // リアウィング形状バリアント
  function buildWing(style, accentMat, metalMat) {
    const group = new THREE.Group();
    if (style === 'split') {
      // 中央にギャップを持つ左右分割翼を、幅広翼板1枚+金属センターマーカーで表現(メッシュ数節約)
      const plane = new THREE.Mesh(new THREE.BoxGeometry(1.62, 0.06, 0.4), accentMat);
      plane.position.set(0, 1.16, -1.28);
      group.add(plane);
    } else if (style === 'high') {
      const plane = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.07, 0.4), accentMat);
      plane.position.set(0, 1.36, -1.32);
      group.add(plane);
      // 翼端板は左右一体の幅広板で代表させメッシュ数を節約
      const endplate = new THREE.Mesh(new THREE.BoxGeometry(1.56, 0.5, 0.06), metalMat);
      endplate.position.set(0, 1.14, -1.32);
      group.add(endplate);
    } else if (style === 'twin') {
      // 上下2段ウィングを、厚みのある1枚+金属セパレーターで表現(メッシュ数節約)
      const plane = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.28, 0.32), accentMat);
      plane.position.set(0, 1.13, -1.28);
      group.add(plane);
      const seam = new THREE.Mesh(new THREE.BoxGeometry(1.52, 0.03, 0.34), metalMat);
      seam.position.set(0, 1.13, -1.28);
      group.add(seam);
    } else { // 'flat' デフォルト
      const plane = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.08, 0.44), accentMat);
      plane.position.set(0, 1.14, -1.28);
      group.add(plane);
    }
    // ウィングステー(左右一体の幅広板で1メッシュ化)
    const strut = new THREE.Mesh(new THREE.BoxGeometry(1.08, 0.34, 0.08), metalMat);
    strut.position.set(0, 0.93, -1.28);
    group.add(strut);
    return group;
  }

  // ブースターノズル(発光)+排気パイプ。kart._flamesを構築する。
  function buildFlames(tilt, count, kart, KS) {
    kart._flames = [];
    const spread = count === 3 ? [-0.32, 0, 0.32] : [-0.28, 0.28];
    for (const x of spread) {
      // 排気パイプ自体を発光素材にし、ノズル先端が常時薄く光るブースターノズルを1メッシュで表現
      const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.13, 0.5, 10), Game.mats.glow(0xffb060, 0.5));
      pipe.position.set(x, KS.engineY - 0.04, -1.42);
      pipe.rotation.x = Math.PI / 2.4;
      tilt.add(pipe);
      const flame = new THREE.Mesh(new THREE.ConeGeometry(0.15, 0.85, 8), Game.mats.glow(0xffa030, 1.6));
      flame.material.transparent = true;
      flame.material.opacity = 0.9;
      flame.position.set(x, KS.engineY - 0.06, -1.85);
      flame.rotation.x = Math.PI / 2;
      flame.visible = false;
      tilt.add(flame);
      kart._flames.push(flame);
    }
  }

  window.Game = window.Game || {};
  window.Game.kartStyle = { buildMesh, KS };
})();
