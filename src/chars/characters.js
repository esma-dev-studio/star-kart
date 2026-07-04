// キャラクター9体 v3.5(Phase8 パイプライン分割 4/4=ファサード)。
// 定義データ(DESIGN.md 2-v3の表と完全一致+boostColor/boostName)と公開APIファサード。
// 実装本体は character_materials.js / character_builder.js / character_rig.js に分離済み:
//   list / build(id)=charBuilder.build / mountOn(kart,id) / drawPortrait(ctx,id,size) / animate=charRig.animate
(function () {
  // ==================== キャラ定義(DESIGN.md 2-v3表と完全一致) ====================
  const list = [
    { id: 'kurumu', name: 'クルム', motif: 'パン種の妖精。クリームの前髪、キャップ+ゴーグル、赤スカーフ', personality: '主人公気質の元気な小型人外',
      color: 0xe8412f, stats: { speed: 3, accel: 3, handling: 3, weight: 3 },
      boostColor: 0xffa030, boostName: '王道の炎' },
    { id: 'rupo', name: 'ルポ', motif: '宅配キツネ。飛行帽ゴーグル、肩掛け配達バッグ、大きな尻尾', personality: '軽快でフレンドリーな配達屋',
      color: 0xff8c2b, stats: { speed: 3, accel: 4, handling: 4, weight: 1 },
      boostColor: 0xffc46a, boostName: '琥珀の疾風' },
    { id: 'donga', name: 'ドンガ', motif: 'キャラメル岩のゴーレム。ひび割れから溶岩色の光、岩の拳', personality: '寡黙で圧倒的なパワー型',
      color: 0x8a7362, stats: { speed: 5, accel: 1, handling: 1, weight: 5 },
      boostColor: 0xff5a24, boostName: '溶岩の奔流' },
    { id: 'volt8', name: 'ヴォルト8', motif: 'ワッフル工場製レースロボ。ツインLEDアイ、アンテナ、下半身はマシンと一体化', personality: '合理的で無表情、時々ユーモラス',
      color: 0xb9bec9, stats: { speed: 4, accel: 3, handling: 2, weight: 3 },
      boostColor: 0x54e0ff, boostName: 'プラズマブースト' },
    { id: 'shizuku', name: 'シズク', motif: 'シロップの水精霊。半透明ガラス質の体、オーロラ色の髪、浮遊', personality: '気まぐれで浮遊感のあるマイペース屋',
      color: 0x5ec8f0, stats: { speed: 2, accel: 4, handling: 5, weight: 1 },
      boostColor: 0x7ad8ff, boostName: '水流の光跡' },
    { id: 'gumiras', name: 'グミラス王', motif: 'グミの王。ゼリー質の恰幅ある体、金の王冠、赤マント、余裕の笑み', personality: '陽気で余裕たっぷりの王様',
      color: 0x9a4fd6, stats: { speed: 4, accel: 2, handling: 2, weight: 4 },
      boostColor: 0xd070ff, boostName: '魔法の紫炎' },
    { id: 'noir', name: 'ノワール卿', motif: 'ビターカカオの騎士。黒鎧、兜のスリットから赤い目が光る、不敵', personality: '寡黙不敵なライバル',
      color: 0x241512, stats: { speed: 5, accel: 2, handling: 3, weight: 3 },
      boostColor: 0xff2440, boostName: '赤黒の闘気' },
    { id: 'baumjii', name: 'バウム翁', motif: '年輪の樹精の長老。クリームの口ヒゲ、モノクル、革手袋', personality: '穏やかで職人気質のベテラン',
      color: 0xa9773f, stats: { speed: 3, accel: 2, handling: 4, weight: 4 },
      boostColor: 0x9ade6a, boostName: '若葉の息吹' },
    { id: 'ginja', name: 'ジンジャ', motif: 'ジンジャークッキーの忍者。アイシングの隈取り、ミントの帯、ニヤリ顔', personality: '身軽なトリックスター',
      color: 0xa86a34, stats: { speed: 2, accel: 5, handling: 4, weight: 1 },
      boostColor: 0x6affc8, boostName: 'ミントの疾走' },
  ];

  // キャラごとのマウントスケール(小柄0.95〜大柄1.25)
  // 体格差を強調: 小柄(0.85)〜巨漢(1.45)の幅で「軽量級/重量級」がひと目で分かるように
  const MOUNT_SCALE = {
    kurumu: 0.85,
    rupo: 0.95,
    donga: 1.45,
    volt8: 1.05,
    shizuku: 1.0,
    gumiras: 1.32,
    noir: 1.15,
    baumjii: 1.15,
    ginja: 0.88,
  };

  function build(id) {
    const g = Game.charBuilder.build(id);
    // (注: 旧WIP版は一部キャラが-Z向きだったが、最終版ビルダーは全キャラ+Z向きで統一済み。
    //  反転フィックスは不要になったため撤去した)
    // アニメ用ランタイム状態の初期化(character_rig.animate/setPose/setExpressionが参照)
    g.userData.anim = {
      expr: 'normal',
      bounceT: Math.random() * 10, // 個体差(全員が同期して跳ねないように位相をずらす)
      leanX: 0, leanZ: 0,
      joyRaise: 0,
      baseScale: 1,
    };
    return g;
  }

  // kart.group内のriderPlaceholderを除去し、同位置にキャラを座らせる
  function mountOn(kart, id) {
    if (!kart || !kart.group) return;
    const placeholder = kart.group.getObjectByName('riderPlaceholder');
    const pos = placeholder ? placeholder.position.clone() : new THREE.Vector3(0, 1.0, -0.25);
    const parent = placeholder ? placeholder.parent : kart._tilt || kart.group;
    if (placeholder && parent) parent.remove(placeholder);

    const charGroup = build(id);
    const scale = MOUNT_SCALE[id] || 1.1;
    charGroup.scale.setScalar(scale);
    charGroup.userData.anim.baseScale = scale;
    charGroup.position.set(pos.x, pos.y - 0.15, pos.z);
    if (parent) parent.add(charGroup);
    else kart.group.add(charGroup);
    charGroup.traverse((o) => { if (o.isMesh) o.castShadow = true; }); // キャラも影を落とす

    kart.charId = id;
    const def = list.find((c) => c.id === id);
    kart.charName = def ? def.name : id;
    kart._charGroup = charGroup;

    Game.charRig.setPose(charGroup, 'ride');
  }

  // ==================== 似顔絵(選択画面カード用) ====================
  function radialBg(ctx, size) {
    const grad = ctx.createRadialGradient(size / 2, size / 2, size * 0.05, size / 2, size / 2, size * 0.62);
    grad.addColorStop(0, '#ffffff');
    grad.addColorStop(1, '#ffe8ef');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);
  }

  function shadeCircle(ctx, cx, cy, r, baseColor) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.clip();
    ctx.fillStyle = baseColor;
    ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
    const shade = ctx.createRadialGradient(cx - r * 0.35, cy - r * 0.4, r * 0.1, cx, cy, r * 1.1);
    shade.addColorStop(0, 'rgba(255,255,255,0.45)');
    shade.addColorStop(0.55, 'rgba(255,255,255,0)');
    shade.addColorStop(1, 'rgba(0,0,0,0.22)');
    ctx.fillStyle = shade;
    ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
    ctx.restore();
    ctx.strokeStyle = 'rgba(0,0,0,0.18)';
    ctx.lineWidth = r * 0.045;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();
  }

  function eyesAndMouth(ctx, size, cx, cy, r, irisColor, mouthColor) {
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.ellipse(cx - r * 1.1, cy, r * 0.42, r * 0.46, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(cx + r * 1.1, cy, r * 0.42, r * 0.46, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = irisColor || '#3a2a20';
    ctx.beginPath(); ctx.arc(cx - r * 1.1, cy + r * 0.05, r * 0.3, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(cx + r * 1.1, cy + r * 0.05, r * 0.3, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.35)';
    ctx.lineWidth = r * 0.05;
    ctx.beginPath(); ctx.ellipse(cx - r * 1.1, cy, r * 0.42, r * 0.46, 0, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.ellipse(cx + r * 1.1, cy, r * 0.42, r * 0.46, 0, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.arc(cx - r * 1.1 + r * 0.12, cy - r * 0.14, r * 0.13, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(cx + r * 1.1 + r * 0.12, cy - r * 0.14, r * 0.13, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = mouthColor || '#7a3b2e';
    ctx.lineWidth = size * 0.02;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(cx, cy + r * 1.3, r * 0.75, 0.15 * Math.PI, 0.85 * Math.PI);
    ctx.stroke();
  }

  const portraitDrawers = {
    kurumu(ctx, size) {
      radialBg(ctx, size);
      shadeCircle(ctx, size * 0.5, size * 0.36, size * 0.3, '#fff6e0');
      shadeCircle(ctx, size * 0.5, size * 0.62, size * 0.3, '#e8412f');
      eyesAndMouth(ctx, size, size * 0.5, size * 0.4, size * 0.045, '#4a2a1c');
      ctx.strokeStyle = 'rgba(51,51,51,0.85)';
      ctx.lineWidth = size * 0.02;
      ctx.beginPath(); ctx.arc(size * 0.5 - size * 0.11, size * 0.4, size * 0.07, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.arc(size * 0.5 + size * 0.11, size * 0.4, size * 0.07, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = 'rgba(105,209,255,0.35)';
      ctx.beginPath(); ctx.arc(size * 0.5 - size * 0.11, size * 0.4, size * 0.06, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(size * 0.5 + size * 0.11, size * 0.4, size * 0.06, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#fff6e0';
      ctx.beginPath(); ctx.arc(size * 0.5, size * 0.18, size * 0.17, Math.PI, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#e8412f';
      ctx.fillRect(size * 0.36, size * 0.72, size * 0.28, size * 0.08);
    },
    rupo(ctx, size) {
      radialBg(ctx, size);
      shadeCircle(ctx, size * 0.5, size * 0.5, size * 0.32, '#ff8c2b');
      ctx.fillStyle = '#ff8c2b';
      ctx.beginPath(); ctx.moveTo(size * 0.32, size * 0.28); ctx.lineTo(size * 0.26, size * 0.08); ctx.lineTo(size * 0.4, size * 0.22); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(size * 0.68, size * 0.28); ctx.lineTo(size * 0.74, size * 0.08); ctx.lineTo(size * 0.6, size * 0.22); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#fff2e0';
      ctx.beginPath(); ctx.moveTo(size * 0.42, size * 0.56); ctx.lineTo(size * 0.58, size * 0.56); ctx.lineTo(size * 0.5, size * 0.7); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#5a3a20';
      ctx.beginPath(); ctx.arc(size * 0.5, size * 0.32, size * 0.28, Math.PI, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(255,224,102,0.5)';
      ctx.strokeStyle = 'rgba(51,51,51,0.85)';
      ctx.lineWidth = size * 0.018;
      ctx.beginPath(); ctx.arc(size * 0.5 - size * 0.1, size * 0.4, size * 0.065, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.arc(size * 0.5 + size * 0.1, size * 0.4, size * 0.065, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      eyesAndMouth(ctx, size, size * 0.5, size * 0.56, size * 0.04, '#3a2a1c');
    },
    donga(ctx, size) {
      radialBg(ctx, size);
      shadeCircle(ctx, size * 0.5, size * 0.5, size * 0.34, '#8a7362');
      ctx.strokeStyle = '#ff5a1c';
      ctx.lineWidth = size * 0.025;
      ctx.beginPath(); ctx.moveTo(size * 0.36, size * 0.3); ctx.lineTo(size * 0.44, size * 0.5); ctx.lineTo(size * 0.34, size * 0.62); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(size * 0.62, size * 0.28); ctx.lineTo(size * 0.58, size * 0.48); ctx.lineTo(size * 0.68, size * 0.6); ctx.stroke();
      eyesAndMouth(ctx, size, size * 0.5, size * 0.48, size * 0.055, '#ff6a1c');
    },
    volt8(ctx, size) {
      radialBg(ctx, size);
      ctx.fillStyle = '#b9bec9';
      ctx.fillRect(size * 0.28, size * 0.24, size * 0.44, size * 0.4);
      const grad = ctx.createLinearGradient(size * 0.28, size * 0.24, size * 0.72, size * 0.64);
      grad.addColorStop(0, 'rgba(255,255,255,0.35)');
      grad.addColorStop(1, 'rgba(0,0,0,0.2)');
      ctx.fillStyle = grad;
      ctx.fillRect(size * 0.28, size * 0.24, size * 0.44, size * 0.4);
      ctx.strokeStyle = 'rgba(0,0,0,0.3)';
      ctx.lineWidth = size * 0.015;
      ctx.strokeRect(size * 0.28, size * 0.24, size * 0.44, size * 0.4);
      ctx.fillStyle = '#4de0ff';
      ctx.shadowColor = '#4de0ff';
      ctx.shadowBlur = size * 0.04;
      ctx.fillRect(size * 0.38, size * 0.4, size * 0.06, size * 0.05);
      ctx.fillRect(size * 0.56, size * 0.4, size * 0.06, size * 0.05);
      ctx.shadowBlur = 0;
      ctx.strokeStyle = '#8a8f9a';
      ctx.lineWidth = size * 0.015;
      ctx.beginPath(); ctx.moveTo(size * 0.5, size * 0.24); ctx.lineTo(size * 0.5, size * 0.1); ctx.stroke();
      ctx.fillStyle = '#4de0ff';
      ctx.beginPath(); ctx.arc(size * 0.5, size * 0.08, size * 0.025, 0, Math.PI * 2); ctx.fill();
    },
    shizuku(ctx, size) {
      radialBg(ctx, size);
      ctx.fillStyle = 'rgba(94,200,240,0.55)';
      ctx.beginPath();
      ctx.ellipse(size * 0.5, size * 0.5, size * 0.3, size * 0.34, 0, 0, Math.PI * 2);
      ctx.fill();
      const cols = ['rgba(255,159,214,0.7)', 'rgba(159,214,255,0.7)', 'rgba(214,255,159,0.7)'];
      for (let i = 0; i < 6; i++) {
        ctx.strokeStyle = cols[i % cols.length];
        ctx.lineWidth = size * 0.02;
        const a = (i / 6) * Math.PI * 2;
        ctx.beginPath();
        ctx.moveTo(size * 0.5, size * 0.28);
        ctx.lineTo(size * 0.5 + Math.cos(a) * size * 0.2, size * 0.28 - size * 0.14 + Math.sin(a) * size * 0.06);
        ctx.stroke();
      }
      eyesAndMouth(ctx, size, size * 0.5, size * 0.5, size * 0.045, '#2c6a8c');
    },
    gumiras(ctx, size) {
      radialBg(ctx, size);
      shadeCircle(ctx, size * 0.5, size * 0.54, size * 0.34, '#9a4fd6');
      ctx.fillStyle = 'rgba(201,39,63,0.85)';
      ctx.beginPath(); ctx.moveTo(size * 0.2, size * 0.5); ctx.lineTo(size * 0.28, size * 0.85); ctx.lineTo(size * 0.72, size * 0.85); ctx.lineTo(size * 0.8, size * 0.5); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#d4af37';
      ctx.beginPath();
      ctx.moveTo(size * 0.32, size * 0.24); ctx.lineTo(size * 0.38, size * 0.1); ctx.lineTo(size * 0.44, size * 0.22);
      ctx.lineTo(size * 0.5, size * 0.06); ctx.lineTo(size * 0.56, size * 0.22); ctx.lineTo(size * 0.62, size * 0.1);
      ctx.lineTo(size * 0.68, size * 0.24); ctx.closePath(); ctx.fill();
      eyesAndMouth(ctx, size, size * 0.5, size * 0.46, size * 0.05, '#5a2a70');
    },
    noir(ctx, size) {
      radialBg(ctx, size);
      shadeCircle(ctx, size * 0.5, size * 0.5, size * 0.34, '#241512');
      ctx.fillStyle = '#ff3b30';
      ctx.shadowColor = '#ff3b30';
      ctx.shadowBlur = size * 0.05;
      ctx.fillRect(size * 0.32, size * 0.47, size * 0.36, size * 0.06);
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#8a1c1c';
      ctx.fillRect(size * 0.48, size * 0.14, size * 0.04, size * 0.14);
    },
    baumjii(ctx, size) {
      radialBg(ctx, size);
      shadeCircle(ctx, size * 0.5, size * 0.5, size * 0.32, '#c79a5e');
      ctx.strokeStyle = 'rgba(110,70,30,0.7)';
      ctx.lineWidth = size * 0.015;
      for (let r = size * 0.08; r < size * 0.3; r += size * 0.05) {
        ctx.beginPath(); ctx.arc(size * 0.5, size * 0.5, r, 0, Math.PI * 2); ctx.stroke();
      }
      ctx.strokeStyle = '#fff6e0';
      ctx.lineWidth = size * 0.03;
      ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(size * 0.4, size * 0.6); ctx.lineTo(size * 0.3, size * 0.66); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(size * 0.6, size * 0.6); ctx.lineTo(size * 0.7, size * 0.66); ctx.stroke();
      ctx.strokeStyle = 'rgba(212,175,55,0.9)';
      ctx.lineWidth = size * 0.02;
      ctx.beginPath(); ctx.arc(size * 0.58, size * 0.48, size * 0.075, 0, Math.PI * 2); ctx.stroke();
      eyesAndMouth(ctx, size, size * 0.5, size * 0.48, size * 0.045, '#5a3a20');
    },
    ginja(ctx, size) {
      radialBg(ctx, size);
      shadeCircle(ctx, size * 0.5, size * 0.5, size * 0.3, '#a86a34');
      ctx.strokeStyle = 'rgba(255,255,255,0.9)';
      ctx.lineWidth = size * 0.025;
      ctx.beginPath(); ctx.arc(size * 0.5 - size * 0.13, size * 0.48, size * 0.1, 0.2 * Math.PI, 0.9 * Math.PI); ctx.stroke();
      ctx.beginPath(); ctx.arc(size * 0.5 + size * 0.13, size * 0.48, size * 0.1, 0.1 * Math.PI, 0.8 * Math.PI); ctx.stroke();
      ctx.fillStyle = '#7fe0c0';
      ctx.fillRect(size * 0.3, size * 0.68, size * 0.4, size * 0.07);
      eyesAndMouth(ctx, size, size * 0.5, size * 0.46, size * 0.04, '#3a2410');
    },
  };

  function drawPortrait(ctx, id, size) {
    const fn = portraitDrawers[id] || portraitDrawers.kurumu;
    fn(ctx, size);
  }

  window.Game = window.Game || {};
  window.Game.characters = {
    list, build, mountOn, drawPortrait,
    animate: (kart, dt, steer) => Game.charRig.animate(kart, dt, steer),
    setPose: (group, pose) => Game.charRig.setPose(group, pose),
    setExpression: (group, expr) => Game.charRig.setExpression(group, expr),
  };
})();
