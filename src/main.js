// エントリポイント。画面フロー(Game.screens)がタイトル→レース→リザルトまで全て統括する。
(function () {
  Game.app.init(document.getElementById('app'));
  const dbg = document.getElementById('debug');
  if (dbg) dbg.style.display = 'none'; // 開発用パネルは通常非表示
  Game.touch.init(); // タッチデバイス(iPad等)なら操作ボタンを用意
  Game.screens.boot();
})();
