import Speech
import AVFoundation
import Foundation

// MARK: - State

enum NarrativeState: Equatable {
    case idle       // not started
    case active     // dictating — mic listening, narration flowing into fields
    case locked     // "Finish" heard — waiting for Save / Save and Next / Done
    case saving     // a save command is committing
    case done       // interview finished
}

// MARK: - Manager

/// Hands-free dictation for adding/editing a survey location.
///
/// Flow (see CSMS voice requirements):
///   1. `start(...)` announces "Listening" and begins dictation immediately —
///      no "Begin Survey" wake word.
///   2. Free narration is appended to Notes. Saying "area name <x>" sets the
///      area name; "floor <x>" sets the floor; "skip" clears the floor.
///   3. "Finish" stops dictation and locks the fields; the app then waits for
///      "Save", "Save and Next", or "Done", each spoken back to confirm.
///
/// IMPORTANT: callers must park `VoiceCommandManager` (setEnabled(false)) before
/// calling `start`, and revive it on dismissal — two recognizers on one mic is
/// what previously made nothing get recognized.
@MainActor
final class VoiceInterviewManager: NSObject, ObservableObject {

    static let shared = VoiceInterviewManager()

    // Published fields — updated as the user speaks
    @Published var state:       NarrativeState = .idle
    @Published var areaName:    String = ""
    @Published var floor:       String = ""
    @Published var surveyNotes: String = ""
    @Published var activeField: String? = nil   // "areaName" | "floor" | "surveyNotes"
    @Published var isListening: Bool   = false

    // Callbacks set by the presenting view before start(). The view reads the
    // published fields (areaName/floor/surveyNotes) inside these.
    private var onSaveCb:        (() -> Void)?
    private var onSaveAndNextCb: (() -> Void)?
    private var onDoneCb:        (() -> Void)?

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
    /// Counts consecutive empty/error restarts so the listen loop can't spin
    /// (tight recursion was thrashing AVAudioEngine on the main actor → freeze).
    private var emptyRestartStreak = 0

    private override init() { super.init() }

    // MARK: - Public API

    /// Begin a dictation session. Announces "Listening" and starts the mic.
    /// `area`/`floor`/`notes` seed the fields (used by edit mode).
    func start(area: String = "", floor: String = "", notes: String = "",
               onSave:        @escaping () -> Void,
               onSaveAndNext: (() -> Void)? = nil,
               onDone:        @escaping () -> Void) {
        self.onSaveCb        = onSave
        self.onSaveAndNextCb = onSaveAndNext
        self.onDoneCb        = onDone

        self.areaName        = area
        self.floor           = floor
        self.surveyNotes     = notes
        self.activeField     = nil
        self.completionFired = false

        Task.detached(priority: .userInitiated) { [weak self] in
            let session = AVAudioSession.sharedInstance()
            // .voiceChat (not .measurement) — .measurement disables system audio
            // processing AND is incompatible with audio output, so synthesizer
            // utterances never fire their didFinish delegate and the UI hangs.
            try? session.setCategory(.playAndRecord, mode: .voiceChat,
                                     options: [.defaultToSpeaker, .allowBluetoothHFP])
            try? session.setActive(true)
            await MainActor.run { [weak self] in self?.beginListening() }
        }
    }

    func stop() {
        stopSTT()
        pendingCompletion = nil
        onSaveCb = nil; onSaveAndNextCb = nil; onDoneCb = nil
        Task.detached(priority: .userInitiated) {
            try? AVAudioSession.sharedInstance().setActive(false,
                                                           options: .notifyOthersOnDeactivation)
        }
        state = .idle
    }

    /// Done button — equivalent to saying "Done": commit and finish.
    func doneButtonTapped() {
        doDone()
    }

    // MARK: - Flow

    private func beginListening() {
        state = .active
        speech.speak("Listening") { [weak self] in self?.listen() }
    }

    private func listen() {
        guard state == .active || state == .locked else { return }
        startSTT(onPartial: nil) { [weak self] transcript in
            self?.route(transcript)
        }
    }

    /// Restart listening after an empty/error result, with a delay and a cap so
    /// repeated failures back off instead of spinning the main actor.
    private func restartListenSoon() {
        guard state == .active || state == .locked else { return }
        emptyRestartStreak += 1
        guard emptyRestartStreak <= 12 else {
            stopSTT()
            speech.speak("Microphone paused. Tap Done, or close and reopen to resume.")
            return
        }
        Task { [weak self] in
            try? await Task.sleep(for: .milliseconds(350))
            await MainActor.run { [weak self] in self?.listen() }
        }
    }

    /// Routes one finished utterance to a command or a field.
    private func route(_ transcript: String) {
        let text  = transcript.trimmingCharacters(in: .whitespacesAndNewlines)
        let lower = text.lowercased()
        guard !text.isEmpty else { restartListenSoon(); return }
        emptyRestartStreak = 0   // real content — reset the backoff counter

        // Locked: only the save commands are honoured.
        if state == .locked {
            if lower.contains("save and next") || lower.contains("save in next") || lower.contains("save next") {
                doSaveAndNext(); return
            }
            if lower.contains("done")  { doDone(); return }
            if lower.contains("save")  { doSave(); return }
            listen(); return   // anything else — keep waiting
        }

        // Active dictation.
        if lower.contains("finish") { finishDictation(); return }

        if let v = remainder(after: ["area name", "area"], inText: text, lower: lower) {
            areaName    = v
            activeField = "areaName"
        } else if lower == "skip" || lower == "skip floor" || lower == "floor skip" {
            floor       = ""
            activeField = nil
        } else if let v = remainder(after: ["floor"], inText: text, lower: lower) {
            floor       = v
            activeField = "floor"
        } else {
            appendNotes(text)
            activeField = "surveyNotes"
        }
        listen()
    }

    private func finishDictation() {
        stopSTT()
        state = .locked
        speech.speak("Finished. Say Save, Save and Next, or Done.") { [weak self] in
            self?.listen()
        }
    }

    private func doSave() {
        stopSTT()
        state = .saving
        let cb = onSaveCb
        speech.speak("Saved.") { [weak self] in
            cb?()
            self?.state = .done
        }
    }

    private func doSaveAndNext() {
        guard !areaName.isEmpty else {
            speech.speak("Area name is required.") { [weak self] in self?.listen() }
            return
        }
        stopSTT()
        state = .saving
        let cb = onSaveAndNextCb ?? onSaveCb
        speech.speak("Saved. Ready for the next location.") { [weak self] in
            cb?()
            self?.resetFields()
            self?.state = .active
            self?.speech.speak("Listening") { [weak self] in self?.listen() }
        }
    }

    /// "Done" ends the interview WITHOUT saving — it stops listening and hands
    /// the dictated values back to the form, where the user reviews and then
    /// saves or discards. (Saving is only done by "Save" / "Save and Next".)
    private func doDone() {
        stopSTT()
        state = .done
        let cb = onDoneCb
        speech.speak("Interview ended. Review and save, or discard.") { [weak self] in
            cb?()
        }
    }

    // MARK: - Field helpers

    private func resetFields() {
        areaName    = ""
        floor       = ""
        surveyNotes = ""
        activeField = nil
    }

    /// If `text` (case-insensitively) begins with any of `prefixes`, returns the
    /// remainder with leading filler ("is", "equals", "=", ":") stripped.
    private func remainder(after prefixes: [String], inText text: String, lower: String) -> String? {
        for p in prefixes where lower.hasPrefix(p + " ") {
            let idx  = text.index(text.startIndex, offsetBy: p.count)
            let rest = stripFiller(String(text[idx...]).trimmingCharacters(in: .whitespaces))
            return rest.isEmpty ? nil : rest
        }
        return nil
    }

    private func stripFiller(_ s: String) -> String {
        var r = s
        for f in ["is ", "equals ", "equal ", "= ", "- ", ": "] {
            if r.lowercased().hasPrefix(f) {
                r = String(r.dropFirst(f.count)).trimmingCharacters(in: .whitespaces)
            }
        }
        return r
    }

    private func appendNotes(_ text: String) {
        surveyNotes = surveyNotes.isEmpty ? text : surveyNotes + " " + text
    }

    // MARK: - STT engine (unchanged plumbing)

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
                } else if self.state == .active || self.state == .locked {
                    self.restartListenSoon()
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
                    } else if self.state == .active || self.state == .locked {
                        self.restartListenSoon()
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
