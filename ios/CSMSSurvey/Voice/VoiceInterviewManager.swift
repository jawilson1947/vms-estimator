import Speech
import AVFoundation
import Foundation

// MARK: - Field definition

struct InterviewFieldDef {
    let key: String
    let label: String
    let prompt: String
    let hint: String
    let isOptional: Bool
    let options: [String]?
}

// MARK: - State

enum InterviewState {
    case idle
    case prompting(field: String)
    case listening(field: String)
    case processing(field: String)
    case confirming(field: String, value: String, phrase: String)
    case reviewing
    case saving
    case done(andContinue: Bool)
    case failed(String)
}

// MARK: - Manager

/// Drives the guided voice interview for Add Location.
///
/// Usage:
///   1. Call `start(buildings:onSave:)` to begin.
///   2. Present `VoiceInterviewView` bound to this manager.
///   3. The manager speaks each prompt, listens for the response, asks Claude
///      to parse it, confirms with the user, then calls `onSave` when done.
@MainActor
final class VoiceInterviewManager: NSObject, ObservableObject {

    static let shared = VoiceInterviewManager()

    @Published var state: InterviewState = .idle
    @Published var collectedValues: [String: String] = [:]
    @Published var lastTranscription: String = ""
    @Published var isListening = false
    /// Last Claude API error — shown in VoiceInterviewView for debugging.
    @Published var lastAPIError: String? = nil

    /// Called when interview completes.
    var onSave: ((_ building: String,
                  _ areaName: String,
                  _ floor: String?,
                  _ surveyNotes: String?,
                  _ wantsPhotos: Bool,
                  _ andContinue: Bool) -> Void)?

    private let speech  = SpeechOutputManager.shared
    private let claude  = ClaudeInterviewClient.shared
    private let voice   = VoiceCommandManager.shared

    private var fields: [InterviewFieldDef] = []
    private var fieldIndex = 0

    private let recognizer = SFSpeechRecognizer(locale: Locale(identifier: "en-US"))!
    private var audioEngine      = AVAudioEngine()
    private var recognitionReq:  SFSpeechAudioBufferRecognitionRequest?
    private var recognitionTask: SFSpeechRecognitionTask?
    private var silenceTimer:    Task<Void, Never>?
    private var lastPartial:     String = ""

    private override init() { super.init() }

    // MARK: - Start / Stop

    func start(buildings: [SurveyBuilding],
               onSave: @escaping (_ building: String,
                                   _ areaName: String,
                                   _ floor: String?,
                                   _ surveyNotes: String?,
                                   _ wantsPhotos: Bool,
                                   _ andContinue: Bool) -> Void) {
        self.onSave = onSave
        collectedValues = [:]
        lastTranscription = ""
        fieldIndex = 0

        let buildingNames = buildings.map { $0.buildingName }

        fields = [
            InterviewFieldDef(
                key: "building", label: "Building",
                prompt: "Which building? The options are: \(buildingNames.joined(separator: "; ")).",
                hint: "Pick the closest matching building name from: \(buildingNames.joined(separator: ", "))",
                isOptional: false, options: buildingNames
            ),
            InterviewFieldDef(
                key: "areaName", label: "Area Name",
                prompt: "What is the area name?",
                hint: "A short descriptive name such as Server Room, Lobby, or Parking Level 1",
                isOptional: false, options: nil
            ),
            InterviewFieldDef(
                key: "floor", label: "Floor",
                prompt: "What floor is this on? Say skip to leave blank.",
                hint: "A floor number or name such as 1, 2, Ground, or Basement",
                isOptional: true, options: nil
            ),
            InterviewFieldDef(
                key: "surveyNotes", label: "Survey Notes",
                prompt: "Any survey notes? Say skip to leave blank.",
                hint: "Brief notes about the location or survey conditions",
                isOptional: true, options: nil
            ),
            InterviewFieldDef(
                key: "wantsPhotos", label: "Photos",
                prompt: "Do you need to add photos for this location? Say yes or no.",
                hint: "yes or no",
                isOptional: false, options: ["yes", "no"]
            ),
        ]

        // Claim the audio session for the entire interview. Keeping it as
        // .playAndRecord throughout avoids the playback↔playAndRecord oscillation
        // that SpeechOutputManager causes between each TTS/STT cycle, which was
        // producing mDataByteSize == 0 empty buffers on the tap callback.
        // AVSpeechSynthesizer works fine under .playAndRecord + .defaultToSpeaker.
        let session = AVAudioSession.sharedInstance()
        try? session.setCategory(.playAndRecord, mode: .measurement,
                                  options: [.defaultToSpeaker, .allowBluetooth])
        try? session.setActive(true)

        // Hand off audio from the always-on voice command listener
        voice.setEnabled(false)

        promptCurrentField()
    }

    func stop() {
        stopSTT()
        // Release the audio session so SpeechOutputManager / VoiceCommandManager
        // can reconfigure it after the interview ends.
        try? AVAudioSession.sharedInstance().setActive(false,
                                                        options: .notifyOthersOnDeactivation)
        voice.setEnabled(true)
        state = .idle
    }

    // MARK: - Field flow

    private func promptCurrentField() {
        guard fieldIndex < fields.count else {
            reviewAll()
            return
        }
        let field = fields[fieldIndex]
        state = .prompting(field: field.label)
        speech.speak(field.prompt) { [weak self] in
            self?.startListeningForField()
        }
    }

    private func startListeningForField() {
        guard fieldIndex < fields.count else { return }
        let field = fields[fieldIndex]
        state = .listening(field: field.label)
        // Brief delay lets the audio session fully release from TTS before we
        // switch it to .playAndRecord. Without this, audioEngine.start() can
        // fail silently and no audio is ever captured.
        Task {
            try? await Task.sleep(for: .milliseconds(300))
            await MainActor.run {
                self.startSTT { [weak self] transcription in
                    self?.process(transcription: transcription, field: field)
                }
            }
        }
    }

    private func process(transcription: String, field: InterviewFieldDef) {
        lastTranscription = transcription

        let norm = transcription.lowercased().trimmingCharacters(in: .whitespaces)

        // Photos field — resolve yes/no locally, no Claude round-trip needed.
        if field.key == "wantsPhotos" {
            let isYes = norm.contains("yes") || norm.contains("yeah") ||
                        norm.contains("yep") || norm == "sure"
            let isNo  = norm.contains("no")  || norm.contains("nope") ||
                        norm.contains("skip")
            if isYes {
                collectedValues["wantsPhotos"] = "yes"
                speech.speak("Great, you can add photos after saving.") { [weak self] in
                    self?.advanceField()
                }
            } else if isNo {
                collectedValues["wantsPhotos"] = "no"
                advanceField()
            } else {
                speech.speak("Please say yes or no.") { [weak self] in
                    self?.startListeningForField()
                }
            }
            return
        }

        // Handle "skip" for optional fields
        if field.isOptional && ["skip", "none", "pass", "nothing"].contains(norm) {
            advanceField()
            return
        }

        state = .processing(field: field.label)

        Task {
            do {
                let req = InterviewParseRequest(
                    fieldKey: field.key,
                    fieldLabel: field.label,
                    hint: field.hint,
                    transcription: transcription,
                    options: field.options
                )
                let response = try await claude.parse(req)
                self.state = .confirming(field: field.label,
                                         value: response.parsedValue,
                                         phrase: response.confirmPhrase)
                self.speech.speak(response.confirmPhrase) { [weak self] in
                    self?.waitForConfirmation(value: response.parsedValue, field: field)
                }
            } catch {
                let msg = (error as? InterviewError)?.errorDescription
                       ?? error.localizedDescription
                self.lastAPIError = msg
                // Speak a short version so it's audible on-device without TTS
                // reading out a full URL or JSON blob.
                let spoken: String
                if let ie = error as? InterviewError {
                    switch ie {
                    case .missingAPIKey:        spoken = "API key missing."
                    case .apiError(let s, _):   spoken = "API error \(s)."
                    case .decodeFailed:         spoken = "Response decode failed."
                    case .emptyResponse:        spoken = "Empty response."
                    case .badJSON:              spoken = "JSON parse failed."
                    }
                } else {
                    spoken = "Network error."
                }
                self.speech.speak("Error: \(spoken). Try again.") { [weak self] in
                    self?.startListeningForField()
                }
            }
        }
    }

    private func waitForConfirmation(value: String, field: InterviewFieldDef) {
        Task {
            try? await Task.sleep(for: .milliseconds(300))
            await MainActor.run { self._startConfirmationSTT(value: value, field: field) }
        }
    }

    private func _startConfirmationSTT(value: String, field: InterviewFieldDef) {
        startSTT { [weak self] transcription in
            guard let self else { return }
            let norm = transcription.lowercased().trimmingCharacters(in: .whitespaces)

            let isYes = norm.contains("yes") || norm.contains("correct") ||
                        norm.contains("right")  || norm.contains("yeah") ||
                        norm.contains("yep")    || norm == "sure"
            let isNo  = norm == "no"           || norm == "nope" ||
                        norm.contains("wrong") || norm.contains("change") ||
                        norm.contains("different")

            if isYes {
                self.collectedValues[field.key] = value
                self.advanceField()
            } else if isNo {
                self.speech.speak("Okay, let's try again.") { [weak self] in
                    self?.startListeningForField()
                }
            } else {
                // Treat the new utterance as a corrected value
                self.process(transcription: transcription, field: field)
            }
        }
    }

    private func advanceField() {
        fieldIndex += 1
        promptCurrentField()
    }

    // MARK: - Review

    private func reviewAll() {
        state = .reviewing
        var summary = "Here's what I have. "
        for field in fields {
            if let val = collectedValues[field.key] {
                summary += "\(field.label): \(val). "
            } else {
                summary += "\(field.label): skipped. "
            }
        }
        summary += "Say save, save and next, or cancel."
        speech.speak(summary) { [weak self] in
            self?.waitForSaveCommand()
        }
    }

    private func waitForSaveCommand() {
        Task {
            try? await Task.sleep(for: .milliseconds(300))
            await MainActor.run { self._startSaveCommandSTT() }
        }
    }

    private func _startSaveCommandSTT() {
        startSTT { [weak self] transcription in
            guard let self else { return }
            let norm = transcription.lowercased()
            if norm.contains("save and next") || norm.contains("next") {
                self.finalize(andContinue: true)
            } else if norm.contains("save") {
                self.finalize(andContinue: false)
            } else if norm.contains("cancel") || norm.contains("stop") || norm.contains("exit") {
                self.stop()
            } else {
                self.speech.speak("Say save, save and next, or cancel.") { [weak self] in
                    self?.waitForSaveCommand()
                }
            }
        }
    }

    private func finalize(andContinue: Bool) {
        state = .saving
        stopSTT()
        voice.setEnabled(true)

        onSave?(
            collectedValues["building"]    ?? "",
            collectedValues["areaName"]    ?? "",
            collectedValues["floor"],
            collectedValues["surveyNotes"],
            collectedValues["wantsPhotos"] == "yes",
            andContinue
        )

        state = .done(andContinue: andContinue)
    }

    // MARK: - STT engine

    private func startSTT(completion: @escaping (String) -> Void) {
        stopSTT()

        // Audio session is already configured as .playAndRecord by start().
        // Do NOT call setCategory here — repeated category switches between TTS
        // (.playback) and STT (.playAndRecord) are what cause the empty buffers.

        let req = SFSpeechAudioBufferRecognitionRequest()
        req.shouldReportPartialResults = true
        req.requiresOnDeviceRecognition = false
        recognitionReq = req

        let inputNode = audioEngine.inputNode
        let format    = inputNode.outputFormat(forBus: 0)
        guard format.sampleRate > 0 else {
            recognitionReq = nil
            speech.speak("Microphone not ready. Please try again.")
            return
        }

        // Capture `req` directly — not `self?.recognitionReq`.
        // The tap runs on a real-time audio thread. Accessing any @MainActor
        // property through self causes unsafeForcedSync (a blocking hop to the
        // main thread from the audio thread), starving the buffer.
        inputNode.installTap(onBus: 0, bufferSize: 1024, format: format) { buffer, _ in
            req.append(buffer)
        }

        do {
            try audioEngine.start()
        } catch {
            stopSTT()
            speech.speak("Microphone failed to start. Please try again.")
            return
        }
        isListening = true
        lastPartial = ""

        recognitionTask = recognizer.recognitionTask(with: req) { [weak self] result, error in
            // ── Extract all values from result/error on this background thread,
            //    BEFORE touching self. Promoting a weak @MainActor reference
            //    outside of a @MainActor context triggers unsafeForcedSync.
            let text    = result?.bestTranscription.formattedString
                              .trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
            let isFinal = result?.isFinal ?? false
            let hadError = error != nil

            Task { @MainActor [weak self] in
                guard let self else { return }

                if !text.isEmpty {
                    self.lastPartial = text
                    // Reset silence timer on every new partial.
                    // 2.5 s gives speakers time for natural pauses.
                    self.silenceTimer?.cancel()
                    self.silenceTimer = Task { [weak self] in
                        try? await Task.sleep(for: .seconds(2.5))
                        guard !Task.isCancelled else { return }
                        await MainActor.run { [weak self] in
                            guard let self else { return }
                            // Guard: if STT was already stopped (e.g. by an
                            // isFinal callback that fired first), do nothing.
                            // Without this, both paths call completion() and
                            // fieldIndex advances twice, skipping a field.
                            guard self.isListening else { return }
                            let captured = self.lastPartial
                            self.stopSTT()
                            if !captured.isEmpty { completion(captured) }
                        }
                    }
                }

                if isFinal && !text.isEmpty {
                    // Same guard: silence timer may have already fired.
                    guard self.isListening else { return }
                    self.silenceTimer?.cancel()
                    self.stopSTT()
                    completion(text)
                } else if hadError {
                    guard self.isListening else { return }
                    self.silenceTimer?.cancel()
                    let captured = self.lastPartial
                    self.stopSTT()
                    if !captured.isEmpty { completion(captured) }
                }
            }
        }
    }

    private func stopSTT() {
        silenceTimer?.cancel()
        silenceTimer = nil
        if audioEngine.isRunning { audioEngine.stop() }
        audioEngine.inputNode.removeTap(onBus: 0)
        recognitionTask?.cancel()
        recognitionTask = nil
        recognitionReq  = nil
        isListening     = false
        // Do NOT recreate audioEngine here. Creating a new AVAudioEngine()
        // resets its hardware connection; the next call to inputNode.outputFormat()
        // returns 0 Hz before the session settles, crashing installTap.
        // Reusing the same instance keeps the hardware format valid.
    }
}
