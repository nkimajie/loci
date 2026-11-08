/**
 * LociVoice — "Say my list" speech-to-text via the Specs ASR module.
 *
 * Owns: one ASR transcription session at a time; forwards partial and final text.
 * API: startListening(), stopListening(); getter isListening.
 *      Emits onPartial(text), onFinal(text), onError(message).
 * Must not: parse or match the list — LociMain sends final text through the same
 *           LociParser used by "Sample list" and "Mixed list".
 * Note: speech-to-text needs internet and may not work in the Lens Studio preview;
 *       errors surface through onError so the card can suggest "Sample list".
 */

import Event, {PublicApi} from "SpectaclesInteractionKit.lspkg/Utils/Event"

const SILENCE_UNTIL_TERMINATION_MS = 1500

@component
export class LociVoice extends BaseScriptComponent {
  @ui.label('<span style="color: #60A5FA;">LociVoice – speech-to-text for "Say my list" (ASR module)</span>')
  @ui.separator

  private asrModule: AsrModule = require("LensStudio:AsrModule")
  private listening = false
  private _onPartial = new Event<string>()
  private _onFinal = new Event<string>()
  private _onError = new Event<string>()

  get onPartial(): PublicApi<string> {
    return this._onPartial.publicApi()
  }

  get onFinal(): PublicApi<string> {
    return this._onFinal.publicApi()
  }

  get onError(): PublicApi<string> {
    return this._onError.publicApi()
  }

  get isListening(): boolean {
    return this.listening
  }

  onAwake(): void {
    this.createEvent("OnDestroyEvent").bind(() => this.stopListening())
  }

  startListening(): void {
    if (this.listening) return
    try {
      const options = AsrModule.AsrTranscriptionOptions.create()
      options.silenceUntilTerminationMs = SILENCE_UNTIL_TERMINATION_MS
      options.mode = AsrModule.AsrMode.HighAccuracy
      options.onTranscriptionUpdateEvent.add((e: AsrModule.TranscriptionUpdateEvent) => {
        if (!this.listening) return
        if (e.isFinal) this._onFinal.invoke(e.text)
        else this._onPartial.invoke(e.text)
      })
      options.onTranscriptionErrorEvent.add((code: AsrModule.AsrStatusCode) => {
        this.listening = false
        let msg = "Speech-to-text error"
        if (code === AsrModule.AsrStatusCode.NoInternet) msg = "No internet for speech-to-text"
        else if (code === AsrModule.AsrStatusCode.Unauthenticated) msg = "Speech-to-text not authorised here"
        this._onError.invoke(msg)
      })
      this.listening = true
      this.asrModule.startTranscribing(options)
    } catch (e) {
      this.listening = false
      this._onError.invoke("Speech-to-text unavailable: " + e)
    }
  }

  stopListening(): void {
    if (!this.listening) return
    this.listening = false
    try {
      this.asrModule.stopTranscribing()
    } catch (e) {
      print("LociVoice: stop failed: " + e)
    }
  }
}
