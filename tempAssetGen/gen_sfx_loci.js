// Loci SFX generator — DropBounce, PopReveal, ShrinkWhoosh (non-pitched UI/foley cues).
const path = require('path');
const fs = require('fs');
const ENGINE = '/Users/ajietakon/.claude/plugins/cache/ls-extensions/ls-clad/1.0.0/skills/build-sfx/tools';
const audio = require(ENGINE);
const p = audio.sfx_presets;
const SR = audio.SAMPLE_RATE;

const PROJECT_ASSETS_SFX = '/Users/ajietakon/Projects/loci/Assets/GeneratedSFX';
fs.mkdirSync(PROJECT_ASSETS_SFX, { recursive: true });

function toStereo(b) {
  if (b && b.left) return b;
  return { left: Float32Array.from(b), right: Float32Array.from(b) };
}
function layer(len, parts) {
  const out = { left: new Float32Array(Math.floor(len * SR)), right: new Float32Array(Math.floor(len * SR)) };
  for (const [buf, offSec, gain] of parts) {
    const s = toStereo(buf);
    const off = Math.floor(offSec * SR);
    for (let i = 0; i < s.left.length && off + i < out.left.length; i++) {
      out.left[off + i] += s.left[i] * gain;
      out.right[off + i] += s.right[i] * gain;
    }
  }
  return out;
}
function peakDb(b) {
  let pk = 0;
  const chans = b.left ? [b.left, b.right] : [b];
  for (const c of chans) for (let i = 0; i < c.length; i++) pk = Math.max(pk, Math.abs(c[i]));
  return 20 * Math.log10(pk || 1e-9);
}
function finish(buf, name) {
  audio.mix_bus.masterChain(buf, { normalize: 'peak' });
  const file = path.join(PROJECT_ASSETS_SFX, name + '.wav');
  audio.WavBuilder.write(buf, file);
  console.log(name, 'peak dB', peakDb(buf).toFixed(2));
}

// DropBounce: soft thud on landing + small rising pop for the bounce.
{
  const thud = p.impact({ material: 'soft', size: 0.35 });
  const boing = p.uiPop({ pitch: -3 });
  const out = layer(0.6, [[thud, 0, 0.9], [boing, 0.09, 0.45]]);
  const fx = audio.mix_bus.applyFx(out, { hpf: 70, reverb: 'smallRoom', gain: 0.9 });
  finish(fx, 'DropBounce');
}

// PopReveal: bright bubble pop + a whisper of sparkle as the item pops back.
{
  const pop = p.uiPop({ pitch: 2 });
  const spark = p.sparkle({ duration: 0.35 });
  const out = layer(0.6, [[pop, 0, 1.0], [spark, 0.03, 0.25]]);
  finish(audio.mix_bus.applyFx(out, { hpf: 150, gain: 0.9 }), 'PopReveal');
}

// ShrinkWhoosh: short downward swish as an object shrinks into its "?" marker.
{
  const sw = p.swish({ duration: 0.35, direction: 'down', size: 0.4 });
  finish(audio.mix_bus.applyFx(sw, { hpf: 200, gain: 0.8 }), 'ShrinkWhoosh');
}
