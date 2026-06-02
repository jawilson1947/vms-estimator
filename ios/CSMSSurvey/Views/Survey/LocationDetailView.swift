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
        ZStack {
            Theme.background.ignoresSafeArea()
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {

                    // Status + floor row
                    HStack(spacing: 10) {
                        StatusBadge(
                            label: vm.location.isDone ? "Surveyed" : "Pending",
                            icon: vm.location.isDone ? "checkmark.seal.fill" : "clock",
                            color: vm.location.isDone ? Theme.success : Theme.warning
                        )
                        if let floor = vm.location.floor {
                            Text("Floor \(floor)")
                                .font(.caption.weight(.medium))
                                .foregroundStyle(Theme.textSecondary)
                                .padding(.horizontal, 10)
                                .padding(.vertical, 5)
                                .background(Theme.surfaceElevated)
                                .clipShape(Capsule())
                        }
                        Spacer()
                    }

                    // Camera assignment (read-only)
                    if let cam = vm.location.cameras.first {
                        VStack(alignment: .leading, spacing: 10) {
                            DarkSectionHeader(title: "Assigned Camera")
                            HStack(spacing: 12) {
                                ZStack {
                                    RoundedRectangle(cornerRadius: 8)
                                        .fill(Theme.accentSoft)
                                        .frame(width: 36, height: 36)
                                    Image(systemName: "camera.fill")
                                        .font(.system(size: 15, weight: .semibold))
                                        .foregroundStyle(Theme.accent)
                                }
                                VStack(alignment: .leading, spacing: 2) {
                                    Text(cam.cameraName)
                                        .font(.subheadline.weight(.semibold))
                                        .foregroundStyle(Theme.textPrimary)
                                    Text(cam.cameraCode)
                                        .font(.caption)
                                        .foregroundStyle(Theme.textSecondary)
                                }
                            }
                        }
                        .darkCard()
                    }

                    // Survey notes
                    VStack(alignment: .leading, spacing: 10) {
                        DarkSectionHeader(title: "Survey Notes")
                        TextEditor(text: $notesText)
                            .frame(minHeight: 90)
                            .foregroundStyle(Theme.textPrimary)
                            .scrollContentBackground(.hidden)
                            .background(Theme.surfaceElevated)
                            .clipShape(RoundedRectangle(cornerRadius: 10))
                            .overlay(RoundedRectangle(cornerRadius: 10).stroke(Theme.border, lineWidth: 1))
                            .tint(Theme.accent)
                    }
                    .darkCard()

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
                        Text(err)
                            .font(.caption)
                            .foregroundStyle(Theme.danger)
                            .padding(12)
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .background(Theme.dangerSoft)
                            .clipShape(RoundedRectangle(cornerRadius: 10))
                    }

                    // Mark surveyed button
                    if !vm.location.isDone {
                        Button {
                            Task { await markSurveyed() }
                        } label: {
                            if vm.isSaving {
                                ProgressView().tint(.white)
                            } else {
                                Label("Mark as Surveyed", systemImage: "checkmark.seal.fill")
                            }
                        }
                        .tealButtonStyle(isLoading: vm.isSaving)
                        .disabled(vm.isSaving)
                        .padding(.top, 4)
                    }
                }
                .padding(16)
            }
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
