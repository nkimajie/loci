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

## Out of scope
- On-the-fly 3D generation of models from spoken words (future work).
- Recognizing the user's real table, chair and shelf; the preview uses fixed virtual stand-ins.
- More or fewer than 5 items.
- Remembering lists or scores between sessions.

## Risks and open questions
- Feel unproven: voice input (speech-to-text may not work in the preview), the 2-second look, and how the animations and chimes feel on real glasses.
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
