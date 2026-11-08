/**
 * LociButtonSkin — bright, high-contrast skin for SpectaclesUIKit buttons on the
 * additive Specs display: a solid saturated fill per state (no dim grey theme
 * gradients), a white rim, and white glyphs / labels in every state.
 *
 * Shared by LociCardUI (card buttons) and LociAnswerUI (✓ / ✗ discs).
 * Pure helpers: no SceneObjects of its own.
 */

import {Button} from "SpectaclesUIKit.lspkg/Scripts/Components/Button/Button"
import {ElementContent} from "SpectaclesUIKit.lspkg/Scripts/Components/Content/ElementContent"
import {GradientParameters} from "SpectaclesUIKit.lspkg/Scripts/Visuals/RoundedRectangle/RoundedRectangle"
import {RoundedRectangleVisual} from "SpectaclesUIKit.lspkg/Scripts/Visuals/RoundedRectangle/RoundedRectangleVisual"

const RIM = new vec4(1, 1, 1, 0.95)
const HOVER_LIGHTEN = 0.22
const PRESS_LIGHTEN = 0.4
const WHITE = new vec4(1, 1, 1, 1)
const WHITE_DIM = new vec4(1, 1, 1, 0.5)

export function solidGradient(c: vec4): GradientParameters {
  return {
    enabled: true,
    start: new vec2(-1, 0),
    end: new vec2(1, 0),
    stop0: {enabled: true, percent: 0, color: c},
    stop1: {enabled: true, percent: 0.5, color: c},
    stop2: {enabled: true, percent: 1, color: c},
  }
}

export function lighten(c: vec4, t: number): vec4 {
  return new vec4(c.r + (1 - c.r) * t, c.g + (1 - c.g) * t, c.b + (1 - c.b) * t, c.a)
}

/**
 * Paints `btn` with a solid `fill` (lighter on hover / press) and a white rim, and
 * optionally makes its ElementContent label bold. The Button's onInitialized fires
 * before its visual applies the theme, so the paint lands one frame later.
 */
export function paintButton(host: BaseScriptComponent, btn: Button, fill: vec4, ec?: ElementContent, labelWeight?: number): void {
  const schedule = () => {
    const later = host.createEvent("DelayedCallbackEvent") as DelayedCallbackEvent
    later.bind(() => {
      const v = btn.visual
      if (v instanceof RoundedRectangleVisual) {
        v.defaultGradient = solidGradient(fill)
        v.hoveredGradient = solidGradient(lighten(fill, HOVER_LIGHTEN))
        v.triggeredGradient = solidGradient(lighten(fill, PRESS_LIGHTEN))
        v.inactiveGradient = solidGradient(new vec4(fill.r, fill.g, fill.b, fill.a * 0.5))
        v.borderDefaultGradient = solidGradient(RIM)
        v.borderHoveredGradient = solidGradient(RIM)
        v.borderTriggeredGradient = solidGradient(RIM)
        v.borderInactiveGradient = solidGradient(RIM)
      }
      if (ec && labelWeight !== undefined) {
        // ElementContent has no weight input; its label is a plain Text component.
        const label = (ec as unknown as {textComponent: Text | null}).textComponent
        if (label) label.weight = labelWeight
      }
    })
    later.reset(0)
  }
  if (btn.initialized) schedule()
  else btn.onInitialized.add(schedule)
}

/**
 * White label and white icon in every state. The theme default is a 0.85 grey label
 * and a near-black glyph while pressed. These fields are ElementContent's own Inspector
 * inputs ("Use Theme Colors" off + the per-state text colours / icon tints).
 */
export function whiteContent(ec: ElementContent): void {
  const c = ec as unknown as {
    _useThemeColors: boolean
    _defaultTextColor: vec4
    _hoveredTextColor: vec4
    _triggeredTextColor: vec4
    _inactiveTextColor: vec4
    _defaultIconTint: vec4
    _hoveredIconTint: vec4
    _triggeredIconTint: vec4
    _inactiveIconTint: vec4
  }
  c._useThemeColors = false
  c._defaultTextColor = WHITE
  c._hoveredTextColor = WHITE
  c._triggeredTextColor = WHITE
  c._inactiveTextColor = WHITE_DIM
  c._defaultIconTint = WHITE
  c._hoveredIconTint = WHITE
  c._triggeredIconTint = WHITE
  c._inactiveIconTint = WHITE_DIM
  ec.markColorsDirty()
}
