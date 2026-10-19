// UI sounds: short, soft and pitched (a little PS1 menu, not a slot machine). All on the ui bus, which
// is never ducked, so they stay crisp over a dimmed world.

import type { AudioKit } from "./audioRuntime";
import { midi, noise, openVoice, tone, type Voice } from "./synth";
import { PRIORITY } from "./voices";

export type UiSound =
  | "hover"
  | "click"
  | "cardOpen"
  | "cardClose"
  | "gpsOpen"
  | "gpsClose"
  | "gpsSelect"
  | "prompt"
  | "discover"
  | "qualityHigh"
  | "qualityLow"
  | "download"
  | "unmute";

/** Notes: [midi, delay s] played as soft triangle blips */
function notes(v: Voice, seq: readonly (readonly [number, number])[], decay = 0.18, peak = 0.16, type: OscillatorType = "triangle") {
  for (const [n, at] of seq) tone(v, { type, freq: midi(n), at, attack: 0.003, decay, peak });
}

const DURATION: Record<UiSound, number> = {
  hover: 0.05,
  click: 0.08,
  cardOpen: 0.45,
  cardClose: 0.3,
  gpsOpen: 0.3,
  gpsClose: 0.25,
  gpsSelect: 0.55,
  prompt: 0.3,
  discover: 1.3,
  qualityHigh: 0.3,
  qualityLow: 0.3,
  download: 0.6,
  unmute: 0.3,
};

export function playUi(kit: AudioKit, sound: UiSound): void {
  const v = openVoice(kit, kit.ui, DURATION[sound], sound === "hover" ? PRIORITY.hover : PRIORITY.ui);
  if (!v) return;
  switch (sound) {
    case "hover":
      tone(v, { freq: 2100, attack: 0.002, decay: 0.025, peak: 0.06 });
      break;
    case "click":
      tone(v, { type: "triangle", freq: 1150, to: 720, attack: 0.002, decay: 0.045, peak: 0.24 });
      noise(v, { filter: "highpass", freq: 4200, decay: 0.012, peak: 0.12 });
      break;
    case "cardOpen":
      // Paper swish up + a bright two-note "here you go"
      noise(v, { filter: "bandpass", freq: 600, to: 2600, q: 1.2, attack: 0.05, decay: 0.12, peak: 0.12 });
      notes(v, [[76, 0.03], [83, 0.1]], 0.28, 0.13);
      break;
    case "cardClose":
      noise(v, { filter: "bandpass", freq: 2400, to: 600, q: 1.2, attack: 0.02, decay: 0.12, peak: 0.1 });
      notes(v, [[81, 0], [74, 0.06]], 0.16, 0.09);
      break;
    case "gpsOpen":
      // Radio "bee-boop" with a crackle of static
      notes(v, [[81, 0], [88, 0.075]], 0.07, 0.07, "square");
      noise(v, { filter: "bandpass", freq: 3000, q: 1.5, decay: 0.05, peak: 0.05 });
      break;
    case "gpsClose":
      notes(v, [[88, 0], [81, 0.065]], 0.06, 0.06, "square");
      break;
    case "gpsSelect":
      // Confirm: a quick rising major triad
      notes(v, [[79, 0], [83, 0.05], [86, 0.1], [91, 0.16]], 0.22, 0.12);
      break;
    case "prompt":
      // Soft pop: "you can interact here"
      tone(v, { freq: 600, to: 1150, sweepTime: 0.05, attack: 0.002, decay: 0.08, peak: 0.16 });
      tone(v, { freq: midi(88), at: 0.05, attack: 0.002, decay: 0.12, peak: 0.05 });
      break;
    case "discover":
      // Little PSX jingle: square arpeggio up to the octave, a held top note and a sparkle
      notes(v, [[72, 0], [76, 0.09], [79, 0.18]], 0.16, 0.07, "square");
      tone(v, { type: "square", freq: midi(84), at: 0.3, attack: 0.004, hold: 0.12, decay: 0.55, peak: 0.07, filter: { type: "lowpass", freq: 3500 } });
      notes(v, [[79, 0.3], [91, 0.42], [96, 0.5]], 0.5, 0.06);
      break;
    case "qualityHigh":
      notes(v, [[76, 0], [81, 0.07]], 0.14, 0.11);
      break;
    case "qualityLow":
      notes(v, [[81, 0], [76, 0.07]], 0.14, 0.11);
      break;
    case "download":
      noise(v, { filter: "bandpass", freq: 900, to: 2400, q: 1, attack: 0.04, decay: 0.15, peak: 0.08 });
      notes(v, [[72, 0.02], [79, 0.09], [84, 0.16]], 0.3, 0.13);
      break;
    case "unmute":
      notes(v, [[79, 0], [84, 0.06]], 0.14, 0.12);
      break;
  }
}
