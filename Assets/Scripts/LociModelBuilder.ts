/**
 * LociModelBuilder — turns LociModelLibrary recipes into simple-shape geometry,
 * builds word totems, and poses each model's short silly animation.
 *
 * Owns: model/totem SceneObject construction under a caller-provided parent,
 *       and the per-model animation curves (poseModel(t), t: 0..1, 1 = rest pose).
 * Expects: a LociShapeKit for meshes/materials; caller decides when to build/animate.
 * Note: the word totem's Text3D is 3D scene content (a world object on a base),
 *       not UI text — panel/label text lives in the *UI.ts modules.
 * Must not: hold session state or play audio.
 */

import {AnimKind, C, GroupDef, ModelDef, Rgb, TOTEM_STYLES} from "./LociModelLibrary"
import {LociShapeKit} from "./LociShapeKit"
import {Ease, clamp01, lerp} from "./LociTween"

const D2R = Math.PI / 180
const TWO_PI = Math.PI * 2

interface Rest {
  pos: vec3
  rot: quat
  scale: vec3
}

interface ConfettiPiece {
  obj: SceneObject
  start: vec3
  vel: vec3
  spin: vec3
}

export interface BuiltModel {
  root: SceneObject
  unit: number // cm per model unit
  modelId: string // library id, or "totem"
  totemText: string
  anim: AnimKind
  groups: {[name: string]: SceneObject}
  groupRest: {[name: string]: Rest}
  groupStartHidden: {[name: string]: boolean}
  confetti: ConfettiPiece[]
  confettiRoot: SceneObject | null
}

function v(a: number[]): vec3 {
  return new vec3(a[0], a[1], a[2])
}

function newObj(name: string, parent: SceneObject): SceneObject {
  const so = global.scene.createSceneObject(name)
  so.setParent(parent)
  return so
}

function makeGroups(b: BuiltModel, defs: GroupDef[] | undefined): void {
  if (!defs) return
  for (const g of defs) {
    const go = newObj("Group_" + g.name, b.root)
    const t = go.getTransform()
    t.setLocalPosition(v(g.pivot))
    const r = g.restRot || [0, 0, 0]
    t.setLocalRotation(quat.fromEulerAngles(r[0] * D2R, r[1] * D2R, r[2] * D2R))
    b.groups[g.name] = go
    b.groupRest[g.name] = {pos: t.getLocalPosition(), rot: t.getLocalRotation(), scale: t.getLocalScale()}
    b.groupStartHidden[g.name] = !!g.startHidden
    if (g.startHidden) go.enabled = false
  }
}

function emptyBuilt(root: SceneObject, unitCm: number, id: string, anim: AnimKind): BuiltModel {
  return {
    root,
    unit: unitCm,
    modelId: id,
    totemText: "",
    anim,
    groups: {},
    groupRest: {},
    groupStartHidden: {},
    confetti: [],
    confettiRoot: null,
  }
}

/** Builds a library model under `parent`; the root is scaled so 1 unit = `unitCm`. */
export function buildModel(kit: LociShapeKit, parent: SceneObject, def: ModelDef, unitCm: number): BuiltModel {
  const root = newObj("Model_" + def.id, parent)
  root.getTransform().setLocalScale(vec3.one().uniformScale(unitCm))
  const b = emptyBuilt(root, unitCm, def.id, def.anim)
  makeGroups(b, def.groups)
  def.parts.forEach((p, i) => {
    const host = p.group && b.groups[p.group] ? b.groups[p.group] : root
    kit.part(host, `${def.id}_${p.shape}_${i}`, p.shape, v(p.pos), v(p.size), p.rot ? v(p.rot) : null, kit.litMaterial(p.color))
  })
  if (def.confetti) addConfetti(kit, b)
  return b
}

function addConfetti(kit: LociShapeKit, b: BuiltModel): void {
  const croot = newObj("Confetti", b.root)
  croot.enabled = false
  b.confettiRoot = croot
  const colors: Rgb[] = [C.yellow, C.pink, C.sky, C.lime, C.coral, C.violet]
  for (let i = 0; i < 14; i++) {
    const ang = (i / 14) * TWO_PI
    const start = new vec3(Math.cos(ang) * 0.08, 0.66, Math.sin(ang) * 0.08)
    const piece = kit.part(croot, "Confetti_" + i, i % 3 === 0 ? "sphere" : "box", start, new vec3(0.06, 0.06, 0.02), null, kit.litMaterial(colors[i % colors.length]))
    b.confetti.push({
      obj: piece,
      start,
      vel: new vec3(Math.cos(ang) * (0.35 + (i % 4) * 0.1), 1.5 + (i % 5) * 0.12, Math.sin(ang) * (0.35 + (i % 3) * 0.12)),
      spin: new vec3(3 + i, 4 + (i % 3), 2 + (i % 5)),
    })
  }
}

/**
 * Builds a word totem: the word in big, bright 3D text on a small base whose colour
 * and shape are unique to the spot.
 */
export function buildTotem(kit: LociShapeKit, parent: SceneObject, word: string, spotIndex: number, unitCm: number): BuiltModel {
  const style = TOTEM_STYLES[((spotIndex % TOTEM_STYLES.length) + TOTEM_STYLES.length) % TOTEM_STYLES.length]
  const root = newObj("Totem_" + word, parent)
  root.getTransform().setLocalScale(vec3.one().uniformScale(unitCm))
  const b = emptyBuilt(root, unitCm, "totem", "hopSlosh")
  b.totemText = word

  const bs = v(style.baseSize)
  kit.part(root, "TotemBase", style.base, new vec3(0, bs.y / 2, 0), bs, null, kit.litMaterial(style.baseColor))
  // A small bright collar so every base reads as a pedestal.
  kit.part(root, "TotemCollar", "cylinder", new vec3(0, bs.y + 0.02, 0), new vec3(0.4, 0.04, 0.4), null, kit.litMaterial(C.cream))

  // Word object lives in cm space (cancels the unit scale) so layoutRect is in cm.
  const wordObj = newObj("TotemWord", root)
  wordObj.getTransform().setLocalPosition(new vec3(0, bs.y + 0.32, 0))
  // Lean the word back so it faces up toward a standing user's eyes.
  wordObj.getTransform().setLocalRotation(quat.fromEulerAngles(-25 * D2R, 0, 0))
  wordObj.getTransform().setLocalScale(vec3.one().uniformScale(1 / unitCm))
  if (kit.totemTextTemplate) {
    const t3 = wordObj.copyComponent(kit.totemTextTemplate) as Text3D
    t3.enabled = true
    t3.text = word
    const w = 2.0 * unitCm
    const h = 0.5 * unitCm
    t3.layoutRect = Rect.create(-w / 2, w / 2, -h / 2, h / 2)
    t3.horizontalOverflow = HorizontalOverflow.Shrink
    t3.verticalOverflow = VerticalOverflow.Shrink
    t3.sizeToFit = true
    t3.size = Math.round(h * 50)
    t3.extrusionDepth = 0.25
    const mat = t3.mainMaterial.clone()
    const c = new vec4(style.textColor[0], style.textColor[1], style.textColor[2], 1)
    const k = 0.8
    const edge = new vec4(style.textColor[0] * k, style.textColor[1] * k, style.textColor[2] * k, 1)
    const pass = mat.mainPass as any
    for (const k of ["frontCapStartingColor", "frontCapEndingColor"]) pass[k] = c
    for (const k of ["outerEdgeStartingColor", "outerEdgeEndingColor", "InnerEdgeStartingColor", "InnerEdgeEndingColor"]) pass[k] = edge
    for (const k of ["backCapStartingColor", "backCapEndingColor"]) pass[k] = c
    t3.mainMaterial = mat
  } else {
    print("LociModelBuilder: totemTextTemplate missing — totem '" + word + "' has no text.")
  }
  return b
}

// ── Animation ────────────────────────────────────────────────────────────────

function hop(t: number, h: number): number {
  const u = clamp01(t)
  return 4 * h * u * (1 - u)
}

function setRoot(b: BuiltModel, pos: vec3, rot: vec3, squash: number): void {
  const tr = b.root.getTransform()
  tr.setLocalPosition(pos.uniformScale(b.unit))
  tr.setLocalRotation(quat.fromEulerAngles(rot.x, rot.y, rot.z))
  const u = b.unit
  tr.setLocalScale(new vec3(u * (1 + squash * 0.5), u * (1 - squash), u * (1 + squash * 0.5)))
}

function setGroup(b: BuiltModel, name: string, offset: vec3, rot: vec3, scale: vec3): void {
  const g = b.groups[name]
  const rest = b.groupRest[name]
  if (!g || !rest) return
  const tr = g.getTransform()
  tr.setLocalPosition(rest.pos.add(offset))
  tr.setLocalRotation(rest.rot.multiply(quat.fromEulerAngles(rot.x, rot.y, rot.z)))
  tr.setLocalScale(new vec3(rest.scale.x * scale.x, rest.scale.y * scale.y, rest.scale.z * scale.z))
}

/** Returns the model to its exact rest pose. */
export function resetPose(b: BuiltModel): void {
  setRoot(b, vec3.zero(), vec3.zero(), 0)
  for (const name of Object.keys(b.groups)) {
    setGroup(b, name, vec3.zero(), vec3.zero(), vec3.one())
    b.groups[name].enabled = !b.groupStartHidden[name]
  }
  if (b.confettiRoot) b.confettiRoot.enabled = false
}

/** Poses the model's silly animation at normalized time t (0..1). t = 1 is rest. */
export function poseModel(b: BuiltModel, t: number): void {
  const Z = vec3.zero()
  const ONE = vec3.one()
  switch (b.anim) {
    case "spinOpen": {
      const spin = Ease.inOutSine(t) * TWO_PI
      const s = t < 0.25 ? lerp(1, 0.3, Ease.outQuad(t / 0.25)) : lerp(0.3, 1, Ease.outBack((t - 0.25) / 0.75))
      setRoot(b, new vec3(0, hop(t, 0.08), 0), new vec3(0, spin, 0), 0)
      setGroup(b, "canopy", Z, Z, new vec3(s, 1 + (1 - s) * 0.8, s))
      break
    }
    case "jingle": {
      const spin = Ease.inOutSine(t) * TWO_PI
      setRoot(b, new vec3(0, hop(t, 0.12), 0), new vec3(0, spin, Math.sin(t * 24) * 0.15 * (1 - t)), 0)
      setGroup(b, "ring", Z, new vec3(0, 0, Math.sin(t * 30) * 0.7 * (1 - t)), ONE)
      break
    }
    case "hopSlosh": {
      const hopT = clamp01(t / 0.6)
      let q = 0
      if (t < 0.1) q = (t / 0.1) * 0.12
      else if (t > 0.6) {
        const u = (t - 0.6) / 0.4
        q = Math.sin(u * Math.PI) * 0.16 * (1 - u)
      }
      setRoot(b, new vec3(0, hop(hopT, 0.35), 0), new vec3(0, 0, Math.sin(t * 16) * 0.22 * (1 - t)), q)
      break
    }
    case "ringWiggle": {
      const env = t < 0.85 ? 1 : (1 - t) / 0.15
      setRoot(b, new vec3(0, hop(t, 0.06), 0), new vec3(0, 0, Math.sin(t * 45) * 0.18 * env), 0)
      const rings = b.groups["rings"]
      if (rings) {
        rings.enabled = t < 0.92
        const k = 0.7 + 0.8 * ((t * 2.2) % 1)
        setGroup(b, "rings", Z, Z, new vec3(k, k, k))
      }
      break
    }
    case "lidPop": {
      let up = 0
      let tilt = 0
      if (t < 0.25) {
        const u = Ease.outQuad(t / 0.25)
        up = 0.4 * u
        tilt = 0.35 * u
      } else if (t < 0.7) {
        up = 0.4 + Math.sin((t - 0.25) * 20) * 0.02
        tilt = 0.35
      } else {
        const u = Ease.outBounce((t - 0.7) / 0.3)
        up = 0.4 * (1 - u)
        tilt = 0.35 * (1 - u)
      }
      setRoot(b, Z, Z, t < 0.12 ? (t / 0.12) * 0.1 : 0)
      setGroup(b, "lid", new vec3(0, up, 0), new vec3(-tilt, 0, 0), ONE)
      if (b.confettiRoot) {
        const active = t > 0.12 && t < 0.98
        b.confettiRoot.enabled = active
        if (active) {
          const tau = (t - 0.12) * 1.4
          for (const p of b.confetti) {
            const pos = p.start.add(p.vel.uniformScale(tau)).add(new vec3(0, -2.4 * tau * tau, 0))
            const ptr = p.obj.getTransform()
            ptr.setLocalPosition(pos)
            ptr.setLocalRotation(quat.fromEulerAngles(p.spin.x * tau, p.spin.y * tau, p.spin.z * tau))
          }
        }
      }
      break
    }
    case "hopSpin": {
      setRoot(b, new vec3(0, hop(t, 0.3), 0), new vec3(0, Ease.inOutSine(t) * TWO_PI, 0), 0)
      break
    }
    case "bounceSpin": {
      const y = Math.abs(Math.sin(t * TWO_PI)) * 0.25 * (1 - t * 0.5)
      setRoot(b, new vec3(0, y, 0), new vec3(0, t * TWO_PI, 0), 0)
      break
    }
    case "wobble": {
      setRoot(b, Z, new vec3(0, 0, Math.sin(t * 20) * 0.25 * (1 - t)), 0)
      const s = Math.sin(Math.PI * t)
      setGroup(b, "steam", new vec3(0, s * 0.2, 0), Z, vec3.one().uniformScale(1 + s * 0.4))
      break
    }
    case "step": {
      const w = Math.sin(t * TWO_PI)
      setRoot(b, new vec3(0, Math.abs(w) * 0.12, w * 0.18), new vec3(-w * 0.25, 0, 0), 0)
      break
    }
    case "lidOpen": {
      setRoot(b, new vec3(0, hop(t, 0.05), 0), Z, 0)
      setGroup(b, "screen", Z, new vec3(Math.sin(Math.PI * t) * 1.45, 0, 0), ONE)
      break
    }
    case "chatter": {
      // Speech bubble "talks" (three squash-stretch pulses with a waggle) while the "?"
      // pops out toward the user, spins once and tucks back in.
      const env = 1 - t
      const talk = Math.sin(t * 6 * Math.PI)
      setRoot(b, new vec3(0, hop(t, 0.1), 0), new vec3(0, 0, talk * 0.12 * env), talk * 0.1 * env)
      const u = clamp01(t / 0.8)
      const pop = Math.sin(Math.PI * u)
      setGroup(b, "mark", new vec3(0, pop * 0.12, pop * 0.25), new vec3(0, Ease.inOutSine(u) * TWO_PI, 0), vec3.one().uniformScale(1 + pop * 0.5))
      break
    }
    case "searchZoom": {
      // Magnifying glass scans left-right twice, then the lens zooms up big at the user.
      const scanEnv = t < 0.55 ? 1 : Math.max(0, 1 - (t - 0.55) / 0.15)
      const scan = Math.sin(t * 2 * TWO_PI) * scanEnv
      setRoot(b, new vec3(scan * 0.18, hop(t, 0.06), 0), new vec3(0, scan * 0.35, scan * 0.12), 0)
      let zoom = 0
      if (t > 0.55) {
        const u = (t - 0.55) / 0.45
        zoom = Math.sin(u * Math.PI) * 0.6 * (1 - u * 0.3)
      }
      setGroup(b, "glass", new vec3(0, 0, zoom * 0.25), Z, vec3.one().uniformScale(1 + zoom))
      break
    }
    case "lightUp": {
      // Light bulb crouches, jumps — ding! — rays flicker on, burst out and turn, then go out.
      const on = t > 0.22 && t < 0.92 && !(t < 0.36 && Math.sin(t * 90) < 0)
      const rays = b.groups["rays"]
      if (rays) rays.enabled = on
      const k = 0.6 + 0.6 * Ease.outBack(clamp01((t - 0.22) / 0.3))
      setGroup(b, "rays", Z, new vec3(0, 0, Math.max(0, t - 0.22) * 1.2), vec3.one().uniformScale(k))
      const crouch = t < 0.15 ? (t / 0.15) * 0.15 : 0
      const jump = t >= 0.15 ? hop((t - 0.15) / 0.5, 0.3) : 0
      setRoot(b, new vec3(0, jump, 0), new vec3(0, 0, Math.sin(t * 28) * 0.15 * (t > 0.3 ? 1 - t : 0)), crouch)
      break
    }
    case "fizz": {
      // Flask shakes harder and harder, hops, and a stream of bubbles rises out of the neck.
      const shakeEnv = t < 0.45 ? t / 0.45 : Math.max(0, 1 - (t - 0.45) / 0.2)
      setRoot(b, new vec3(0, hop((t - 0.4) / 0.35, 0.25), 0), new vec3(0, 0, Math.sin(t * 70) * 0.12 * shakeEnv), t > 0.36 && t < 0.42 ? 0.12 : 0)
      const bubbles = b.groups["bubbles"]
      if (bubbles) bubbles.enabled = t > 0.42 && t < 0.97
      const u = clamp01((t - 0.42) / 0.55)
      setGroup(b, "bubbles", new vec3(Math.sin(u * 12) * 0.04, u * 0.5, 0), new vec3(0, u * 3, 0), vec3.one().uniformScale(0.5 + u * 0.9))
      break
    }
    case "flagWave": {
      // Checkered flag waves (a wave travels along the four cloth columns) with a victory hop.
      const env = Math.sin(Math.PI * t)
      const ph = t * 4 * TWO_PI
      for (let k = 0; k < 4; k++) {
        const a = ph - k * 0.9
        setGroup(b, "c" + k, new vec3(0, Math.sin(a + 0.5) * 0.01 * k * env, Math.sin(a) * 0.05 * (k + 1) * env), new vec3(0, Math.cos(a) * 0.25 * env, 0), ONE)
      }
      const jumps = Math.abs(Math.sin(t * 2 * Math.PI)) * 0.12 * (1 - t)
      setRoot(b, new vec3(0, jumps, 0), new vec3(0, Math.sin(t * TWO_PI) * 0.3 * (1 - t), 0), 0)
      break
    }
  }
}
