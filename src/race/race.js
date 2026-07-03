// レース進行管理。カウントダウン→周回/順位トラッキング→リザルトまでを一元管理する。
// HUD/AIは RaceManager の公開状態(getStandings/raceTime/phase等)だけを参照すること。
(function () {
  const RACE_TUNING = {
    countdownStepSec: 1,          // カウントダウン1段の秒数(3→2→1→GOの間隔)
    countdownStartN: 3,           // カウントダウン開始番号
    rocketStartWindow: 0.45,      // GO直前、この秒数スロットル押しっぱなしならロケットスタート成功
    rocketStartBoost: 0.85,       // ロケットスタート成功時のブースト秒数
    lapCrossBackThresh: -0.5,     // progress差がこれ未満なら順方向にスタートラインを通過(周回+1)
    lapCrossFwdThresh: 0.5,       // progress差がこれ超なら逆方向にスタートラインを通過(周回-1)
    finishLingerSec: 15,          // プレイヤー完走からフェーズ'finished'に移るまでの待機秒数
  };

  // プレイヤー用コントローラ。入力をそのままGame.inputから取得して返すだけ。
  Game.PlayerController = class PlayerController {
    constructor() {
      this.isPlayer = true;
      this.isAI = false;
    }

    // dt/kart/course/raceは他コントローラとインターフェースを揃えるための引数(未使用)
    getInput(dt, kart, course, race) {
      return Game.input.getState();
    }
  };

  // レース進行管理本体。
  // entries: [{ kart, controller }] controller は { isPlayer?, isAI?, getInput(dt,kart,course,race) }
  Game.RaceManager = class RaceManager {
    constructor({ course, entries, laps }) {
      this.course = course;
      this.entries = entries;
      this.laps = laps ?? Game.config.race.laps;

      this.playerKart = null;
      for (const e of entries) {
        if (e.controller && e.controller.isPlayer) { this.playerKart = e.kart; break; }
      }

      this.phase = 'countdown';
      this.countdownT = RACE_TUNING.countdownStartN * RACE_TUNING.countdownStepSec;
      this._lastCountShown = null;
      this.raceTime = 0;
      this._playerFinishT = null; // プレイヤー完走からの経過タイマー(finished移行判定用)

      // ロケットスタート判定用: GO直前 rocketStartWindow 秒間のスロットル押下時間を積算
      this._throttleHeldT = new Map();
      for (const e of entries) this._throttleHeldT.set(e.kart, 0);

      for (const e of entries) e.kart.lapTimes = [];

      // コールバック(必要に応じて外部からセット)
      this.onCountdownTick = null;
      this.onGo = null;
      this.onLapChange = null;
      this.onKartFinish = null;
      this.onRaceEnd = null;
    }

    start() {
      const positions = this.course.startPositions(this.entries.length);
      this.entries.forEach((e, i) => {
        const sp = positions[i];
        e.kart.resetAt(sp.pos, sp.heading, sp.hint);
        e.kart.finished = false;
        e.kart.rank = i + 1;
        e.kart.lap = 1;
        e.kart.lapTimes = [];
        e.kart.bestLap = null;
        e.kart.finishTime = null;
        // 路面クエリをここで一度取っておく(lapProgress初期化用にprogressが要る)
        const q = this.course.query(e.kart.pos, sp.hint);
        e.kart.lastQuery = q;
        e.kart._prevP = q.progress;             // 直近フレームの生progress(0..1)
        e.kart._lapProgress = q.progress - 1;    // スタートはライン後方(p≈0.98)なので≈-0.02
        e.kart.raceProgress = e.kart._lapProgress;
        this._throttleHeldT.set(e.kart, 0);
      });

      this.phase = 'countdown';
      this.countdownT = RACE_TUNING.countdownStartN * RACE_TUNING.countdownStepSec;
      this._lastCountShown = RACE_TUNING.countdownStartN;
      this.raceTime = 0;
      this._playerFinishT = null;
      if (this.onCountdownTick) this.onCountdownTick(this._lastCountShown);
    }

    // ---- 内部: カウントダウン中の進行 ----
    _updateCountdown(dt) {
      // ロケットスタート判定用に、実入力(ゼロ入力ではなく)のスロットル状態を監視する。
      // AIは判定にconfig.ai.rocketStartChanceの確率抽選を使うため、ここでは人間側だけ監視すれば足りる
      // (AIコントローラをレース開始前に不用意に呼び出さないためでもある)。
      for (const e of this.entries) {
        if (!(e.controller && e.controller.isAI)) {
          const input = e.controller.getInput(dt, e.kart, this.course, this);
          const held = this._throttleHeldT.get(e.kart) ?? 0;
          if (input && input.throttle > 0) {
            this._throttleHeldT.set(e.kart, held + dt);
          } else {
            this._throttleHeldT.set(e.kart, 0);
          }
        }
        // カート自体はカウントダウン中は静止(ゼロ入力で更新)
        e.kart.update(dt, { throttle: 0, brake: 0, steer: 0, drift: false, driftPressed: false }, this.course);
      }

      this.countdownT -= dt;
      const remaining = Math.max(0, this.countdownT);
      const shown = remaining > 0 ? Math.ceil(remaining / RACE_TUNING.countdownStepSec) : 0;
      if (shown !== this._lastCountShown) {
        this._lastCountShown = shown;
        if (shown > 0) {
          if (this.onCountdownTick) this.onCountdownTick(shown);
        } else {
          this._go();
        }
      }
    }

    _go() {
      this.phase = 'racing';
      this.raceTime = 0;
      const ai = Game.config.ai;
      for (const e of this.entries) {
        let success;
        if (e.controller && e.controller.isAI) {
          success = Math.random() < ai.rocketStartChance;
        } else {
          success = (this._throttleHeldT.get(e.kart) ?? 0) >= RACE_TUNING.rocketStartWindow;
        }
        if (success) e.kart.applyBoost(RACE_TUNING.rocketStartBoost);
      }
      if (this.onGo) this.onGo();
    }

    // ---- 内部: レース中の周回/順位トラッキング ----
    _trackLap(kart) {
      const q = kart.lastQuery;
      if (!q) return;
      const p = q.progress;
      const prevP = kart._prevP ?? p;
      let delta = p - prevP;
      if (delta < RACE_TUNING.lapCrossBackThresh) delta += 1;      // 順方向にライン通過(0.98→0.02など)
      else if (delta > RACE_TUNING.lapCrossFwdThresh) delta -= 1;  // 逆走でライン跨ぎ
      kart._prevP = p;

      const lapProgress = kart._lapProgress + delta;
      kart._lapProgress = lapProgress;
      kart.raceProgress = lapProgress;

      const newLap = Game.U.clamp(Math.floor(lapProgress) + 1, 1, this.laps);
      if (newLap > kart.lap && !kart.finished) {
        kart.lap = newLap;
        const last = this.raceTime;
        const prevSum = kart.lapTimes.length > 0 ? kart.lapTimes[kart.lapTimes.length - 1] : 0;
        kart.lapTimes.push(last);
        const lapDuration = last - prevSum;
        if (kart.bestLap == null || lapDuration < kart.bestLap) kart.bestLap = lapDuration;
        if (this.onLapChange) this.onLapChange(kart, kart.lap);
      } else {
        kart.lap = newLap;
      }

      if (!kart.finished && lapProgress >= this.laps) {
        kart.finished = true;
        kart.finishTime = this.raceTime;
        // 最終ラップのラップタイムが未記録なら(周回検知と同フレームで完走した場合)ここで確定する
        if (kart.lapTimes.length < this.laps) {
          const last = this.raceTime;
          const prevSum = kart.lapTimes.length > 0 ? kart.lapTimes[kart.lapTimes.length - 1] : 0;
          kart.lapTimes.push(last);
          const lapDuration = last - prevSum;
          if (kart.bestLap == null || lapDuration < kart.bestLap) kart.bestLap = lapDuration;
        }
        const rank = this._rankOfFinisher(kart);
        if (this.onKartFinish) this.onKartFinish(kart, kart.finishTime, rank);

        if (kart === this.playerKart) {
          this._playerFinishT = 0;
          // プレイヤー完走後は自動走行(AI)に切り替える
          const entry = this.entries.find((e) => e.kart === kart);
          if (entry) entry.controller = new Game.AIController(kart);
        }
      }
    }

    _rankOfFinisher(kart) {
      // 既に完走済みのカートのうち、自分以下のfinishTimeを持つ数+1が自分の順位
      let rank = 1;
      for (const e of this.entries) {
        if (e.kart !== kart && e.kart.finished && e.kart.finishTime <= kart.finishTime) rank++;
      }
      return rank;
    }

    _updateRanks() {
      const sorted = this.entries.map((e) => e.kart).slice().sort((a, b) => {
        if (a.finished && b.finished) return a.finishTime - b.finishTime;
        if (a.finished) return -1;
        if (b.finished) return 1;
        return b.raceProgress - a.raceProgress;
      });
      sorted.forEach((k, i) => { k.rank = i + 1; });
    }

    update(dt) {
      if (this.phase === 'countdown') {
        this._updateCountdown(dt);
        return;
      }
      if (this.phase === 'finished') return;

      this.raceTime += dt;

      const karts = this.entries.map((e) => e.kart);
      for (const e of this.entries) {
        const input = e.controller.getInput(dt, e.kart, this.course, this);
        e.kart.update(dt, input, this.course);
      }
      Game.Kart.collide(karts);

      for (const e of this.entries) this._trackLap(e.kart);
      this._updateRanks();

      const allFinished = this.entries.every((e) => e.kart.finished);
      const playerDone = this._playerFinishT != null;
      if (playerDone) this._playerFinishT += dt;
      if (allFinished || (playerDone && this._playerFinishT >= RACE_TUNING.finishLingerSec)) {
        this._finishRace();
      }
    }

    _finishRace() {
      this.phase = 'finished';
      const results = this.entries.map((e) => {
        const k = e.kart;
        return {
          kart: k,
          rank: k.rank,
          finishTime: k.finished ? k.finishTime : null,
          lapTimes: k.lapTimes.slice(),
          bestLap: k.bestLap ?? null,
        };
      }).sort((a, b) => a.rank - b.rank);
      if (this.onRaceEnd) this.onRaceEnd(results);
    }

    getStandings() {
      return this.entries
        .map((e) => e.kart)
        .slice()
        .sort((a, b) => a.rank - b.rank)
        .map((k) => ({
          kart: k, rank: k.rank, lap: k.lap, lapProgress: k.raceProgress, finished: k.finished,
        }));
    }

    trackDistance(a, b) {
      return (a.raceProgress - b.raceProgress) * this.course.spline.total;
    }
  };
})();
