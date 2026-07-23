// エントリポイント。画面フロー(Game.screens)がタイトル→レース→リザルトまで全て統括する。
(function () {
  Game.app.init(document.getElementById('app'));
  const dbg = document.getElementById('debug');
  if (dbg) dbg.style.display = 'none'; // 開発用パネルは通常非表示
  Game.touch.init(); // タッチデバイス(iPad等)なら操作ボタンを用意
  // 設定(音量・影・タッチボタンサイズ)を復元。影トグルは太陽光のcastShadowで即時反映
  // (renderer.shadowMap切替はシェーダ再コンパイルが要るため光源側で切る)
  if (Game.settings) {
    Game.settings.onShadowChange = (on) => {
      if (Game.app.sun) Game.app.sun.castShadow = on;
    };
    Game.settings.init();
  }
  Game.screens.boot();
})();
