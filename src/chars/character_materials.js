// キャラクター素材パレット(Phase8 パイプライン分割 1/4)。
// 役割: Game.charMats.get(charId) → そのキャラ専用の素材セットを返す。
// 全マテリアルは Game.mats(paint/matte/metal/rubber/glow/glass)経由で生成する
// (このファイルで MeshStandardMaterial を直接 new しない)。
// カラーは DESIGN.md「## 2-v3」表 + boostColor欄 に準拠。
(function () {
  // キャラIDごとの素材セット定義。
  // 共通キー: suit(布/主色) / suitAccent(差し色) / skin(素肌・殻・外皮) / gear(金属小物) /
  //           boost(専用ブースト発光) / trim(縁取り・アイシング等の白系仕上げ)
  // 独自キー: 各キャラのモチーフに応じて追加(下記コメント参照)
  const DEF = {
    // クルム: パン種の妖精。赤×クリーム
    kurumu: () => ({
      suit: Game.mats.matte(0xe8412f),
      suitAccent: Game.mats.matte(0xfff2da),
      skin: Game.mats.matte(0xffe7c2),
      cream: Game.mats.matte(0xfff6e0),      // クリームの前髪
      gear: Game.mats.metal(0xdedede),        // ゴーグルフレーム
      lens: Game.mats.glass(0x69d1ff, 0.55),  // ゴーグルレンズ
      boost: Game.mats.glow(0xffa030, 1.5),
      trim: Game.mats.matte(0xffffff),
      eyeIris: 0x4a2a1c,
    }),
    // ルポ: 宅配キツネ。オレンジ×白
    rupo: () => ({
      suit: Game.mats.matte(0xff8c2b),
      suitAccent: Game.mats.matte(0xffffff),
      skin: Game.mats.matte(0xff8c2b),
      muzzle: Game.mats.matte(0xfff2e0),
      cap: Game.mats.matte(0x5a3a20),
      bag: Game.mats.matte(0x7a4a20),
      bagFlap: Game.mats.matte(0xffffff),
      gear: Game.mats.metal(0xdedede),
      lens: Game.mats.glass(0xffe066, 0.55),
      boost: Game.mats.glow(0xffc46a, 1.5),
      trim: Game.mats.matte(0xffffff),
      eyeIris: 0x3a2a1c,
    }),
    // ドンガ: キャラメル岩のゴーレム。岩グレー×溶岩発光(装甲そのものの体=スーツ標準装備の例外)
    donga: () => ({
      rock: Game.mats.matte(0x8a7362),
      rockDark: Game.mats.matte(0x6b5847),
      crack: Game.mats.glow(0xff5a1c, 1.6),
      gear: Game.mats.metal(0x5b5048),
      boost: Game.mats.glow(0xff5a24, 1.7),
      eyeIris: 0xff6a1c,
    }),
    // ヴォルト8: レースロボ。シルバー×シアン発光(装甲そのものの体=例外)
    volt8: () => ({
      metal: Game.mats.metal(0xb9bec9),
      metalDark: Game.mats.metal(0x757b86),
      panel: Game.mats.matte(0x2c2f36),
      led: Game.mats.glow(0x4de0ff, 1.9),
      ledExcited: Game.mats.glow(0xff9a3c, 1.9),
      ledDizzy: Game.mats.glow(0xff3b6e, 1.9),
      ledJoy: Game.mats.glow(0x7fff7f, 1.9),
      boost: Game.mats.glow(0x54e0ff, 1.7),
    }),
    // シズク: シロップの水精霊。半透明ブルー×虹
    shizuku: () => ({
      body: Game.mats.glass(0x8fdcff, 0.5),
      drop: Game.mats.glass(0x5ec8f0, 0.55),
      core: Game.mats.glow(0x9fe0ff, 1.3),
      auroraA: Game.mats.glow(0xff9fd6, 0.9),
      auroraB: Game.mats.glow(0x9fd6ff, 0.9),
      auroraC: Game.mats.glow(0xd6ff9f, 0.9),
      crown: Game.mats.glass(0xffffff, 0.7),
      boost: Game.mats.glow(0x7ad8ff, 1.6),
      eyeIris: 0x2c6a8c,
    }),
    // グミラス王: グミの王。紫グミ×金
    gumiras: () => ({
      jelly: Game.mats.glass(0x9a4fd6, 0.72),
      jellyDark: Game.mats.glass(0x7a35ad, 0.72),
      crown: Game.mats.metal(0xd4af37),
      jewel: Game.mats.glow(0xff3b6e, 1.1),
      cape: Game.mats.matte(0xc9273f),
      collar: Game.mats.matte(0xfff6e0),
      boost: Game.mats.glow(0xd070ff, 1.6),
      eyeIris: 0x5a2a70,
    }),
    // ノワール卿: ビターカカオの騎士。黒×赤発光
    noir: () => ({
      armor: Game.mats.matte(0x241512),
      armorDark: Game.mats.matte(0x160b09),
      pauldron: Game.mats.metal(0x3a1414),
      trim: Game.mats.metal(0x8a1c1c),
      cape: Game.mats.matte(0x1a0f0d),
      slit: Game.mats.glow(0xff3b30, 1.8),
      boost: Game.mats.glow(0xff2440, 1.7),
    }),
    // バウム翁: 年輪の樹精の長老。ウッド茶×モスグリーン
    baumjii: () => ({
      wood: Game.mats.matte(0xa9773f),
      woodDark: Game.mats.matte(0x7a5228),
      skin: Game.mats.matte(0xc79a5e),
      leaf: Game.mats.matte(0x5e8a4a),
      mustache: Game.mats.matte(0xfff6e0),
      glove: Game.mats.matte(0x7a4a26),
      gear: Game.mats.metal(0xd4af37),
      lens: Game.mats.glass(0xffffff, 0.3),
      boost: Game.mats.glow(0x9ade6a, 1.4),
      eyeIris: 0x5a3a20,
    }),
    // ジンジャ: ジンジャークッキーの忍者。ジンジャー茶×白×ミント
    ginja: () => ({
      cookie: Game.mats.matte(0xa86a34),
      cookieDark: Game.mats.matte(0x7d4c22),
      icing: Game.mats.matte(0xffffff),
      sash: Game.mats.matte(0x7fe0c0),
      gear: Game.mats.metal(0xdedede),
      boost: Game.mats.glow(0x6affc8, 1.6),
      eyeIris: 0x3a2410,
    }),
  };

  const cache = {};
  function get(charId) {
    if (cache[charId]) return cache[charId];
    const fn = DEF[charId] || DEF.kurumu;
    const set = fn();
    cache[charId] = set;
    return set;
  }

  window.Game = window.Game || {};
  window.Game.charMats = { get };
})();
