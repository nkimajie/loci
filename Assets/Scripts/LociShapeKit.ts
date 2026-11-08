/**
 * LociShapeKit — builds simple-shape geometry (code-authored model backend).
 *
 * Owns: the unit primitive meshes + base materials, a colour→material cache, and
 *       helpers that place a primitive by centre/size/rotation (meshes are
 *       normalised by their AABB, so `size` is the real extent in parent units).
 * Expects @inputs: 8 unit primitive meshes, a lit SimplePBR material, an unlit
 *       material (glows/arrows) and a disabled Text3D template for word totems.
 * Must not: decide what to build or when — LociModelBuilder / LociSpot / LociGuide do.
 */

import {Rgb, ShapeKind} from "./LociModelLibrary"

const D2R = Math.PI / 180

@component
export class LociShapeKit extends BaseScriptComponent {
  @ui.label('<span style="color: #60A5FA;">LociShapeKit – simple-shape geometry for models, totems, glows and arrows</span>')
  @ui.separator
  @ui.label('<span style="color: #60A5FA;">References</span>')
  @ui.group_start("References")
  @input
  @hint("Unit box mesh (1 x 1 x 1)")
  boxMesh!: RenderMesh

  @input
  @hint("Unit sphere mesh")
  sphereMesh!: RenderMesh

  @input
  @hint("Unit cylinder mesh (Y-up)")
  cylinderMesh!: RenderMesh

  @input
  @hint("Unit cone mesh (apex +Y)")
  coneMesh!: RenderMesh

  @input
  @hint("Unit torus mesh (ring in the XZ plane)")
  torusMesh!: RenderMesh

  @input
  @hint("Unit capsule mesh (Y-up)")
  capsuleMesh!: RenderMesh

  @input
  @hint("Unit pyramid mesh (apex +Y)")
  pyramidMesh!: RenderMesh

  @input
  @hint("Unit disc mesh (flat, facing +Y)")
  discMesh!: RenderMesh

  @input
  @hint("Lit SimplePBR material — cloned once per colour for model parts")
  baseMaterial!: Material

  @input
  @hint("Unlit material — cloned for glows and arrows (made additive at runtime)")
  glowMaterial!: Material

  @input
  @hint("Disabled Text3D whose font + material word totems copy")
  totemTextTemplate!: Text3D
  @ui.group_end

  @ui.separator
  @ui.label('<span style="color: #60A5FA;">Settings</span>')
  @ui.group_start("Settings")
  @input
  @hint("Surface roughness of model parts (0 = glossy, 1 = matte)")
  @widget(new SliderWidget(0, 1, 0.05))
  roughness: number = 0.55

  @input
  @hint("Self-lit share of each model colour so objects read bright on the additive display (0 = lighting only)")
  @widget(new SliderWidget(0, 1, 0.05))
  emissiveBoost: number = 0.35
  @ui.group_end

  private litCache: {[key: string]: Material} = {}

  onAwake(): void {
    if (!this.boxMesh || !this.baseMaterial || !this.glowMaterial) {
      print("LociShapeKit: required mesh/material inputs are not wired.")
    }
  }

  mesh(kind: ShapeKind): RenderMesh {
    switch (kind) {
      case "sphere":
        return this.sphereMesh
      case "cylinder":
        return this.cylinderMesh
      case "cone":
        return this.coneMesh
      case "torus":
        return this.torusMesh
      case "capsule":
        return this.capsuleMesh
      case "pyramid":
        return this.pyramidMesh
      case "disc":
        return this.discMesh
      default:
        return this.boxMesh
    }
  }

  /** Lit material for a colour (cached — parts of the same colour share one material). */
  litMaterial(rgb: Rgb): Material {
    const key = rgb.map((v) => v.toFixed(3)).join(",")
    let mat = this.litCache[key]
    if (!mat) {
      mat = this.baseMaterial.clone()
      mat.mainPass.baseColor = new vec4(rgb[0], rgb[1], rgb[2], 1)
      mat.mainPass.roughness = this.roughness
      mat.mainPass.metallic = 0
      const k = this.emissiveBoost
      ;(mat.mainPass as any).Port_Emissive_N006 = new vec3(rgb[0] * k, rgb[1] * k, rgb[2] * k)
      this.litCache[key] = mat
    }
    return mat
  }

  /** A fresh additive unlit material (not cached — callers animate its colour). */
  glowMaterialFor(rgb: Rgb, intensity: number): Material {
    const mat = this.glowMaterial.clone()
    mat.mainPass.blendMode = BlendMode.Add
    mat.mainPass.depthWrite = false
    mat.mainPass.twoSided = true
    LociShapeKit.setGlow(mat, rgb, intensity)
    return mat
  }

  static setGlow(mat: Material, rgb: Rgb, intensity: number): void {
    const k = Math.max(0, intensity)
    mat.mainPass.baseColor = new vec4(rgb[0] * k, rgb[1] * k, rgb[2] * k, 1)
  }

  /**
   * Places one primitive: `pos` is its centre and `size` its real extent, both in
   * the parent's local units; `rotDeg` is applied after sizing.
   */
  part(
    parent: SceneObject,
    name: string,
    kind: ShapeKind,
    pos: vec3,
    size: vec3,
    rotDeg: vec3 | null,
    material: Material,
  ): SceneObject {
    const so = global.scene.createSceneObject(name)
    so.setParent(parent)
    const m = this.mesh(kind)
    const ext = m.aabbMax.sub(m.aabbMin)
    const sx = ext.x > 1e-4 ? size.x / ext.x : size.x
    const sy = ext.y > 1e-4 ? size.y / ext.y : Math.max(size.y, 0.001)
    const sz = ext.z > 1e-4 ? size.z / ext.z : size.z
    const t = so.getTransform()
    t.setLocalPosition(pos)
    if (rotDeg) t.setLocalRotation(quat.fromEulerAngles(rotDeg.x * D2R, rotDeg.y * D2R, rotDeg.z * D2R))
    t.setLocalScale(new vec3(sx, sy, sz))
    const rmv = so.createComponent("Component.RenderMeshVisual") as RenderMeshVisual
    rmv.mesh = m
    rmv.mainMaterial = material
    return so
  }
}
