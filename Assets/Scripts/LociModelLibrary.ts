/**
 * LociModelLibrary — the prebuilt model catalogue (pure data, no scene access).
 *
 * Owns: the 15 prebuilt models — the errands pack (umbrella, key, milk, phone, gift),
 *       the scientific-method study pack (speech bubble, magnifying glass, light bulb,
 *       flask, checkered flag) and book, cup, apple, shoe, laptop — their synonym lists,
 *       part recipes built from simple shapes, and which silly animation each one plays.
 *       Also the per-spot word-totem base styles.
 * Units: 1.0 = the spot's nominal object size. Base sits at y = 0, centred on x/z,
 *        front faces +Z (the spot turns the model toward the user).
 *        Parts that belong to a group use positions RELATIVE to the group pivot.
 * Must not: create SceneObjects — LociModelBuilder turns these recipes into geometry.
 */

export type ShapeKind = "box" | "sphere" | "cylinder" | "cone" | "torus" | "capsule" | "pyramid" | "disc"
export type Rgb = [number, number, number]
export type V3 = [number, number, number]

export type AnimKind =
  | "spinOpen"
  | "jingle"
  | "hopSlosh"
  | "ringWiggle"
  | "lidPop"
  | "hopSpin"
  | "wobble"
  | "step"
  | "lidOpen"
  | "bounceSpin"
  | "chatter"
  | "searchZoom"
  | "lightUp"
  | "fizz"
  | "flagWave"

export interface PartDef {
  shape: ShapeKind
  pos: V3
  size: V3
  rot?: V3 // degrees
  color: Rgb
  group?: string
}

export interface GroupDef {
  name: string
  pivot: V3
  restRot?: V3 // degrees
  startHidden?: boolean
}

export interface ModelDef {
  id: string
  displayName: string
  synonyms: string[]
  anim: AnimKind
  groups?: GroupDef[]
  parts: PartDef[]
  confetti?: boolean
}

export const C: {[name: string]: Rgb} = {
  yellow: [1.0, 0.86, 0.18],
  amber: [1.0, 0.66, 0.15],
  gold: [1.0, 0.77, 0.24],
  silver: [0.86, 0.88, 0.93],
  white: [0.97, 0.97, 0.95],
  sky: [0.45, 0.78, 1.0],
  skyLight: [0.74, 0.9, 1.0],
  pink: [1.0, 0.52, 0.72],
  pinkLight: [1.0, 0.8, 0.9],
  red: [0.96, 0.27, 0.28],
  coral: [1.0, 0.52, 0.42],
  orange: [1.0, 0.57, 0.22],
  teal: [0.32, 0.87, 0.8],
  blue: [0.4, 0.6, 1.0],
  cream: [1.0, 0.95, 0.83],
  green: [0.48, 0.9, 0.42],
  tan: [0.86, 0.66, 0.46],
  violet: [0.74, 0.55, 1.0],
  lime: [0.68, 0.96, 0.36],
  keys: [0.78, 0.82, 0.9],
  // Checkered-flag dark squares: deep blue, not black (black is invisible on the additive display).
  ink: [0.2, 0.26, 0.62],
}

/** A smooth stroke drawn as overlapping flat beads (used for the speech bubble's "?"). */
function beads(points: V3[], d: number, color: Rgb, group: string): PartDef[] {
  return points.map((p) => ({shape: "sphere" as ShapeKind, pos: p, size: [d, d, 0.04] as V3, color, group}))
}

/** "?" glyph in the XY plane, centred on its group pivot: a hook of beads, a stem and a dot. */
function questionMark(color: Rgb, group: string): PartDef[] {
  const pts: V3[] = []
  for (let a = 165; a >= -45; a -= 30) {
    const r = (a * Math.PI) / 180
    pts.push([0.1 * Math.cos(r), 0.09 + 0.1 * Math.sin(r), 0.01])
  }
  pts.push([0.03, -0.01, 0.01], [0.005, -0.045, 0.01], [0, -0.075, 0.01])
  const out = beads(pts, 0.075, color, group)
  out.push({shape: "sphere", pos: [0, -0.185, 0.01], size: [0.095, 0.095, 0.04], color, group})
  return out
}

/** 4 x 3 checkered flag cloth; each column is its own group (c0..c3) so it can wave. */
function checkeredCloth(): PartDef[] {
  const out: PartDef[] = []
  for (let k = 0; k < 4; k++) {
    for (let r = 0; r < 3; r++) {
      out.push({shape: "box", pos: [0, (r - 1) * 0.14, 0], size: [0.14, 0.14, 0.03], color: (k + r) % 2 === 0 ? C.white : C.ink, group: "c" + k})
    }
  }
  return out
}

/** Light-bulb "idea" rays: short capsules fanned over the top of the bulb (group "rays"). */
function bulbRays(): PartDef[] {
  const out: PartDef[] = []
  for (let i = 0; i <= 6; i++) {
    const deg = i * 30
    const r = (deg * Math.PI) / 180
    out.push({
      shape: "capsule",
      pos: [0.5 * Math.cos(r), 0.5 * Math.sin(r), 0],
      size: [0.06, 0.16, 0.06],
      rot: [0, 0, deg - 90],
      color: i % 2 === 0 ? C.yellow : C.white,
      group: "rays",
    })
  }
  return out
}

export const MODEL_LIBRARY: ModelDef[] = [
  {
    id: "umbrella",
    displayName: "Umbrella",
    synonyms: ["umbrella", "brolly", "parasol"],
    anim: "spinOpen",
    groups: [{name: "canopy", pivot: [0, 0.66, 0]}],
    parts: [
      {shape: "cylinder", pos: [0, 0.47, 0], size: [0.05, 0.84, 0.05], color: C.silver},
      {shape: "torus", pos: [0.06, 0.07, 0], size: [0.15, 0.045, 0.15], rot: [90, 0, 0], color: C.coral},
      {shape: "capsule", pos: [0, 0.16, 0], size: [0.07, 0.14, 0.07], color: C.coral},
      {shape: "cone", pos: [0, 0.13, 0], size: [0.96, 0.26, 0.96], color: C.yellow, group: "canopy"},
      {shape: "torus", pos: [0, 0.005, 0], size: [0.96, 0.045, 0.96], color: C.amber, group: "canopy"},
      {shape: "sphere", pos: [0.470, 0.0, 0.000], size: [0.06, 0.06, 0.06], color: C.amber, group: "canopy"},
      {shape: "sphere", pos: [0.332, 0.0, 0.332], size: [0.06, 0.06, 0.06], color: C.white, group: "canopy"},
      {shape: "sphere", pos: [0.000, 0.0, 0.470], size: [0.06, 0.06, 0.06], color: C.amber, group: "canopy"},
      {shape: "sphere", pos: [-0.332, 0.0, 0.332], size: [0.06, 0.06, 0.06], color: C.white, group: "canopy"},
      {shape: "sphere", pos: [-0.470, 0.0, 0.000], size: [0.06, 0.06, 0.06], color: C.amber, group: "canopy"},
      {shape: "sphere", pos: [-0.332, 0.0, -0.332], size: [0.06, 0.06, 0.06], color: C.white, group: "canopy"},
      {shape: "sphere", pos: [-0.000, 0.0, -0.470], size: [0.06, 0.06, 0.06], color: C.amber, group: "canopy"},
      {shape: "sphere", pos: [0.332, 0.0, -0.332], size: [0.06, 0.06, 0.06], color: C.white, group: "canopy"},
      {shape: "sphere", pos: [0, 0.95, 0], size: [0.06, 0.06, 0.06], color: C.amber},
    ],
  },
  {
    id: "key",
    displayName: "Key",
    synonyms: ["key", "keys", "key ring", "keyring", "car key", "house key"],
    anim: "jingle",
    groups: [{name: "ring", pivot: [0, 0.9, 0]}],
    parts: [
      {shape: "torus", pos: [0, 0.68, 0], size: [0.44, 0.14, 0.44], rot: [90, 0, 0], color: C.gold},
      {shape: "box", pos: [0, 0.47, 0], size: [0.16, 0.05, 0.1], color: C.amber},
      {shape: "box", pos: [0, 0.27, 0], size: [0.1, 0.4, 0.08], color: C.gold},
      {shape: "box", pos: [0.09, 0.12, 0], size: [0.1, 0.07, 0.07], color: C.gold},
      {shape: "box", pos: [0.075, 0.23, 0], size: [0.07, 0.06, 0.07], color: C.gold},
      {shape: "box", pos: [0, 0.035, 0], size: [0.08, 0.07, 0.07], color: C.gold},
      {shape: "torus", pos: [0, 0.05, 0], size: [0.3, 0.06, 0.3], rot: [70, 0, 0], color: C.silver, group: "ring"},
    ],
  },
  {
    id: "milk",
    displayName: "Milk",
    synonyms: ["milk", "milk carton", "carton of milk", "carton"],
    anim: "hopSlosh",
    parts: [
      {shape: "box", pos: [0, 0.32, 0], size: [0.42, 0.64, 0.42], color: C.white},
      {shape: "box", pos: [0, 0.36, 0], size: [0.43, 0.2, 0.43], color: C.sky},
      {shape: "sphere", pos: [0, 0.36, 0.215], size: [0.1, 0.12, 0.03], color: C.white},
      {shape: "box", pos: [0, 0.64, 0], size: [0.42, 0.3, 0.3], rot: [45, 0, 0], color: C.white},
      {shape: "box", pos: [0, 0.86, 0], size: [0.42, 0.06, 0.04], color: C.white},
      {shape: "cylinder", pos: [0, 0.78, 0.13], size: [0.13, 0.07, 0.13], rot: [45, 0, 0], color: C.sky},
    ],
  },
  {
    id: "phone",
    displayName: "Phone",
    synonyms: [
      "phone",
      "mobile",
      "mobile phone",
      "cell",
      "cellphone",
      "cell phone",
      "smartphone",
      "telephone",
      "call mom",
      "call mum",
    ],
    anim: "ringWiggle",
    groups: [{name: "rings", pivot: [0, 0.5, 0], startHidden: true}],
    parts: [
      {shape: "box", pos: [0, 0.5, 0], size: [0.52, 0.98, 0.1], color: C.pink},
      {shape: "box", pos: [0, 0.53, 0.051], size: [0.44, 0.78, 0.01], color: C.skyLight},
      {shape: "box", pos: [0, 0.94, 0.052], size: [0.12, 0.02, 0.008], color: C.white},
      {shape: "sphere", pos: [0, 0.08, 0.052], size: [0.07, 0.07, 0.02], color: C.white},
      {shape: "box", pos: [-0.1, 0.72, 0.058], size: [0.1, 0.1, 0.01], color: C.yellow},
      {shape: "box", pos: [0.1, 0.72, 0.058], size: [0.1, 0.1, 0.01], color: C.teal},
      {shape: "box", pos: [-0.1, 0.54, 0.058], size: [0.1, 0.1, 0.01], color: C.coral},
      {shape: "box", pos: [0.1, 0.54, 0.058], size: [0.1, 0.1, 0.01], color: C.violet},
      {shape: "torus", pos: [0, 0, 0], size: [0.9, 0.05, 0.9], rot: [90, 0, 0], color: C.pinkLight, group: "rings"},
      {shape: "torus", pos: [0, 0, 0], size: [1.25, 0.05, 1.25], rot: [90, 0, 0], color: C.pinkLight, group: "rings"},
    ],
  },
  {
    id: "gift",
    displayName: "Gift",
    synonyms: ["gift", "present", "gift box", "giftbox"],
    anim: "lidPop",
    confetti: true,
    groups: [{name: "lid", pivot: [0, 0.6, 0]}],
    parts: [
      {shape: "box", pos: [0, 0.3, 0], size: [0.7, 0.6, 0.7], color: C.red},
      {shape: "box", pos: [0, 0.3, 0], size: [0.72, 0.6, 0.14], color: C.yellow},
      {shape: "box", pos: [0, 0.3, 0], size: [0.14, 0.6, 0.72], color: C.yellow},
      {shape: "box", pos: [0, 0.06, 0], size: [0.78, 0.12, 0.78], color: C.red, group: "lid"},
      {shape: "box", pos: [0, 0.06, 0], size: [0.8, 0.125, 0.15], color: C.yellow, group: "lid"},
      {shape: "box", pos: [0, 0.06, 0], size: [0.15, 0.125, 0.8], color: C.yellow, group: "lid"},
      {shape: "capsule", pos: [-0.11, 0.22, 0], size: [0.13, 0.28, 0.13], rot: [0, 0, 55], color: C.yellow, group: "lid"},
      {shape: "capsule", pos: [0.11, 0.22, 0], size: [0.13, 0.28, 0.13], rot: [0, 0, -55], color: C.yellow, group: "lid"},
      {shape: "sphere", pos: [0, 0.16, 0], size: [0.12, 0.12, 0.12], color: C.amber, group: "lid"},
    ],
  },
  {
    id: "speech",
    displayName: "Speech bubble",
    synonyms: [
      "speech bubble",
      "speech balloon",
      "chat bubble",
      "bubble",
      "question",
      "question mark",
      "ask",
      "ask a question",
      "ask questions",
    ],
    anim: "chatter",
    groups: [{name: "mark", pivot: [0, 0.52, 0.1]}],
    parts: [
      // Sky outline behind a white elliptical bubble (cylinders turned to face the user).
      {shape: "cylinder", pos: [0, 0.52, -0.03], size: [1.04, 0.16, 0.82], rot: [90, 0, 0], color: C.sky},
      {shape: "cone", pos: [-0.25, 0.155, -0.03], size: [0.3, 0.36, 0.12], rot: [0, 0, 150], color: C.sky},
      {shape: "cylinder", pos: [0, 0.52, 0], size: [0.96, 0.2, 0.74], rot: [90, 0, 0], color: C.white},
      {shape: "cone", pos: [-0.24, 0.17, 0], size: [0.24, 0.3, 0.16], rot: [0, 0, 150], color: C.white},
      ...questionMark(C.blue, "mark"),
    ],
  },
  {
    id: "magnifier",
    displayName: "Magnifying glass",
    synonyms: [
      "magnifying glass",
      "magnifier",
      "magnifying lens",
      "loupe",
      "research",
      "do research",
      "background research",
      "search",
      "investigate",
      "investigation",
    ],
    anim: "searchZoom",
    groups: [{name: "glass", pivot: [-0.1, 0.62, 0]}],
    parts: [
      // Thin gold rim (a disc behind) around a big sky-blue lens (a thicker disc in front).
      {shape: "cylinder", pos: [0, 0, -0.01], size: [0.7, 0.06, 0.7], rot: [90, 0, 0], color: C.gold, group: "glass"},
      {shape: "cylinder", pos: [0, 0, 0.01], size: [0.58, 0.08, 0.58], rot: [90, 0, 0], color: C.skyLight, group: "glass"},
      {shape: "capsule", pos: [-0.12, 0.12, 0.055], size: [0.06, 0.18, 0.02], rot: [0, 0, 45], color: C.white, group: "glass"},
      {shape: "cylinder", pos: [0.183, 0.337, 0], size: [0.09, 0.1, 0.09], rot: [0, 0, 45], color: C.gold},
      {shape: "cylinder", pos: [0.324, 0.196, 0], size: [0.11, 0.3, 0.11], rot: [0, 0, 45], color: C.coral},
      {shape: "sphere", pos: [0.452, 0.068, 0], size: [0.12, 0.12, 0.12], color: C.coral},
    ],
  },
  {
    id: "bulb",
    displayName: "Light bulb",
    synonyms: [
      "light bulb",
      "lightbulb",
      "bulb",
      "idea",
      "bright idea",
      "hypothesis",
      "hypotheses",
      "make a hypothesis",
      "form a hypothesis",
    ],
    anim: "lightUp",
    groups: [{name: "rays", pivot: [0, 0.64, 0], startHidden: true}],
    parts: [
      {shape: "sphere", pos: [0, 0.64, 0], size: [0.6, 0.62, 0.6], color: C.yellow},
      {shape: "cone", pos: [0, 0.4, 0], size: [0.46, 0.36, 0.46], rot: [180, 0, 0], color: C.yellow},
      {shape: "sphere", pos: [-0.13, 0.76, 0.22], size: [0.09, 0.13, 0.04], color: C.white},
      {shape: "cylinder", pos: [0, 0.21, 0], size: [0.26, 0.22, 0.26], color: C.silver},
      {shape: "torus", pos: [0, 0.15, 0], size: [0.28, 0.035, 0.28], color: C.white},
      {shape: "torus", pos: [0, 0.21, 0], size: [0.28, 0.035, 0.28], color: C.white},
      {shape: "torus", pos: [0, 0.27, 0], size: [0.28, 0.035, 0.28], color: C.white},
      {shape: "cylinder", pos: [0, 0.07, 0], size: [0.14, 0.06, 0.14], color: C.amber},
      {shape: "sphere", pos: [0, 0.03, 0], size: [0.08, 0.05, 0.08], color: C.amber},
      ...bulbRays(),
    ],
  },
  {
    id: "flask",
    displayName: "Flask",
    synonyms: [
      "flask",
      "conical flask",
      "erlenmeyer flask",
      "beaker",
      "potion",
      "experiment",
      "do an experiment",
      "test",
      "lab",
      "chemistry",
    ],
    anim: "fizz",
    groups: [{name: "bubbles", pivot: [0, 0.94, 0], startHidden: true}],
    parts: [
      {shape: "cone", pos: [0, 0.35, 0], size: [0.74, 0.7, 0.74], color: C.lime},
      {shape: "sphere", pos: [-0.08, 0.2, 0.25], size: [0.08, 0.08, 0.04], color: C.white},
      {shape: "sphere", pos: [0.1, 0.12, 0.29], size: [0.06, 0.06, 0.04], color: C.white},
      {shape: "sphere", pos: [0.02, 0.32, 0.2], size: [0.05, 0.05, 0.03], color: C.white},
      {shape: "cylinder", pos: [0, 0.73, 0], size: [0.2, 0.42, 0.2], color: C.skyLight},
      {shape: "torus", pos: [0, 0.94, 0], size: [0.26, 0.05, 0.26], color: C.white},
      {shape: "sphere", pos: [0, 0.08, 0], size: [0.1, 0.1, 0.1], color: C.white, group: "bubbles"},
      {shape: "sphere", pos: [0.05, 0.2, 0], size: [0.08, 0.08, 0.08], color: C.lime, group: "bubbles"},
      {shape: "sphere", pos: [-0.04, 0.3, 0], size: [0.07, 0.07, 0.07], color: C.skyLight, group: "bubbles"},
      {shape: "sphere", pos: [0.03, 0.4, 0], size: [0.06, 0.06, 0.06], color: C.white, group: "bubbles"},
    ],
  },
  {
    id: "flag",
    displayName: "Checkered flag",
    synonyms: [
      "checkered flag",
      "chequered flag",
      "finish flag",
      "racing flag",
      "flag",
      "finish",
      "finish line",
      "conclusion",
      "conclude",
      "draw a conclusion",
    ],
    anim: "flagWave",
    groups: [
      {name: "c0", pivot: [-0.12, 0.77, 0]},
      {name: "c1", pivot: [0.02, 0.77, 0]},
      {name: "c2", pivot: [0.16, 0.77, 0]},
      {name: "c3", pivot: [0.3, 0.77, 0]},
    ],
    parts: [
      {shape: "cylinder", pos: [-0.21, 0.035, 0], size: [0.32, 0.07, 0.32], color: C.coral},
      {shape: "cylinder", pos: [-0.21, 0.52, 0], size: [0.06, 0.98, 0.06], color: C.silver},
      {shape: "sphere", pos: [-0.21, 1.03, 0], size: [0.1, 0.1, 0.1], color: C.gold},
      ...checkeredCloth(),
    ],
  },
  {
    id: "book",
    displayName: "Book",
    synonyms: ["book", "novel", "textbook"],
    anim: "hopSpin",
    parts: [
      {shape: "box", pos: [0, 0.43, 0], size: [0.62, 0.86, 0.16], color: C.blue},
      {shape: "box", pos: [0.02, 0.43, 0], size: [0.6, 0.82, 0.13], color: C.cream},
      {shape: "box", pos: [0, 0.62, 0.081], size: [0.44, 0.1, 0.01], color: C.yellow},
      {shape: "sphere", pos: [0, 0.4, 0.082], size: [0.14, 0.14, 0.01], color: C.yellow},
    ],
  },
  {
    id: "cup",
    displayName: "Cup",
    synonyms: ["cup", "mug", "coffee", "teacup", "tea cup", "coffee cup"],
    anim: "wobble",
    groups: [{name: "steam", pivot: [0, 0.75, 0]}],
    parts: [
      {shape: "cylinder", pos: [0, 0.3, 0], size: [0.56, 0.6, 0.56], color: C.teal},
      {shape: "cylinder", pos: [0, 0.3, 0], size: [0.57, 0.08, 0.57], color: C.white},
      {shape: "torus", pos: [0, 0.6, 0], size: [0.58, 0.05, 0.58], color: C.white},
      {shape: "cylinder", pos: [0, 0.57, 0], size: [0.5, 0.01, 0.5], color: C.tan},
      {shape: "torus", pos: [0.32, 0.32, 0], size: [0.32, 0.08, 0.32], rot: [90, 0, 0], color: C.teal},
      {shape: "sphere", pos: [-0.06, 0.03, 0], size: [0.1, 0.1, 0.1], color: C.white, group: "steam"},
      {shape: "sphere", pos: [0.06, 0.15, 0], size: [0.08, 0.08, 0.08], color: C.white, group: "steam"},
      {shape: "sphere", pos: [-0.03, 0.25, 0], size: [0.06, 0.06, 0.06], color: C.white, group: "steam"},
    ],
  },
  {
    id: "apple",
    displayName: "Apple",
    synonyms: ["apple"],
    anim: "bounceSpin",
    parts: [
      {shape: "sphere", pos: [0, 0.38, 0], size: [0.78, 0.74, 0.78], color: C.red},
      {shape: "cylinder", pos: [0, 0.8, 0], size: [0.05, 0.16, 0.05], rot: [0, 0, 10], color: C.tan},
      {shape: "sphere", pos: [0.1, 0.82, 0], size: [0.22, 0.04, 0.11], rot: [0, 0, 25], color: C.green},
      {shape: "sphere", pos: [-0.18, 0.55, 0.25], size: [0.12, 0.16, 0.06], color: C.pinkLight},
    ],
  },
  {
    id: "shoe",
    displayName: "Shoe",
    synonyms: ["shoe", "sneaker", "trainer", "boot"],
    anim: "step",
    parts: [
      {shape: "box", pos: [0, 0.05, 0.02], size: [0.42, 0.1, 0.96], color: C.white},
      {shape: "box", pos: [0, 0.28, -0.22], size: [0.4, 0.38, 0.46], color: C.orange},
      {shape: "sphere", pos: [0, 0.2, 0.2], size: [0.4, 0.28, 0.5], color: C.orange},
      {shape: "torus", pos: [0, 0.47, -0.25], size: [0.36, 0.05, 0.36], color: C.white},
      {shape: "box", pos: [0, 0.36, 0.0], size: [0.24, 0.035, 0.05], rot: [-30, 0, 0], color: C.white},
      {shape: "box", pos: [0, 0.31, 0.09], size: [0.24, 0.035, 0.05], rot: [-30, 0, 0], color: C.white},
      {shape: "box", pos: [0.205, 0.22, -0.05], size: [0.01, 0.06, 0.4], color: C.white},
      {shape: "box", pos: [-0.205, 0.22, -0.05], size: [0.01, 0.06, 0.4], color: C.white},
    ],
  },
  {
    id: "laptop",
    displayName: "Laptop",
    synonyms: ["laptop", "computer", "notebook computer", "macbook"],
    anim: "lidOpen",
    groups: [{name: "screen", pivot: [0, 0.06, -0.25], restRot: [-12, 0, 0]}],
    parts: [
      {shape: "box", pos: [0, 0.03, 0.05], size: [0.9, 0.06, 0.62], color: C.silver},
      {shape: "box", pos: [0, 0.062, 0.07], size: [0.78, 0.008, 0.3], color: C.keys},
      {shape: "box", pos: [0, 0.062, 0.29], size: [0.22, 0.006, 0.12], color: C.white},
      {shape: "box", pos: [0, 0.3, 0], size: [0.9, 0.6, 0.04], color: C.silver, group: "screen"},
      {shape: "box", pos: [0, 0.3, 0.021], size: [0.82, 0.52, 0.006], color: C.sky, group: "screen"},
      {shape: "sphere", pos: [0, 0.585, 0.022], size: [0.02, 0.02, 0.006], color: C.white, group: "screen"},
    ],
  },
]

/** Word-totem bases: colour + shape unique to each spot (index 0..4, route order). */
export interface TotemStyle {
  base: ShapeKind
  baseSize: V3
  baseColor: Rgb
  textColor: Rgb
}

export const TOTEM_STYLES: TotemStyle[] = [
  {base: "cylinder", baseSize: [0.62, 0.14, 0.62], baseColor: C.coral, textColor: [1.0, 0.9, 0.55]},
  {base: "box", baseSize: [0.62, 0.14, 0.42], baseColor: C.teal, textColor: [0.7, 1.0, 0.95]},
  {base: "pyramid", baseSize: [0.62, 0.2, 0.62], baseColor: C.violet, textColor: [1.0, 0.86, 0.3]},
  {base: "torus", baseSize: [0.62, 0.16, 0.62], baseColor: C.pink, textColor: [1.0, 0.85, 0.92]},
  {base: "sphere", baseSize: [0.6, 0.22, 0.6], baseColor: C.lime, textColor: [0.85, 1.0, 0.6]},
]

export function findModel(id: string): ModelDef | null {
  for (const m of MODEL_LIBRARY) if (m.id === id) return m
  return null
}
