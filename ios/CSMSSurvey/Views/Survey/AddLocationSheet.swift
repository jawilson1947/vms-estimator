import SwiftUI
import PhotosUI

struct AddLocationSheet: View {
    let buildings: [SurveyBuilding]
    let onSave: (SurveyLocation) -> Void

    @Environment(\.dismiss) private var dismiss
    @StateObject private var voice  = VoiceCommandManager.shared
    private        let speech       = SpeechOutputManager.shared
    private        let api          = APIClient.shared

    @State private var areaName     = ""
    @State private var floor        = ""
    @State private var surveyNotes  = ""
    @State private var selectedBuilding: SurveyBuilding?
    @State private var pendingPhotos: [UIImage] = []
    @State private var photoItem:   PhotosPickerItem?
    @State private var isSaving     = false
    @State private var errorMsg:    String?
    @State private var voiceField:  String?   // highlights active field

    private let maxPhotos = 5

    var body: some View {
        NavigationStack {
            Form {
                // Building picker
                Section("Building") {
                    Picker("Building", selection: $selectedBuilding) {
                        Text("Select…").tag(Optional<SurveyBuilding>(nil))
                        ForEach(buildings) { b in
                            Text(b.buildingName).tag(Optional(b))
                        }
                    }
                }

                // Fields
                Section("Location") {
                    fieldRow(label: "Area Name", placeholder: "e.g. Server Room",
                             text: $areaName, field: "areaName")
                    fieldRow(label: "Floor", placeholder: "e.g. 2",
                             text: $floor, field: "floor")
                }

                Section("Notes") {
                    TextEditor(text: $surveyNotes)
                        .frame(minHeight: 80)
                        .overlay(
                            RoundedRectangle(cornerRadius: 6)
                                .stroke(voiceField == "notes"
                                        ? Color.orange
                                        : Color(.systemGray4), lineWidth: voiceField == "notes" ? 2 : 1)
                        )
                }

                // Pending photos
                if !pendingPhotos.isEmpty {
                    Section("Photos (\(pendingPhotos.count)/\(maxPhotos))") {
                        ScrollView(.horizontal, showsIndicators: false) {
                            HStack(spacing: 8) {
                                ForEach(pendingPhotos.indices, id: \.self) { i in
                                    Image(uiImage: pendingPhotos[i])
                                        .resizable()
                                        .scaledToFill()
                                        .frame(width: 80, height: 80)
                                        .clipShape(RoundedRectangle(cornerRadius: 8))
                                }
                            }
                            .padding(.vertical, 4)
                        }
                    }
                }

                // Photo add
                if pendingPhotos.count < maxPhotos {
                    Section {
                        PhotosPicker(selection: $photoItem, matching: .images) {
                            Label("Add Photo", systemImage: "camera")
                        }
                    }
                }

                if let err = errorMsg {
                    Section {
                        Text(err).foregroundStyle(.red).font(.caption)
                    }
                }
            }
            .navigationTitle("Add Location")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    if isSaving {
                        ProgressView()
                    } else {
                        Button("Save") { Task { await save(andContinue: false) } }
                            .disabled(areaName.isEmpty || selectedBuilding == nil)
                    }
                }
                ToolbarItem(placement: .bottomBar) {
                    Button("Save & Next") { Task { await save(andContinue: true) } }
                        .disabled(areaName.isEmpty || selectedBuilding == nil || isSaving)
                }
            }
        }
        .onChange(of: photoItem) { _, item in
            Task { await loadPhoto(item) }
        }
        .onAppear  { registerVoiceCommands() }
        .onDisappear { voice.unregister(id: "quick-add") }
    }

    // MARK: - Field row helper

    @ViewBuilder
    private func fieldRow(label: String, placeholder: String,
                          text: Binding<String>, field: String) -> some View {
        HStack {
            Text(label)
                .frame(width: 90, alignment: .leading)
            TextField(placeholder, text: text)
                .overlay(
                    RoundedRectangle(cornerRadius: 6)
                        .stroke(voiceField == field ? Color.orange : Color.clear, lineWidth: 2)
                        .padding(-4)
                )
        }
    }

    // MARK: - Save

    private func save(andContinue: Bool) async {
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

            speech.speak(andContinue ? "\(areaName) saved. Ready for next location." : "\(areaName) saved.")
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
