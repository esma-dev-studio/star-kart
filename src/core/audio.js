// Web Audio API による全合成サウンド(Game.audio)。
// - init()はユーザー操作後に呼ばれる想定。呼ばれるまで全APIは安全にno-op
// - BGMは自前の16分音符ステップシーケンサ(AudioContext時刻でスケジューリング、lookahead方式)
// - SFXは単発の合成音(オシレータ/ノイズバッファ)
(function () {
  // ==== ローカル定数(マジックナンバー集約) ====
  const C = {
    masterGain: 0.45,
    bgmBusGain: 0.9,
    sfxBusGain: 0.85,
    compressor: { threshold: -18, knee: 22, ratio: 5, attack: 0.003, release: 0.25 },

    stepDur: 0.25,          // 16分音符 = 0.25 * (60/BPM) 秒換算のベースは _stepSeconds() で算出
    lookaheadMs: 25,        // スケジューラのタイマ間隔(ms)
    scheduleAheadSec: 0.14, // この秒数先までのステップを事前スケジュール

    finalLapTempoMul: 1.12, // 最終ラップのテンポ倍率
    finalLapPitchMul: 1.03, // 最終ラップの微ピッチアップ

    engine: {
      baseFreq: 55,
      maxFreqMul: 3.4,
      gain: 0.05,
      lowpassBase: 500,
      lowpassSpeedMul: 2600,
    },

    // 走行音レイヤー(エンジン音に重ねる持続音)。合計してもエンジンを覆わない控えめな音量に
    drive: {
      // オフロード走行音: ノイズ→lowpass。未舗装路+接地+速度>speedMinで立ち上がる
      offroad: {
        gainMax: 0.14,
        speedMin: 2,
        filterMin: 400, filterMax: 900,
        attackTau: 0.08,  // 立ち上がりは自然に
        releaseTau: 0.035, // 抜けるときは素早く0へ
      },
      // ドリフトスキール: ノイズ→bandpass(Q高め)。速いほど高く鋭い音に
      drift: {
        gainMax: 0.10,
        gainFloorRatio: 0.4, // ドリフト開始直後(低速側)でも最低限鳴る比率
        filterBase: 1600, filterRange: 500,
        qMin: 6, qMax: 11,
        smoothTau: 0.05,
      },
      // 風切り音: ノイズ→highpass。高速域で速度の2乗で立ち上がる
      wind: {
        gainMax: 0.08,
        filterFreq: 2500,
        ratioThreshold: 0.7, // speed/maxSpeedがこれを超えてから立ち上がる
        boostMul: 1.3,       // ブースト中はさらに+30%
        smoothTau: 0.06,
      },
      // ブースト開始の加速ワッシュ(単発ノイズスイープ)
      whoosh: {
        filterStart: 600, filterEnd: 6000, sweepDur: 0.4,
        dur: 0.45, gainPeak: 0.16,
      },
    },

    // BGM定義。tempo(BPM), key(ルート周波数Hz), steps(1小節=16step)*bars
    songs: {
      title: {
        tempo: 152, bars: 8, swing: 0,
        chords: [
          { root: 261.63, third: 329.63, fifth: 392.00 }, // C
          { root: 349.23, third: 440.00, fifth: 523.25 }, // F
          { root: 220.00, third: 261.63, fifth: 329.63 }, // Am
          { root: 392.00, third: 493.88, fifth: 587.33 }, // G
        ],
        melodyWave: 'square',
        melody: [
          0, 4, 7, 12, 11, 7, 9, 7, 5, 4, 5, 7, 9, 7, 4, 0,
          -1, -1, 0, 4, 7, 9, 7, 4, 5, 4, 2, 0, -1, -1, 0, -1,
        ],
        bassWave: 'triangle',
        drumPattern: 'pop',
        melodyGain: 0.16, bassGain: 0.14, drumGain: 0.16,
      },
      cookieTown: {
        tempo: 118, bars: 8, swing: 0.08,
        chords: [
          { root: 293.66, third: 369.99, fifth: 440.00 }, // D
          { root: 246.94, third: 311.13, fifth: 369.99 }, // B(minorish)
          { root: 196.00, third: 246.94, fifth: 293.66 }, // G
          { root: 220.00, third: 277.18, fifth: 329.63 }, // A
        ],
        melodyWave: 'triangle',
        melody: [
          0, -1, 4, 7, 9, 7, 4, -1, 5, -1, 4, 2, 0, -1, -1, -1,
          2, -1, 5, 9, 7, 5, 4, -1, 2, -1, 0, 2, 4, -1, -1, -1,
        ],
        bassWave: 'sine',
        drumPattern: 'pop',
        melodyGain: 0.15, bassGain: 0.16, drumGain: 0.13,
      },
      chocoCanyon: {
        tempo: 132, bars: 8, swing: 0,
        chords: [
          { root: 220.00, third: 261.63, fifth: 329.63 }, // Am
          { root: 196.00, third: 233.08, fifth: 293.66 }, // Gm-ish(G,Bb,D)
          { root: 174.61, third: 207.65, fifth: 261.63 }, // F
          { root: 246.94, third: 293.66, fifth: 369.99 }, // Bm-ish
        ],
        melodyWave: 'sawtooth',
        melody: [
          0, 3, 7, 10, 12, 10, 7, 3, 0, 3, 7, 3, 5, 3, 0, -1,
          -3, 0, 3, 7, 3, 0, -3, -5, 0, 3, 7, 10, 7, 3, 0, -1,
        ],
        bassWave: 'square',
        drumPattern: 'perc',
        melodyGain: 0.15, bassGain: 0.17, drumGain: 0.18,
      },
      skyCastle: {
        tempo: 140, bars: 8, swing: 0,
        chords: [
          { root: 261.63, third: 329.63, fifth: 392.00 }, // C
          { root: 329.63, third: 415.30, fifth: 493.88 }, // E
          { root: 220.00, third: 277.18, fifth: 329.63 }, // Am(with maj3 shimmer)
          { root: 349.23, third: 440.00, fifth: 523.25 }, // F
        ],
        melodyWave: 'triangle',
        arpeggio: true,
        melody: [
          0, 4, 7, 12, 7, 4, 0, 4, 2, 5, 9, 14, 9, 5, 2, 5,
          0, 4, 7, 11, 7, 4, 0, 4, 5, 9, 12, 9, 5, 9, 5, 2,
        ],
        bassWave: 'sine',
        drumPattern: 'sparkle',
        melodyGain: 0.13, bassGain: 0.12, drumGain: 0.10,
      },
      auroraFrost: {
        // 夜の氷原: 冷たくきらめくドリーミーなアルペジオ(Am-F-C-G)
        tempo: 126, bars: 8, swing: 0,
        chords: [
          { root: 220.00, third: 261.63, fifth: 329.63 }, // Am
          { root: 174.61, third: 220.00, fifth: 261.63 }, // F
          { root: 261.63, third: 329.63, fifth: 392.00 }, // C
          { root: 196.00, third: 246.94, fifth: 293.66 }, // G
        ],
        melodyWave: 'triangle',
        arpeggio: true,
        melody: [
          0, -1, 3, 7, 10, -1, 7, 3, 2, -1, 5, 9, 12, -1, 9, 5,
          0, 3, 7, 10, 12, -1, 10, 7, 5, -1, 3, 2, 0, -1, -1, -1,
        ],
        bassWave: 'sine',
        drumPattern: 'sparkle',
        melodyGain: 0.13, bassGain: 0.13, drumGain: 0.09,
      },
      solarForge: {
        // 恒星炉の重工業地帯: 下降形(Dm-C-Bb-A)のドライビングインダストリアル
        tempo: 138, bars: 8, swing: 0,
        chords: [
          { root: 146.83, third: 174.61, fifth: 220.00 }, // Dm
          { root: 130.81, third: 164.81, fifth: 196.00 }, // C
          { root: 116.54, third: 146.83, fifth: 174.61 }, // Bb
          { root: 110.00, third: 138.59, fifth: 164.81 }, // A
        ],
        melodyWave: 'sawtooth',
        melody: [
          0, 0, 3, 5, 7, -1, 7, 8, 7, 5, 3, -1, 0, 3, 5, 3,
          0, 0, 3, 5, 7, 10, 8, 7, 5, 3, 2, -1, 0, -1, -1, -1,
        ],
        bassWave: 'square',
        drumPattern: 'perc',
        melodyGain: 0.14, bassGain: 0.18, drumGain: 0.18,
      },
      voidSpiral: {
        // 次元の裂け目: 半音の揺らぎとスウィングでうねる不安定シンセ(Em-C-F#m-Bm)
        tempo: 134, bars: 8, swing: 0.10,
        chords: [
          { root: 164.81, third: 196.00, fifth: 246.94 }, // Em
          { root: 130.81, third: 164.81, fifth: 196.00 }, // C
          { root: 185.00, third: 220.00, fifth: 277.18 }, // F#m
          { root: 123.47, third: 146.83, fifth: 185.00 }, // Bm
        ],
        melodyWave: 'square',
        arpeggio: true,
        melody: [
          0, -1, 3, 7, 6, -1, 3, 0, 2, -1, 5, 8, 7, -1, 5, 2,
          0, 3, 6, 7, 10, -1, 7, 6, 3, -1, 2, 1, 0, -1, -1, -1,
        ],
        bassWave: 'triangle',
        drumPattern: 'perc',
        melodyGain: 0.13, bassGain: 0.15, drumGain: 0.15,
      },
      singularity: {
        // 事象の地平線: 低く重いベースが刻む緊迫ダークテクノ(Dm-Bb-Gm-A)
        tempo: 144, bars: 8, swing: 0,
        chords: [
          { root: 146.83, third: 174.61, fifth: 220.00 }, // Dm
          { root: 116.54, third: 146.83, fifth: 174.61 }, // Bb
          { root: 98.00,  third: 116.54, fifth: 146.83 }, // Gm
          { root: 110.00, third: 138.59, fifth: 164.81 }, // A
        ],
        melodyWave: 'sawtooth',
        melody: [
          0, 0, -1, 0, 3, -1, 0, -1, 5, -1, 3, -1, 1, 0, -1, 0,
          0, 0, -1, 0, 3, 5, -1, 7, 8, 7, 5, 3, 1, -1, 0, -1,
        ],
        bassWave: 'square',
        drumPattern: 'perc',
        melodyGain: 0.13, bassGain: 0.19, drumGain: 0.19,
      },
      result: {
        tempo: 150, bars: 4, swing: 0,
        chords: [
          { root: 349.23, third: 440.00, fifth: 523.25 }, // F
          { root: 392.00, third: 493.88, fifth: 587.33 }, // G
          { root: 440.00, third: 554.37, fifth: 659.25 }, // A
          { root: 392.00, third: 493.88, fifth: 587.33 }, // G
        ],
        melodyWave: 'square',
        melody: [
          0, 4, 7, 9, 7, 4, 0, -1, 2, 5, 9, 12, 9, 5, 2, -1,
        ],
        bassWave: 'triangle',
        drumPattern: 'pop',
        melodyGain: 0.17, bassGain: 0.15, drumGain: 0.15,
      },
      award: {
        tempo: 128, bars: 4, swing: 0,
        chords: [
          { root: 392.00, third: 493.88, fifth: 587.33 }, // G
          { root: 523.25, third: 659.25, fifth: 783.99 }, // C(oct up)
          { root: 440.00, third: 554.37, fifth: 659.25 }, // A
          { root: 523.25, third: 659.25, fifth: 783.99 }, // C
        ],
        melodyWave: 'sawtooth',
        melody: [
          0, 7, 12, 16, 12, 7, 4, 7, 0, 7, 12, 19, 16, 12, 7, 12,
        ],
        bassWave: 'square',
        drumPattern: 'fanfare',
        melodyGain: 0.18, bassGain: 0.17, drumGain: 0.17,
      },
    },
  };

  let ctx = null;
  let masterGainNode = null;
  let bgmBus = null;
  let sfxBus = null;
  let compressorNode = null;
  let noiseBuffer = null;
  let ready = false;
  // URLに ?mute=1 が付いていたら最初から消音する(自動テスト・検証セッション用。
  // リロードしてもクエリは残るので、検証中に音が漏れない)
  let muted = /[?&]mute=1/.test(location.search);
  // 設定画面用の音量(0〜1、各バスの基準ゲインに乗算)。setVolumesで変更・保存
  let volumes = { bgm: 1, sfx: 1 };

  // ==== BGMシーケンサ状態 ====
  let currentBgmId = null;
  let seq = null; // { song, stepIndex, nextStepTime, timerId, tempoMul, pitchMul }

  // ==== エンジン音状態 ====
  let engine = null; // { osc, gain, filter }

  // ==== 走行音レイヤー状態(オフロード/ドリフトスキール/風切り音) ====
  let drive = null; // { offSrc/offFilter/offGain, driftSrc/driftFilter/driftGain, windSrc/windFilter/windGain, prevBoostT }

  function safe(fn) {
    return function (...args) {
      if (!ready || !ctx) return;
      try { return fn.apply(null, args); } catch (e) { /* オーディオ失敗は握りつぶす(ゲーム続行優先) */ }
    };
  }

  function buildNoiseBuffer() {
    const len = ctx.sampleRate * 0.5;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    return buf;
  }

  // ==== 音量設定(bgm/sfx、各0〜1) ====
  function clamp01(v) {
    return Math.min(1, Math.max(0, v));
  }

  function loadVolumes() {
    try {
      const raw = localStorage.getItem('sgVolumes');
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        if (typeof parsed.bgm === 'number' && isFinite(parsed.bgm)) volumes.bgm = clamp01(parsed.bgm);
        if (typeof parsed.sfx === 'number' && isFinite(parsed.sfx)) volumes.sfx = clamp01(parsed.sfx);
      }
    } catch (e) { /* 壊れた保存値は無視し既定値のまま使う */ }
  }

  function applyVolumesToBuses() {
    if (bgmBus) bgmBus.gain.value = C.bgmBusGain * volumes.bgm;
    if (sfxBus) sfxBus.gain.value = C.sfxBusGain * volumes.sfx;
  }

  function init() {
    if (ctx) {
      // 二重呼び出し安全。suspendedなら再開を試みる
      if (ctx.state === 'suspended') ctx.resume().catch(() => {});
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return; // 非対応環境はno-opのまま
    try {
      ctx = new AC();
      masterGainNode = ctx.createGain();
      masterGainNode.gain.value = muted ? 0 : C.masterGain;
      compressorNode = ctx.createDynamicsCompressor();
      compressorNode.threshold.value = C.compressor.threshold;
      compressorNode.knee.value = C.compressor.knee;
      compressorNode.ratio.value = C.compressor.ratio;
      compressorNode.attack.value = C.compressor.attack;
      compressorNode.release.value = C.compressor.release;

      bgmBus = ctx.createGain();
      sfxBus = ctx.createGain();
      loadVolumes();          // 保存済み音量設定を読み込む(壊れていれば既定値のまま)
      applyVolumesToBuses();  // bgmBus/sfxBus.gainへ反映

      bgmBus.connect(compressorNode);
      sfxBus.connect(compressorNode);
      compressorNode.connect(masterGainNode);
      masterGainNode.connect(ctx.destination);

      noiseBuffer = buildNoiseBuffer();
      ready = true;

      if (ctx.state === 'suspended') ctx.resume().catch(() => {});

      // タブが見えていない間は音を完全に止める(Web Audioはタブ非表示でも鳴り続けるため、
      // バックグラウンドのタブからBGMが流れ続ける事故を防ぐ)。タブに戻ったら再開する
      if (typeof document !== 'undefined') {
        document.addEventListener('visibilitychange', () => {
          if (!ctx) return;
          if (document.hidden) {
            if (ctx.state === 'running') ctx.suspend().catch(() => {});
          } else if (ctx.state === 'suspended') {
            ctx.resume().catch(() => {});
          }
        });
      }
    } catch (e) {
      ctx = null; ready = false;
    }
  }

  // ==== ノートユーティリティ ====
  function semitoneToFreq(baseFreq, semis) {
    return baseFreq * Math.pow(2, semis / 12);
  }

  function playOsc(dest, wave, freq, startT, dur, gainPeak, opts) {
    opts = opts || {};
    const osc = ctx.createOscillator();
    osc.type = wave;
    osc.frequency.setValueAtTime(freq, startT);
    if (opts.pitchMul && opts.pitchMul !== 1) {
      osc.frequency.setValueAtTime(freq * opts.pitchMul, startT);
    }
    if (opts.slideTo) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(1, opts.slideTo), startT + dur);
    }
    const g = ctx.createGain();
    const atk = opts.attack ?? 0.005;
    const rel = opts.release ?? Math.max(0.03, dur * 0.4);
    g.gain.setValueAtTime(0.0001, startT);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, gainPeak), startT + atk);
    g.gain.exponentialRampToValueAtTime(0.0001, startT + atk + rel);
    osc.connect(g);
    g.connect(dest);
    osc.start(startT);
    osc.stop(startT + atk + rel + 0.05);
    return osc;
  }

  function playNoise(dest, startT, dur, gainPeak, opts) {
    opts = opts || {};
    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer;
    let node = src;
    if (opts.filterType) {
      const f = ctx.createBiquadFilter();
      f.type = opts.filterType;
      f.frequency.value = opts.filterFreq || 1000;
      node.connect(f);
      node = f;
    }
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, startT);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, gainPeak), startT + (opts.attack ?? 0.002));
    g.gain.exponentialRampToValueAtTime(0.0001, startT + dur);
    node.connect(g);
    g.connect(dest);
    src.start(startT);
    src.stop(startT + dur + 0.05);
    return src;
  }

  // ==== ドラムパターン(16ステップ、パターン名→各パートのon/velocity配列) ====
  const DRUM_PATTERNS = {
    pop: {
      kick:  [1,0,0,0, 0,0,1,0, 1,0,0,0, 0,0,1,0],
      snare: [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0],
      hat:   [1,0,1,0, 1,0,1,1, 1,0,1,0, 1,0,1,1],
    },
    perc: {
      kick:  [1,0,0,1, 0,0,1,0, 1,0,0,1, 0,1,1,0],
      snare: [0,0,1,0, 1,0,0,0, 0,0,1,0, 1,0,0,1],
      hat:   [1,1,0,1, 1,1,0,1, 1,1,0,1, 1,1,0,1],
    },
    sparkle: {
      kick:  [1,0,0,0, 0,0,0,0, 1,0,0,0, 0,0,0,0],
      snare: [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0],
      hat:   [1,0,1,1, 0,1,1,0, 1,0,1,1, 0,1,1,1],
    },
    fanfare: {
      kick:  [1,0,1,0, 1,0,1,0, 1,0,1,0, 1,0,1,1],
      snare: [0,0,0,1, 0,0,0,1, 0,0,0,1, 0,1,0,1],
      hat:   [1,1,1,1, 1,1,1,1, 1,1,1,1, 1,1,1,1],
    },
  };

  function triggerDrumStep(pattern, stepInBar, t, drumGain) {
    const kick = pattern.kick[stepInBar];
    const snare = pattern.snare[stepInBar];
    const hat = pattern.hat[stepInBar];
    if (kick) {
      playOsc(bgmBus, 'sine', 130, t, 0.16, drumGain * 1.1, { slideTo: 45, attack: 0.001, release: 0.14 });
    }
    if (snare) {
      playNoise(bgmBus, t, 0.12, drumGain * 0.9, { filterType: 'highpass', filterFreq: 1400, attack: 0.001 });
    }
    if (hat) {
      playNoise(bgmBus, t, 0.045, drumGain * 0.45, { filterType: 'highpass', filterFreq: 6000, attack: 0.001 });
    }
  }

  function stepSeconds(song) {
    const tempo = song.tempo * (seq ? seq.tempoMul : 1);
    return (60 / tempo) / 4; // 16分音符
  }

  function scheduleStep() {
    if (!seq) return;
    const song = seq.song;
    const sDur = stepSeconds(song);
    while (seq.nextStepTime < ctx.currentTime + C.scheduleAheadSec) {
      const totalSteps = song.bars * 16;
      const step = seq.stepIndex % totalSteps;
      const barIdx = Math.floor(step / 16) % song.chords.length;
      const stepInBar = step % 16;
      const chord = song.chords[barIdx % song.chords.length];
      const t = seq.nextStepTime;
      const pitchMul = seq.pitchMul;

      // ドラム
      const pattern = DRUM_PATTERNS[song.drumPattern] || DRUM_PATTERNS.pop;
      triggerDrumStep(pattern, stepInBar, t, song.drumGain);

      // ベース(1拍=4step毎にルート/5度を弾む)
      const bassBeat = stepInBar % 4;
      if (bassBeat === 0 || (bassBeat === 2 && stepInBar % 8 !== 0)) {
        const freq = (bassBeat === 0 ? chord.root : chord.fifth) / 2 * pitchMul;
        playOsc(bgmBus, song.bassWave, freq, t, sDur * 1.8, song.bassGain, { attack: 0.005, release: sDur * 1.5 });
      }

      // メロディ
      if (song.melody && song.melody.length) {
        const melIdx = step % song.melody.length;
        const semis = song.melody[melIdx];
        if (semis !== -1) {
          if (song.arpeggio) {
            const freq = semitoneToFreq(chord.root, semis) * pitchMul;
            playOsc(bgmBus, song.melodyWave, freq, t, sDur * 0.9, song.melodyGain, { attack: 0.004, release: sDur * 0.7 });
          } else {
            const freq = semitoneToFreq(chord.root, semis) * pitchMul;
            playOsc(bgmBus, song.melodyWave, freq, t, sDur * 1.6, song.melodyGain, { attack: 0.006, release: sDur * 1.3 });
          }
        }
      }

      seq.stepIndex++;
      seq.nextStepTime += sDur;
    }
  }

  function startSequencer(songId) {
    stopSequencerOnly();
    const song = C.songs[songId];
    if (!song) return;
    seq = {
      song,
      stepIndex: 0,
      nextStepTime: ctx.currentTime + 0.05,
      timerId: null,
      tempoMul: 1,
      pitchMul: 1,
    };
    seq.timerId = setInterval(scheduleStep, C.lookaheadMs);
  }

  function stopSequencerOnly() {
    if (seq && seq.timerId) clearInterval(seq.timerId);
    seq = null;
  }

  const playBgm = safe(function (id) {
    if (currentBgmId === id) return; // 同じidなら継続
    currentBgmId = id;
    if (!C.songs[id]) { stopSequencerOnly(); return; }
    startSequencer(id);
  });

  const stopBgm = safe(function () {
    currentBgmId = null;
    stopSequencerOnly();
  });

  const setFinalLap = safe(function (on) {
    if (!seq) return;
    seq.tempoMul = on ? C.finalLapTempoMul : 1;
    seq.pitchMul = on ? C.finalLapPitchMul : 1;
  });

  // ==== SFX ====
  const SFX = {
    hop: () => {
      playOsc(sfxBus, 'square', 420, ctx.currentTime, 0.09, 0.18, { slideTo: 620, attack: 0.002, release: 0.08 });
    },
    land: () => {
      playOsc(sfxBus, 'sine', 160, ctx.currentTime, 0.1, 0.2, { slideTo: 70, attack: 0.001, release: 0.09 });
      playNoise(sfxBus, ctx.currentTime, 0.06, 0.12, { filterType: 'lowpass', filterFreq: 800 });
    },
    miniTurbo: () => {
      const t = ctx.currentTime;
      playOsc(sfxBus, 'sawtooth', 300, t, 0.22, 0.22, { slideTo: 900, attack: 0.002, release: 0.2 });
      playOsc(sfxBus, 'square', 600, t + 0.02, 0.18, 0.14, { slideTo: 1200, attack: 0.002, release: 0.16 });
    },
    boost: () => {
      const t = ctx.currentTime;
      playOsc(sfxBus, 'sawtooth', 200, t, 0.35, 0.24, { slideTo: 1100, attack: 0.003, release: 0.32 });
      playNoise(sfxBus, t, 0.15, 0.1, { filterType: 'highpass', filterFreq: 2000 });
    },
    padBoost: () => {
      const t = ctx.currentTime;
      playOsc(sfxBus, 'square', 260, t, 0.28, 0.22, { slideTo: 980, attack: 0.002, release: 0.26 });
    },
    jump: () => {
      playOsc(sfxBus, 'triangle', 300, ctx.currentTime, 0.22, 0.2, { slideTo: 760, attack: 0.002, release: 0.2 });
    },
    itemGet: () => {
      const t = ctx.currentTime;
      [0, 4, 7, 12].forEach((s, i) => {
        playOsc(sfxBus, 'square', semitoneToFreq(523.25, s), t + i * 0.045, 0.12, 0.16, { attack: 0.002, release: 0.1 });
      });
    },
    itemUse: () => {
      playOsc(sfxBus, 'square', 500, ctx.currentTime, 0.1, 0.18, { slideTo: 300, attack: 0.002, release: 0.09 });
    },
    shoot: () => {
      const t = ctx.currentTime;
      playOsc(sfxBus, 'sawtooth', 700, t, 0.12, 0.2, { slideTo: 1400, attack: 0.001, release: 0.1 });
      playNoise(sfxBus, t, 0.05, 0.1, { filterType: 'highpass', filterFreq: 3000 });
    },
    hit: () => {
      const t = ctx.currentTime;
      playNoise(sfxBus, t, 0.14, 0.22, { filterType: 'lowpass', filterFreq: 1200 });
      playOsc(sfxBus, 'square', 140, t, 0.14, 0.16, { slideTo: 60, attack: 0.001, release: 0.13 });
    },
    spin: () => {
      const t = ctx.currentTime;
      for (let i = 0; i < 4; i++) {
        playOsc(sfxBus, 'square', 500 - i * 80, t + i * 0.08, 0.09, 0.14, { attack: 0.001, release: 0.08 });
      }
    },
    shieldBreak: () => {
      const t = ctx.currentTime;
      playNoise(sfxBus, t, 0.18, 0.2, { filterType: 'bandpass', filterFreq: 2200 });
      playOsc(sfxBus, 'triangle', 900, t, 0.15, 0.14, { slideTo: 300, attack: 0.001, release: 0.14 });
    },
    star: () => {
      const t = ctx.currentTime;
      [0, 3, 7, 10, 12].forEach((s, i) => {
        playOsc(sfxBus, 'square', semitoneToFreq(392, s), t + i * 0.05, 0.16, 0.15, { attack: 0.002, release: 0.14 });
      });
    },
    fall: () => {
      playOsc(sfxBus, 'sawtooth', 500, ctx.currentTime, 0.4, 0.18, { slideTo: 80, attack: 0.002, release: 0.38 });
    },
    respawn: () => {
      const t = ctx.currentTime;
      [0, 5, 9].forEach((s, i) => {
        playOsc(sfxBus, 'triangle', semitoneToFreq(300, s), t + i * 0.07, 0.14, 0.16, { attack: 0.002, release: 0.13 });
      });
    },
    countBeep: () => {
      playOsc(sfxBus, 'square', 700, ctx.currentTime, 0.12, 0.2, { attack: 0.002, release: 0.11 });
    },
    countGo: () => {
      const t = ctx.currentTime;
      playOsc(sfxBus, 'square', 1050, t, 0.3, 0.24, { attack: 0.002, release: 0.28 });
      playOsc(sfxBus, 'square', 1400, t + 0.02, 0.28, 0.18, { attack: 0.002, release: 0.26 });
    },
    finish: () => {
      const t = ctx.currentTime;
      [0, 4, 7, 12, 16].forEach((s, i) => {
        playOsc(sfxBus, 'square', semitoneToFreq(523.25, s), t + i * 0.09, 0.3, 0.2, { attack: 0.003, release: 0.28 });
      });
    },
    lap: () => {
      const t = ctx.currentTime;
      playOsc(sfxBus, 'triangle', 660, t, 0.14, 0.18, { attack: 0.002, release: 0.13 });
      playOsc(sfxBus, 'triangle', 880, t + 0.06, 0.16, 0.16, { attack: 0.002, release: 0.15 });
    },
    click: () => {
      playOsc(sfxBus, 'square', 800, ctx.currentTime, 0.05, 0.14, { attack: 0.001, release: 0.045 });
    },
    select: () => {
      const t = ctx.currentTime;
      playOsc(sfxBus, 'square', 600, t, 0.06, 0.14, { attack: 0.001, release: 0.05 });
      playOsc(sfxBus, 'square', 900, t + 0.04, 0.08, 0.14, { attack: 0.001, release: 0.07 });
    },
  };

  const sfx = safe(function (name) {
    const fn = SFX[name];
    if (fn) fn();
  });

  // ==== エンジン音 ====
  function startEngine() {
    if (engine) return;
    // 重厚化: メインsaw+デチューンsaw+サブオシレータ(1オクターブ下のsine)の3層
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.value = C.engine.baseFreq;
    const osc2 = ctx.createOscillator();
    osc2.type = 'sawtooth';
    osc2.frequency.value = C.engine.baseFreq;
    osc2.detune.value = 14; // わずかにずらして厚みを出す
    const sub = ctx.createOscillator();
    sub.type = 'sine';
    sub.frequency.value = C.engine.baseFreq / 2;
    const subGain = ctx.createGain();
    subGain.gain.value = 0.55;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = C.engine.lowpassBase;
    const g = ctx.createGain();
    g.gain.value = 0.0001;
    osc.connect(filter);
    osc2.connect(filter);
    sub.connect(subGain);
    subGain.connect(filter);
    filter.connect(g);
    g.connect(sfxBus);
    osc.start(); osc2.start(); sub.start();
    engine = { osc, osc2, sub, gain: g, filter };
  }

  function stopEngine() {
    if (!engine) return;
    try {
      const t = ctx.currentTime;
      engine.gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.08);
      engine.osc.stop(t + 0.1);
      engine.osc2.stop(t + 0.1);
      engine.sub.stop(t + 0.1);
    } catch (e) { /* noop */ }
    engine = null;
  }

  // ==== 走行音レイヤー(オフロード/ドリフトスキール/風切り音) ====
  // エンジン音と同じく「カートに随伴する」持続音源。既存noiseBufferを3系統で使い回す
  function startDriveLayer() {
    if (drive) return;
    const Dc = C.drive;

    // オフロード走行音: ノイズ→lowpass→ゲイン
    const offSrc = ctx.createBufferSource();
    offSrc.buffer = noiseBuffer;
    offSrc.loop = true;
    const offFilter = ctx.createBiquadFilter();
    offFilter.type = 'lowpass';
    offFilter.frequency.value = Dc.offroad.filterMin;
    const offGain = ctx.createGain();
    offGain.gain.value = 0.0001;
    offSrc.connect(offFilter); offFilter.connect(offGain); offGain.connect(sfxBus);
    offSrc.start();

    // ドリフトスキール: ノイズ→bandpass(Q高め)→ゲイン
    const driftSrc = ctx.createBufferSource();
    driftSrc.buffer = noiseBuffer;
    driftSrc.loop = true;
    const driftFilter = ctx.createBiquadFilter();
    driftFilter.type = 'bandpass';
    driftFilter.frequency.value = Dc.drift.filterBase;
    driftFilter.Q.value = Dc.drift.qMin;
    const driftGain = ctx.createGain();
    driftGain.gain.value = 0.0001;
    driftSrc.connect(driftFilter); driftFilter.connect(driftGain); driftGain.connect(sfxBus);
    driftSrc.start();

    // 風切り音: ノイズ→highpass→ゲイン
    const windSrc = ctx.createBufferSource();
    windSrc.buffer = noiseBuffer;
    windSrc.loop = true;
    const windFilter = ctx.createBiquadFilter();
    windFilter.type = 'highpass';
    windFilter.frequency.value = Dc.wind.filterFreq;
    const windGain = ctx.createGain();
    windGain.gain.value = 0.0001;
    windSrc.connect(windFilter); windFilter.connect(windGain); windGain.connect(sfxBus);
    windSrc.start();

    drive = {
      offSrc, offFilter, offGain,
      driftSrc, driftFilter, driftGain,
      windSrc, windFilter, windGain,
      prevBoostT: 0, // ブースト開始エッジ検出用(前フレームのboostT)
    };
  }

  function stopDriveLayer() {
    if (!drive) return;
    try {
      const t = ctx.currentTime;
      drive.offGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.08);
      drive.driftGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.08);
      drive.windGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.08);
      drive.offSrc.stop(t + 0.1);
      drive.driftSrc.stop(t + 0.1);
      drive.windSrc.stop(t + 0.1);
    } catch (e) { /* noop */ }
    drive = null;
  }

  // ブースト開始(boostTが0→正に遷移した瞬間)の加速ワッシュ。単発でsfxBusへ
  function playBoostWhoosh() {
    if (!ready || !ctx) return;
    const W = C.drive.whoosh;
    const t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(W.filterStart, t);
    filter.frequency.exponentialRampToValueAtTime(W.filterEnd, t + W.sweepDur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(W.gainPeak, t + 0.04);
    g.gain.exponentialRampToValueAtTime(0.0001, t + W.dur);
    src.connect(filter); filter.connect(g); g.connect(sfxBus);
    src.start(t);
    src.stop(t + W.dur + 0.05);
  }

  // 走行音レイヤーの毎フレーム更新(update()から呼ばれる)
  function updateDriveLayer(kart, ratio, base, now) {
    if (!drive) return;
    const Dc = C.drive;
    const P = Game.config.physics;
    const spd = Math.max(0, kart.speed || 0);
    const q = kart.lastQuery;

    // --- オフロード走行音: 未舗装+接地+一定速度以上で速度比例、それ以外は素早く減衰 ---
    const offroadOn = !!(q && q.surface === 'offroad' && kart.grounded && spd > Dc.offroad.speedMin);
    if (offroadOn) {
      const cap = base * (P.offroadMultiplier || 0.5); // オフロードでの実質最高速を基準に正規化
      const r = Math.min(1, spd / Math.max(1, cap));
      drive.offGain.gain.setTargetAtTime(Dc.offroad.gainMax * r, now, Dc.offroad.attackTau);
      drive.offFilter.frequency.setTargetAtTime(
        Dc.offroad.filterMin + (Dc.offroad.filterMax - Dc.offroad.filterMin) * r, now, 0.08);
    } else {
      drive.offGain.gain.setTargetAtTime(0.0001, now, Dc.offroad.releaseTau);
    }

    // --- ドリフトスキール: ドリフト中+接地で速度に応じてゲインとフィルタを上げる ---
    const driftingOn = !!(kart.drift && kart.drift.state === 'drifting' && kart.grounded);
    if (driftingOn) {
      const floor = P.driftMinSpeed || 13; // ドリフト可能な最低速度を基準に正規化
      const r = Math.min(1, Math.max(0, (spd - floor) / Math.max(1, base - floor)));
      const g = Dc.drift.gainMax * (Dc.drift.gainFloorRatio + r * (1 - Dc.drift.gainFloorRatio));
      drive.driftGain.gain.setTargetAtTime(g, now, Dc.drift.smoothTau);
      drive.driftFilter.frequency.setTargetAtTime(Dc.drift.filterBase + Dc.drift.filterRange * r, now, Dc.drift.smoothTau);
      drive.driftFilter.Q.setTargetAtTime(Dc.drift.qMin + (Dc.drift.qMax - Dc.drift.qMin) * r, now, Dc.drift.smoothTau);
    } else {
      drive.driftGain.gain.setTargetAtTime(0.0001, now, 0.05);
    }

    // --- 風切り音: speed/maxSpeedが閾値を超えた分の2乗で立ち上げ、ブースト中は+30% ---
    const windR = Math.min(1, Math.max(0, (ratio - Dc.wind.ratioThreshold) / (1 - Dc.wind.ratioThreshold)));
    let windTarget = Dc.wind.gainMax * windR * windR;
    if (kart.boostT > 0) windTarget *= Dc.wind.boostMul;
    drive.windGain.gain.setTargetAtTime(windTarget, now, Dc.wind.smoothTau);

    // --- ブースト開始ワッシュ: 0→正のエッジでのみ1回発火 ---
    const boostT = kart.boostT || 0;
    if (boostT > 0 && drive.prevBoostT <= 0) playBoostWhoosh();
    drive.prevBoostT = boostT;
  }

  // ブースト時の「掛け声」風チャープ(キャラの体格でピッチが変わる)
  function shout(pitch = 1) {
    if (!ready || !ctx) return;
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    o.type = 'square';
    o.frequency.setValueAtTime(280 * pitch, t);
    o.frequency.exponentialRampToValueAtTime(520 * pitch, t + 0.09);
    o.frequency.exponentialRampToValueAtTime(400 * pitch, t + 0.2);
    const flt = ctx.createBiquadFilter();
    flt.type = 'bandpass';
    flt.frequency.value = 900 * pitch;
    flt.Q.value = 1.2;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.09, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.24);
    o.connect(flt); flt.connect(g); g.connect(sfxBus);
    o.start(t); o.stop(t + 0.26);
  }

  const update = safe(function (dt, playerKart) {
    if (!engine || !playerKart) return;
    const base = playerKart.baseMaxSpeed || Game.config.physics.maxSpeed;
    const ratio = Math.min(1.4, Math.max(0, (playerKart.speed || 0) / base));
    const freq = C.engine.baseFreq * (1 + ratio * (C.engine.maxFreqMul - 1));
    const now = ctx.currentTime;
    engine.osc.frequency.setTargetAtTime(freq, now, 0.05);
    engine.osc2.frequency.setTargetAtTime(freq, now, 0.05);
    engine.sub.frequency.setTargetAtTime(freq / 2, now, 0.05);
    engine.gain.gain.setTargetAtTime(C.engine.gain * (0.3 + ratio * 0.7), now, 0.08);
    engine.filter.frequency.setTargetAtTime(C.engine.lowpassBase + ratio * C.engine.lowpassSpeedMul, now, 0.06);
    updateDriveLayer(playerKart, ratio, base, now);
  });

  // ==== kartコールバックのチェーン ====
  const attachedKarts = [];

  function chain(kart, propName, handler) {
    const prev = kart[propName];
    kart[propName] = (...args) => {
      if (prev) prev(...args);
      handler(...args);
    };
  }

  const attachKart = safe(function (kart, isPlayer) {
    if (!kart) return;
    chain(kart, 'onHop', () => sfx('hop'));
    chain(kart, 'onLand', () => sfx('land'));
    chain(kart, 'onMiniTurbo', () => sfx('miniTurbo'));
    chain(kart, 'onSpin', () => sfx('spin'));
    chain(kart, 'onPadBoost', () => sfx('padBoost'));
    chain(kart, 'onJumpPad', () => sfx('jump'));
    chain(kart, 'onWallHit', () => {
      // 壁ヒットは弱め: 通常hitより控えめな音量にするため個別合成
      if (!ready || !ctx) return;
      const t = ctx.currentTime;
      playNoise(sfxBus, t, 0.08, 0.1, { filterType: 'lowpass', filterFreq: 900 });
    });
    chain(kart, 'onFell', () => sfx('fall'));
    chain(kart, 'onRespawn', () => sfx('respawn'));
    chain(kart, 'onShieldBreak', () => sfx('shieldBreak'));

    // キャラ別ピッチの掛け声(小柄=高い声、大柄=低い声)
    const SHOUT_PITCH = {
      donga: 0.55, gumiras: 0.7, baumjii: 0.75, noir: 0.85, volt8: 0.9,
      kurumu: 1.15, rupo: 1.25, shizuku: 1.35, ginja: 1.45,
    };
    const pitch = SHOUT_PITCH[kart.charId] || 1.0;
    chain(kart, 'onMiniTurbo', () => shout(pitch));
    chain(kart, 'onJumpPad', () => shout(pitch * 1.1));

    attachedKarts.push(kart);
    if (isPlayer) { startEngine(); startDriveLayer(); }
  });

  const detachAll = safe(function () {
    stopEngine();
    stopDriveLayer();
    attachedKarts.length = 0;
    // コールバックのチェーン自体は残っても安全(prev呼び出しのみ)なので解除しない
  });

  window.Game = window.Game || {};
  // 消音の切替(音声処理は動かしたままマスターだけ0にする)。
  // 検証・バックグラウンド作業でゲームを動かす時は最初にこれを呼ぶこと
  const setMuted = safe(function (on) {
    muted = !!on;
    if (masterGainNode) masterGainNode.gain.value = muted ? 0 : C.masterGain;
  });

  // 設定画面用の音量API。setMuted/?mute=1のマスター消音とは独立(muted中も値は保存・反映され、
  // 解除時にそのまま効く)。ctx初期化前でも呼べるように safe() ではなく素の関数として公開する
  function setVolumes(v) {
    v = v || {};
    if (typeof v.bgm === 'number' && isFinite(v.bgm)) volumes.bgm = clamp01(v.bgm);
    if (typeof v.sfx === 'number' && isFinite(v.sfx)) volumes.sfx = clamp01(v.sfx);
    applyVolumesToBuses(); // ctx未初期化ならbgmBus/sfxBusがnullなので何もしない(init時にloadVolumesで反映される)
    try { localStorage.setItem('sgVolumes', JSON.stringify(volumes)); } catch (e) { /* 保存失敗は無視(ゲーム続行優先) */ }
  }

  function getVolumes() {
    return { bgm: volumes.bgm, sfx: volumes.sfx };
  }

  Game.audio = {
    init,
    playBgm,
    stopBgm,
    setFinalLap,
    sfx,
    attachKart,
    update,
    detachAll,
    setMuted,
    setVolumes,
    getVolumes,
  };
})();
