export const MIN_TONE_HZ = 20;
export const MAX_TONE_HZ = 20000;

export function clampToneHz(frequency: number) {
  return Math.min(MAX_TONE_HZ, Math.max(MIN_TONE_HZ, frequency));
}

export function stepTone(frequency: number, referenceHz: number, direction: -1 | 1) {
  const midi = Math.round(69 + 12 * Math.log2(frequency / referenceHz)) + direction;
  return clampToneHz(referenceHz * 2 ** ((midi - 69) / 12));
}

export function sliderToFrequency(value: number) {
  return MIN_TONE_HZ * (MAX_TONE_HZ / MIN_TONE_HZ) ** (value / 1000);
}

export function frequencyToSlider(frequency: number) {
  return (1000 * Math.log(frequency / MIN_TONE_HZ)) / Math.log(MAX_TONE_HZ / MIN_TONE_HZ);
}
