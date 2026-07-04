// キャラクターアニメーション・ポーズ制御(Phase8 パイプライン分割 3/4)。
// 役割: Game.charRig = { animate(kart, dt, steer), setPose(group, 'select'|'ride'), setExpression(group, expr) }
// character_builder.js が作った userData.parts / userData.anim を参照して動かす。
// キャラ個性(DESIGN.md要求): donga=重々しい / shizuku=浮遊 / ginja=小刻み / noir=不動 / gumiras=ぷるぷる
(function () {
  const ANIM = {
    bounceFreqMin: 5.2,
    bounceFreqMax: 13.5,
    bounceAmpBase: 0.028,
    bounceAmpBoost: 0.05,
    leanMax: 0.5,
    leanDamp: 9,
    forwardLeanBoost: 0.22,
    armFlapFreq: 16,
    armFlapAmp: 0.9,
    joyArmUpSpeed: 8,
    dizzyHeadSpin: 9,
  };

  // キャラ個性別の走行アニメ係数
  const PERSONA = {
    donga: { bounceMul: 0.55, freqMul: 0.6, leanMul: 0.7, armSwingMul: 0.7 },
    shizuku: { bounceMul: 0, freqMul: 1.0, leanMul: 1.0, armSwingMul: 0.8, hover: true },
    ginja: { bounceMul: 1.3, freqMul: 1.9, leanMul: 1.3, armSwingMul: 1.4 },
    noir: { bounceMul: 0.35, freqMul: 0.7, leanMul: 0.4, armSwingMul: 0.35 },
    gumiras: { bounceMul: 1.0, freqMul: 1.0, leanMul: 1.0, armSwingMul: 1.0, jiggle: true },
  };
  const DEFAULT_PERSONA = { bounceMul: 1.0, freqMul: 1.0, leanMul: 1.0, armSwingMul: 1.0 };

  // キャラごとの基準スケール(characters.jsのMOUNT_SCALEと同じ値をここでも参照できるよう複製せず、
  // g.scale.x の現在値から比率だけ動かす: 呼び出し側が最初に設定したスケールをbaseとして保持する)
  function ensureAnim(g) {
    if (g.userData.anim) return g.userData.anim;
    const parts = g.userData.parts || {};
    const anim = {
      expr: 'normal',
      bounceT: Math.random() * 10,
      leanX: 0,
      leanZ: 0,
      joyRaise: 0,
      baseScale: g.scale.x || 1,
    };
    g.userData.anim = anim;
    return anim;
  }

  // ---- 表情切替: expr変化時のみ処理(mouths/slitsのvisible切替。テクスチャ生成済みキャッシュ) ----
  function setExpression(group, expr) {
    if (!group || !group.userData || !group.userData.parts) return;
    const parts = group.userData.parts;
    const anim = ensureAnim(group);
    if (anim.expr === expr) return;
    anim.expr = expr;
    if (parts.mouths) {
      for (const key of Object.keys(parts.mouths)) {
        parts.mouths[key].visible = key === expr;
      }
    }
  }

  // ---- ポーズ: キャラ選択画面(select)/搭乗時(ride)の姿勢 ----
  // 腕pivotの回転と頭(headY周りの傾き=bodyRoot.rotation)で性格を表現する。
  const SELECT_POSE = {
    // 胸を張る(デフォルト): 軽く胸を張り腕を自然に下ろす
    kurumu: (p) => { p.armL.rotation.set(0.1, 0, -0.15); p.armR.rotation.set(0.1, 0, 0.15); },
    // 敬礼(配達屋らしく)
    rupo: (p) => { p.armL.rotation.set(0, 0, -0.1); p.armR.rotation.set(-1.6, 0, 0.3); },
    // 岩の拳を突き合わせる力強いポーズ
    donga: (p) => { p.armL.rotation.set(-0.4, 0, -0.5); p.armR.rotation.set(-0.6, 0, 0.6); },
    // 直立不動、腕は体側にきっちり
    volt8: (p) => { p.armL.rotation.set(0, 0, -0.05); p.armR.rotation.set(0, 0, 0.05); },
    // ふわりと腕を広げる浮遊ポーズ
    shizuku: (p) => { p.armL.rotation.set(-0.2, 0, -0.45); p.armR.rotation.set(-0.2, 0, 0.45); },
    // 腕組み(王の余裕)
    gumiras: (p) => { p.armL.rotation.set(-0.9, 0.3, -0.2); p.armR.rotation.set(-0.9, -0.3, 0.2); },
    // 腕組み(不敵なライバル)
    noir: (p) => { p.armL.rotation.set(-0.7, 0.2, -0.1); p.armR.rotation.set(-0.7, -0.2, 0.1); },
    // 穏やかに手を後ろで組む(片腕だけ引くため非対称)
    baumjii: (p) => { p.armL.rotation.set(-1.3, 0, -0.1); p.armR.rotation.set(-0.1, 0, 0.15); },
    // ニヤリのトリックスターポーズ(片腕を腰に)
    ginja: (p) => { p.armL.rotation.set(-1.1, 0.4, -0.3); p.armR.rotation.set(0.15, 0, 0.2); },
  };
  const SELECT_HEAD_TILT = {
    kurumu: 0.06, rupo: 0.1, donga: -0.03, volt8: 0, shizuku: 0.08,
    gumiras: -0.04, noir: -0.05, baumjii: 0.05, ginja: 0.12,
  };

  function setPose(group, pose) {
    if (!group || !group.userData || !group.userData.parts) return;
    const parts = group.userData.parts;
    const charId = group.name ? group.name.replace('char_', '') : null;
    if (pose === 'select') {
      const fn = SELECT_POSE[charId];
      if (fn) fn(parts);
      group.rotation.x = 0;
      group.rotation.z = SELECT_HEAD_TILT[charId] || 0;
      setExpression(group, 'joy');
    } else {
      // ride: ハンドルへ腕を伸ばす通常姿勢(走行アニメが引き継ぐ基準姿勢)
      parts.armL.rotation.set(0.15, 0, 0);
      parts.armR.rotation.set(-0.15, 0, 0);
      group.rotation.x = 0;
      group.rotation.z = 0;
      setExpression(group, 'normal');
    }
  }

  // ---- 走行アニメーション(毎フレーム、kart.updateVisualから呼ばれる) ----
  function animate(kart, dt, steer) {
    const g = kart._charGroup;
    if (!g || !g.userData || !g.userData.parts) return;
    const parts = g.userData.parts;
    const anim = ensureAnim(g);
    const U = Game.U;
    const P = PERSONA[kart.charId] || DEFAULT_PERSONA;

    const spinning = kart.spinT > 0;
    const boosting = kart.boostT > 0;
    const starring = kart.starT > 0;
    const justFinishedWon = kart.finished && kart.rank === 1;

    // ---- 表情切替(状態が変わった時だけ) ----
    if (justFinishedWon) setExpression(g, 'joy');
    else if (spinning) setExpression(g, 'dizzy');
    else if (boosting || starring) setExpression(g, 'excited');
    else setExpression(g, 'normal');

    // ---- 速度に応じた上下バウンス ----
    const speedRatio = U.clamp(Math.abs(kart.speed) / (Game.config.physics.maxSpeed || 30), 0, 1.6);
    const freq = (ANIM.bounceFreqMin + (ANIM.bounceFreqMax - ANIM.bounceFreqMin) * Math.min(speedRatio, 1)) * P.freqMul;
    anim.bounceT += dt * freq;
    const baseAmp = kart.grounded
      ? ANIM.bounceAmpBase + (boosting || starring ? ANIM.bounceAmpBoost : 0) * (0.6 + 0.4 * Math.sin(anim.bounceT * 2))
      : 0;
    const amp = baseAmp * P.bounceMul;
    let bounceY = spinning ? 0 : Math.abs(Math.sin(anim.bounceT)) * amp;
    if (P.hover) {
      bounceY = 0.06 + Math.sin(anim.bounceT * 0.6) * 0.035;
    }
    g.position.y = -0.15 + bounceY;

    // ぷるぷる/もちもちスクイーズ(縦伸縮に対し横を逆位相)。グミラスはゼリー質でより強く
    const squishAmpMul = P.jiggle ? 2.2 : 1.0;
    const squish = spinning ? 1 : 1 + Math.sin(anim.bounceT) * (amp * 1.6 * squishAmpMul);
    const baseScale = anim.baseScale || 1;
    g.scale.set(baseScale / Math.sqrt(squish), baseScale * squish, baseScale / Math.sqrt(squish));

    // ---- ステア/ドリフト方向へのリーン ----
    let targetLeanZ = -steer * ANIM.leanMax * 0.5 * P.leanMul;
    let targetLeanX = 0;
    if (kart.drift && kart.drift.state === 'drifting') {
      targetLeanZ = -kart.drift.dir * ANIM.leanMax * P.leanMul;
    }
    if (boosting || starring) {
      targetLeanX = ANIM.forwardLeanBoost;
    }
    anim.leanZ = U.damp(anim.leanZ, targetLeanZ, ANIM.leanDamp, dt);
    anim.leanX = U.damp(anim.leanX, targetLeanX, ANIM.leanDamp, dt);
    g.rotation.z = anim.leanZ;
    g.rotation.x = -anim.leanX;

    // ---- 腕アニメーション ----
    const armL = parts.armL, armR = parts.armR;
    if (spinning) {
      const flap = Math.sin(anim.bounceT * ANIM.armFlapFreq) * ANIM.armFlapAmp * P.armSwingMul;
      armL.rotation.x = flap;
      armR.rotation.x = -flap;
      anim.joyRaise = 0;
      const spin = performance.now() * 0.001 * ANIM.dizzyHeadSpin;
      if (parts.eyeL) parts.eyeL.rotation.z = spin;
      if (parts.eyeR) parts.eyeR.rotation.z = -spin;
    } else if (justFinishedWon) {
      anim.joyRaise = U.damp(anim.joyRaise, 1, ANIM.joyArmUpSpeed, dt);
      armL.rotation.x = -anim.joyRaise * 2.4;
      armR.rotation.x = -anim.joyRaise * 2.4;
      if (parts.eyeL) parts.eyeL.rotation.z = U.damp(parts.eyeL.rotation.z, 0, 10, dt);
      if (parts.eyeR) parts.eyeR.rotation.z = U.damp(parts.eyeR.rotation.z, 0, 10, dt);
    } else {
      anim.joyRaise = U.damp(anim.joyRaise, 0, ANIM.joyArmUpSpeed, dt);
      const swing = Math.sin(anim.bounceT) * 0.25 * Math.min(speedRatio, 1) * P.armSwingMul;
      armL.rotation.x = swing - anim.joyRaise * 2.4;
      armR.rotation.x = -swing - anim.joyRaise * 2.4;
      if (parts.eyeL) parts.eyeL.rotation.z = U.damp(parts.eyeL.rotation.z, 0, 10, dt);
      if (parts.eyeR) parts.eyeR.rotation.z = U.damp(parts.eyeR.rotation.z, 0, 10, dt);
    }

    // シズクの泡はふわふわ漂わせる
    if (parts.bubbles) {
      const t = anim.bounceT;
      for (let i = 0; i < parts.bubbles.length; i++) {
        parts.bubbles[i].position.y += Math.sin(t * 1.7 + i) * 0.0006;
      }
    }
  }

  window.Game = window.Game || {};
  window.Game.charRig = { animate, setPose, setExpression };
})();
