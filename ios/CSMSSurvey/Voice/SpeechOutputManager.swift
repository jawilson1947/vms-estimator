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

    private let synth = AVSpeechSynthesizer()
    private var onFinish: (() -> Void)?

    override init() {
        super.init()
        synth.delegate = self

        // Route speech through the speaker and bypass the hardware silent switch
        let session = AVAudioSession.sharedInstance()
        try? session.setCategory(.playback, mode: .spokenAudio, options: [.duckOthers, .mixWithOthers])
        try? session.setActive(true)
    }

    // MARK: - Public API

    /// Speak `text`, then call `completion` when finished (or on error).
    func speak(_ text: String, then completion: (() -> Void)? = nil) {
        synth.stopSpeaking(at: .immediate)
        onFinish    = completion
        isSpeaking  = true

        let utt      = AVSpeechUtterance(string: text)
        utt.voice    = AVSpeechSynthesisVoice(language: "en-US")
        utt.rate     = AVSpeechUtteranceDefaultSpeechRate * 1.15  // slightly faster
        utt.volume   = 1.0
        utt.preUtteranceDelay  = 0.05
        utt.postUtteranceDelay = 0.1
        synth.speak(utt)
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
        onFinish   = nil
        cb?()
    }
}
