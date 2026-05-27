import SwiftUI
import PhotosUI

struct LocationDetailView: View {
    @StateObject private var vm: LocationDetailViewModel
    @StateObject private var voice = VoiceCommandManager.shared
    private        let speech      = SpeechOutputManager.shared
    @Environment(\.dismiss) private var dismiss

    @State private var notesText   = ""
    @State private var photoItem:  PhotosPickerItem?
    @State private var showCamera  = false

    init(location: SurveyLocation, onUpdate: @escaping (SurveyLocation) -> Void) {
        let viewModel = LocationDetailViewModel(location: location)
        viewModel.onUpdate = onUpdate
        _vm = StateObject(wrappedValue: viewModel)
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {

                // Status badge
                HStack {
                    Label(
                        vm.location.isDone ? "Surveyed" : "Pending",
                        systemImage: vm.location.isDone ? "checkmark.seal.fill" : "clock"
                    )
                    .font(.caption.bold())
                    .foregroundStyle(vm.location.isDone ? .green : .orange)
                    .padding(.horizontal, 10)
                    .padding(.vertical, 5)
                    .background((vm.location.isDone ? Color.green : Color.orange).opacity(0.12))
                    .clipShape(Capsule())

                    if let floor = vm.location.floor {
                        Text("Floor \(floor)")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                    Spacer()
                }

                // Camera assignment (read-only)
                if let cam = vm.location.cameras.first {
                    GroupBox("Assigned Camera") {
                        HStack {
                            Image(systemName: "camera.fill")
                                .foregroundStyle(.blue)
                            VStack(alignment: .leading) {
                                Text(cam.cameraName).font(.subheadline.bold())
                                Text(cam.cameraCode).font(.caption).foregroundStyle(.secondary)
                            }
                        }
                    }
                }

                // Survey notes
                GroupBox("Survey Notes") {
                    TextEditor(text: $notesText)
                        .frame(minHeight: 80)
                }

                // Photos
                PhotoGridView(
                    photos: vm.location.images,
                    isUploading: vm.isUploading,
                    atLimit: vm.atPhotoLimit,
                    onDelete: { photo in Task { await vm.deletePhoto(photo) } },
                    onPickerItem: { item in Task { await loadPhoto(item) } }
                )

                // Error
                if let err = vm.errorMsg {
                    Text(err).font(.caption).foregroundStyle(.red)
                }

                // Mark surveyed button
                if !vm.location.isDone {
                    Button {
                        Task { await markSurveyed() }
                    } label: {
                        Group {
                            if vm.isSaving {
                                ProgressView().tint(.white)
                            } else {
                                Label("Mark as Surveyed", systemImage: "checkmark.seal.fill")
                                    .fontWeight(.semibold)
                            }
                        }
                        .frame(maxWidth: .infinity)
                        .padding()
                    }
                    .buttonStyle(.borderedProminent)
                    .tint(.green)
                    .disabled(vm.isSaving)
                }
            }
            .padding()
        }
        .navigationTitle(vm.location.areaName)
        .navigationBarTitleDisplayMode(.large)
        .onAppear {
            notesText = vm.location.surveyNotes ?? ""
            registerVoiceCommands()
        }
        .onDisappear {
            voice.unregister(id: "location-detail")
            // Auto-save notes on exit if changed
            if notesText != (vm.location.surveyNotes ?? "") {
                Task { await vm.saveNotes(notesText) }
            }
        }
        .onChange(of: photoItem) { _, item in Task { await loadPhoto(item) } }
    }

    private func markSurveyed() async {
        speech.speak("\(vm.location.areaName) marked as surveyed")
        await vm.markSurveyed()
    }

    private func loadPhoto(_ item: PhotosPickerItem?) async {
        guard let item else { return }
        if let data = try? await item.loadTransferable(type: Data.self),
           let img  = UIImage(data: data) {
            await vm.uploadPhoto(img)
            let count = vm.location.images.count
            speech.speak("Photo added. \(count) of \(LocationDetailViewModel.maxPhotos).")
        }
        photoItem = nil
    }

    private func registerVoiceCommands() {
        voice.register(id: "location-detail", commands: [
            VoiceCommand(keywords: ["save", "mark surveyed"]) { _ in
                Task { await markSurveyed() }
            },
            VoiceCommand(keywords: ["photo"]) { _ in
                if vm.atPhotoLimit {
                    speech.speak("Photo limit reached")
                } else {
                    speech.speak("Tap to add a photo")
                }
            },
            VoiceCommand(keywords: ["close", "back", "exit"]) { _ in
                speech.speak("Closing") { dismiss() }
            },
        ])
    }
}
