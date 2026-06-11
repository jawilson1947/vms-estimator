import Speech
import AVFoundation
import Foundation

// MARK: - State

enum NarrativeState: Equatable {
    case idle       // waiting for "Begin Survey"
    case active     // interview running, mic listening
    case saving     // API call in flight (brief)
    case done       // interview finished
}

// MARK: - Manager

@MainActor
final class VoiceInterviewManager: NSObject, ObservableObject {

    static let shared = VoiceInterviewManager()

    // Published fields — updated in real time as the user speaks
    @Published var state:       NarrativeState = .idle
    @Published var areaName:    String = ""
    @Published var floor:       String = ""
    @Published var surveyNotes: String = ""
    @Published var activeField: String? = nil   // "areaName" | "floor" | "surveyNotes"
    @Published var isListening: Bool   = false

    // Callbacks set by AddLocationSheet before start()
    var onSaveAndNext: ((String, String?, String?) -> Void)?
    var onFinish:      ((String, String?, String?) -> Void)?

    private let speech     = SpeechOutputManager.shared
    private let recognizer = SFSpeechRecognizer(locale: Locale(identifier: "en-US"))!

    private var recognitionReq:    SFSpeechAudioBufferRecognitionRequest?
    private var recognitionTask:   SFSpeechRecognitionTask?
    private var silenceTimer:      Task<Void, Never>?
    private var timeoutTimer:      Task<Void, Never>?
    private var activeEngine:      AVAudioEngine?
    private var lastPartial:       String = ""
    private var completionFired    = false
    private var pendingCompletion: ((String) -> Void)?

    // Pre-compiled regex patterns (cached — called on every partial result)
    private static let areaRegex  = try! NSRegularExpression(
        pattern: #"(?i)\barea[\s\-]+name\s*(?:=|equals?)\s*(.+?)(?=\s+\b(?:floor|notes?|skip|save|finish|review)\b|$)"#
    )
    private static let floorRegex = try! NSRegularExpression(
        pattern: #"(?i)\bfloor\s*(?:=|equals?)\s*(.+?)(?=\s+\b(?:area|notes?|skip|save|finish|review)\b|$)"#
    )
    private static let notesRegex = try! NSRegularExpression(
        pattern: #"(?i)\bnotes?\s*(?:=|equals?)\s*(.+?)(?=\s+\b(?:area|floor|skip|save|finish|review)\b|$)"#
    )

    private override init() { super.init() }

    // MARK: - Public API

    func start(onSaveAndNext: @escaping (String, String?, String?) -> Void,
               onFinish:      @escaping (String, String?, String?) -> Void) {
        self.onSaveAndNext = onSaveAndNext
        self.onFinish      = onFinish
        resetFields()

        Task.detached(priority: .userInitiated) { [weak self] in
            let session = AVAudioSession.sharedInstance()
            try? session.setCategory(.playAndRecord, mode: .measurement,
                                     options: [.defaultToSpeaker, .allowBluetoothHFP])
            try? session.setActive(true)
            await MainActor.run { [weak self] in
                self?.listenForBegin()
            }
        }
    }

    func stop() {
        stopSTT()
        pendingCompletion = nil
        Task.detached(priority: .userInitiated) {
            try? AVAudioSession.sharedInstance().setActive(false,
                                                           options: .notifyOthersOnDeactivation)
        }
        state = .idle
    }

    /// Done button — identical to saying "Finish".
    func doneButtonTapped() {
        stopSTT()
        triggerFinish()
    }

    // MARK: - Field helpers

    private func resetFields() {
        areaName    = ""
        floor       = ""
        surveyNotes = ""
        activeField = nil
    }

    // MARK: - Wait for "Begin Survey"

    private func listenForBegin() {
        state = .idle
        startSTT(onPartial: nil) { [weak self] transcript in
            guard let self else { return }
            let lower = transcript.lowercased()
            if lower.contains("begin survey") || lower.contains("begin") ||
               lower.contains("start survey") {
                self.speech.speak("Proceed with Survey") { [weak self] in
                    self?.state = .active
                    self?.listen()
                }
            } else {
                self.listenForBegin()
            }
        }
    }

    // MARK: - Main narrative loop

    private func listen() {
        guard state == .active else { return }
        startSTT(onPartial: { [weak self] partial in
            // Update form fields in real time on every partial result
            self?.parseFields(from: partial)
        }) { [weak self] transcript in
            guard let self else { return }
            // Final pass then check for commands
            self.parseFields(from: transcript)
            self.handleCommands(in: transcript)
        }
    }

    private func handleCommands(in transcript: String) {
        let lower = transcript.lowercased().trimmingCharacters(in: .whitespaces)

        if lower.contains("review survey") {
            resetFields()
            speech.speak("Proceed with Survey") { [weak self] in
                self?.listen()
            }
            return
        }

        if lower.contains("save and next") || lower.contains("save in next") {
            triggerSaveAndNext()
            return
        }

        if lower.contains("finish") {
            triggerFinish()
            return
        }

        // Pure field data — continue listening
        listen()
    }

    // MARK: - Save actions

    private func triggerSaveAndNext() {
        guard !areaName.isEmpty else {
            speech.speak("Area name is required.") { [weak self] in
                self?.listen()
            }
            return
        }
        let name     = areaName
        let floorVal = floor.isEmpty ? nil : floor
        let notesVal = surveyNotes.isEmpty ? nil : surveyNotes
        onSaveAndNext?(name, floorVal, notesVal)
        resetFields()
        speech.speak("\(name) saved. Ready for next location.") { [weak self] in
            self?.listen()
        }
    }

    private func triggerFinish() {
        let name     = areaName
        let floorVal = floor.isEmpty ? nil : floor
        let notesVal = surveyNotes.isEmpty ? nil : surveyNotes
        speech.speak("End Interview") { [weak self] in
            guard let self else { return }
            if !name.isEmpty {
                self.onFinish?(name, floorVal, notesVal)
            }
            self.state = .done
        }
    }

    // MARK: - Real-time field parsing

    private func parseFields(from transcript: String) {
        let text  = transcript.trimmingCharacters(in: .whitespaces)
        let lower = text.lowercased().trimmingCharacters(in: .whitespaces)

        if let v = match(Self.areaRegex, in: text) {
            areaName    = v
            activeField = "areaName"
        }

        if let v = match(Self.floorRegex, in: text) {
            floor       = v
            activeField = "floor"
        }

        if let v = match(Self.notesRegex, in: text) {
            surveyNotes = v
            activeField = "surveyNotes"
        }

        // "Skip" — clears floor and releases active field
        if ["skip", "floor skip", "skip floor",
            "floor equals skip", "floor = skip"].contains(lower) {
            floor       = ""
            activeField = nil
        }
    }

    private func match(_ regex: NSRegularExpression, in text: String) -> String? {
        let nsRange = NSRange(text.startIndex..., in: text)
        guard let m = regex.firstMatch(in: text, range: nsRange),
              m.numberOfRanges > 1 else { return nil }
        let cr = m.range(at: 1)
        guard cr.location != NSNotFound,
              let swiftRange = Range(cr, in: text) else { return nil }
        let value = String(text[swiftRange]).trimmingCharacters(in: .whitespaces)
        return value.isEmpty ? nil : value
    }

    // MARK: - STT engine

    private func startSTT(onPartial: ((String) -> Void)?,
                          completion: @escaping (String) -> Void) {
        stopSTT()
        completionFired = false

        let engine    = AVAudioEngine()
        activeEngine  = engine
        let inputNode = engine.inputNode
        let format    = inputNode.outputFormat(forBus: 0)

        guard format.sampleRate > 0 else {
            activeEngine = nil
            Task { [weak self] in
                try? await Task.sleep(for: .milliseconds(700))
                self?.startSTT(onPartial: onPartial, completion: completion)
            }
            return
        }

        let req = SFSpeechAudioBufferRecognitionRequest()
        req.shouldReportPartialResults  = true
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

        isListening       = true
        lastPartial       = ""
        pendingCompletion = completion

        // 30-second timeout — narrative sessions can have natural long pauses
        timeoutTimer = Task { [weak self] in
            try? await Task.sleep(for: .seconds(30))
            guard !Task.isCancelled else { return }
            await MainActor.run { [weak self] in
                guard let self, self.isListening else { return }
                let captured = self.lastPartial
                self.stopSTT()
                if !captured.isEmpty {
                    self.fireCompletion(captured, completion: completion)
                } else if self.state == .active {
                    self.listen()
                }
            }
        }

        recognitionTask = recognizer.recognitionTask(with: req) { [weak self] result, error in
            let text     = result?.bestTranscription.formattedString
                               .trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
            let isFinal  = result?.isFinal ?? false
            let hadError = error != nil

            Task { @MainActor [weak self] in
                guard let self, self.isListening else { return }

                if !text.isEmpty {
                    self.lastPartial = text
                    onPartial?(text)

                    self.silenceTimer?.cancel()
                    self.silenceTimer = Task { [weak self] in
                        try? await Task.sleep(for: .seconds(3))
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
                    } else if self.state == .active {
                        self.listen()
                    }
                }
            }
        }
    }

    private func fireCompletion(_ text: String, completion: @escaping (String) -> Void) {
        guard !completionFired else { return }
        completionFired = true
        completion(text)
    }

    private func stopSTT() {
        timeoutTimer?.cancel(); timeoutTimer = nil
        silenceTimer?.cancel(); silenceTimer = nil
        if let engine = activeEngine {
            if engine.isRunning { engine.stop() }
            engine.inputNode.removeTap(onBus: 0)
            activeEngine = nil
        }
        recognitionTask?.cancel(); recognitionTask = nil
        recognitionReq  = nil
        isListening     = false
    }
}
