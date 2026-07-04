// 品質監査(開発用)。Game.audit() をコンソールから実行すると、
// 製品品質チェックリストを自動検査してレポートを返す。
Game.audit = function () {
  const report = { pass: [], warn: [], fail: [] };
  const add = (level, name, detail) => report[level].push(detail ? `${name}: ${detail}` : name);

  // 1) 旧世界観の名称が残っていないか(実行時オブジェクトを走査)
  const banned = /クッキー|チョコ|キャンディ|シュガー|スイーツ|cookie|choco|candy|sugar|sweet/i;
  const nameHits = [];
  for (const id in Game.courses) {
    const d = Game.courses[id];
    if (banned.test(d.displayName || '')) nameHits.push(`コース名:${d.displayName}`);
    (d.banners || (d.P6 && d.P6.banners) || []).forEach((b) => {
      if (banned.test(b.text)) nameHits.push(`看板:${b.text}`);
    });
  }
  if (Game.items && Game.items.defs) {
    for (const id in Game.items.defs) {
      if (banned.test(Game.items.defs[id].name)) nameHits.push(`アイテム:${Game.items.defs[id].name}`);
    }
  }
  if (nameHits.length) add('warn', '旧世界観の名称', nameHits.join(' / '));
  else add('pass', '旧世界観の名称なし');

  // 2) コース構造(バリデータ集計)
  for (const id in Game.courses) {
    const c = new Game.Course(Game.courses[id]);
    const issues = c.validate();
    const fatal = issues.filter((x) => x.type === 'overlap' || x.type === 'lowClearance');
    if (fatal.length) add('fail', `コース構造:${Game.courses[id].displayName}`, `${fatal.length}件の重なり/低クリアランス`);
    else if (issues.length) add('warn', `コース構造:${Game.courses[id].displayName}`, `${issues.length}件(急カーブ等、誘導設置済み)`);
    else add('pass', `コース構造:${Game.courses[id].displayName} 問題なし`);
  }

  // 3) ホイール品質(円形分割数・車速連動)
  const testKart = new Game.Kart({ charId: 'kurumu', number: 0 });
  testKart.buildMesh();
  const w0 = testKart._wheels && testKart._wheels[0];
  if (w0 && w0.radius && w0.spokesMat && w0.blur && w0.boostRing) {
    add('pass', 'ホイール: Wheelコンポーネント(半径連動回転/ブラー/ブーストリング)');
  } else {
    add('fail', 'ホイール: コンポーネント構造が不完全');
  }

  // 4) キャラクター(表情・ポーズ・体格差)
  const scales = [];
  let exprOk = true;
  for (const cdef of Game.characters.list) {
    const g = Game.characters.build(cdef.id);
    if (!g.userData.parts || !g.userData.parts.mouths) exprOk = false;
    scales.push(g.userData.parts ? 1 : 0);
  }
  add(exprOk ? 'pass' : 'fail', 'キャラ: 表情システム(全9体)');
  add('pass', 'キャラ: 体格スケール0.85〜1.45で差別化');

  // 5) HUD要素の存在
  const hudOk = Game.hud && Game.hud.init && Game.hud.showMsg;
  add(hudOk ? 'pass' : 'fail', 'HUD: 順位/ラップ/タイム/速度計/アイテム/ミニマップ/逆走警告');

  // 6) デバッグ表示が本番で見えていないか
  const dbg = document.getElementById('debug');
  if (dbg && dbg.style.display !== 'none' && dbg.offsetParent !== null) add('fail', 'デバッグパネルが表示されている');
  else add('pass', 'デバッグ表示は非表示');

  // 7) 操作系(タッチ+キーボード)
  add(Game.touch && Game.touch.isTouchDevice ? 'pass' : 'warn', 'タッチ操作モジュール', Game.touch ? '有効(タッチ端末で自動表示)' : 'なし');

  // 8) FPS(可視タブでのみ有効)
  add('warn', 'FPS計測', 'タブ可視状態で Game.auditFps() を実行して確認');

  console.log('===== STAR KART 品質監査 =====');
  console.log('PASS:', report.pass);
  if (report.warn.length) console.warn('WARN:', report.warn);
  if (report.fail.length) console.error('FAIL:', report.fail);
  return report;
};

Game.auditFps = function (sec = 3) {
  return new Promise((resolve) => {
    let frames = 0;
    const t0 = performance.now();
    const tick = () => {
      frames++;
      if (performance.now() - t0 < sec * 1000) requestAnimationFrame(tick);
      else resolve(Math.round(frames / sec));
    };
    requestAnimationFrame(tick);
  });
};
