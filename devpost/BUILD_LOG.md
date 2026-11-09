# Build log

How Loci was planned and built, and what went wrong along the way. The whole build ran in one Claude Code session (8–9 November 2026) against Lens Studio 5.23.2 through its MCP server.

## Timeline

| Commit | What |
|---|---|
| `fd630fa` | First working build from the brief: the flow end to end, with the 5 done criteria passing a scripted in-preview self-test |
| `739d3ec` | LEAF installed (2.0.2) and the 5 done criteria written as real-pinch LEAF scenarios; all pass |
| `19e94d3`, `8895703` | Brighter answer labels and card buttons, a light card, bold button text, a framed preview start |
| `8e7698a` | v2 part 1: the **Find-it** quiz replaces the ✓/✗ self-check; the preview framing is made readable for recording; 9 LEAF scenarios |
| `36240ab` | v2 part 2: the scientific-method **study pack**, new start-card buttons, voice on-device only; 10 scenarios |
| `f503db8` | v2 part 3: **Build my palace** (pinch 5 places for a custom route); 13 scenarios |
| this commit | Judge-facing docs, the LEAF results, screenshots and screenshot helpers. No gameplay changes |

## Key decisions from the plan-lens brief

The brief ([`design-brief.md`](design-brief.md)) was written and approved before any code. These are the decisions that shaped the build:

- **One spatial moment.** "I stand at my table and watch my list become a route." Everything else serves it: five objects drop one at a time onto real-feeling places, left to right like a sentence.
- **Product, not overlay.** The memory palace *is* the experience. A real version would sense the user's table, chair and shelf and hear the spoken list. The preview uses light, warm stand-ins built from boxes at real sizes: a 1.2 × 0.7 m table, a chair and a shelf.
- **Where things live, in centimetres from where the user stands.** Five spots: chair seat, table left, centre and right, and shelf top. Each has its own object size (15–30 cm). There is no floor spot, because it's too far down to look at comfortably. The card sits about 20 cm above the table's front edge, below the line of sight to the route.
- **Models from words, never a near-miss.** There is a fixed library of bright models built from simple shapes, each with synonyms. Matching ignores case, spacing and simple plurals. Any other word becomes a **word totem** (3D text on a per-spot base). There is no on-the-fly 3D generation.
- **One parser for every input.** "Sample list" and "Mixed list" send fixed text through the same parser and matcher as voice, so the voice path is tested without speech.
- **Pinch is the tested path.** Every step is a pinch. A 2-second look is an extra.
- **One thing pulses at a time.** A session takes about 90 s: build, study walk, group glow, quiz, results.
- **Done criteria written as tests.** There are five criteria, each checkable in the preview by pinching. The build notes tell CLAD to write a LEAF scenario for each.

Later decisions (the v2 changes, recorded in the brief's "v2 changes" section):

- **Find-it quiz.** The v1 score was an honest self-report (tap ✓ if you remembered). Find-it hides every object and asks "Where's the …?", and you point at the place. The score becomes objective, and it tests recall by place, which is what the method of loci trains. The prompt order is a seeded shuffle, so tests are deterministic.
- **Framing for recording.** The Specs view is about 32° wide, while the route spans about 87° from where the user stands. The preview camera therefore stands 3.2 m back, looking 16° down, and the card floats 0.9 m in front of it. Nothing changes on Specs.
- **Study pack.** Five abstract steps of the scientific method become five vivid objects, and the quiz asks for the step itself. Errands became the warm-up.
- **Build my palace.** The user pinches 5 surfaces and the route's spots move there. Places must be 25 cm apart. On Specs, World Query is tried behind a flag; the preview uses Box colliders on the stand-ins.

## CLAD agents and tools used

- **`lens-studio-router` (skill).** Checked the environment (Lens Studio 5.22+, project open, MCP up, editor signed in), saw that the project targets Specs, and handed off to the builder.
- **`specs-experience-builder` (agent).** Built v1 from the brief:
  - the scripts;
  - the stand-ins;
  - the 10 models made from primitives;
  - the parser and matcher;
  - the cards (built with UI Kit);
  - spatial audio cues made with CLAD's **build-sfx** and **build-music** synthesizers (generators in `tempAssetGen/`);
  - a scripted self-test of the 5 criteria.
- **`live-lens-tester` (agent).** Installed LEAF and wrote the first 5 scenarios and their helpers. It ran them in the preview with real SIK pinches, then fixed two timing bugs in its own tests.
- **Main Claude Code session.** Made every later change (v1 polish and v2 parts 1–3) directly through the Lens Studio MCP tools:
  - `ExecuteEditorCode` and `scene-graphql` for scene edits and saves;
  - `RecompileTypeScriptTool` and `RunAndCollectLogsTool` for the compile-and-run loop;
  - `CapturePanelScreenshotTool` and `MovePreviewCamera` for visual checks;
  - `IconSelector` for Material icons;
  - `open_leaf_panel`, `list_leaf_scenarios` and `run_leaf_scenario` for LEAF.

## Problems hit and how each was solved

### 1. Lens Studio 5.24 sign-in
- **Problem:** signing in to Lens Studio 5.24 didn't work for us. CLAD's router won't start a build until the editor reports a signed-in user, and the Asset Library (where SIK, UI Kit and LEAF come from) also needs an account.
- **Fix:** build on **Lens Studio 5.23.2**, where sign-in worked. It is inside CLAD's supported range (5.22+), and LEAF ships a matching editor plugin (LEAF Plugin 5.23). Everything in this repo, including the tests, targets 5.23.2.

### 2. LEAF 4.0.0 vs SIK 2.0.0
- **Problem:** the Asset Library offered Leaf 2.0.0, 2.0.1, 2.0.2 and 4.0.0, and the tester installed the newest. That was the wrong one, for two reasons:
  - Leaf 4.0.0 imports from `InteractionKit.lspkg`, the renamed kit at package version 4.0.0. This project uses `SpectaclesInteractionKit.lspkg`, package 2.0.0 (SIK 0.18.0 at runtime).
  - It was also built with a newer Lens Studio.

  During the install, Lens Studio logged `External Dependency InteractionKit version mismatch: project has 2.0.0, required is 4.0.0`. It tried to download InteractionKit 4.0.0 and opened two modal dialogs. From then on every editor change failed with `Invalid transition from Immutable to Mutable`, and recompiles timed out.
- **Fix:**
  1. The user closed both dialogs and chose **Cancel/No on InteractionKit 4.0.0**. A second interaction kit would have broken the Lens's buttons.
  2. We committed a checkpoint of the working build (`fd630fa`).
  3. The tester removed Leaf 4.0.0 and its project-scoped plugin through Lens Studio's asset manager.
  4. Before importing anything, it downloaded **Leaf 2.0.2** to a scratch folder and checked it. It depends on SpectaclesInteractionKit 2.0.0 and Bitmoji 3D 10.0.1, every import uses `SpectaclesInteractionKit.lspkg/...`, and it ships no project plugin.
  5. Installing 2.0.2 raised no dialogs, TypeScript compiled, and all 5 scenarios passed.
- **Lesson:** pick the LEAF version that matches the project's SIK package, not the newest one.
- **Related snag:** two preview-inspection MCP tools (`CaptureRuntimeViewTool`, `QueryRuntimeSceneTool`) silently auto-installed helper packages whose examples import kits this project doesn't have, which broke compilation. Those packages were removed, and the build switched to panel screenshots and the Lens's own state getters instead.

### 3. The MCP connection dropped after a Lens Studio restart
- **Problem:** Lens Studio quit unexpectedly mid-session, taking the MCP server with it. When it came back:
  - Scene edits made since the last save were gone. The card tint reverted to brown and the preview stand-back reverted to its old value, which gave the "low close-up of the table" the user saw.
  - The preview camera's start pose, which is editor workspace state rather than part of the project, came back level instead of 16° down.

  Lens Studio crashed twice more later: once during a LEAF run, and once during a screenshot showcase.
- **Fix:**
  - **Stop and report.** The project rule is never to work around a dead MCP with raw HTTP, so work stopped and was reported. A liveness hook blocks Lens Studio tool calls while the server is down. Work resumed only after the user restarted Lens Studio and reconnected.
  - **Verify against git first.** After each reconnect, the editor's project state was checked against the last commit. Lost scene values were re-applied and saved at once, and from then on the project was saved right after every scene edit.
  - **Stop depending on editor state.** Since the preview pose can reset on any restart, the Lens now tilts the room about the camera at start, so the view is always a 16° look-down whatever pitch the preview camera starts at.
  - **Commit in small verified steps.** v2 shipped as three commits, each only after its full LEAF suite passed. A crash could never cost more than unsaved scene edits.

### Smaller snags
- **The route doesn't fit the Specs view.** From the user's spot the Specs view is about 32° wide, while the route spans about 87°. A recording camera at the user's spot can never show it all. **Fix:** the preview-only stand-back camera and the card at 0.9 m, so the text stays readable at 1080p.
- **LEAF's simulated hand pinches up close.** Its ray is a short segment beside the target, which hit the chair seat from underneath during the first Build-my-palace test. **Fix:** the place tests pinch with LEAF's far-field `DefaultLeafInteractor`, whose ray runs from the camera through a thin aim pad on the surface. That is the same path as a mouse click. Places then landed 0.00 cm from their aim points.
- **Long LEAF runs outlast the MCP call.** C8 and C13 take 57–67 s, and `run_leaf_scenario` times out at about 60 s, but the scenario keeps running. **Fix:** read `[id] PASSED` from the Lens Studio log.
- **Injected preview taps don't reach SIK.** The real-mouse path for Build my palace therefore couldn't be automated. It is covered by the far-pointer tests and listed as a limit.
