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

  // ==== BGMシーケンサ状態 ====
  let currentBgmId = null;
  let seq = null; // { song, stepIndex, nextStepTime, timerId, tempoMul, pitchMul }

  // ==== エンジン音状態 ====
  let engine = null; // { osc, gain, filter }

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
      masterGainNode.gain.value = C.masterGain;
      compressorNode = ctx.createDynamicsCompressor();
      compressorNode.threshold.value = C.compressor.threshold;
      compressorNode.knee.value = C.compressor.knee;
      compressorNode.ratio.value = C.compressor.ratio;
      compressorNode.attack.value = C.compressor.attack;
      compressorNode.release.value = C.compressor.release;

      bgmBus = ctx.createGain();
      bgmBus.gain.value = C.bgmBusGain;
      sfxBus = ctx.createGain();
      sfxBus.gain.value = C.sfxBusGain;

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
    if (isPlayer) startEngine();
  });

  const detachAll = safe(function () {
    stopEngine();
    attachedKarts.length = 0;
    // コールバックのチェーン自体は残っても安全(prev呼び出しのみ)なので解除しない
  });

  window.Game = window.Game || {};
  Game.audio = {
    init,
    playBgm,
    stopBgm,
    setFinalLap,
    sfx,
    attachKart,
    update,
    detachAll,
  };
})();
