// CPUドライバー。Game.AIController を実装。
// レコードライン追従+コーナー減速+ドリフト+ギャップ/壁回避+スタック脱出+ラバーバンドを行う。
// 入力はKart.update()が受け取るinputLikeと同形式で返す。

// ---- チューニング用ローカル定数 ----
const AI_SKILL_BASE = 0.65;        // skillデフォルトの下限
const AI_SKILL_RANGE = 0.30;       // skillデフォルトのばらつき幅

const AI_CORNER_LOOKAHEAD = 10;    // 曲率推定用の追加先読みサンプル数
const AI_CORNER_SPEED_RATIO = 0.62; // このmaxSpeed比を超えていて急カーブなら減速対象
const AI_CORNER_THROTTLE_CUT = 0.16; // 急カーブ判定の曲率しきい値(rad/サンプル)
const AI_CORNER_BRAKE_TURN = 0.30; // これ以上の鋭角(ヘアピン)ならブレーキも使う
const AI_CORNER_BRAKE_SPEED_RATIO = 0.8; // ブレーキを踏む速度比のしきい値

const AI_DRIFT_SAMPLE_STEP = 3;    // ドリフト用曲率サンプルの間隔(先読みインデックス刻み)
const AI_DRIFT_SAMPLE_COUNT = 4;   // ドリフト判定に見る先読みサンプル数
const AI_DRIFT_RELEASE_MARGIN = 0.55; // 曲率がdriftMinTurnのこの比まで緩んだら解放

const AI_HAZARD_LOOKAHEAD_DIST = 30; // ギャップ/ジャンプ台/落下区間を警戒する前方距離(units)
const AI_HAZARD_LINE_PULL = 6;       // ハザード接近時にlineOffsetを0へ寄せる速さ(/s相当のdamp率)

// 落下区間(fallZone)では路肩が無く縁から落ちるため、通常より慎重に走る
const AI_FALL_MARGIN_RATIO = 0.5;    // 内側ブレンド補正を開始する半幅比(通常0.75より早い)
const AI_FALL_FULL_RATIO = 0.7;      // リカバリーへ入る半幅比(通常0.85より早い)
const AI_FALL_CURVE_SLOW = 0.05;     // この曲率以上のカーブが前方にあれば減速
const AI_FALL_THROTTLE_CURVE = 0.55; // 落下区間+カーブでのスロットル上限
const AI_FALL_THROTTLE = 0.85;       // 落下区間(直線)でのスロットル上限

// 急カーブでは先読みを短縮し、目標点のオーバーシュート(ジグザグ)を防ぐ
// (縮めすぎると逆に至近の目標点に振り回されて反対方向へ暴れるため、控えめに留める)
const AI_CURVE_SHORTEN_CURV = 0.10;  // この曲率(rad/サンプル)から先読み短縮を開始
const AI_CURVE_SHORTEN_MAX = 0.28;   // 最大でこの比まで先読みサンプル数を縮める
const AI_CURVE_SHORTEN_MIN_COUNT = 6; // 先読みサンプル数の下限(これ未満に縮めない)

const AI_WALL_MARGIN_RATIO = 0.75;   // halfWidthに対してこの比を超えたら内側へのブレンド補正を開始
const AI_WALL_FULL_RATIO = 0.85;     // halfWidthに対してこの比を超えたらリカバリーモードへ
// ドリフトのステア強制は壁回避と競合しうるため、壁回避が始まったら即ドリフトも解除する(同じ比を共有)
const AI_WALL_DRIFT_CANCEL_RATIO = AI_WALL_MARGIN_RATIO;

// ---- リカバリーモード ----
// 衝突・スピン・ドリフト暴走で「コースに対して大きく誤った向き」や「壁ゾーン」に陥った時、
// 通常のライン追従・壁バンバン制御(全力±1ステア→反対壁へピンポン)を止め、
// 中心線上の近い先読み点へ滑らかに向き直す。旋回力は速度に比例するため低速ブレーキは厳禁。
const AI_RECOVER_MISALIGN = 1.75;    // 進行方向と接線の角度差がこれ(rad,≈100°)を超えたらリカバリー
const AI_RECOVER_TARGET_AHEAD = 8;   // リカバリー時に狙う中心線上の先読みサンプル数
const AI_RECOVER_GAIN = 2.0;         // リカバリー時のステアゲイン
const AI_RECOVER_BRAKE_SPEED = 14;   // 大きく向き直す必要がありこの速度超なら一旦減速(旋回半径を縮める)
const AI_RECOVER_BRAKE_ANGLE = 1.3;  // 減速判断の角度差しきい値(rad)
const AI_DRIFT_MAX_MISALIGN = 0.9;   // ドリフト中、接線とこの角度差(rad,≈52°)を超えたら強制解放

const AI_STUCK_SPEED = 4.5;          // これ未満をスタック候補とみなす速度
const AI_STUCK_TIME = 1.5;           // この秒数継続でスタック判定
const AI_STUCK_ESCAPE_TIME = 1.2;    // 脱出(バック+逆ステア)の継続秒数

const AI_FINISHED_THROTTLE = 0.6;    // ゴール後の巡航スロットル

const AI_STEER_CLAMP = 1;            // ステア出力のクランプ幅

Game.AIController = class AIController {
  constructor(kart, opts = {}) {
    this.kart = kart;
    kart.isAI = true;
    this.skill = opts.skill ?? (AI_SKILL_BASE + Math.random() * AI_SKILL_RANGE);
    // レコードラインの個体差(半幅比オフセット)
    this.lineOffset = (Math.random() * 2 - 1) * Game.config.ai.lineNoise;
    this._baseLineOffset = this.lineOffset;

    this._drifting = false;
    this._driftDir = 0;

    this._stuckT = 0;
    this._escapeT = 0;
  }

  // Phase3でアイテム使用ロジックを実装するためのフック(現在は空)
  useItem(kart, race) {}

  getInput(dt, kart, course, race) {
    const A = Game.config.ai, U = Game.U;

    // ラバーバンド: プレイヤーとの距離でmaxSpeedを毎フレーム上書き
    if (race && race.playerKart && typeof race.trackDistance === 'function') {
      const dist = race.trackDistance(race.playerKart, kart); // 正=プレイヤーが前
      const rb = A.rubberband;
      const factor = 1 + U.clamp(dist / rb.range, -1, 1) * (dist > 0 ? rb.maxBoost : rb.maxDrag);
      kart.maxSpeed = kart.baseMaxSpeed * factor * (0.94 + 0.06 * this.skill);
    }

    // ゴール後: ドリフトなしでライン追従のみ継続
    if (kart.finished) {
      const follow = this._followLine(kart, course);
      return {
        throttle: AI_FINISHED_THROTTLE, brake: 0, steer: follow.steer,
        drift: false, driftPressed: false, itemPressed: false, pausePressed: false,
      };
    }

    // スタック検出&脱出
    const speedAbs = Math.abs(kart.speed);
    if (this._escapeT > 0) {
      this._escapeT -= dt;
      const escapeSteer = this._escapeSteer || 0;
      return {
        throttle: 0, brake: 1, steer: escapeSteer,
        drift: false, driftPressed: false, itemPressed: false, pausePressed: false,
      };
    }
    if (speedAbs < AI_STUCK_SPEED && kart.grounded) {
      this._stuckT += dt;
      if (this._stuckT >= AI_STUCK_TIME) {
        this._stuckT = 0;
        this._escapeT = AI_STUCK_ESCAPE_TIME;
        const lat = kart.lastQuery ? kart.lastQuery.lateral : 0;
        // コース内側へ切り返す(バック中は前進時と逆操舵になる点に注意し、
        // 前進再開時に内側へ向くよう符号を選ぶ)
        this._escapeSteer = lat >= 0 ? -1 : 1;
        this._drifting = false;
        return {
          throttle: 0, brake: 1, steer: this._escapeSteer,
          drift: false, driftPressed: false, itemPressed: false, pausePressed: false,
        };
      }
    } else {
      this._stuckT = 0;
    }

    // 前方ハザード('gap'|'jump'|'fall'|null)判定 → ライン直進化+ドリフト禁止
    const hazard = this._hazardAhead(course, kart);
    const targetLineOffset = hazard ? 0 : this._baseLineOffset;
    this.lineOffset = U.damp(this.lineOffset, targetLineOffset, AI_HAZARD_LINE_PULL, dt);

    // レコードライン追従ステア
    const follow = this._followLine(kart, course);
    let steer = follow.steer;

    // 姿勢チェック: コース接線に対する向きのズレ
    const q = kart.lastQuery;
    const misalign = q ? U.wrapAngle(kart.heading - q.tangentAngle) : 0;
    let recovering = false;
    if (q) {
      const lat = q.lateral;
      // 落下区間では縁に寄る前に早めの補正を開始する
      const marginRatio = hazard === 'fall' ? AI_FALL_MARGIN_RATIO : AI_WALL_MARGIN_RATIO;
      const fullRatio = hazard === 'fall' ? AI_FALL_FULL_RATIO : AI_WALL_FULL_RATIO;
      if (Math.abs(misalign) > AI_RECOVER_MISALIGN || Math.abs(lat) > q.halfWidth * fullRatio) {
        recovering = true;
      } else if (Math.abs(lat) > q.halfWidth * marginRatio) {
        // 軽度の壁寄り: 内側へブレンド補正(バンバン制御にしない)
        const over = U.clamp(
          (Math.abs(lat) - q.halfWidth * marginRatio) /
          Math.max(1e-3, q.halfWidth * (fullRatio - marginRatio)), 0, 1);
        const inwardSteer = lat > 0 ? -1 : 1;
        steer = U.lerp(steer, inwardSteer, over);
      }
    }

    const speedRatio = speedAbs / Math.max(1, kart.maxSpeed);
    let throttle = 1, brake = 0;
    if (recovering) {
      // 中心線上の近い先読み点へ滑らかに向き直す
      const s = course.spline;
      const idx = ((kart.progressHint ?? 0) + AI_RECOVER_TARGET_AHEAD) % s.count;
      const p = s.pts[idx];
      const desired = Math.atan2(p.x - kart.pos.x, p.z - kart.pos.z);
      const diff = U.wrapAngle(desired - kart.heading);
      steer = U.clamp(diff * AI_RECOVER_GAIN, -AI_STEER_CLAMP, AI_STEER_CLAMP);
      this._drifting = false;
      // 大回頭が必要で速すぎる時だけ減速(旋回半径を縮める)。低速でのブレーキは回頭不能を招くため禁止
      if (speedAbs > AI_RECOVER_BRAKE_SPEED && Math.abs(diff) > AI_RECOVER_BRAKE_ANGLE) {
        throttle = 0; brake = 1;
      }
    } else {
      // コーナー曲率推定(先読みしたtangentAngleの変化)による減速
      const curveInfo = this._curvature(course, kart, AI_CORNER_LOOKAHEAD);
      if (Math.abs(curveInfo.curv) > AI_CORNER_THROTTLE_CUT && speedRatio > AI_CORNER_SPEED_RATIO) {
        throttle = 0;
        if (Math.abs(curveInfo.curv) > AI_CORNER_BRAKE_TURN && speedRatio > AI_CORNER_BRAKE_SPEED_RATIO) {
          brake = 1;
        }
      }
      // 落下区間では控えめに(直線でも少し抑え、カーブでは大きく抑える)
      if (hazard === 'fall') {
        throttle = Math.min(throttle,
          Math.abs(curveInfo.curv) > AI_FALL_CURVE_SLOW ? AI_FALL_THROTTLE_CURVE : AI_FALL_THROTTLE);
      } else if (hazard === 'jump' || hazard === 'gap') {
        // ジャンプ台/ギャップは減速せず全開で直進して飛ぶ
        throttle = 1; brake = 0;
      }
    }
    steer = U.clamp(steer, -AI_STEER_CLAMP, AI_STEER_CLAMP);

    // ドリフト判定
    // 開始はホップ(空中)を経てkart側で成立するため、ホップ〜ドリフト中は
    // grounded=falseになっても継続扱いにする(spinT/hazardのみ強制解除条件とする)。
    let drift = false, driftPressed = false;
    if (!hazard && !recovering) {
      const dcurv = this._driftCurvature(course, kart);
      if (!this._drifting) {
        const canStart = kart.grounded && kart.spinT <= 0
          && speedAbs > A.driftMinSpeed && Math.abs(dcurv) >= A.driftMinTurn;
        if (canStart) {
          this._drifting = true;
          this._driftDir = Math.sign(dcurv) || Math.sign(steer) || 1;
          driftPressed = true;
          drift = true;
          // ホップ中にsteerが0だとkart側でドリフト方向が決まらないため、開始時から寄せる
          steer = U.clamp(this._driftDir * Math.max(Math.abs(steer), 0.6), -AI_STEER_CLAMP, AI_STEER_CLAMP);
        }
      } else {
        // 継続判定: スピン中、カーブが緩んだら(接地時のみ判定)、または壁際に迫ったら解放
        const releaseByCurve = kart.grounded
          && (Math.abs(dcurv) < A.driftMinTurn * AI_DRIFT_RELEASE_MARGIN || speedAbs < A.driftMinSpeed * 0.6);
        const nearWall = q && Math.abs(q.lateral) > q.halfWidth * AI_WALL_DRIFT_CANCEL_RATIO;
        // ドリフト暴走ガード: 接線から大きくズレた/コース外に出たら即解放
        const badAngle = Math.abs(misalign) > AI_DRIFT_MAX_MISALIGN;
        const offTrack = q && q.surface === 'offroad';
        if (kart.spinT > 0 || releaseByCurve || nearWall || badAngle || offTrack) {
          this._drifting = false;
          drift = false;
        } else {
          drift = true;
          // ドリフト中は内向きへステアを寄せる(ミニターボ充填を稼ぐ)
          steer = U.clamp(this._driftDir * Math.max(Math.abs(steer), 0.6), -AI_STEER_CLAMP, AI_STEER_CLAMP);
        }
      }
    } else {
      this._drifting = false;
    }

    return {
      throttle, brake, steer,
      drift, driftPressed,
      itemPressed: false,
      pausePressed: false,
    };
  }

  // 基準先読みサンプル数(仕様通り: lookAheadBase + |speed|*lookAheadSpeed)
  _lookAheadCount(kart) {
    const A = Game.config.ai;
    return A.lookAheadBase + Math.abs(kart.speed) * A.lookAheadSpeed;
  }

  // レコードライン(スプライン+個体差オフセット)への追従ステアを計算
  // 急カーブ区間では先読みを短縮し、目標点のオーバーシュート(ジグザグ)を防ぐ
  _followLine(kart, course) {
    const A = Game.config.ai, U = Game.U;
    const s = course.spline;
    const hintIdx = kart.progressHint ?? 0;
    const baseCount = this._lookAheadCount(kart);

    // 手前の粗い曲率で先読み距離を減衰させる(基準先読み点までの進行方向変化)
    const probeIdx = (hintIdx + Math.round(baseCount)) % s.count;
    const curv = Math.abs(Game.U.wrapAngle(s.tangentAngle(probeIdx) - s.tangentAngle(hintIdx)));
    const shorten = U.clamp((curv - AI_CURVE_SHORTEN_CURV) / AI_CURVE_SHORTEN_CURV, 0, 1) * AI_CURVE_SHORTEN_MAX;
    const count = Math.max(AI_CURVE_SHORTEN_MIN_COUNT, baseCount * (1 - shorten));

    const ahead = (hintIdx + Math.round(count)) % s.count;
    const p = s.pts[ahead], n = s.nrm[ahead], w = s.w[ahead];
    const tx = p.x + n.x * (this.lineOffset * w);
    const tz = p.z + n.z * (this.lineOffset * w);
    const dx = tx - kart.pos.x, dz = tz - kart.pos.z;
    const desired = Math.atan2(dx, dz);
    const diff = U.wrapAngle(desired - kart.heading);
    const steer = U.clamp(diff * A.steerGain, -AI_STEER_CLAMP, AI_STEER_CLAMP);
    return { steer, aheadIdx: ahead };
  }

  // 前方の進行方向変化(曲率)を推定。正=左カーブ、負=右カーブ相当。
  _curvature(course, kart, extra) {
    const s = course.spline;
    const hintIdx = kart.progressHint ?? 0;
    const base = (hintIdx + Math.round(this._lookAheadCount(kart))) % s.count;
    const far = (base + extra) % s.count;
    const a0 = s.tangentAngle(base), a1 = s.tangentAngle(far);
    const curv = Game.U.wrapAngle(a1 - a0);
    return { curv };
  }

  // ドリフト開始/継続判定用: 前方Nサンプルの曲率が同符号で閾値以上続いているか
  _driftCurvature(course, kart) {
    const s = course.spline;
    const hintIdx = kart.progressHint ?? 0;
    const startIdx = (hintIdx + Math.round(this._lookAheadCount(kart))) % s.count;
    let sign = 0, minAbs = Infinity, ok = true;
    for (let k = 0; k < AI_DRIFT_SAMPLE_COUNT; k++) {
      const i0 = (startIdx + k * AI_DRIFT_SAMPLE_STEP) % s.count;
      const i1 = (i0 + AI_DRIFT_SAMPLE_STEP) % s.count;
      const d = Game.U.wrapAngle(s.tangentAngle(i1) - s.tangentAngle(i0));
      const sg = Math.sign(d);
      if (sg === 0) continue;
      if (sign === 0) sign = sg;
      else if (sg !== sign) { ok = false; break; }
      minAbs = Math.min(minAbs, Math.abs(d));
    }
    if (!ok || sign === 0 || minAbs === Infinity) return 0;
    return sign * minAbs;
  }

  // 前方AI_HAZARD_LOOKAHEAD_DIST units以内のハザード種別を返す('gap'|'jump'|'fall'|null)
  // gaps/jumpPadsは直進+全速で飛ぶ必要があり、fallZonesは減速+中央寄せで慎重に走る
  _hazardAhead(course, kart) {
    const s = course.spline;
    const hintIdx = kart.progressHint ?? 0;
    const stepDist = s.step || (s.total / s.count);
    const sampleSpan = Math.max(1, Math.round(AI_HAZARD_LOOKAHEAD_DIST / Math.max(0.01, stepDist)));
    let fall = null;
    for (let k = 0; k <= sampleSpan; k++) {
      const idx = (hintIdx + k) % s.count;
      const t = s.progress(idx);
      if (course.inZone(course.gaps, t)) return 'gap';
      for (const pad of course.pads) {
        if (pad.type === 'jump' && Game.Course.inRange(pad, t)) return 'jump';
      }
      if (!fall && course.inZone(course.fallZones, t)) fall = 'fall';
    }
    return fall;
  }
};
