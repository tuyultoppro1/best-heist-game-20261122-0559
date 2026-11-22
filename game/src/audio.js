// Synthesised sound: every noise is built with WebAudio, no audio files. The context is
// created on the first user gesture, so a headless load never makes a sound.
export function createAudio() {
  let context = null;

  function ensure() {
    if (context) return context;
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return null;
      context = new AudioContext();
    } catch {
      return null;
    }
    return context;
  }

  function tone(frequency, seconds, type, gainValue, when = 0) {
    const ctx = ensure();
    if (!ctx) return;
    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.value = frequency;
      gain.gain.setValueAtTime(gainValue, ctx.currentTime + when);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + when + seconds);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime + when);
      osc.stop(ctx.currentTime + when + seconds);
    } catch {
      // Sound is garnish: a failure here must never break the game.
    }
  }

  function noise(seconds, gainValue, lowpass) {
    const ctx = ensure();
    if (!ctx) return;
    try {
      const length = Math.floor(ctx.sampleRate * seconds);
      const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < length; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = lowpass;
      const gain = ctx.createGain();
      gain.gain.value = gainValue;
      source.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);
      source.start();
    } catch {
      // See tone(): sound never breaks the game.
    }
  }

  return {
    unlock() {
      const ctx = ensure();
      if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {});
    },
    step(sneaking) {
      noise(0.07, sneaking ? 0.03 : 0.06, 500);
    },
    pickup() {
      tone(660, 0.12, 'sine', 0.12);
      tone(990, 0.18, 'sine', 0.1, 0.08);
    },
    smash() {
      noise(0.25, 0.22, 2400);
      tone(180, 0.2, 'square', 0.06);
    },
    alarm() {
      tone(880, 0.16, 'square', 0.07);
      tone(660, 0.16, 'square', 0.07, 0.18);
    },
    smoke() {
      noise(0.4, 0.12, 900);
    },
    caught() {
      tone(220, 0.5, 'sawtooth', 0.12);
      tone(110, 0.7, 'sawtooth', 0.12, 0.15);
    },
    victory() {
      [523, 659, 784, 1047].forEach((freq, i) => tone(freq, 0.25, 'sine', 0.12, i * 0.13));
    },
  };
}
