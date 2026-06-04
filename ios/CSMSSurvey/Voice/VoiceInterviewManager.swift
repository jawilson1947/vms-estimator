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

@MainActor
final class VoiceInterviewManager: NSObject, ObservableObject {

    static let shared = VoiceInterviewManager()

    @Published var state: InterviewState = .idle
    @Published var collectedValues: [String: String] = [:]
    @Published var lastTranscription: String = ""
    @Published var isListening = false
    @Published var lastAPIError: String? = nil

    var onSave: ((_ building: String,
                  _ areaName: String,
                  _ floor: String?,
                  _ surveyNotes: String?,
                  _ wantsPhotos: Bool,
                  _ andContinue: Bool) -> Void)?

    private let speech = SpeechOutputManager.shared
    private let claude = ClaudeInterviewClient.shared
    private let voice  = VoiceCommandManager.shared

    private var fields:     [InterviewFieldDef] = []
    private var fieldIndex  = 0

    private let recognizer   = SFSpeechRecognizer(locale: Locale(identifier: "en-US"))!
    private var recognitionReq:  SFSpeechAudioBufferRecognitionRequest?
    private var recognitionTask: SFSpeechRecognitionTask?
    private var silenceTimer:    Task<Void, Never>?
    private var timeoutTimer:    Task<Void, Never>?
    private var lastPartial:      String = ""
    private var completionFired   = false
    private var activeEngine:     AVAudioEngine?
    private var pendingCompletion: ((String) -> Void)?

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
        lastAPIError = nil

        let buildingNames = buildings.map { $0.buildingName }

        fields = [
            InterviewFieldDef(
                key: "building", label: "Building",
                prompt: "Which building? Options are: \(buildingNames.joined(separator: "; ")).",
                hint: "Pick the closest matching building name from: \(buildingNames.joined(separator: ", "))",
                isOptional: false, options: buildingNames
            ),
            InterviewFieldDef(
                key: "areaName", label: "Area name",
                prompt: "What is the area name?",
                hint: "Short name like Server Room or Lobby",
                isOptional: false, options: nil
            ),
            InterviewFieldDef(
                key: "floor", label: "Floor",
                prompt: "Which floor? Say skip to leave blank.",
                hint: "Floor number or name",
                isOptional: true, options: nil
            ),
            InterviewFieldDef(
                key: "surveyNotes", label: "Survey notes",
                prompt: "Any survey notes? Say skip to leave blank.",
                hint: "Brief notes about the location",
                isOptional: true, options: nil
            ),
            InterviewFieldDef(
                key: "wantsPhotos", label: "Photos",
                prompt: "Do you need to add photos? Say yes or no.",
                hint: "yes or no",
                isOptional: false, options: ["yes", "no"]
            ),
        ]

        let session = AVAudioSession.sharedInstance()
        try? session.setCategory(.playAndRecord, mode: .measurement,
                                  options: [.defaultToSpeaker, .allowBluetooth])
        try? session.setActive(true)

        voice.setEnabled(false)
        promptCurrentField()
    }

    func stop() {
        stopSTT()
        pendingCompletion = nil
        try? AVAudioSession.sharedInstance().setActive(false,
                                                        options: .notifyOthersOnDeactivation)
        voice.setEnabled(true)
        state = .idle
    }

    /// Called by the Done button — immediately fires with whatever has been heard so far.
    func manualDone() {
        guard isListening, let completion = pendingCompletion else { return }
        let captured = lastPartial
        stopSTT()
        pendingCompletion = nil
        if !captured.isEmpty {
            fireCompletion(captured, completion: completion)
        } else {
            speech.speak("I didn't catch anything. Please try again.") { [weak self] in
                self?.startListeningForField()
            }
        }
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
        Task {
            try? await Task.sleep(for: .milliseconds(400))
            self.startSTT { [weak self] transcription in
                self?.process(transcription: transcription, field: field)
            }
        }
    }

    private func process(transcription: String, field: InterviewFieldDef) {
        lastTranscription = transcription
        let norm = transcription.lowercased().trimmingCharacters(in: .whitespaces)

        // Yes/No fields — resolve locally
        if field.key == "wantsPhotos" {
            let yes = norm.contains("yes") || norm.contains("yeah") ||
                      norm.contains("yep") || norm == "sure"
            let no  = norm.contains("no")  || norm.contains("nope") ||
                      norm.contains("skip")
            if yes {
                collectedValues["wantsPhotos"] = "yes"
                speech.speak("Got it.") { [weak self] in self?.advanceField() }
            } else if no {
                collectedValues["wantsPhotos"] = "no"
                advanceField()
            } else {
                speech.speak("Please say yes or no.") { [weak self] in
                    self?.startListeningForField()
                }
            }
            return
        }

        // Skip for optional fields
        if field.isOptional &&
           ["skip", "none", "pass", "nothing", "no"].contains(norm) {
            advanceField()
            return
        }

        // Building — use Claude for fuzzy name matching
        if field.key == "building" {
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
                    self.confirm(value: response.parsedValue,
                                 phrase: response.confirmPhrase,
                                 field: field)
                } catch {
                    self.lastAPIError = error.localizedDescription
                    // Fall back to raw transcription
                    let fallback = transcription.trimmingCharacters(in: .whitespaces)
                    self.confirm(value: fallback,
                                 phrase: "I heard \(fallback). Is that correct?",
                                 field: field)
                }
            }
            return
        }

        // All other fields — accept transcription directly
        let value = transcription.trimmingCharacters(in: .whitespaces)
        confirm(value: value,
                phrase: "\(field.label): \(value). Is that correct?",
                field: field)
    }

    private func confirm(value: String, phrase: String, field: InterviewFieldDef) {
        state = .confirming(field: field.label, value: value, phrase: phrase)
        speech.speak(phrase) { [weak self] in
            self?.waitForConfirmation(value: value, field: field)
        }
    }

    private func waitForConfirmation(value: String, field: InterviewFieldDef) {
        Task {
            try? await Task.sleep(for: .milliseconds(400))
            self.startSTT { [weak self] transcription in
                guard let self else { return }
                let norm = transcription.lowercased().trimmingCharacters(in: .whitespaces)
                let yes  = norm.contains("yes")   || norm.contains("correct") ||
                           norm.contains("right") || norm.contains("yeah")    ||
                           norm.contains("yep")   || norm == "sure"
                let no   = norm.contains("no")    || norm.contains("nope")  ||
                           norm.contains("wrong") || norm.contains("change")
                if yes {
                    self.collectedValues[field.key] = value
                    self.advanceField()
                } else if no {
                    self.speech.speak("Okay, let's try again.") { [weak self] in
                        self?.startListeningForField()
                    }
                } else {
                    self.process(transcription: transcription, field: field)
                }
            }
        }
    }

    private func advanceField() {
        fieldIndex += 1
        promptCurrentField()
    }

    // MARK: - Review & save

    private func reviewAll() {
        state = .reviewing
        var summary = "Here is what I have. "
        for field in fields where field.key != "wantsPhotos" {
            if let val = collectedValues[field.key] {
                summary += "\(field.label): \(val). "
            }
        }
        summary += "Say save, save and next, or cancel."
        speech.speak(summary) { [weak self] in
            self?.listenForSaveCommand()
        }
    }

    private func listenForSaveCommand() {
        Task {
            try? await Task.sleep(for: .milliseconds(400))
            self.startSTT { [weak self] transcription in
                guard let self else { return }
                let norm = transcription.lowercased()
                if norm.contains("save and next") || norm.contains("next") {
                    self.finalize(andContinue: true)
                } else if norm.contains("save") {
                    self.finalize(andContinue: false)
                } else if norm.contains("cancel") || norm.contains("stop") ||
                          norm.contains("exit") {
                    self.stop()
                } else {
                    self.speech.speak("Say save, save and next, or cancel.") { [weak self] in
                        self?.listenForSaveCommand()
                    }
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
        completionFired = false

        // Fresh engine each cycle — avoids stale hardware state after multiple sessions
        let engine = AVAudioEngine()
        activeEngine = engine
        let inputNode = engine.inputNode
        let format = inputNode.outputFormat(forBus: 0)

        guard format.sampleRate > 0 else {
            // Format not ready — retry after a short delay
            activeEngine = nil
            Task {
                try? await Task.sleep(for: .milliseconds(700))
                self.startSTT(completion: completion)
            }
            return
        }

        let req = SFSpeechAudioBufferRecognitionRequest()
        req.shouldReportPartialResults = true
        req.requiresOnDeviceRecognition = false
        recognitionReq = req

        inputNode.installTap(onBus: 0, bufferSize: 1024, format: format) { buffer, _ in
            req.append(buffer)
        }

        do {
            try engine.start()
        } catch {
            inputNode.removeTap(onBus: 0)
            activeEngine = nil
            speech.speak("Microphone failed. Please try again.")
            return
        }

        isListening = true
        lastPartial = ""
        pendingCompletion = completion

        // 12-second hard timeout — prevents infinite hangs if mic goes silent
        timeoutTimer = Task { [weak self] in
            try? await Task.sleep(for: .seconds(12))
            guard !Task.isCancelled else { return }
            await MainActor.run { [weak self] in
                guard let self, self.isListening else { return }
                let captured = self.lastPartial
                self.stopSTT()
                if !captured.isEmpty {
                    self.fireCompletion(captured, completion: completion)
                } else {
                    self.speech.speak("I didn't catch that. Please try again.") { [weak self] in
                        self?.startListeningForField()
                    }
                }
            }
        }

        recognitionTask = recognizer.recognitionTask(with: req) { [weak self] result, error in
            let text    = result?.bestTranscription.formattedString
                              .trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
            let isFinal = result?.isFinal ?? false
            let hadError = error != nil

            Task { @MainActor [weak self] in
                guard let self, self.isListening else { return }

                if !text.isEmpty {
                    // Check for "stop" terminator — strip it and fire immediately
                    let words = text.lowercased().components(separatedBy: .whitespaces)
                    if words.last == "stop" {
                        let withoutStop = text
                            .components(separatedBy: .whitespaces)
                            .dropLast()
                            .joined(separator: " ")
                            .trimmingCharacters(in: .whitespaces)
                        self.silenceTimer?.cancel()
                        self.stopSTT()
                        self.pendingCompletion = nil
                        let result = withoutStop.isEmpty ? self.lastPartial : withoutStop
                        if !result.isEmpty {
                            self.fireCompletion(result, completion: completion)
                        }
                        return
                    }

                    self.lastPartial = text
                    self.silenceTimer?.cancel()
                    self.silenceTimer = Task { [weak self] in
                        try? await Task.sleep(for: .seconds(4))
                        guard !Task.isCancelled else { return }
                        await MainActor.run { [weak self] in
                            guard let self, self.isListening else { return }
                            let captured = self.lastPartial
                            self.stopSTT()
                            self.pendingCompletion = nil
                            self.fireCompletion(captured, completion: completion)
                        }
                    }
                }

                if isFinal && !text.isEmpty {
                    self.silenceTimer?.cancel()
                    self.stopSTT()
                    self.pendingCompletion = nil
                    self.fireCompletion(text, completion: completion)
                } else if hadError {
                    self.silenceTimer?.cancel()
                    let captured = self.lastPartial
                    self.stopSTT()
                    self.pendingCompletion = nil
                    if !captured.isEmpty {
                        self.fireCompletion(captured, completion: completion)
                    }
                }
            }
        }
    }

    /// Ensures completion fires exactly once per STT session
    private func fireCompletion(_ text: String, completion: @escaping (String) -> Void) {
        guard !completionFired else { return }
        completionFired = true
        completion(text)
    }

    private func stopSTT() {
        timeoutTimer?.cancel()
        timeoutTimer = nil
        silenceTimer?.cancel()
        silenceTimer = nil
        if let engine = activeEngine {
            if engine.isRunning { engine.stop() }
            engine.inputNode.removeTap(onBus: 0)
            activeEngine = nil
        }
        recognitionTask?.cancel()
        recognitionTask = nil
        recognitionReq  = nil
        isListening = false
    }
}
