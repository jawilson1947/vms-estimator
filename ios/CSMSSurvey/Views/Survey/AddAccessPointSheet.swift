import SwiftUI
import PhotosUI

/// Access-control parallel to `AddLocationSheet`. Structural mirror so the two
/// can be diffed side-by-side during review.
///
/// Differences from `AddLocationSheet`:
///   - Title is "Add Access Point" (the underlying storage is still a
///     `SurveyLocation` row — see plan §1.3).
///   - Adds an Access Method picker (optional) backed by
///     `AccessMethodCatalog.shared`. The picker is searchable when the catalog
///     has more than 8 entries.
///   - Voice interview script is unchanged from camera mode: the access method
///     is filled by manual tap only.
struct AddAccessPointSheet: View {
    let projectId: Int
    let onSave: (SurveyLocation) -> Void

    @Environment(\.dismiss) private var dismiss
    @StateObject private var voice     = VoiceCommandManager.shared
    @StateObject private var interview = VoiceInterviewManager.shared
    @StateObject private var catalog   = AccessMethodCatalog.shared
    private        let speech          = SpeechOutputManager.shared
    private        let api             = APIClient.shared

    @State private var areaName        = ""
    @State private var floor           = ""
    @State private var surveyNotes     = ""
    @State private var accessMethodId: Int?
    @State private var pendingPhotos:  [UIImage] = []
    @State private var photoItem:      PhotosPickerItem?
    @State private var showCamera      = false
    @State private var isSaving        = false
    @State private var errorMsg:       String?
    @State private var voiceField:     String?
    @State private var showInterview   = false
    @State private var showHelp        = false
    @State private var showMethodPicker = false

    private let maxPhotos = 5

    var body: some View {
        NavigationStack {
            ZStack {
                Theme.background.ignoresSafeArea()
                ScrollView {
                    VStack(spacing: 16) {
                        formContent
                    }
                    .padding(16)
                }
            }
            .navigationTitle("Add Access Point")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar { toolbarItems }
        }
        .onChange(of: photoItem) { _, item in Task { await loadPhoto(item) } }
        .onAppear  {
            registerVoiceCommands()
            // Background refresh so admin-added methods appear without app restart.
            Task { await catalog.refresh() }
        }
        .onDisappear { voice.unregister(id: "quick-add-access") }
        // Auto-start voice dictation when the add sheet opens (announces "Listening").
        .task {
            try? await Task.sleep(for: .milliseconds(350))
            startVoiceInterview()
        }
        .fullScreenCover(isPresented: $showInterview) {
            VoiceInterviewView(manager: interview) { showInterview = false }
                .onDisappear {
                    interview.stop()
                    voice.setEnabled(true)
                }
        }
        .sheet(isPresented: $showHelp) {
            VoiceQuickRefView()
        }
        .sheet(isPresented: $showMethodPicker) {
            AccessMethodPickerSheet(selectedId: $accessMethodId)
        }
    }

    // MARK: - Form content

    @ViewBuilder
    private var formContent: some View {
        // Area / Door + Floor
        VStack(alignment: .leading, spacing: 14) {
            DarkSectionHeader(title: "Location")
            themedField(label: "Area / Door Name", placeholder: "e.g. Main Entrance",
                        text: $areaName, field: "areaName")
            themedField(label: "Floor", placeholder: "e.g. 2 or Ground",
                        text: $floor, field: "floor")
        }
        .darkCard()

        // Access method picker
        VStack(alignment: .leading, spacing: 10) {
            DarkSectionHeader(title: "Access Method")
            Button {
                showMethodPicker = true
            } label: {
                HStack {
                    Text(selectedMethodLabel)
                        .font(.subheadline)
                        .foregroundStyle(accessMethodId == nil ? Theme.textTertiary : Theme.textPrimary)
                    Spacer()
                    Image(systemName: "chevron.right")
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(Theme.textTertiary)
                }
                .padding(.horizontal, 12)
                .padding(.vertical, 12)
                .background(Theme.surfaceElevated)
                .clipShape(RoundedRectangle(cornerRadius: 10))
                .overlay(RoundedRectangle(cornerRadius: 10).stroke(Theme.border, lineWidth: 1))
            }
            .buttonStyle(.plain)

            if accessMethodId != nil {
                Button {
                    accessMethodId = nil
                } label: {
                    Label("Clear", systemImage: "xmark.circle")
                        .font(.caption.weight(.medium))
                        .foregroundStyle(Theme.textSecondary)
                }
                .buttonStyle(.plain)
            }
        }
        .darkCard()

        // Notes
        VStack(alignment: .leading, spacing: 10) {
            DarkSectionHeader(title: "Survey Notes")
            let isFocused = voiceField == "notes"
            TextEditor(text: $surveyNotes)
                .frame(minHeight: 80)
                .foregroundStyle(Theme.textPrimary)
                .scrollContentBackground(.hidden)
                .background(Theme.surfaceElevated)
                .clipShape(RoundedRectangle(cornerRadius: 10))
                .overlay(
                    RoundedRectangle(cornerRadius: 10)
                        .stroke(isFocused ? Theme.borderFocus : Theme.border,
                                lineWidth: isFocused ? 2 : 1)
                )
                .tint(Theme.accent)
        }
        .darkCard()

        // Photos
        photoSection

        // Error
        if let err = errorMsg {
            Text(err)
                .font(.caption)
                .foregroundStyle(Theme.danger)
                .padding(12)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(Theme.dangerSoft)
                .clipShape(RoundedRectangle(cornerRadius: 10))
        }
    }

    @ViewBuilder
    private var photoSection: some View {
        if !pendingPhotos.isEmpty {
            VStack(alignment: .leading, spacing: 10) {
                DarkSectionHeader(title: "Photos (\(pendingPhotos.count)/\(maxPhotos))")
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 8) {
                        ForEach(pendingPhotos.indices, id: \.self) { i in
                            Image(uiImage: pendingPhotos[i])
                                .resizable().scaledToFill()
                                .frame(width: 72, height: 72)
                                .clipShape(RoundedRectangle(cornerRadius: 10))
                        }
                    }
                    .padding(.vertical, 4)
                }
            }
            .darkCard()
        }
        if pendingPhotos.count < maxPhotos {
            HStack(spacing: 10) {
                Button {
                    showCamera = true
                } label: {
                    Label("Take Photo", systemImage: "camera.fill")
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(Theme.accent)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 13)
                        .background(Theme.accentSoft)
                        .clipShape(RoundedRectangle(cornerRadius: 12))
                        .overlay(RoundedRectangle(cornerRadius: 12).stroke(Theme.accent.opacity(0.28), lineWidth: 1))
                }
                PhotosPicker(selection: $photoItem, matching: .images) {
                    Label("Library", systemImage: "photo.on.rectangle")
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(Theme.textSecondary)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 13)
                        .background(Theme.surfaceElevated)
                        .clipShape(RoundedRectangle(cornerRadius: 12))
                        .overlay(RoundedRectangle(cornerRadius: 12).stroke(Theme.border, lineWidth: 1))
                }
            }
            .fullScreenCover(isPresented: $showCamera) {
                CameraCapture { image in
                    if pendingPhotos.count < maxPhotos {
                        pendingPhotos.append(image)
                    }
                }
                .ignoresSafeArea()
            }
        }
    }

    // MARK: - Toolbar

    @ToolbarContentBuilder
    private var toolbarItems: some ToolbarContent {
        ToolbarItem(placement: .cancellationAction) {
            Button("Cancel") { dismiss() }
                .foregroundStyle(Theme.textSecondary)
        }
        ToolbarItem(placement: .navigationBarTrailing) {
            Button { showHelp = true } label: {
                Image(systemName: "questionmark.circle")
                    .foregroundStyle(Theme.textSecondary)
            }
        }
        ToolbarItem(placement: .confirmationAction) {
            if isSaving {
                ProgressView().tint(Theme.accent)
            } else {
                Button("Save") { Task { await save(andContinue: false) } }
                    .foregroundStyle(Theme.accent)
                    .disabled(areaName.isEmpty)
            }
        }
        ToolbarItem(placement: .bottomBar) {
            Button("Save & Next") { Task { await save(andContinue: true) } }
                .foregroundStyle(Theme.accent)
                .disabled(areaName.isEmpty || isSaving)
        }
        ToolbarItem(placement: .bottomBar) {
            Button { startVoiceInterview() } label: {
                Label("Voice Interview", systemImage: "waveform.and.mic")
                    .foregroundStyle(Theme.textSecondary)
            }
            .disabled(isSaving)
        }
    }

    // MARK: - Themed field row

    @ViewBuilder
    private func themedField(label: String, placeholder: String,
                              text: Binding<String>, field: String) -> some View {
        let isActive = voiceField == field
        VStack(alignment: .leading, spacing: 6) {
            Text(label)
                .font(.caption.weight(.semibold))
                .foregroundStyle(Theme.textSecondary)
                .tracking(0.3)
            TextField(placeholder, text: text)
                .foregroundStyle(Theme.textPrimary)
                .tint(Theme.accent)
                .padding(.horizontal, 12)
                .padding(.vertical, 10)
                .background(Theme.background)
                .clipShape(RoundedRectangle(cornerRadius: 8))
                .overlay(
                    RoundedRectangle(cornerRadius: 8)
                        .stroke(isActive ? Theme.borderFocus : Theme.border,
                                lineWidth: isActive ? 2 : 1)
                )
        }
    }

    // MARK: - Voice interview (script unchanged — narrative engine fills area/floor/notes only)

    private func startVoiceInterview() {
        guard !showInterview else { return }
        // Fully park the global VoiceCommandManager so only the interview's
        // AVAudioEngine owns the mic (see AddLocationSheet for the rationale).
        voice.setEnabled(false)
        showInterview = true
        interview.start(
            area: areaName, floor: floor, notes: surveyNotes,
            onSave: {
                areaName    = interview.areaName
                floor       = interview.floor
                surveyNotes = interview.surveyNotes
                Task {
                    await save(andContinue: false, silent: true)
                    showInterview = false
                }
            },
            onSaveAndNext: {
                areaName    = interview.areaName
                floor       = interview.floor
                surveyNotes = interview.surveyNotes
                Task { await save(andContinue: true, silent: true) }
            },
            onDone: {
                areaName    = interview.areaName
                floor       = interview.floor
                surveyNotes = interview.surveyNotes
                showInterview = false
                if !areaName.isEmpty {
                    Task { await save(andContinue: false, silent: true) }
                }
            }
        )
    }

    // MARK: - Save

    private func save(andContinue: Bool, silent: Bool = false) async {
        guard !areaName.isEmpty else { return }
        isSaving = true
        errorMsg = nil
        do {
            let body = NewLocationBody(projectId: projectId,
                                       areaName: areaName,
                                       floor: floor.isEmpty ? nil : floor,
                                       surveyNotes: surveyNotes.isEmpty ? nil : surveyNotes,
                                       accessMethodId: accessMethodId)
            var saved = try await api.createLocation(body)

            for image in pendingPhotos {
                let resized = image.resizedToMaxDimension(1920)
                if let data = resized.jpegData(compressionQuality: 0.82) {
                    let photo = try await api.uploadPhoto(locationId: saved.id,
                                                          imageData: data,
                                                          mimeType: "image/jpeg")
                    saved.images.append(photo)
                }
            }

            if !silent {
                speech.speak(andContinue
                    ? "\(areaName) saved. Ready for next access point."
                    : "\(areaName) saved.")
            }
            onSave(saved)

            if andContinue {
                areaName       = ""
                floor          = ""
                surveyNotes    = ""
                accessMethodId = nil
                pendingPhotos  = []
            } else {
                dismiss()
            }
        } catch {
            errorMsg = error.localizedDescription
        }
        isSaving = false
    }

    // MARK: - Photo

    private func loadPhoto(_ item: PhotosPickerItem?) async {
        guard let item else { return }
        speech.speak("Tap to capture a photo")
        if let data = try? await item.loadTransferable(type: Data.self),
           let img  = UIImage(data: data) {
            if pendingPhotos.count < maxPhotos {
                pendingPhotos.append(img)
            }
        }
        photoItem = nil
    }

    // MARK: - Selected method label

    private var selectedMethodLabel: String {
        guard let id = accessMethodId,
              let method = catalog.method(id: id) else {
            return "Select access method (optional)"
        }
        if let g = method.grouping, !g.isEmpty {
            return "\(method.name) — \(g)"
        }
        return method.name
    }

    // MARK: - Voice commands

    private func registerVoiceCommands() {
        voice.register(id: "quick-add-access", commands: [
            VoiceCommand(keywords: ["name"]) { _ in
                speech.speak("Say the area or door name") {
                    voiceField = "areaName"
                    voice.waitForValue("Name") { val in
                        areaName   = val
                        voiceField = nil
                        speech.speak("Name set to \(val)")
                    }
                }
            },
            VoiceCommand(keywords: ["floor"]) { _ in
                speech.speak("Say the floor") {
                    voiceField = "floor"
                    voice.waitForValue("Floor") { val in
                        floor      = val
                        voiceField = nil
                        speech.speak("Floor \(val)")
                    }
                }
            },
            VoiceCommand(keywords: ["notes", "note"]) { _ in
                speech.speak("Say your notes") {
                    voiceField = "notes"
                    voice.waitForValue("Notes") { val in
                        surveyNotes = val
                        voiceField  = nil
                        speech.speak("Notes recorded")
                    }
                }
            },
            VoiceCommand(keywords: ["photo"]) { _ in
                if pendingPhotos.count < maxPhotos {
                    speech.speak("Tap to capture a photo")
                } else {
                    speech.speak("Photo limit reached")
                }
            },
            VoiceCommand(keywords: ["save"]) { _ in
                guard !areaName.isEmpty else {
                    speech.speak("Please say a name first"); return
                }
                Task { await save(andContinue: false) }
            },
            VoiceCommand(keywords: ["next"]) { _ in
                guard !areaName.isEmpty else {
                    speech.speak("Please say a name first"); return
                }
                Task { await save(andContinue: true) }
            },
            VoiceCommand(keywords: ["exit", "cancel", "close"]) { _ in
                speech.speak("Closing") { dismiss() }
            },
        ])
    }
}

// MARK: - Access Method picker sheet

/// Inline picker — kept in the same file as `AddAccessPointSheet` because it is
/// the only consumer. Becomes searchable when the catalog has more than 8
/// entries (today's seed list is 9, so search is on by default).
private struct AccessMethodPickerSheet: View {
    @Binding var selectedId: Int?
    @Environment(\.dismiss) private var dismiss
    @StateObject private var catalog = AccessMethodCatalog.shared
    @State private var searchText = ""

    private static let searchableThreshold = 8

    private var filtered: [AccessMethod] {
        let all = catalog.current()
        guard !searchText.isEmpty else { return all }
        let q = searchText.lowercased()
        return all.filter {
            $0.name.lowercased().contains(q) ||
            ($0.grouping?.lowercased().contains(q) ?? false)
        }
    }

    private var shouldShowSearch: Bool {
        catalog.current().count > Self.searchableThreshold
    }

    var body: some View {
        NavigationStack {
            ZStack {
                Theme.background.ignoresSafeArea()
                Group {
                    if catalog.current().isEmpty {
                        if catalog.isLoading {
                            ProgressView("Loading access methods…")
                                .tint(Theme.accent)
                        } else {
                            VStack(spacing: 12) {
                                Text(catalog.lastError ?? "No access methods available.")
                                    .font(.subheadline)
                                    .foregroundStyle(Theme.textSecondary)
                                Button("Retry") { Task { await catalog.refresh() } }
                                    .foregroundStyle(Theme.accent)
                            }
                            .padding()
                        }
                    } else if filtered.isEmpty {
                        Text("No results for \"\(searchText)\".")
                            .foregroundStyle(Theme.textSecondary)
                            .font(.subheadline)
                    } else {
                        List(filtered) { method in
                            Button {
                                selectedId = method.id
                                dismiss()
                            } label: {
                                AccessMethodRow(method: method, isSelected: method.id == selectedId)
                            }
                            .listRowBackground(Theme.surfaceElevated)
                        }
                        .listStyle(.plain)
                        .scrollContentBackground(.hidden)
                    }
                }
            }
            .navigationTitle("Access Method")
            .navigationBarTitleDisplayMode(.inline)
            .modifier(ConditionalSearchable(text: $searchText, enabled: shouldShowSearch))
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                        .foregroundStyle(Theme.textSecondary)
                }
            }
            .task { await catalog.refresh() }
        }
    }
}

private struct AccessMethodRow: View {
    let method: AccessMethod
    let isSelected: Bool

    var body: some View {
        HStack {
            VStack(alignment: .leading, spacing: 3) {
                Text(method.name)
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(Theme.textPrimary)
                if let g = method.grouping, !g.isEmpty {
                    Text(g)
                        .font(.caption)
                        .foregroundStyle(Theme.textSecondary)
                }
            }
            Spacer()
            if isSelected {
                Image(systemName: "checkmark")
                    .foregroundStyle(Theme.accent)
                    .font(.system(size: 15, weight: .semibold))
            }
        }
        .padding(.vertical, 4)
    }
}

/// Applies `.searchable` only when the list is long enough to warrant it.
/// SwiftUI's `.searchable` modifier doesn't accept a runtime toggle, so we wrap it.
private struct ConditionalSearchable: ViewModifier {
    @Binding var text: String
    let enabled: Bool
    func body(content: Content) -> some View {
        if enabled {
            content.searchable(text: $text,
                               placement: .navigationBarDrawer(displayMode: .always),
                               prompt: "Search methods")
        } else {
            content
        }
    }
}
