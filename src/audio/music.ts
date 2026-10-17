// Фоновая музыка: «живой» лаунж-джаз / босса-нова, синтезированный в реальном времени.
//  • электропиано — частотная модуляция (звук в духе Rhodes) с джазовыми аккордами;
//  • нейлоновая гитара — физическая модель струны (алгоритм Карплуса — Стронга);
//  • контрабас — щипок с мягким фильтром;
//  • щётки и райд-тарелка;
//  • реверберация небольшого зала.
// Внешние аудиофайлы не нужны — всё звучит и без интернета.

export const BPM = 92;
export const BEAT = 60 / BPM;
export const BAR = BEAT * 4;

const midi = (n: number) => 440 * Math.pow(2, (n - 69) / 12);
const rnd = (a: number, b: number) => a + Math.random() * (b - a);

interface Chord {
  root: number; // MIDI ноты баса
  tones: number[]; // голоса аккорда (в средней октаве)
  scale: number[]; // ноты для мелодии
}

const C = (root: number, tones: number[], scale: number[]): Chord => ({ root, tones, scale });

// Часть A: Cmaj7 – Am7 – Dm9 – G13 – Em7 – A7(b9) – Dm9 – G13
const PART_A: Chord[] = [
  C(36, [64, 67, 71, 74], [72, 74, 76, 79, 81, 83]),
  C(45, [60, 64, 67, 71], [69, 72, 74, 76, 79, 81]),
  C(38, [60, 64, 65, 69], [69, 72, 74, 77, 81]),
  C(43, [59, 64, 65, 69], [71, 74, 76, 77, 79]),
  C(40, [62, 67, 71, 74], [71, 74, 76, 79, 83]),
  C(45, [61, 64, 67, 70], [69, 70, 73, 76, 79]),
  C(38, [60, 64, 65, 69], [69, 72, 74, 77, 81]),
  C(43, [59, 64, 65, 69], [71, 74, 76, 77, 79]),
];
// Часть B: Fmaj7 – Fm6 – Em7 – A7 – Dm7 – G7 – Cmaj7 – G7(b13)
const PART_B: Chord[] = [
  C(41, [64, 65, 69, 72], [72, 76, 77, 79, 81, 84]),
  C(41, [62, 65, 68, 72], [72, 74, 75, 77, 80]),
  C(40, [62, 67, 71, 74], [71, 74, 76, 79, 83]),
  C(45, [61, 64, 67, 69], [69, 73, 76, 79, 81]),
  C(38, [60, 65, 69, 72], [69, 72, 74, 77, 81]),
  C(43, [59, 62, 65, 69], [71, 74, 77, 79]),
  C(36, [64, 67, 71, 74], [72, 76, 79, 83, 84]),
  C(43, [59, 63, 65, 68], [71, 74, 75, 77, 79]),
];
const FORM = [...PART_A, ...PART_A, ...PART_B, ...PART_A];

export class LoungeBand {
  private out: GainNode;
  private dry: GainNode;
  private wet: GainNode;
  private noise: AudioBuffer;
  private strings = new Map<number, AudioBuffer>();
  private phrase: number[] = [];

  constructor(private ctx: AudioContext, destination: AudioNode) {
    this.out = ctx.createGain();
    this.out.gain.value = 0.9;
    // Реверберация: свёртка с синтезированным импульсом зала
    const verb = ctx.createConvolver();
    verb.buffer = this.makeImpulse(1.8);
    this.dry = ctx.createGain();
    this.wet = ctx.createGain();
    this.dry.gain.value = 0.85;
    this.wet.gain.value = 0.32;
    // Тёплый тон: лёгкое срезание верхов на общей шине
    const tone = ctx.createBiquadFilter();
    tone.type = 'lowshelf';
    tone.frequency.value = 220;
    tone.gain.value = 2;
    this.out.connect(tone);
    tone.connect(this.dry).connect(destination);
    tone.connect(verb).connect(this.wet).connect(destination);
    const len = ctx.sampleRate * 2;
    this.noise = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = this.noise.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  }

  private makeImpulse(seconds: number) {
    const ctx = this.ctx;
    const len = Math.floor(ctx.sampleRate * seconds);
    const buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      for (let i = 0; i < len; i++) {
        const t = i / len;
        // Ранние отражения + плавный хвост
        const early = i < ctx.sampleRate * 0.03 && Math.random() < 0.02 ? 0.6 : 0;
        d[i] = ((Math.random() * 2 - 1) * Math.pow(1 - t, 3.2) + early) * 0.6;
      }
    }
    return buf;
  }

  /** Сыграть такт номер bar, начиная со времени t0 */
  playBar(t0: number, bar: number) {
    const chord = FORM[bar % FORM.length];
    const next = FORM[(bar + 1) % FORM.length];
    const section = Math.floor((bar % FORM.length) / 8);
    const sw = (t: number) => t0 + t * BEAT + rnd(-0.008, 0.008); // живое «плавание» во времени

    // Контрабас — босса: корень на 1, квинта на «и» второй доли, корень на 3, подход к следующему аккорду на 4
    const fifth = chord.root + 7;
    this.bass(sw(0), chord.root, 0.95);
    this.bass(sw(1.5), fifth, 0.7);
    this.bass(sw(2), chord.root, 0.85);
    this.bass(sw(3.5), next.root + (Math.random() < 0.5 ? -1 : 1), 0.6);

    // Гитара — классический ритм босса-новы
    const pattern = bar % 2 === 0 ? [0, 0.75, 1.5, 2.5, 3.25] : [0.5, 1.25, 2, 2.75, 3.5];
    pattern.forEach((p, i) => this.guitarChord(sw(p), chord.tones, i === 0 ? 0.5 : 0.36));

    // Электропиано — мягкие аккорды раз в такт (в бриджe — чаще)
    this.rhodesChord(sw(section === 2 ? 0 : 0.02), chord.tones.map((n) => n + 12), 0.24, BEAT * 3.2);
    if (section === 2) this.rhodesChord(sw(2.5), chord.tones.map((n) => n + 12), 0.16, BEAT * 1.4);

    // Мелодия: фразы по 2 такта, затем пауза — как у живого исполнителя
    if (bar % 4 === 0 || this.phrase.length === 0) this.phrase = this.makePhrase();
    const phraseBar = bar % 4;
    if (phraseBar < 2) this.melody(t0, chord, phraseBar);

    // Щётки и райд
    for (let b = 0; b < 4; b++) {
      this.ride(sw(b), b % 2 === 0 ? 0.11 : 0.08);
      if (b === 1 || b === 3) this.ride(sw(b + 0.66), 0.05);
    }
    this.brushSwish(t0, BAR);
    this.brushTap(sw(1), 0.12);
    this.brushTap(sw(3), 0.14);
    this.kick(sw(0), 0.32);
    this.kick(sw(2.5), 0.18);
  }

  private makePhrase() {
    // Ритм фразы в восьмых: где звучит нота
    const rhythms = [
      [0, 1, 3, 4, 6],
      [1, 2, 3, 5, 7, 9],
      [0, 2, 3, 6, 8, 10],
      [2, 3, 4, 7, 9],
    ];
    return rhythms[Math.floor(Math.random() * rhythms.length)];
  }

  private melody(t0: number, chord: Chord, phraseBar: number) {
    let prev = chord.scale[Math.floor(chord.scale.length / 2)];
    for (const step of this.phrase) {
      const local = step - phraseBar * 8;
      if (local < 0 || local >= 8) continue;
      // Плавное движение по ступеням аккорда/лада
      const cands = chord.scale.filter((n) => Math.abs(n - prev) <= 5);
      const note = (cands.length ? cands : chord.scale)[Math.floor(Math.random() * (cands.length || chord.scale.length))];
      prev = note;
      const t = t0 + local * (BEAT / 2) + (local % 2 ? BEAT * 0.08 : 0) + rnd(-0.01, 0.01); // свинг
      this.rhodesNote(t, note, rnd(0.13, 0.19), BEAT * rnd(0.6, 1.4), true);
    }
  }

  // ───────────── Инструменты ─────────────

  /** Электропиано: FM-синтез (несущая + модулятор 1:1 и «колокольчик» 14:1) */
  private rhodesNote(t: number, note: number, vel: number, dur: number, lead = false) {
    const ctx = this.ctx;
    const f = midi(note);
    const car = ctx.createOscillator();
    const mod = ctx.createOscillator();
    const bell = ctx.createOscillator();
    const modGain = ctx.createGain();
    const bellGain = ctx.createGain();
    const amp = ctx.createGain();
    const pan = ctx.createStereoPanner();
    car.frequency.value = f;
    mod.frequency.value = f;
    bell.frequency.value = f * 14;
    const idx = f * (lead ? 2.2 : 1.6) * vel * 4;
    modGain.gain.setValueAtTime(idx, t);
    modGain.gain.exponentialRampToValueAtTime(Math.max(1, idx * 0.15), t + 0.6);
    bellGain.gain.setValueAtTime(f * 0.9 * vel, t);
    bellGain.gain.exponentialRampToValueAtTime(1, t + 0.12);
    mod.connect(modGain).connect(car.frequency);
    bell.connect(bellGain).connect(car.frequency);
    const end = t + dur + 1.2;
    amp.gain.setValueAtTime(0.0001, t);
    amp.gain.exponentialRampToValueAtTime(vel, t + 0.006);
    amp.gain.exponentialRampToValueAtTime(vel * 0.45, t + 0.35);
    amp.gain.setTargetAtTime(0.0001, t + dur, 0.35);
    pan.pan.value = (note - 66) / 40;
    car.connect(amp).connect(pan).connect(this.out);
    [car, mod, bell].forEach((o) => {
      o.start(t);
      o.stop(end);
    });
  }

  private rhodesChord(t: number, notes: number[], vel: number, dur: number) {
    // Лёгкое «арпеджио» пальцев — ноты чуть врозь
    notes.forEach((n, i) => this.rhodesNote(t + i * rnd(0.006, 0.014), n, vel * rnd(0.85, 1), dur));
  }

  /** Струна по Карплусу — Стронгу: шум, пропущенный через линию задержки с затуханием */
  private string(note: number): AudioBuffer {
    const hit = this.strings.get(note);
    if (hit) return hit;
    const ctx = this.ctx;
    const sr = ctx.sampleRate;
    const len = Math.floor(sr * 1.8);
    const buf = ctx.createBuffer(1, len, sr);
    const d = buf.getChannelData(0);
    const period = Math.max(2, Math.round(sr / midi(note)));
    const line = new Float32Array(period);
    // Начальный «щипок»: сглаженный шум (мягкая подушечка пальца, нейлон)
    let prev = 0;
    for (let i = 0; i < period; i++) {
      const v = Math.random() * 2 - 1;
      prev = prev * 0.55 + v * 0.45;
      line[i] = prev;
    }
    const decay = 0.9955 - Math.max(0, note - 60) * 0.0004;
    let idx = 0;
    for (let i = 0; i < len; i++) {
      const cur = line[idx];
      const nxt = line[(idx + 1) % period];
      const v = (cur + nxt) * 0.5 * decay;
      line[idx] = v;
      d[i] = cur;
      idx = (idx + 1) % period;
    }
    this.strings.set(note, buf);
    return buf;
  }

  private pluck(t: number, note: number, vel: number, pan = 0) {
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = this.string(note);
    const body = ctx.createBiquadFilter(); // резонанс корпуса гитары
    body.type = 'peaking';
    body.frequency.value = 220;
    body.Q.value = 1.2;
    body.gain.value = 5;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 3200;
    const amp = ctx.createGain();
    amp.gain.value = vel;
    const p = ctx.createStereoPanner();
    p.pan.value = pan;
    src.connect(body).connect(lp).connect(amp).connect(p).connect(this.out);
    src.start(t);
    src.stop(t + 1.8);
  }

  private guitarChord(t: number, tones: number[], vel: number) {
    // Гитарный голос ниже пианино; струны «рассыпаются» на несколько миллисекунд
    tones.slice(0, 4).forEach((n, i) => this.pluck(t + i * rnd(0.004, 0.009), n - 12, vel * rnd(0.8, 1), -0.35 + i * 0.05));
  }

  /** Контрабас: треугольник + синус, мягкий фильтр, атака щипка */
  private bass(t: number, note: number, vel: number) {
    const ctx = this.ctx;
    const f = midi(note);
    const o1 = ctx.createOscillator();
    const o2 = ctx.createOscillator();
    o1.type = 'triangle';
    o2.type = 'sine';
    o1.frequency.setValueAtTime(f * 1.012, t);
    o1.frequency.exponentialRampToValueAtTime(f, t + 0.05);
    o2.frequency.value = f;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(900, t);
    lp.frequency.exponentialRampToValueAtTime(320, t + 0.3);
    const amp = ctx.createGain();
    const v = 0.34 * vel;
    amp.gain.setValueAtTime(0.0001, t);
    amp.gain.exponentialRampToValueAtTime(v, t + 0.012);
    amp.gain.exponentialRampToValueAtTime(v * 0.5, t + 0.25);
    amp.gain.exponentialRampToValueAtTime(0.0001, t + BEAT * 1.6);
    o1.connect(lp);
    o2.connect(lp);
    lp.connect(amp).connect(this.out);
    [o1, o2].forEach((o) => {
      o.start(t);
      o.stop(t + BEAT * 1.7);
    });
    // Щелчок пальца по струне
    this.noiseHit(t, 0.004, 1800, 0.05 * vel, 'bandpass', 0);
  }

  private noiseHit(t: number, dur: number, freq: number, vol: number, type: BiquadFilterType, pan: number, q = 1) {
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    const amp = ctx.createGain();
    amp.gain.setValueAtTime(vol, t);
    amp.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    const p = ctx.createStereoPanner();
    p.pan.value = pan;
    src.connect(f).connect(amp).connect(p).connect(this.out);
    src.start(t, Math.random() * 1.5);
    src.stop(t + dur + 0.02);
  }

  /** Райд-тарелка: металлический FM-звон + шум */
  private ride(t: number, vel: number) {
    const ctx = this.ctx;
    const car = ctx.createOscillator();
    const mod = ctx.createOscillator();
    const mg = ctx.createGain();
    car.type = 'square';
    car.frequency.value = 520;
    mod.frequency.value = 520 * 2.76;
    mg.gain.value = 900;
    mod.connect(mg).connect(car.frequency);
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 5200;
    const amp = ctx.createGain();
    amp.gain.setValueAtTime(vel * 0.25, t);
    amp.gain.exponentialRampToValueAtTime(0.0001, t + 0.9);
    const p = ctx.createStereoPanner();
    p.pan.value = 0.35;
    car.connect(hp).connect(amp).connect(p).connect(this.out);
    car.start(t);
    mod.start(t);
    car.stop(t + 0.95);
    mod.stop(t + 0.95);
    this.noiseHit(t, 0.25, 9000, vel * 0.35, 'highpass', 0.35);
  }

  /** Щётка: короткий удар по малому барабану */
  private brushTap(t: number, vel: number) {
    this.noiseHit(t, 0.18, 2600, vel, 'bandpass', -0.15, 0.7);
    this.noiseHit(t, 0.06, 900, vel * 0.5, 'bandpass', -0.15, 1.5);
  }

  /** Щётка: «шуршание» по кругу на протяжении такта */
  private brushSwish(t: number, dur: number) {
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = 3200;
    f.Q.value = 0.5;
    const amp = ctx.createGain();
    amp.gain.setValueAtTime(0.0001, t);
    // Два «круга» щёткой за такт
    for (let k = 0; k < 2; k++) {
      const s = t + (k * dur) / 2;
      amp.gain.exponentialRampToValueAtTime(0.028, s + dur * 0.18);
      amp.gain.exponentialRampToValueAtTime(0.006, s + dur * 0.48);
    }
    const p = ctx.createStereoPanner();
    p.pan.value = -0.2;
    src.connect(f).connect(amp).connect(p).connect(this.out);
    src.start(t, Math.random());
    src.stop(t + dur + 0.05);
  }

  /** Мягкая бочка */
  private kick(t: number, vel: number) {
    const ctx = this.ctx;
    const o = ctx.createOscillator();
    o.frequency.setValueAtTime(95, t);
    o.frequency.exponentialRampToValueAtTime(48, t + 0.12);
    const amp = ctx.createGain();
    amp.gain.setValueAtTime(0.0001, t);
    amp.gain.exponentialRampToValueAtTime(vel * 0.5, t + 0.005);
    amp.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
    o.connect(amp).connect(this.out);
    o.start(t);
    o.stop(t + 0.32);
  }
}
