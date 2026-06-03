import SwiftUI

struct CameraPickerSheet: View {
    let onSelect: (CameraModel) -> Void

    @Environment(\.dismiss) private var dismiss
    @StateObject private var vm = CameraPickerViewModel()

    var body: some View {
        NavigationStack {
            ZStack {
                Theme.background.ignoresSafeArea()
                Group {
                    if vm.isLoading {
                        ProgressView("Loading cameras…")
                            .tint(Theme.accent)
                    } else if let err = vm.errorMsg {
                        VStack(spacing: 12) {
                            Text(err)
                                .font(.subheadline)
                                .foregroundStyle(Theme.danger)
                            Button("Retry") { Task { await vm.load() } }
                                .foregroundStyle(Theme.accent)
                        }
                        .padding()
                    } else if vm.filtered.isEmpty {
                        Text(vm.searchText.isEmpty ? "No cameras found." : "No results for \"\(vm.searchText)\".")
                            .foregroundStyle(Theme.textSecondary)
                            .font(.subheadline)
                    } else {
                        List(vm.filtered) { camera in
                            Button {
                                onSelect(camera)
                                dismiss()
                            } label: {
                                CameraRow(camera: camera)
                            }
                            .listRowBackground(Theme.surfaceElevated)
                        }
                        .listStyle(.plain)
                        .scrollContentBackground(.hidden)
                    }
                }
            }
            .navigationTitle("Select Camera")
            .navigationBarTitleDisplayMode(.inline)
            .searchable(text: $vm.searchText, placement: .navigationBarDrawer(displayMode: .always), prompt: "Search by manufacturer or model")
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                        .foregroundStyle(Theme.textSecondary)
                }
            }
        }
        .task { await vm.load() }
    }
}

// MARK: - Camera row

private struct CameraRow: View {
    let camera: CameraModel

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(camera.displayName)
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(Theme.textPrimary)
            HStack(spacing: 8) {
                if let type = camera.cameraType {
                    badge(type, color: Theme.accent)
                }
                if let ptz = camera.ptz, ptz {
                    badge("PTZ", color: Theme.textSecondary)
                }
                if let res = camera.resolutionClass ?? camera.resolution {
                    Text(res)
                        .font(.caption)
                        .foregroundStyle(Theme.textSecondary)
                }
            }
        }
        .padding(.vertical, 4)
    }

    @ViewBuilder
    private func badge(_ text: String, color: Color) -> some View {
        Text(text)
            .font(.caption.weight(.medium))
            .foregroundStyle(color)
            .padding(.horizontal, 8)
            .padding(.vertical, 2)
            .background(color.opacity(0.12))
            .clipShape(Capsule())
    }
}
