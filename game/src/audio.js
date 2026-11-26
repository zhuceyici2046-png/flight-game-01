// Tiny synthesised sound effects: no audio files, everything is an oscillator or filtered
// noise through the Web Audio API. The context is created on the first user gesture (browsers
// refuse it before one), and every call is a no-op until then or while muted. A low engine
// hum runs while flying; its pitch follows the throttle.

export function createAudio() {
  let context = null;
  let muted = false;
  let master = null;
  let engineOsc = null;
  let engineGain = null;
  let engineFilter = null;

  function ensure() {
    if (context !== null) return true;
    try {
      const Ctor = window.AudioContext ?? window.webkitAudioContext;
      if (!Ctor) return false;
      context = new Ctor();
      master = context.createGain();
      master.gain.value = 0.16;
      master.connect(context.destination);
    } catch {
      return false;
    }
    return true;
  }

  function tone(freq, dur, type, slideTo, vol = 0.9) {
    if (muted || !ensure() || context.state === 'suspended') return;
    try {
      void context.resume();
      const osc = context.createOscillator();
      const gain = context.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, context.currentTime);
      if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(30, slideTo), context.currentTime + dur);
      gain.gain.setValueAtTime(vol, context.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + dur);
      osc.connect(gain);
      gain.connect(master);
      osc.start();
      osc.stop(context.currentTime + dur + 0.02);
    } catch {
      // Sound is decoration: a failure here must never break the game.
    }
  }

  function noise(dur, cutoff = 900) {
    if (muted || !ensure() || context.state === 'suspended') return;
    try {
      void context.resume();
      const len = Math.floor(context.sampleRate * dur);
      const buffer = context.createBuffer(1, len, context.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = context.createBufferSource();
      src.buffer = buffer;
      const filter = context.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = cutoff;
      const gain = context.createGain();
      gain.gain.setValueAtTime(0.7, context.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + dur);
      src.connect(filter);
      filter.connect(gain);
      gain.connect(master);
      src.start();
    } catch {
      // Sound is decoration.
    }
  }

  return {
    /** Call from a user gesture so the context is allowed to start. */
    unlock() {
      ensure();
    },
    toggleMute() {
      muted = !muted;
      if (engineGain) engineGain.gain.value = muted ? 0 : 0.05;
      return muted;
    },
    get muted() {
      return muted;
    },
    /** Start the engine hum; call every frame with speed 0..1 and fuel 0..100. */
    engine(speedNorm, fuel) {
      if (muted || !ensure() || context.state === 'suspended') return;
      try {
        void context.resume();
        if (!engineOsc) {
          engineOsc = context.createOscillator();
          engineOsc.type = 'sawtooth';
          engineFilter = context.createBiquadFilter();
          engineFilter.type = 'lowpass';
          engineFilter.frequency.value = 320;
          engineGain = context.createGain();
          engineGain.gain.value = 0.05;
          engineOsc.connect(engineFilter);
          engineFilter.connect(engineGain);
          engineGain.connect(master);
          engineOsc.start();
        }
        const lowFuel = fuel < 25;
        engineOsc.frequency.setTargetAtTime(lowFuel ? 52 : 62 + 55 * speedNorm, context.currentTime, 0.1);
        engineGain.gain.setTargetAtTime(muted ? 0 : 0.045 + 0.03 * speedNorm, context.currentTime, 0.1);
      } catch {
        // Sound is decoration.
      }
    },
    engineOff() {
      if (engineGain) engineGain.gain.value = 0;
    },
    /** Pitch climbs with the combo multiplier, so a chain sounds like a chain. */
    ring(mult) {
      tone(520 + 90 * mult, 0.14, 'sine', 940 + 120 * mult);
      tone(1040 + 90 * mult, 0.1, 'sine', 1560, 0.4);
    },
    star() {
      tone(880, 0.09, 'triangle', 1320);
    },
    fuel() {
      tone(392, 0.1, 'triangle', 523);
      setTimeout(() => tone(523, 0.12, 'triangle', 784), 70);
    },
    boost() {
      noise(0.25, 2400);
      tone(220, 0.18, 'sawtooth', 660);
    },
    hit() {
      noise(0.3);
      tone(140, 0.32, 'square', 55);
    },
    delivery() {
      [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => tone(f, 0.22, 'triangle'), i * 100));
    },
  };
}
