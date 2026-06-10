import Speech
import AVFoundation
import Foundation

// MARK: - Types

enum VoiceMode { case idle, waitingForValue }

struct VoiceCommand {
    let keywords: [String]
    let action: (String) -> Void   // called with remainder after keyword
}

/// Flat view of one context's registered commands — used by VoiceCommandTestPanel.
struct RegisteredCommandGroup {
    let context: String
    let keywords: [String]
}

// MARK: - Manager

/// Continuous speech recogniser that drives the hands-free survey workflow.
///
/// Usage:
///   1. Call `requestPermission()` once on app launch.
///   2. Call `register(id:commands:)` from each view when it appears.
///   3. Call `unregister(id:)` from onDisappear.
///   4. Commands call `waitForValue(_:then:)` to capture spoken field values.
@MainActor
final class VoiceCommandManager: NSObject, ObservableObject {

    static let shared = VoiceCommandManager()

    @Published var enabled    = true
    @Published var mode:      VoiceMode  = .idle
    @Published var activeField: String?  = nil
    @Published var lastHeard:   String   = ""
    @Published var isListening          = false
    @Published var permissionGranted    = false

    private let speech  = SpeechOutputManager.shared
    private let recognizer = SFSpeechRecognizer(locale: Locale(identifier: "en-US"))!
    private var audioEngine      = AVAudioEngine()
    private var recognitionReq:  SFSpeechAudioBufferRecognitionRequest?
    private var recognitionTask: SFSpeechRecognitionTask?

    private var commands: [String: [VoiceCommand]] = [:]   // keyed by context id
    private var valueCallback: ((String) -> Void)?
    private var valueTimer:    Task<Void, Never>?

    private let valueTimeoutSecs: Double = 6

    override private init() { super.init() }

    // MARK: - Permissions

    func requestPermission() async {
        let micStatus: Bool
        if #available(iOS 17.0, *) {
            micStatus = await AVAudioApplication.requestRecordPermission()
        } else {
            micStatus = await withCheckedContinuation { cont in
                AVAudioSession.sharedInstance().requestRecordPermission { granted in
                    cont.resume(returning: granted)
                }
            }
        }
        let speechStatus = await withCheckedContinuation { cont in
            SFSpeechRecognizer.requestAuthorization { status in
                cont.resume(returning: status == .authorized)
            }
        }
        permissionGranted = micStatus && speechStatus
        if permissionGranted { startListening() }
    }

    // MARK: - Command registration

    func register(id: String, commands: [VoiceCommand]) {
        self.commands[id] = commands
    }

    func unregister(id: String) {
        commands.removeValue(forKey: id)
    }

    /// Flat list of all registered commands, used by VoiceCommandTestPanel.
    var registeredCommands: [RegisteredCommandGroup] {
        commands.map { id, cmds in
            RegisteredCommandGroup(context: id, keywords: cmds.flatMap(\.keywords))
        }.sorted { $0.context < $1.context }
    }

    /// Injects a text phrase as if it were recognised by the microphone — for testing only.
    func simulateInput(_ text: String) {
        handle(text: text.lowercased().trimmingCharacters(in: .whitespacesAndNewlines))
    }

    // MARK: - waitForValue

    func waitForValue(_ fieldName: String, then callback: @escaping (String) -> Void) {
        valueTimer?.cancel()
        mode          = .waitingForValue
        activeField   = fieldName
        valueCallback = callback
        valueTimer    = Task {
            try? await Task.sleep(for: .seconds(valueTimeoutSecs))
            guard !Task.isCancelled else { return }
            await MainActor.run { self.clearValueMode(timedOut: true) }
        }
    }

    private func clearValueMode(timedOut: Bool = false) {
        valueTimer?.cancel()
        valueTimer    = nil
        mode          = .idle
        activeField   = nil
        let cb        = valueCallback
        valueCallback = nil
        if timedOut { speech.speak("Timed out. Try again.") }
        _ = cb   // discard
    }

    // MARK: - Recognition lifecycle

    func startListening() {
        guard !isListening, permissionGranted, enabled else { return }
        guard recognizer.isAvailable else { return }

        // setCategory / setActive are blocking — bridge to a background thread
        // via withCheckedContinuation so we don't capture self across actor boundaries
        // (which causes the Sendable warning) and don't block the main actor.
        Task {
            await withCheckedContinuation { (cont: CheckedContinuation<Void, Never>) in
                DispatchQueue.global(qos: .userInitiated).async {
                    let session = AVAudioSession.sharedInstance()
                    try? session.setCategory(.playAndRecord, mode: .measurement,
                                              options: [.defaultToSpeaker, .allowBluetoothHFP])
                    try? session.setActive(true)
                    cont.resume()
                }
            }
            // Resume on the main actor (Task inherits the @MainActor context of startListening)
            self.startEngine()
        }
    }

    private func startEngine() {
        let req = SFSpeechAudioBufferRecognitionRequest()
        req.shouldReportPartialResults = false
        req.requiresOnDeviceRecognition = false
        recognitionReq = req

        let inputNode = audioEngine.inputNode
        let format    = inputNode.outputFormat(forBus: 0)
        guard format.sampleRate > 0 else {
            recognitionReq = nil
            // Session not settled yet — retry shortly
            Task {
                try? await Task.sleep(for: .milliseconds(200))
                await MainActor.run { self.startListening() }
            }
            return
        }
        // Capture req directly to avoid @MainActor unsafeForcedSync on the
        // real-time audio thread.
        inputNode.installTap(onBus: 0, bufferSize: 1024, format: format) { buffer, _ in
            req.append(buffer)
        }

        try? audioEngine.start()
        isListening = true

        recognitionTask = recognizer.recognitionTask(with: req) { [weak self] result, error in
            guard let self else { return }
            if let result, result.isFinal {
                let text = result.bestTranscription.formattedString
                    .lowercased()
                    .trimmingCharacters(in: .whitespacesAndNewlines)
                Task { @MainActor in self.handle(text: text) }
            }
            if error != nil || (result?.isFinal ?? false) {
                Task { @MainActor in self.restartAfterResult() }
            }
        }
    }

    private func restartAfterResult() {
        stopEngine()
        guard enabled, !speech.isSpeaking else { return }
        // Brief pause before restarting to avoid echo
        Task {
            try? await Task.sleep(for: .milliseconds(300))
            await MainActor.run { self.startListening() }
        }
    }

    func pauseForSpeech() {
        stopEngine()
    }

    func resumeAfterSpeech() {
        guard enabled else { return }
        Task {
            try? await Task.sleep(for: .milliseconds(350))
            await MainActor.run { self.startListening() }
        }
    }

    private func stopEngine() {
        if audioEngine.isRunning { audioEngine.stop() }
        audioEngine.inputNode.removeTap(onBus: 0)
        recognitionTask?.cancel()
        recognitionTask = nil
        recognitionReq  = nil
        isListening     = false
        // Do NOT recreate audioEngine — same reason as VoiceInterviewManager:
        // a fresh AVAudioEngine() returns 0 Hz from inputNode.outputFormat()
        // before the hardware session settles, which crashes installTap.
    }

    // MARK: - Transcript handling

    func handle(text: String) {
        lastHeard = text

        // Consume as field value
        if mode == .waitingForValue, let cb = valueCallback {
            clearValueMode()
            cb(text)
            return
        }

        // Match registered commands
        let allCommands = commands.values.flatMap { $0 }
        for cmd in allCommands {
            for kw in cmd.keywords {
                let norm = text.lowercased()
                if norm == kw || norm.hasPrefix(kw + " ") {
                    let remainder = norm.hasPrefix(kw + " ")
                        ? String(norm.dropFirst(kw.count + 1))
                        : ""
                    cmd.action(remainder)
                    return
                }
            }
        }
    }

    // MARK: - Enable toggle

    func setEnabled(_ on: Bool) {
        enabled = on
        if on  { startListening() }
        else   { stopEngine() }
    }
}
