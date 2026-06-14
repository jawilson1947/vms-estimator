import SwiftUI
import PhotosUI

struct LocationDetailView: View {
    @StateObject private var vm: LocationDetailViewModel
    @StateObject private var voice     = VoiceCommandManager.shared
    @StateObject private var interview = VoiceInterviewManager.shared
    private        let speech          = SpeechOutputManager.shared
    @Environment(\.dismiss) private var dismiss

    @State private var notesText           = ""
    @State private var photoItem:          PhotosPickerItem?
    @State private var showCamera          = false
    @State private var showCameraPicker    = false
    @State private var showDeleteConfirm   = false
    @State private var showInterview       = false

    init(location: SurveyLocation,
         onUpdate: @escaping (SurveyLocation) -> Void,
         onDelete: (() -> Void)? = nil) {
        let viewModel = LocationDetailViewModel(location: location)
        viewModel.onUpdate = onUpdate
        viewModel.onDelete = onDelete
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

                    // Camera assignment
                    VStack(alignment: .leading, spacing: 10) {
                        DarkSectionHeader(title: "Camera Model")
                        if let cam = vm.location.cameraModel {
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
                                    Text(cam.displayName)
                                        .font(.subheadline.weight(.semibold))
                                        .foregroundStyle(Theme.textPrimary)
                                    HStack(spacing: 6) {
                                        if let type = cam.cameraType {
                                            Text(type)
                                                .font(.caption)
                                                .foregroundStyle(Theme.accent)
                                        }
                                        if let res = cam.resolutionClass ?? cam.resolution {
                                            Text("· \(res)")
                                                .font(.caption)
                                                .foregroundStyle(Theme.textSecondary)
                                        }
                                    }
                                }
                                Spacer()
                                if vm.isSaving {
                                    ProgressView().tint(Theme.accent)
                                } else {
                                    Button {
                                        Task { await vm.removeCamera() }
                                    } label: {
                                        Image(systemName: "xmark.circle.fill")
                                            .foregroundStyle(Theme.textSecondary)
                                            .font(.system(size: 20))
                                    }
                                }
                            }
                            .padding(12)
                            .background(Theme.surfaceElevated)
                            .clipShape(RoundedRectangle(cornerRadius: 10))
                            .overlay(RoundedRectangle(cornerRadius: 10).stroke(Theme.border, lineWidth: 1))
                        } else {
                            Button {
                                showCameraPicker = true
                            } label: {
                                Label("Assign Camera", systemImage: "camera.badge.plus")
                                    .font(.subheadline.weight(.semibold))
                                    .foregroundStyle(Theme.accent)
                                    .frame(maxWidth: .infinity)
                                    .padding(.vertical, 13)
                                    .background(Theme.accentSoft)
                                    .clipShape(RoundedRectangle(cornerRadius: 12))
                                    .overlay(RoundedRectangle(cornerRadius: 12).stroke(Theme.accent.opacity(0.28), lineWidth: 1))
                            }
                            .disabled(vm.isSaving)
                        }
                    }
                    .darkCard()

                    // Survey notes
                    VStack(alignment: .leading, spacing: 10) {
                        HStack {
                            DarkSectionHeader(title: "Survey Notes")
                            Spacer()
                            if notesText != (vm.location.surveyNotes ?? "") {
                                Button {
                                    Task { await vm.saveNotes(notesText) }
                                } label: {
                                    if vm.isSaving {
                                        ProgressView().tint(Theme.accent).scaleEffect(0.8)
                                    } else {
                                        Text("Save")
                                            .font(.caption.weight(.semibold))
                                            .foregroundStyle(Theme.accent)
                                            .padding(.horizontal, 12)
                                            .padding(.vertical, 5)
                                            .background(Theme.accentSoft)
                                            .clipShape(Capsule())
                                            .overlay(Capsule().stroke(Theme.accent.opacity(0.3), lineWidth: 1))
                                    }
                                }
                                .disabled(vm.isSaving)
                            }
                        }
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
                        onPickerItem: { item in Task { await loadPhoto(item) } },
                        onCameraImage: { image in Task { await vm.uploadPhoto(image) } }
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
        .sheet(isPresented: $showCameraPicker) {
            CameraPickerSheet { selected in
                Task { await vm.assignCamera(selected) }
            }
        }
        .navigationTitle(vm.location.areaName)
        .navigationBarTitleDisplayMode(.large)
        .toolbar {
            ToolbarItem(placement: .navigationBarTrailing) {
                HStack(spacing: 14) {
                    Button { startVoiceInterview() } label: {
                        Image(systemName: "waveform.and.mic")
                            .foregroundStyle(Theme.accent)
                    }
                    .disabled(vm.isSaving)
                    Button(role: .destructive) {
                        showDeleteConfirm = true
                    } label: {
                        Image(systemName: "trash")
                            .foregroundStyle(Theme.danger)
                    }
                    .disabled(vm.isSaving)
                }
            }
        }
        .fullScreenCover(isPresented: $showInterview) {
            VoiceInterviewView(manager: interview) { showInterview = false }
                .onDisappear {
                    interview.stop()
                    voice.setEnabled(true)
                }
        }
        .confirmationDialog(
            "Delete \"\(vm.location.areaName)\"?",
            isPresented: $showDeleteConfirm,
            titleVisibility: .visible
        ) {
            Button("Delete Survey", role: .destructive) {
                Task { await vm.deleteLocation() }
            }
            Button("Cancel", role: .cancel) {}
        } message: {
            Text("This will permanently remove the survey and all its photos.")
        }
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

    // MARK: - Voice edit

    private func startVoiceInterview() {
        guard !showInterview else { return }
        // Park the always-on command listener so only the interview owns the mic.
        voice.setEnabled(false)
        showInterview = true
        interview.start(
            area:  vm.location.areaName,
            floor: vm.location.floor ?? "",
            notes: notesText,
            onSave: {
                Task {
                    await vm.saveDetails(area:  interview.areaName,
                                         floor: interview.floor,
                                         notes: interview.surveyNotes)
                    notesText     = interview.surveyNotes
                    showInterview = false
                }
            },
            onDone: {
                Task {
                    await vm.saveDetails(area:  interview.areaName,
                                         floor: interview.floor,
                                         notes: interview.surveyNotes)
                    notesText     = interview.surveyNotes
                    showInterview = false
                }
            }
        )
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
