// Синтезированные звуки и фоновая музыка (WebAudio). Внешние файлы не нужны.

type SfxName =
  | 'click'
  | 'hover'
  | 'dice'
  | 'diceHit'
  | 'step'
  | 'coin'
  | 'cash'
  | 'lose'
  | 'buy'
  | 'build'
  | 'card'
  | 'wheelTick'
  | 'wheelWin'
  | 'jail'
  | 'turn'
  | 'win'
  | 'bankrupt'
  | 'error'
  | 'pop'
  | 'trade'
  | 'auction'
  | 'whoosh';

class SoundEngine {
  private ctx: AudioContext | null = null;
  private sfxGain: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private master: GainNode | null = null;
  private noiseBuf: AudioBuffer | null = null;
  private sfxVol = 0.7;
  private musicVol = 0.35;
  private musicOn = false;
  private musicTimer: ReturnType<typeof setTimeout> | null = null;
  private nextBar = 0;
  private bar = 0;
  private lastHover = 0;

  /** Вызывается при первом касании — браузеры запрещают звук без действия пользователя */
  unlock() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    try {
      const AC = window.AudioContext || (window as any).webkitAudioContext;
      this.ctx = new AC();
    } catch {
      return;
    }
    const ctx = this.ctx!;
    this.master = ctx.createGain();
    this.master.connect(ctx.destination);
    const comp = ctx.createDynamicsCompressor();
    comp.connect(this.master);
    this.sfxGain = ctx.createGain();
    this.sfxGain.gain.value = this.sfxVol;
    this.sfxGain.connect(comp);
    this.musicGain = ctx.createGain();
    this.musicGain.gain.value = this.musicVol;
    this.musicGain.connect(comp);
    const len = ctx.sampleRate * 1;
    this.noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    if (this.musicOn) this.startMusic();
  }

  setVolumes(sfx: number, music: number) {
    this.sfxVol = sfx;
    this.musicVol = music;
    if (this.sfxGain) this.sfxGain.gain.value = sfx;
    if (this.musicGain) this.musicGain.gain.setTargetAtTime(music, this.ctx!.currentTime, 0.2);
    if (music > 0 && !this.musicTimer && this.musicOn && this.ctx) this.startMusic();
  }

  // ───────────── Примитивы ─────────────

  private tone(freq: number, dur: number, opts: { type?: OscillatorType; vol?: number; at?: number; slide?: number; attack?: number; dest?: AudioNode; vibrato?: number } = {}) {
    const ctx = this.ctx;
    if (!ctx || !this.sfxGain) return;
    const t = ctx.currentTime + (opts.at ?? 0);
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = opts.type ?? 'sine';
    o.frequency.setValueAtTime(freq, t);
    if (opts.slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq * opts.slide), t + dur);
    if (opts.vibrato) {
      const lfo = ctx.createOscillator();
      const lg = ctx.createGain();
      lfo.frequency.value = 6;
      lg.gain.value = opts.vibrato;
      lfo.connect(lg).connect(o.frequency);
      lfo.start(t);
      lfo.stop(t + dur + 0.05);
    }
    const v = opts.vol ?? 0.3;
    const a = opts.attack ?? 0.005;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(v, t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(opts.dest ?? this.sfxGain);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  private noise(dur: number, opts: { at?: number; vol?: number; freq?: number; q?: number; type?: BiquadFilterType; sweep?: number; dest?: AudioNode } = {}) {
    const ctx = this.ctx;
    if (!ctx || !this.noiseBuf || !this.sfxGain) return;
    const t = ctx.currentTime + (opts.at ?? 0);
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    const f = ctx.createBiquadFilter();
    f.type = opts.type ?? 'bandpass';
    f.frequency.setValueAtTime(opts.freq ?? 2000, t);
    if (opts.sweep) f.frequency.exponentialRampToValueAtTime(opts.sweep, t + dur);
    f.Q.value = opts.q ?? 1;
    const g = ctx.createGain();
    g.gain.setValueAtTime(opts.vol ?? 0.3, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(opts.dest ?? this.sfxGain);
    src.start(t, Math.random() * 0.5);
    src.stop(t + dur + 0.05);
  }

  play(name: SfxName) {
    if (!this.ctx || this.sfxVol <= 0) return;
    switch (name) {
      case 'click':
        this.tone(660, 0.08, { type: 'triangle', vol: 0.25, slide: 1.5 });
        this.noise(0.03, { freq: 4000, vol: 0.08 });
        break;
      case 'hover': {
        const now = performance.now();
        if (now - this.lastHover < 60) return;
        this.lastHover = now;
        this.tone(1200, 0.04, { type: 'sine', vol: 0.05 });
        break;
      }
      case 'pop':
        this.tone(500, 0.12, { type: 'sine', vol: 0.25, slide: 2.2 });
        break;
      case 'dice':
        for (let i = 0; i < 7; i++) this.noise(0.05, { at: i * 0.07 + Math.random() * 0.03, freq: 1800 + Math.random() * 1500, q: 4, vol: 0.25 });
        break;
      case 'diceHit':
        this.noise(0.06, { freq: 900 + Math.random() * 600, q: 3, vol: 0.35 });
        this.tone(180 + Math.random() * 60, 0.06, { type: 'triangle', vol: 0.15 });
        break;
      case 'step':
        this.tone(320 + Math.random() * 60, 0.07, { type: 'sine', vol: 0.18, slide: 0.6 });
        this.noise(0.03, { freq: 1500, q: 2, vol: 0.06 });
        break;
      case 'coin':
        this.tone(1318, 0.09, { type: 'square', vol: 0.08 });
        this.tone(1975, 0.25, { type: 'square', vol: 0.08, at: 0.07 });
        break;
      case 'cash':
        [0, 0.06, 0.12, 0.18].forEach((at, i) => this.tone([1318, 1568, 1975, 2637][i], 0.18, { type: 'square', vol: 0.06, at }));
        this.noise(0.25, { freq: 6000, q: 1, vol: 0.05, at: 0.05 });
        break;
      case 'lose':
        this.tone(440, 0.35, { type: 'triangle', vol: 0.2, slide: 0.5 });
        this.tone(330, 0.4, { type: 'triangle', vol: 0.15, slide: 0.5, at: 0.12 });
        break;
      case 'buy':
        [523, 659, 784, 1046].forEach((f, i) => this.tone(f, 0.22, { type: 'triangle', vol: 0.2, at: i * 0.07 }));
        this.tone(1568, 0.4, { type: 'sine', vol: 0.12, at: 0.28 });
        break;
      case 'build':
        this.noise(0.08, { freq: 400, q: 2, vol: 0.5 });
        this.tone(120, 0.12, { type: 'sine', vol: 0.4, slide: 0.6 });
        this.noise(0.08, { freq: 500, q: 2, vol: 0.45, at: 0.16 });
        this.tone(140, 0.12, { type: 'sine', vol: 0.35, slide: 0.6, at: 0.16 });
        this.tone(880, 0.3, { type: 'triangle', vol: 0.12, at: 0.3 });
        break;
      case 'card':
      case 'whoosh':
        this.noise(0.35, { freq: 400, sweep: 3000, q: 1.5, vol: 0.25, type: 'bandpass' });
        break;
      case 'wheelTick':
        this.tone(1800, 0.025, { type: 'square', vol: 0.06 });
        break;
      case 'wheelWin':
        [659, 784, 988, 1318].forEach((f, i) => this.tone(f, 0.3, { type: 'triangle', vol: 0.2, at: i * 0.09 }));
        break;
      case 'jail':
        this.tone(220, 0.3, { type: 'sawtooth', vol: 0.12 });
        this.tone(175, 0.5, { type: 'sawtooth', vol: 0.12, at: 0.25 });
        this.noise(0.4, { freq: 3000, q: 8, vol: 0.15, at: 0.5 });
        break;
      case 'turn':
        this.tone(784, 0.15, { type: 'sine', vol: 0.2 });
        this.tone(1175, 0.3, { type: 'sine', vol: 0.2, at: 0.1 });
        break;
      case 'trade':
        this.tone(587, 0.15, { type: 'triangle', vol: 0.2 });
        this.tone(880, 0.25, { type: 'triangle', vol: 0.2, at: 0.1 });
        break;
      case 'auction':
        this.noise(0.05, { freq: 600, q: 3, vol: 0.5 });
        this.tone(200, 0.15, { type: 'triangle', vol: 0.3, slide: 0.7 });
        break;
      case 'win': {
        const seq = [523, 659, 784, 1046, 784, 1046, 1318];
        seq.forEach((f, i) => this.tone(f, 0.35, { type: 'triangle', vol: 0.22, at: i * 0.12 }));
        [523, 659, 784].forEach((f) => this.tone(f * 2, 1.2, { type: 'sine', vol: 0.1, at: 0.9 }));
        break;
      }
      case 'bankrupt':
        [392, 370, 349, 294].forEach((f, i) => this.tone(f, i === 3 ? 0.9 : 0.35, { type: 'sawtooth', vol: 0.12, at: i * 0.32, vibrato: i === 3 ? 8 : 0 }));
        break;
      case 'error':
        this.tone(160, 0.18, { type: 'square', vol: 0.12 });
        break;
    }
  }

  // ───────────── Музыка ─────────────

  setMusicEnabled(on: boolean) {
    this.musicOn = on;
    if (on && this.ctx) this.startMusic();
    if (!on) this.stopMusic();
  }

  private startMusic() {
    if (!this.ctx || this.musicTimer) return;
    this.nextBar = this.ctx.currentTime + 0.2;
    this.scheduleMusic();
  }

  private stopMusic() {
    if (this.musicTimer) clearTimeout(this.musicTimer);
    this.musicTimer = null;
  }

  private scheduleMusic = () => {
    const ctx = this.ctx;
    if (!ctx || !this.musicGain) return;
    // Планируем такты чуть заранее
    while (this.nextBar < ctx.currentTime + 1.5) {
      this.playBar(this.nextBar, this.bar++);
      this.nextBar += BAR;
    }
    this.musicTimer = setTimeout(this.scheduleMusic, 400);
  };

  private playBar(t0: number, bar: number) {
    const ctx = this.ctx!;
    const dest = this.musicGain!;
    if (this.musicVol <= 0) return;
    const chord = PROG[bar % PROG.length];
    const beat = BAR / 4;
    // Мягкий аккорд (электропиано)
    chord.forEach((n, i) => {
      [0, 2].forEach((b) => this.musicNote(midi(n + 12), t0 + b * beat + i * 0.01, beat * 1.6, 0.045, 'triangle', dest));
    });
    // Бас
    const root = chord[0] - 12;
    [0, 1.5, 2, 3].forEach((b, i) => this.musicNote(midi(root + (i === 1 ? 7 : 0)), t0 + b * beat, beat * 0.8, 0.12, 'sine', dest));
    // Мелодия из пентатоники с повторяющейся фразой
    const phrase = MELODY[(bar >> 1) % MELODY.length];
    phrase.forEach(([step, len, deg]) => {
      if (deg == null) return;
      const n = SCALE[deg % SCALE.length] + 12 * Math.floor(deg / SCALE.length) + 72;
      this.musicNote(midi(n), t0 + step * (beat / 2), len * (beat / 2) * 0.9, 0.05, 'square', dest, 2200);
    });
    // Лёгкие «тарелки»
    for (let k = 0; k < 8; k++) {
      const src = ctx.createBufferSource();
      src.buffer = this.noiseBuf;
      const f = ctx.createBiquadFilter();
      f.type = 'highpass';
      f.frequency.value = 8000;
      const g = ctx.createGain();
      const tt = t0 + k * (beat / 2);
      g.gain.setValueAtTime(k % 2 ? 0.012 : 0.025, tt);
      g.gain.exponentialRampToValueAtTime(0.0001, tt + 0.05);
      src.connect(f).connect(g).connect(dest);
      src.start(tt, Math.random() * 0.5);
      src.stop(tt + 0.06);
    }
  }

  private musicNote(freq: number, t: number, dur: number, vol: number, type: OscillatorType, dest: AudioNode, cutoff = 1800) {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    const f = ctx.createBiquadFilter();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.value = freq;
    f.type = 'lowpass';
    f.frequency.value = cutoff;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(f).connect(g).connect(dest);
    o.start(t);
    o.stop(t + dur + 0.05);
  }
}

const BPM = 104;
const BAR = (60 / BPM) * 4;
const midi = (n: number) => 440 * Math.pow(2, (n - 69) / 12);
// I – vi – IV – V в до мажоре (корни в 4-й октаве)
const PROG = [
  [60, 64, 67, 71],
  [57, 60, 64, 67],
  [53, 57, 60, 64],
  [55, 59, 62, 65],
];
const SCALE = [0, 2, 4, 7, 9]; // пентатоника
// [шаг (восьмые), длительность (восьмые), ступень]
const MELODY: [number, number, number | null][][] = [
  [[0, 1, 2], [1, 1, 3], [2, 2, 4], [5, 1, 3], [6, 2, 2]],
  [[0, 2, 4], [2, 1, 5], [3, 1, 4], [4, 2, 3], [7, 1, 2]],
  [[1, 1, 1], [2, 1, 2], [3, 2, 3], [6, 2, 1]],
  [[0, 3, 0], [4, 1, 2], [5, 1, 3], [6, 2, 4]],
];

export const sound = new SoundEngine();
export type { SfxName };
