import SwiftUI
import PhotosUI

struct AddLocationSheet: View {
    let buildings: [SurveyBuilding]
    let onSave: (SurveyLocation) -> Void

    @Environment(\.dismiss) private var dismiss
    @StateObject private var voice     = VoiceCommandManager.shared
    @StateObject private var interview = VoiceInterviewManager.shared
    private        let speech          = SpeechOutputManager.shared
    private        let api             = APIClient.shared

    @State private var areaName     = ""
    @State private var floor        = ""
    @State private var surveyNotes  = ""
    @State private var selectedBuilding: SurveyBuilding?
    @State private var pendingPhotos: [UIImage] = []
    @State private var photoItem:   PhotosPickerItem?
    @State private var isSaving     = false
    @State private var errorMsg:    String?
    @State private var voiceField:  String?   // highlights active field
    @State private var showInterview = false

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
            .navigationTitle("Add Location")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar { toolbarItems }
        }
        .onChange(of: photoItem) { _, item in Task { await loadPhoto(item) } }
        .onAppear  { registerVoiceCommands() }
        .onDisappear { voice.unregister(id: "quick-add") }
        .fullScreenCover(isPresented: $showInterview) {
            VoiceInterviewView(manager: interview) { showInterview = false }
        }
    }

    // MARK: - Form content

    @ViewBuilder
    private var formContent: some View {
        // Building picker
        VStack(alignment: .leading, spacing: 10) {
            DarkSectionHeader(title: "Building")
            Picker("Building", selection: $selectedBuilding) {
                Text("Select…")
                    .foregroundStyle(Theme.textTertiary)
                    .tag(Optional<SurveyBuilding>(nil))
                ForEach(buildings) { b in
                    Text(b.buildingName)
                        .foregroundStyle(Theme.textPrimary)
                        .tag(Optional(b))
                }
            }
            .pickerStyle(.menu)
            .tint(Theme.accent)
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.horizontal, 14)
            .padding(.vertical, 12)
            .background(Theme.surfaceElevated)
            .clipShape(RoundedRectangle(cornerRadius: 10))
            .overlay(RoundedRectangle(cornerRadius: 10).stroke(Theme.border, lineWidth: 1))
        }
        .darkCard()

        // Location fields
        VStack(alignment: .leading, spacing: 14) {
            DarkSectionHeader(title: "Location")
            themedField(label: "Area Name", placeholder: "e.g. Server Room",
                        text: $areaName, field: "areaName")
            themedField(label: "Floor", placeholder: "e.g. 2 or Ground",
                        text: $floor, field: "floor")
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
            PhotosPicker(selection: $photoItem, matching: .images) {
                Label("Add Photo", systemImage: "camera.fill")
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(Theme.accent)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 13)
                    .background(Theme.accentSoft)
                    .clipShape(RoundedRectangle(cornerRadius: 12))
                    .overlay(RoundedRectangle(cornerRadius: 12).stroke(Theme.accent.opacity(0.28), lineWidth: 1))
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
        ToolbarItem(placement: .confirmationAction) {
            if isSaving {
                ProgressView().tint(Theme.accent)
            } else {
                Button("Save") { Task { await save(andContinue: false) } }
                    .foregroundStyle(Theme.accent)
                    .disabled(areaName.isEmpty || selectedBuilding == nil)
            }
        }
        ToolbarItem(placement: .bottomBar) {
            Button("Save & Next") { Task { await save(andContinue: true) } }
                .foregroundStyle(Theme.accent)
                .disabled(areaName.isEmpty || selectedBuilding == nil || isSaving)
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

    // MARK: - Voice interview

    private func startVoiceInterview() {
        showInterview = true
        interview.start(buildings: buildings) { building, name, floorVal, notes, wantsPhotos, andContinue in
            self.selectedBuilding = self.buildings.first { $0.buildingName == building }
            self.areaName    = name
            self.floor       = floorVal ?? ""
            self.surveyNotes = notes ?? ""
            self.showInterview = false
            Task {
                try? await Task.sleep(for: .milliseconds(150))
                await self.save(andContinue: andContinue, promptPhotos: wantsPhotos)
            }
        }
    }

    // MARK: - Save

    private func save(andContinue: Bool, promptPhotos: Bool = false) async {
        guard let building = selectedBuilding, !areaName.isEmpty else { return }
        isSaving = true
        errorMsg = nil
        do {
            let body = NewLocationBody(buildingId: building.id,
                                       areaName: areaName,
                                       floor: floor.isEmpty ? nil : floor,
                                       surveyNotes: surveyNotes.isEmpty ? nil : surveyNotes)
            var saved = try await api.createLocation(body)

            // Upload any pending photos
            for image in pendingPhotos {
                if let data = image.jpegData(compressionQuality: 0.85) {
                    let photo = try await api.uploadPhoto(locationId: saved.id,
                                                          imageData: data,
                                                          mimeType: "image/jpeg")
                    saved.images.append(photo)
                }
            }

            if promptPhotos {
                speech.speak("\(areaName) saved. Tap Add Photo to add your photos.")
            } else {
                speech.speak(andContinue ? "\(areaName) saved. Ready for next location." : "\(areaName) saved.")
            }
            onSave(saved)

            if andContinue {
                areaName    = ""
                floor       = ""
                surveyNotes = ""
                pendingPhotos = []
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

    // MARK: - Voice commands

    private func registerVoiceCommands() {
        voice.register(id: "quick-add", commands: [
            VoiceCommand(keywords: ["name"]) { _ in
                speech.speak("Say the area name") {
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
                guard !areaName.isEmpty, selectedBuilding != nil else {
                    speech.speak("Please say a name first"); return
                }
                Task { await save(andContinue: false) }
            },
            VoiceCommand(keywords: ["next"]) { _ in
                guard !areaName.isEmpty, selectedBuilding != nil else {
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
