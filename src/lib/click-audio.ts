export const clickSounds = [
  { id: "classic", label: "Classic" },
  { id: "wood", label: "Wood block" },
  { id: "digital", label: "Digital beep" },
  { id: "tick", label: "Soft tick" },
  { id: "cowbell", label: "Cowbell" },
] as const;

export type ClickSound = (typeof clickSounds)[number]["id"];

export const DEFAULT_CLICK_SOUND: ClickSound = "classic";
export const CLICK_SOUND_STORAGE_KEY = "podiumpanda.clickSound";

export function isClickSound(value: unknown): value is ClickSound {
  return clickSounds.some((sound) => sound.id === value);
}

type Voice = {
  waves: OscillatorType[];
  // Frequencies for accent, main beat and subdivision, in Hz.
  pitches: [number, number, number];
  ratios: number[];
  decay: number;
  gain: number;
  drop?: number;
};

const voices: Record<ClickSound, Voice> = {
  classic: { waves: ["sine"], pitches: [1320, 880, 560], ratios: [1], decay: 0.055, gain: 1 },
  wood: {
    waves: ["sine"],
    pitches: [1500, 1100, 800],
    ratios: [1],
    decay: 0.035,
    gain: 1.3,
    drop: 0.7,
  },
  digital: {
    waves: ["square"],
    pitches: [1760, 1320, 880],
    ratios: [1],
    decay: 0.05,
    gain: 0.35,
  },
  tick: { waves: ["sine"], pitches: [3200, 2600, 2000], ratios: [1], decay: 0.02, gain: 1.1 },
  cowbell: {
    waves: ["square", "square"],
    pitches: [800, 660, 540],
    ratios: [1, 1.505],
    decay: 0.14,
    gain: 0.3,
  },
};

export function scheduleClick(
  context: AudioContext,
  time: number,
  accented: boolean,
  mainBeat: boolean,
  countIn = false,
  sound: ClickSound = DEFAULT_CLICK_SOUND,
) {
  const voice = voices[sound];
  const base = voice.pitches[accented ? 0 : mainBeat ? 1 : 2] * (countIn ? 0.75 : 1);
  const volume = (accented ? 0.42 : mainBeat ? 0.24 : 0.1) * voice.gain;
  const gain = context.createGain();
  gain.gain.setValueAtTime(0.0001, time);
  gain.gain.exponentialRampToValueAtTime(volume, time + 0.003);
  gain.gain.exponentialRampToValueAtTime(0.0001, time + voice.decay);
  gain.connect(context.destination);
  voice.ratios.forEach((ratio, index) => {
    const oscillator = context.createOscillator();
    oscillator.type = countIn && sound === "classic" ? "triangle" : voice.waves[index];
    oscillator.frequency.setValueAtTime(base * ratio, time);
    if (voice.drop)
      oscillator.frequency.exponentialRampToValueAtTime(
        base * ratio * voice.drop,
        time + voice.decay,
      );
    oscillator.connect(gain);
    oscillator.start(time);
    oscillator.stop(time + voice.decay + 0.01);
  });
}

let previewContext: AudioContext | null = null;

export function previewClick(sound: ClickSound) {
  try {
    if (!previewContext || previewContext.state === "closed") previewContext = new AudioContext();
    const context = previewContext;
    void context.resume();
    scheduleClick(context, context.currentTime + 0.02, true, true, false, sound);
    scheduleClick(context, context.currentTime + 0.42, false, true, false, sound);
  } catch (error) {
    console.warn("Could not preview the click sound.", error);
  }
}
