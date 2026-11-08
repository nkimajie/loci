// Loci musical cues — SpotChime1..5 (rising pentatonic along the route), CorrectChime,
// MissedTone, ResultsJingle. All cues share one randomly-picked key so they cohere.
const path = require('path');
const fs = require('fs');
const m = require('/Users/ajietakon/.claude/plugins/cache/ls-extensions/ls-clad/1.0.0/skills/build-music/tools');

const PROJECT_ASSETS_SFX = '/Users/ajietakon/Projects/loci/Assets/GeneratedSFX';
fs.mkdirSync(PROJECT_ASSETS_SFX, { recursive: true });

function peakDb(b) {
  let pk = 0;
  for (const c of [b.left, b.right]) for (let i = 0; i < c.length; i++) pk = Math.max(pk, Math.abs(c[i]));
  return 20 * Math.log10(pk || 1e-9);
}
function write(out, name) {
  m.WavBuilder.write(out, path.join(PROJECT_ASSETS_SFX, name + '.wav'));
  const pk = peakDb(out);
  console.log(name, 'peak dB', pk.toFixed(2), pk < -30 ? 'SILENT_OUTPUT' : 'ok');
}

// Random key per run (variety mandate) — logged so a liked take can be pinned.
const roots = ['C5', 'D5', 'Eb5', 'F5', 'G4', 'A4'];
const root = roots[Math.floor(Math.random() * roots.length)];
const chimeVoices = ['kalimba', 'musicBox', 'marimba', 'vibraphone'];
const chimeVoice = chimeVoices[Math.floor(Math.random() * chimeVoices.length)];
console.log('key root', root, 'chime voice', chimeVoice);

const bpm = 120;
const degree = (d) => { const ev = [{ time: 0, beats: 1, value: d, velocity: 90 }]; m.scale(ev, 'pentatonicMajor', root); return ev[0].value; };

// SpotChime1..5 — one soft note per route spot, rising left to right.
for (let i = 0; i < 5; i++) {
  const ev = [{ time: 0, beats: 1.5, value: degree(i), velocity: 82 }];
  const tr = m.track('chime', chimeVoice, ev, { fx: { hpf: 250, reverb: 'mediumRoom', gain: 0.6 } });
  write(m.render([tr], { bpm, duration: 1.6 }), 'SpotChime' + (i + 1));
}

// CorrectChime — two rising bell-like notes (a fifth up).
{
  const ev = [
    { time: 0, beats: 0.5, value: degree(2), velocity: 85 },
    { time: 0.35, beats: 1.5, value: degree(5), velocity: 92 },
  ];
  const tr = m.track('ok', 'bell', ev, { fx: { hpf: 300, reverb: 'smallRoom', gain: 0.5 } });
  write(m.render([tr], { bpm, duration: 1.6 }), 'CorrectChime');
}

// MissedTone — gentle two-note descent, low and soft (not punishing).
{
  const ev = [
    { time: 0, beats: 0.6, value: degree(2) - 12, velocity: 70 },
    { time: 0.5, beats: 1.4, value: degree(0) - 12, velocity: 65 },
  ];
  const tr = m.track('miss', 'vibraphone', ev, { fx: { hpf: 180, lpf: 3500, reverb: 'smallRoom', gain: 0.5 } });
  write(m.render([tr], { bpm, duration: 1.8 }), 'MissedTone');
}

// ResultsJingle — quick rising arpeggio landing on a sustained chord.
{
  const lead = [0, 1, 2, 4].map((d, i) => ({ time: i * 0.25, beats: 0.3, value: degree(d + 2), velocity: 88 }));
  const chord = [0, 2, 4].map((d) => ({ time: 1.0, beats: 2.5, value: degree(d + 2) - 12, velocity: 70 }));
  const t1 = m.track('arp', chimeVoice, lead, { fx: { hpf: 300, reverb: 'mediumRoom', gain: 0.5 } });
  const t2 = m.track('pad', 'electricPiano', chord, { fx: { hpf: 200, lpf: 4000, reverb: 'mediumRoom', gain: 0.4 } });
  write(m.render([t1, t2], { bpm, duration: 3.2, master: { normalize: 'peak', glue: true } }), 'ResultsJingle');
}
