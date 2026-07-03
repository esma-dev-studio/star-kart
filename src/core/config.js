// 全チューニング定数。バランス調整は必ずここを触る(コード内マジックナンバー禁止)
Game.config = {
  physics: {
    maxSpeed: 30,            // 基準最高速 (units/s)
    accel: 20,               // 基礎加速度
    brakeDecel: 34,
    reverseMaxSpeed: 9,
    coastDecel: 9,           // アクセルオフ時の減速
    overSpeedDecel: 14,      // 上限超過時(ブースト切れ等)の減速
    baseTurnRate: 2.05,      // 通常旋回 rad/s
    highSpeedSteerScale: 0.55, // 最高速時のステア効き(1=変化なし)
    gripNormal: 8.5,         // 速度方向がheadingへ収束する速さ(/s)
    gripDrift: 3.0,          // ドリフト中(小さいほど滑る)
    gripAir: 2.5,            // 空中
    hopImpulse: 3.2,         // ドリフト開始ホップの上向き初速(滞空≈0.32秒)
    gravity: 20,
    driftMinSpeed: 13,       // これ未満ではドリフト不可/強制解除
    driftTurnMin: 0.55,      // ドリフト中の最小旋回(外側へ当て舵時)
    driftTurnMax: 2.75,      // ドリフト中の最大旋回(内側へフル舵時)
    driftChargeBase: 0.75,   // ミニターボ充填速度(基礎)
    driftChargeSteer: 0.55,  // 内側フル舵での追加充填
    miniTurbo: [             // 3段階: 青→橙→紫
      { time: 0.8, boost: 0.55 },
      { time: 1.8, boost: 0.95 },
      { time: 3.0, boost: 1.45 },
    ],
    sparkColors: [0x55c8ff, 0xffa030, 0xd05dff],
    boostMultiplier: 1.35,   // ブースト中の速度上限倍率
    padBoostTime: 0.9,       // ブーストパッドの効果時間
    offroadMultiplier: 0.5,  // コース外の速度上限倍率
    spinDuration: 1.1,       // 被弾スピン時間
    wallRestitution: 0.35,   // 壁に深い角度で当たった時に残る速度割合
    kartRadius: 1.5,         // カート同士の衝突半径
    jumpImpulse: 7.5,        // ジャンプ台の上向き初速
    jumpPadMinSpeed: 22,     // ジャンプ台の最低射出速度(低速で踏んでもギャップを飛べる保証)
    padFlightCenter: 1.6,    // ジャンプ台飛行中に路面中央へ吸い寄せる強さ(/s)。着地失敗の救済
    fallRespawnDepth: 12,    // 路面からこれだけ落ちたらリスポーン
    respawnLockTime: 0.9,    // リスポーン後の操作ロック
  },
  cameraCfg: {
    dist: 7.6, height: 3.4,
    lookAhead: 7, lookHeight: 1.2,
    fovBase: 62, fovSpeed: 8, fovBoost: 12,  // 速度/ブーストによるFOV加算
    posDamp: 7, angDamp: 4.5,
  },
  statsMap: {                // キャラステータス(1-5, 基準3)→物理係数
    speed: 0.035,            // maxSpeed倍率/ポイント
    accel: 0.11,
    handling: 0.07,
    weightStep: 0.25,        // 質量 = 1 + (weight-3)*この値
  },
  race: { laps: 3, kartCount: 8, countdownSec: 3 },
  ai: {
    lookAheadBase: 10,       // 先読みサンプル数(基礎)
    lookAheadSpeed: 0.55,    // +速度×この係数
    steerGain: 2.4,          // 角度差→ステア量
    driftMinTurn: 0.045,     // この曲率(rad/サンプル)以上のカーブでドリフト検討
    driftMinSpeed: 18,
    rubberband: {
      range: 90,             // プレイヤーとの距離がこの値で効果最大
      maxBoost: 0.13,        // 後方時の最大速度ボーナス
      maxDrag: 0.09,         // 前方時の最大速度ペナルティ
    },
    lineNoise: 0.25,         // レコードラインの個体差(半幅比)
    rocketStartChance: 0.6,  // CPUのロケットスタート成功率
  },
};
