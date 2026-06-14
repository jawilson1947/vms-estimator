import AVFoundation
import Foundation

/// Wraps AVSpeechSynthesizer for hands-free spoken acknowledgements.
///
/// Key iOS differences vs the web speechSynthesis API:
///  - AVAudioSession .playback category bypasses the ringer/silent switch
///  - No spontaneous freeze bug; no cancel()-before-speak() trap
///  - Completion callback is reliable
@MainActor
final class SpeechOutputManager: NSObject, ObservableObject, AVSpeechSynthesizerDelegate {

    static let shared = SpeechOutputManager()

    @Published var isSpeaking = false
    /// Overrides the default speech rate when set (used by SpeechOutputTestPanel).
    @Published var testRate: Float?

    private let synth = AVSpeechSynthesizer()
    private var onFinish: (() -> Void)?

    override init() {
        super.init()
        synth.delegate = self
        // The audio session is flipped per-utterance via configureSession(playback:),
        // which runs off the main thread so the frequent speak/listen toggles don't
        // block the UI (the previous on-main setActive caused the listening freeze).
    }

    // MARK: - Audio session helpers

    /// Configure the shared AVAudioSession OFF the main thread. `setCategory` /
    /// `setActive` are blocking Core Audio calls — running them on @MainActor
    /// (as before) stalled the UI during the frequent speak/listen toggles and
    /// caused the "freeze while listening". Bridged through a continuation like
    /// VoiceCommandManager does, so we await completion without blocking main.
    ///
    /// `playback == true`  → .playback / .spokenAudio (for synthesizer output)
    /// `playback == false` → .playAndRecord / .voiceChat (for the recognizers)
    private nonisolated func configureSession(playback: Bool) async {
        await withCheckedContinuation { (cont: CheckedContinuation<Void, Never>) in
            DispatchQueue.global(qos: .userInitiated).async {
                let session = AVAudioSession.sharedInstance()
                if playback {
                    try? session.setCategory(.playback, mode: .spokenAudio,
                                             options: [.duckOthers, .mixWithOthers])
                } else {
                    try? session.setCategory(.playAndRecord, mode: .voiceChat,
                                             options: [.defaultToSpeaker, .allowBluetoothHFP])
                }
                try? session.setActive(true)
                cont.resume()
            }
        }
    }

    // MARK: - Public API

    /// Speak `text`, then call `completion` when finished (or on error).
    func speak(_ text: String, then completion: (() -> Void)? = nil) {
        synth.stopSpeaking(at: .immediate)
        onFinish    = completion
        isSpeaking  = true

        let utt      = AVSpeechUtterance(string: text)
        utt.voice    = AVSpeechSynthesisVoice(language: "en-US")
        utt.rate     = testRate ?? (AVSpeechUtteranceDefaultSpeechRate * 1.15)
        utt.volume   = 1.0
        utt.preUtteranceDelay  = 0.05
        utt.postUtteranceDelay = 0.1

        // Configure the session off-main, then speak. The Task inherits the
        // @MainActor context, so `synth.speak` runs back on the main actor.
        Task { [weak self] in
            guard let self else { return }
            await self.configureSession(playback: true)
            self.synth.speak(utt)
        }
    }

    func stop() {
        synth.stopSpeaking(at: .immediate)
        finish()
    }

    // MARK: - AVSpeechSynthesizerDelegate

    nonisolated func speechSynthesizer(_ synthesizer: AVSpeechSynthesizer,
                                       didFinish utterance: AVSpeechUtterance) {
        Task { @MainActor in self.finish() }
    }

    nonisolated func speechSynthesizer(_ synthesizer: AVSpeechSynthesizer,
                                       didCancel utterance: AVSpeechUtterance) {
        Task { @MainActor in self.finish() }
    }

    private func finish() {
        isSpeaking = false
        let cb = onFinish
        onFinish = nil
        // Hand the session back to the recognizers (playAndRecord / voiceChat)
        // OFF the main thread, then run the completion — which typically starts
        // STT and needs the session already in the recording configuration.
        Task { [weak self] in
            await self?.configureSession(playback: false)
            cb?()
        }
    }
}
