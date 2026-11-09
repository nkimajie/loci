---
status: approved
---

# Design brief: Loci

<!-- Filled in by plan-lens from the learner's interview. Use the learner's words. Mark any value they didn't choose as (default). -->

## The one spatial moment
I stand at my table and watch my list become a route: five big, bright, playful 3D objects drop one at a time onto the chair, across the table and onto the shelf, reading left to right like a sentence. Then they shrink into glowing "?" markers, and I pinch each one in order, recall it, and see it pop back into its place.

## Why it belongs on glasses
- Uses: draws in the world (objects anchored to real spots in my room); leaves your body free (eyes up on the room, a single pinch per step).
- Why it's better than the phone or laptop version: the memory palace technique works because our brains remember places far better than lists, but on paper or a phone the "palace" is only imaginary. With glasses, it's real. The items sit in my actual room, along a route I physically look across.

## Product or overlay
- Type: product. The memory palace is the experience, placed on my real surroundings.
- What the real version would sense: my real table, chair and shelf, and my spoken list.
- Stand-in for the preview:
  - Surfaces: virtual stand-ins built from simple shapes in light, warm colours, never dark: a 1.2 × 0.7 m table, 0.75 m high; a chair (0.45 m seat) on its left; a shelf with its top at 1.2 m on its right. The 5 anchor spots are fixed on these.
  - Voice: "Sample list" and "Mixed list" buttons on the start card feed fixed lists through the same parser and matcher that voice uses.
  - Recall: no sensing needed. Scoring is an honest self-check (✓ "Got it" / ✗ "Missed"), the way flashcard apps do it.

## Where things live
- Where the user is looking during the main task: across the table in one left-to-right sweep, standing about 0.5 m back from the table front. Spots 2–4 are visible together; spots 1 and 5 sit at the edges of the view.
- All positions are measured from where the user stands (ahead / left / right, height above floor).
- Spot 1 (chair seat): 0.8 m ahead, 0.8 m left, 0.45 m high. Object about 30 cm.
- Spot 2 (table left): 0.9 m ahead, 0.35 m left, on the table (0.75 m). Object about 15 cm.
- Spot 3 (table back-centre, the hero spot): 1.1 m ahead, centred, on the table. Object about 20 cm.
- Spot 4 (table right): 0.9 m ahead, 0.35 m right, on the table. Object about 15 cm.
- Spot 5 (shelf top): 1.0 m ahead, 0.9 m right, 1.2 m high. Object about 20 cm.
- No floor spot: it's too far down to look at comfortably.
- "?" markers: 8 cm discs floating just above each spot.
- ✓ / ✗ targets: about 10 cm each, 14 cm apart, placed just below the revealed object, not on a floating panel.
- Start card: a small, pale "Loci" card floating about 20 cm above the table's front edge, centred, tilted toward the user, below the line of sight to the route objects.
- "Walk again" / "Quiz me" and the results card ("4 / 5" plus "Review missed", "Quiz again", "New list"): same spot as the start card, about 20 cm above the table's front edge.
- Virtual table, chair and shelf: as listed under the preview stand-in, positioned so the spots above sit on them.

### Sample list (errands before leaving the house, read in route order as a sentence)
1. Chair: umbrella, open bright-yellow canopy. Animation: spins open.
2. Table left: oversized gold key on a ring. Animation: jingles and turns.
3. Table centre: white milk carton with a sky-blue cap. Animation: hops and sloshes.
4. Table right: phone in a pink case ("call mom"). Animation: rings and wiggles.
5. Shelf: red gift box with a yellow bow. Animation: lid pops with confetti.

All bright and built from simple shapes.

### Model library and word totems
- Prebuilt models: the 5 sample models plus book, cup, apple, shoe, laptop, each with a synonym list (e.g. "mobile" → phone, "keys" → key).
- Matching ignores case, extra spaces and simple plurals (so "keys" matches the key model).
- A model is used only on an exact or synonym match, never a near-miss.
- Any other word becomes a "word totem": the word in big, bright 3D text on a small base whose colour and shape are unique to that spot, with the same drop, bounce and pulse behaviour as a model.
- No on-the-fly 3D generation.

## Hands and input
- Start: pinch "Say my list", "Sample list" or "Mixed list" on the start card.
- Study: pinch the current object to play its animation, show its name for 2 seconds and move on. (Looking at it for about 2 seconds does the same; extra.)
- Switch: pinch "Walk again" or "Quiz me". No timer.
- Quiz: pinch the current "?" marker to reveal the item, then pinch ✓ "Got it" or ✗ "Missed".
- Results: pinch "Review missed", "Quiz again" or "New list".
- Pinch is the tested path for every step.
- Targets highlight when aimed at.
- Voice and its button: "Say my list" uses speech-to-text; "Sample list" and "Mixed list" do the same job without speech. "Mixed list" sends the fixed text "umbrella, keys, volcano, mobile, gift" through the exact same parser and matcher as voice. Optional stretch: if I say my answer out loud in the quiz before pinching and speech-to-text matches the item name, it auto-marks ✓.

## When things show
A session takes about 90 seconds, and only one thing pulses at a time.
- Start card: shows at launch; hides once a list is chosen.
- Build: as each item is said (or read from the preset list), its object drops onto its spot one at a time in route order (chair, table left, table centre, table right, shelf) with a bounce and a chime from that spot. Watching the route form is the technique.
- Study: spot 1 pulses with an arrow. Pinching it (or a ~2 s look) plays a short silly animation and shows its name for 2 seconds; then a chime and an arrow point to the next spot. After spot 5, all five glow together for 2 seconds.
- Switch: "Walk again" and "Quiz me" appear after the group glow. "Walk again" restarts study at spot 1.
- Quiz: on "Quiz me", each object shrinks into a "?" marker in route order. Only the current marker pulses. Pinch reveals the item and shows ✓ / ✗ next to it; after answering, ✓ / ✗ hide and a chime and arrow move me to the next marker.
- Results: a "4 / 5"-style score card at the start-card spot; missed items glow at their spots. Buttons: "Review missed" (walks only the missed spots in study mode), "Quiz again", "New list". The card fades after about 10 seconds.
- Out of view: for spots 1 and 5, a soft chime from that spot and a small arrow point the way.

## Done criteria
Each one can be checked in Lens Studio's preview, via pinch, and each is a LEAF test.
1. "Sample list" places the 5 models one at a time, in route order, at chair, table left, table centre, table right, shelf.
2. Pinching the current object moves the pulse and arrow to the next spot, only one spot pulses at a time, and "Quiz me" appears after spot 5.
3. "Quiz me" turns all 5 into "?" markers, and pinching a marker reveals the correct item plus ✓ / ✗.
4. Answering ✓ ✓ ✗ ✓ ✓ shows "4 / 5", only spot 3 glows, and "Review missed" walks only spot 3.
5. "Mixed list" shows the key model for "keys" (plural matched), the phone model for "mobile", and a word totem reading exactly "volcano" at table centre, never a near-miss model.

## v2 changes

### Find-it quiz (replaces the ✓ / ✗ self-check)
- **What changed.** After "Quiz me", all 5 objects vanish and every spot shows the same neutral glowing "?" marker. Nothing pulses and no arrow points, so nothing gives the answer away. A prompt card asks "Where's the umbrella?" with the item's name and a small 3D copy of its model. I pinch the spot where I think it was: its marker, or the empty spot itself.
  - Right: the object pops back with a green ring and a bright chime, and stays.
  - Wrong: the pinched spot shakes red. Then the right spot briefly shows its object with an orange ring and its name, hides again, and the next prompt comes up.
- **Order.** The 5 items are asked once each, in a shuffled order that is never plain route order. The shuffle is seeded (`quizSeed`, default 7) so tests and demos repeat exactly. Each "Quiz again" round uses the next seeded order.
- **Score.** Correct first tries out of 5. On the results card the missed items glow at their spots as before, every object is back in place, and "Review missed" walks only the missed spots.
- **Why.** The v1 score was an honest self-report: I tapped ✓ if I thought I'd remembered. Find-it is objective, because the Lens knows where each item lives. It also tests the right thing. The method of loci trains recall by place: you walk the route in your head and find each item where you put it. Pointing at the place is that recall, done with the body in the real room. That is something only glasses can ask for. A phone quiz would ask for the word.
- **Removed.** The ✓ / ✗ targets and their per-spot anchors.

### Done criteria 3 and 4 (v2 wording; replaces 3 and 4 above)
3. "Quiz me" makes all 5 objects vanish behind identical neutral markers, and a prompt asks "Where's the <item>?" with that item's icon, in the seeded shuffled order. Pinching the right spot brings the object back with a green ring.
4. Pinching the right spot for 4 items and a wrong spot for the milk shows "4 / 5", only the milk's spot glows, and "Review missed" walks only that spot.

Extra LEAF checks: a wrong pinch reveals the right spot (red shake, then a brief orange-ring reveal); each item is asked exactly once; "Quiz again" resets the score; "New list" clears every spot. A study-pack check (C10) is described under "Study pack and start card" below.

### Study pack and start card
- **Start card.** Three packs, top to bottom: "Study pack" (the main, blue button), "Errands (warm-up)" and "Mixed list". "Build my palace" sits below them (see "Build my palace" below).
  - "Errands (warm-up)" is the v1 "Sample list", unchanged: umbrella, keys, milk, call mom, gift. Done criterion 1 now refers to it.
- **Study pack: the scientific method.** One step per spot, in route order:
  1. Chair: a white speech bubble with a blue "?" (Ask a question). Animation: the bubble chatters, squashing, stretching and waggling, while the "?" pops out toward me, spins and tucks back in.
  2. Table left: a magnifying glass with a gold rim and coral handle (Research). Animation: it scans left and right, then the lens zooms up big.
  3. Table centre: a yellow light bulb (Hypothesis). Animation: it crouches and jumps, and its rays flicker on and burst out, a visual "ding!".
  4. Table right: a green flask (Experiment). Animation: it shakes harder and harder, hops, and bubbles fizz out of the neck.
  5. Shelf: a checkered flag (Conclusion). Animation: a wave ripples along the cloth with a victory hop.
  - All five are bright and built from simple shapes, like the errands models. The flag's dark squares are deep blue, not black, because black disappears on the additive display.
- **Why a study pack.** Errands show the technique. Study material is where it pays off: an ordered list of abstract steps that has to be learned. "Hypothesis" is hard to picture; a light bulb jumping on the table is not, and the route keeps the steps in order.
- **Names and questions.** The name tag shows the step ("Hypothesis"); the object is its picture. Find-it asks for the step:
  - "Where's the question?", "Where's the research?", "Where's the hypothesis?", "Where's the experiment?", "Where's the conclusion?"
  - A phrase asks for the noun after its article: "ask a question" asks for "the question". "Call mom" still asks for "the phone".
  - Long questions shrink to stay on one line of the card.
- **Synonyms.** Each new model also matches its object names and its step words, through the same matcher as voice. For example, "lightbulb" and "idea" give the light bulb; "beaker" and "experiments" give the flask; "chequered flag" and "finish line" give the flag. Near-misses such as "glass" still become word totems.
- **Voice is on-device only.** "Say my list" uses the Specs speech-to-text (ASR) module, which works only on Specs, with internet, not in the Lens Studio preview.
  - The preview start card hides the button. On Specs it shows as a fourth button. For debugging, the card's "Show Voice In Preview" setting puts it back in the preview.
  - The packs send fixed text through the same parser and matcher that voice uses, so everything after speech-to-text is still tested.
- **LEAF (C10).** The start card shows the three packs in order, with no "Say my list" in the preview. The synonyms match. "Study pack" places the 5 models in route order. Each step's name shows and its animation plays (including its signature move) and settles back to rest. Find-it asks for each step by name with its icon, and ends at "5 / 5".

### Build my palace (custom spots)
- **Start card.** The fixed chair–table–shelf route stays the default, now called "Quick route". The start card's fourth button, "Build my palace", lets me choose my own five places instead.
- **Building.** The card says "Pinch 5 places for your palace" and counts "0 of 5", "1 of 5" and so on. I pinch any surface: chair seat, table, shelf top or the floor.
  - Each accepted pinch drops a numbered, glowing place (a cyan disc with a number above it). A thin bright line joins it to the previous place, so the route draws itself in order.
  - A pinch closer than 25 cm to an existing place is rejected gently. That place gives a small shake, and the card says "Too close to place 2 — try 25 cm away".
  - "Quick route" on the build card cancels and keeps the fixed route.
- **After 5 places.** The route's five spots move to my places, and the start card reads "Your palace: pick a pack for your 5 places". The chosen pack then drops onto them in the order I pinched them.
  - Everything after that is unchanged: the study walk, the Find-it quiz with markers at my places, the results with missed places glowing, and Review missed.
  - The numbered places hide while the objects are out. After "New list" they come back, because the palace is kept for the next list; reusing one palace for many lists is how the method of loci is meant to be used. The start card's last button is then "Quick route", which returns to the fixed spots.
- **How a pinch becomes a place.**
  - In the preview, the pinch's SIK interactor ray (from the eye through the mouse or the far-pinch point) is raycast against Box colliders on the table, chair and shelf stand-ins (table top, chair seat, shelf top and boards) and an invisible floor. Only hits on the top of a surface count. The colliders exist only while building, so they never get in the way of other pinches.
  - On Specs, the same code first asks World Query surface hit-testing (the "Build With World Query" setting, on by default) and falls back to the stand-ins. The preview never uses World Query, and on-device placement is untested here.
  - Pinches on the card's buttons are ignored.
- **Why.** The method of loci works best in a place you know. Choosing the places yourself, in your own order, is the first step of the technique, not a setting.
- **LEAF (C11–C13).** The place-pinching tests drive a camera-ray "far pointer" through LEAF, which follows the same path as a mouse click in the preview. LEAF's simulated hand pinches up close, with a short ray beside the target that can reach a surface from below, so it isn't used for places.
  - C11: 5 pinches create 5 places in order, numbered 1–5 and joined by 4 lines, each exactly where its ray hit. The route spots then move there.
  - C12: a pinch about 12 cm from place 2 is rejected (place 2 shakes, the card explains, still 2 of 5). A far-enough pinch is accepted. "Quick route" cancels.
  - C13: on a built palace, the Errands objects drop onto the custom places, the study walk and Find-it run there, and missing the milk gives "4 / 5" with only its place glowing. "New list" keeps the palace, and "Quick route" puts the fixed spots back.
- **Start card size.** With four buttons, the preview start card drops its empty status line (it only reports what voice heard). On Specs it also has "Say my list" and the status line, making it about 37 cm tall at the table's front edge.

### Framing fix for recording (Lens Studio preview only)
- **Problem.** The Specs view is only about 32° wide. From where the user stands (0.5 m from the table front), the chair and the shelf are about 87° apart, so the whole route can never be in one preview frame from there. Standing far enough back to fit it made the start card's text too small to read in a screen recording.
- **Fix.** The preview camera starts 3.2 m behind the user's spot, at standing eye height, looking about 16° down. The route is centred in the top half of the frame with a margin on both sides.
  - The preview camera's own pitch is editor state that can come back level after a Lens Studio restart. So the Lens doesn't rely on it: at start it tilts the room about the camera by whatever it takes to give the same 16° look-down view.
  - The card no longer sits at the far table edge in the preview. It floats about 0.9 m in front of the camera, in the free band below the table spots (or above the route if the camera starts level), so it never covers a spot.
  - Card captions and the quiz question are larger, and nothing was shrunk.
  - Item name tags scale with distance (up to 2.5×) so they stay readable from the camera.
  - Gaze dwell is off while the preview camera stands back, because it is a recording view, not the user's eyes.
- **On Specs nothing changes.** The card stays about 20 cm above the table's front edge, about 0.85 m from the eyes, which is already about the 0.9 m the preview copies. The stand-back is the "Preview Stand Back" setting on the Loci object; 0 starts the preview at the user's spot.

## Out of scope
- On-the-fly 3D generation of models from spoken words (future work).
- Recognizing the user's real table, chair and shelf; the preview uses fixed virtual stand-ins.
- More or fewer than 5 items.
- Remembering lists or scores between sessions.

## Risks and open questions
- Feel unproven: voice input (on-device only, so the preview can't test it), the 2-second look, and how the animations and chimes feel on real glasses.
- Spots 1 and 5 sit at the edges of the narrow view; the chime and arrow are expected to carry them, but only real glasses can confirm.

## Build notes for CLAD
- Build for SPECS so it runs and can be demonstrated in Lens Studio's preview. No SPECS device is available.
- Use Spectacles Interaction Kit (SIK) and UI Kit for all interactions, so they work with the mouse in Interactive Preview and with LEAF.
- Build any stand-in exactly as described above, and keep it obvious in the scene.
- Use real-world scale in centimeters. Keep content inside the user's view during the main task.
- The display is additive: black renders as transparent. Don't rely on black or very dark content to be seen; keep text light and readable from where the user stands.
- Get the basic flow working first, then add detail.
- Write LEAF scenarios for each done criterion, run them in preview, and report which pass. Say which criteria have no test.
- Don't record, identify, or follow people.

## After the build: judge it
This part is for you, after CLAD finishes.

1. **Does it work?** Ask your agent which LEAF tests passed and which done criteria have no test.
2. **Walk around it.** Open the preview in Interactive Preview. Use WASD to move, Q and E to go down and up, and right-drag (or hold Shift) to look around. Clicking acts as a pinch. Stand where a user would and look at the task.
3. **Ask the three questions.**
   - Does it use what I'm looking at?
   - Does it put something in my space, where it belongs?
   - Does it free my hands or let me keep my eyes up?
   - Would it be just as good on a phone? If so, what would make it need the glasses?
4. **Check comfort.**
   - Everything I need is in view while I do the task. Nothing sits at the edges, behind me, or stuck to my face.
   - Every control is within reach of someone standing there.
   - Text reads easily from where I stand. No dark UI disappearing.
   - Things show when needed and get out of the way.
5. **Label what you know.** Write "logic proven" next to anything the tests and preview show working, and "feel unproven" next to anything only real glasses could tell you (comfort over time, real hand tracking, real recognition).
6. **Fix with design notes, not code.** Tell your agent what to change in design terms, for example: "Move the step card 15 cm lower and next to the pan. Make the Next button twice as big. Re-run the tests." If a fix takes under a minute, like nudging a panel, do it yourself in the scene.
7. **Submit.** Record a video under 3 minutes of your Lens in the preview, public on YouTube. Make your repo public with your Lens Studio project and this `devpost/` folder. Details are on the hackathon site: https://learn-specs.devpost.com/resources
