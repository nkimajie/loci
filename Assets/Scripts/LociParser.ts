/**
 * LociParser — the ONE parser + matcher shared by voice, "Sample list" and "Mixed list".
 *
 * Owns: splitting spoken/typed text into list items, and matching each item to a
 *       prebuilt model by exact name or synonym.
 * Matching rules (from the brief): ignore case, extra spaces and simple plurals;
 *       use a model only on an exact or synonym match — never a near-miss.
 *       Anything else becomes a word totem (modelId = null).
 * Must not: touch the scene.
 */

import {MODEL_LIBRARY} from "./LociModelLibrary"

export interface ListItem {
  /** Normalized word as heard ("keys", "volcano"). Also the totem text. */
  word: string
  /** Display label shown on the name tag ("Keys", "Call mom"). */
  display: string
  /** Matched model id, or null when the item becomes a word totem. */
  modelId: string | null
}

const LEADING_ARTICLES = ["a ", "an ", "the "]

/** Lowercase, strip punctuation, collapse whitespace, trim. */
export function normalize(text: string): string {
  let s = (text || "").toLowerCase()
  s = s.replace(/[^a-z0-9' \-]/g, " ")
  s = s.replace(/[\-']/g, " ")
  s = s.replace(/\s+/g, " ").trim()
  for (const a of LEADING_ARTICLES) {
    if (s.indexOf(a) === 0 && s.length > a.length) {
      s = s.substring(a.length).trim()
    }
  }
  return s
}

let synonymIndex: {[phrase: string]: string} | null = null

function getIndex(): {[phrase: string]: string} {
  if (synonymIndex) return synonymIndex
  synonymIndex = {}
  for (const m of MODEL_LIBRARY) {
    synonymIndex[normalize(m.id)] = m.id
    synonymIndex[normalize(m.displayName)] = m.id
    for (const s of m.synonyms) synonymIndex[normalize(s)] = m.id
  }
  return synonymIndex
}

/** Exact or synonym match, allowing only simple plurals. Returns null otherwise. */
export function matchModel(word: string): string | null {
  const w = normalize(word)
  if (w.length === 0) return null
  const idx = getIndex()
  if (idx[w] !== undefined) return idx[w]
  const candidates: string[] = []
  if (w.length > 3 && w.endsWith("ies")) candidates.push(w.substring(0, w.length - 3) + "y")
  if (w.length > 2 && w.endsWith("es")) candidates.push(w.substring(0, w.length - 2))
  if (w.length > 1 && w.endsWith("s")) candidates.push(w.substring(0, w.length - 1))
  for (const c of candidates) {
    if (idx[c] !== undefined) return idx[c]
  }
  return null
}

/** Multi-word synonyms we must not split when a transcript has no commas. */
function multiWordPhrases(): string[] {
  const out: string[] = []
  for (const k of Object.keys(getIndex())) if (k.indexOf(" ") >= 0) out.push(k)
  out.sort((a, b) => b.length - a.length)
  return out
}

/** Splits text into up to `max` items. Commas/"and"/"then"/full stops separate items. */
export function splitList(text: string, max: number = 5): string[] {
  const raw = (text || "")
    .toLowerCase()
    .replace(/\b(and then|and|then|also)\b/g, ",")
    .split(/[,;\.\n]+/)
    .map((s) => normalize(s))
    .filter((s) => s.length > 0)

  let items = raw
  if (items.length < max) {
    // No (or few) separators — e.g. a raw speech transcript. Split on spaces but
    // keep known multi-word synonyms ("call mom", "cell phone") together.
    const words = normalize(raw.join(" ")).split(" ").filter((s) => s.length > 0)
    const phrases = multiWordPhrases()
    const merged: string[] = []
    let i = 0
    while (i < words.length) {
      let taken = false
      for (const p of phrases) {
        const parts = p.split(" ")
        if (words.slice(i, i + parts.length).join(" ") === p) {
          merged.push(p)
          i += parts.length
          taken = true
          break
        }
      }
      if (!taken) {
        merged.push(words[i])
        i += 1
      }
    }
    if (merged.length > items.length) items = merged
  }
  return items.slice(0, max)
}

function capitalize(s: string): string {
  return s.length === 0 ? s : s.charAt(0).toUpperCase() + s.substring(1)
}

/** Parses text into ListItems via the shared matcher. */
export function parseAndMatch(text: string, max: number = 5): ListItem[] {
  return splitList(text, max).map((w) => ({
    word: w,
    display: capitalize(w),
    modelId: matchModel(w),
  }))
}
