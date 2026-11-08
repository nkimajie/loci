/**
 * LociAudio — all Loci sound cues, played from the spot they belong to.
 *
 * Owns: the generated SFX/music cue assets (fixed internal assets → requireAsset),
 *       a small pool of AudioComponents that can be moved to a world position
 *       (spatial chimes "from that spot"), and the master volume.
 * API: setup(camera), spotChime(i, pos), drop(pos), pop(pos), whoosh(pos),
 *      correct(pos), missed(pos), results(), routeArpeggio(positions).
 * Must not: decide when cues play — LociMain / LociSpot call it.
 */

const SPOT_CHIMES: AudioTrackAsset[] = [
  requireAsset("../GeneratedSFX/SpotChime1.wav") as AudioTrackAsset,
  requireAsset("../GeneratedSFX/SpotChime2.wav") as AudioTrackAsset,
  requireAsset("../GeneratedSFX/SpotChime3.wav") as AudioTrackAsset,
  requireAsset("../GeneratedSFX/SpotChime4.wav") as AudioTrackAsset,
  requireAsset("../GeneratedSFX/SpotChime5.wav") as AudioTrackAsset,
]
const DROP_BOUNCE = requireAsset("../GeneratedSFX/DropBounce.wav") as AudioTrackAsset
const POP_REVEAL = requireAsset("../GeneratedSFX/PopReveal.wav") as AudioTrackAsset
const SHRINK_WHOOSH = requireAsset("../GeneratedSFX/ShrinkWhoosh.wav") as AudioTrackAsset
const CORRECT_CHIME = requireAsset("../GeneratedSFX/CorrectChime.wav") as AudioTrackAsset
const MISSED_TONE = requireAsset("../GeneratedSFX/MissedTone.wav") as AudioTrackAsset
const RESULTS_JINGLE = requireAsset("../GeneratedSFX/ResultsJingle.wav") as AudioTrackAsset

const POOL_SIZE = 6

@component
export class LociAudio extends BaseScriptComponent {
  @ui.label('<span style="color: #60A5FA;">LociAudio – chimes, drops, pops and quiz cues (spatial, from each spot)</span>')
  @ui.separator
  @ui.label('<span style="color: #60A5FA;">Settings</span>')
  @ui.group_start("Settings")
  @input
  @hint("Overall volume for every Loci cue")
  @widget(new SliderWidget(0, 1, 0.05))
  masterVolume: number = 0.8

  @input
  @hint("Play chimes from the spot's position (spatial audio) so off-screen spots can be heard")
  spatialChimes: boolean = true
  @ui.group_end

  private pool: AudioComponent[] = []
  private next = 0
  private delayed: {left: number; fn: () => void}[] = []

  onAwake(): void {
    for (let i = 0; i < POOL_SIZE; i++) {
      const so = global.scene.createSceneObject("LociAudioVoice" + i)
      so.setParent(this.sceneObject)
      const ac = so.createComponent("Component.AudioComponent") as AudioComponent
      ac.playbackMode = Audio.PlaybackMode.LowLatency
      this.pool.push(ac)
    }
    this.createEvent("UpdateEvent").bind(() => {
      if (this.delayed.length === 0) return
      const dt = getDeltaTime()
      for (const d of this.delayed) d.left -= dt
      const due = this.delayed.filter((d) => d.left <= 0)
      this.delayed = this.delayed.filter((d) => d.left > 0)
      for (const d of due) d.fn()
    })
  }

  /** Enables spatial playback (adds an AudioListener to the camera if missing). */
  setup(cameraObject: SceneObject | null): void {
    if (!this.spatialChimes || !cameraObject) return
    try {
      if (!cameraObject.getComponent("Component.AudioListenerComponent")) {
        cameraObject.createComponent("Component.AudioListenerComponent")
      }
      for (const ac of this.pool) {
        ac.spatialAudio.enabled = true
        ac.spatialAudio.positionEffect.enabled = true
        ac.spatialAudio.distanceEffect.enabled = false
        ac.spatialAudio.directivityEffect.enabled = false
      }
    } catch (e) {
      print("LociAudio: spatial audio unavailable, using plain playback: " + e)
    }
  }

  spotChime(index: number, pos: vec3 | null): void {
    const i = Math.max(0, Math.min(SPOT_CHIMES.length - 1, index))
    this.play(SPOT_CHIMES[i], pos, 0.75)
  }

  drop(pos: vec3 | null): void {
    this.play(DROP_BOUNCE, pos, 0.7)
  }

  pop(pos: vec3 | null): void {
    this.play(POP_REVEAL, pos, 0.75)
  }

  whoosh(pos: vec3 | null): void {
    this.play(SHRINK_WHOOSH, pos, 0.45)
  }

  correct(pos: vec3 | null): void {
    this.play(CORRECT_CHIME, pos, 0.7)
  }

  missed(pos: vec3 | null): void {
    this.play(MISSED_TONE, pos, 0.6)
  }

  results(): void {
    this.play(RESULTS_JINGLE, null, 0.7)
  }

  /** Plays the five spot chimes in route order — the route as a little rising tune. */
  routeArpeggio(positions: (vec3 | null)[], indices: number[]): void {
    indices.forEach((spotIndex, k) => {
      this.delayed.push({left: k * 0.16, fn: () => this.spotChime(spotIndex, positions[k])})
    })
  }

  private play(track: AudioTrackAsset, pos: vec3 | null, volume: number): void {
    if (!track || this.pool.length === 0) return
    const ac = this.pool[this.next]
    this.next = (this.next + 1) % this.pool.length
    if (pos) ac.getSceneObject().getTransform().setWorldPosition(pos)
    else ac.getSceneObject().getTransform().setLocalPosition(vec3.zero())
    if (ac.isPlaying()) ac.stop(false)
    ac.audioTrack = track
    ac.volume = volume * this.masterVolume
    ac.play(1)
  }
}
