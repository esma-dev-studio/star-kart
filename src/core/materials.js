// 共有マテリアルファクトリ。プレミアム化の核: 全モジュールはここから素材を取る。
// MeshStandardMaterial(PBR)で「塗装・金属・ゴム・ガラス・発光」の質感差を作る。
//
// 重要(r134の色管理): レンダラがsRGB出力のため、マテリアルの色指定は
// convertSRGBToLinear() でリニア化しないと白茶けて表示される。
// このファクトリを通せば自動で正しく変換される。
//
// 注意: 各メソッドは分割代入(const {paint} = Game.mats)で呼ばれても動くよう、
// thisに依存せずローカル関数 lin() を使うこと。
(function () {
  const lin = (color) => new THREE.Color(color).convertSRGBToLinear();

  Game.mats = {
    // 指定色をリニア空間へ(sRGB出力での「見た目通りの色」にする)
    col: lin,
    // カート塗装(光沢のあるペイント)
    paint(color) {
      return new THREE.MeshStandardMaterial({ color: lin(color), roughness: 0.32, metalness: 0.28 });
    },
    // つや消し樹脂/布
    matte(color) {
      return new THREE.MeshStandardMaterial({ color: lin(color), roughness: 0.85, metalness: 0.0 });
    },
    // 金属(パイプ・ホイール・機械部品)
    metal(color = 0xb9bec9) {
      return new THREE.MeshStandardMaterial({ color: lin(color), roughness: 0.28, metalness: 0.9 });
    },
    // タイヤゴム
    rubber(color = 0x26262b) {
      return new THREE.MeshStandardMaterial({ color: lin(color), roughness: 0.95, metalness: 0.0 });
    },
    // 発光パーツ(ブースター・ネオン・ライト)。ライト不要で光って見える
    glow(color, intensity = 1.4) {
      return new THREE.MeshStandardMaterial({
        color: lin(color), emissive: lin(color), emissiveIntensity: intensity,
        roughness: 0.4, metalness: 0.0,
      });
    },
    // 半透明ガラス/キャンディ
    glass(color = 0xffffff, opacity = 0.4) {
      return new THREE.MeshStandardMaterial({
        color: lin(color), roughness: 0.12, metalness: 0.05, transparent: true, opacity,
      });
    },
  };
})();
