import SwiftUI

struct SurveyBoardView: View {
    @StateObject private var vm: SurveyBoardViewModel
    @StateObject private var voice = VoiceCommandManager.shared
    private let speech = SpeechOutputManager.shared

    @State private var showAddSheet     = false
    @State private var selectedLocation: SurveyLocation?
    @State private var showQuickRef     = false

    init(projectId: Int) {
        _vm = StateObject(wrappedValue: SurveyBoardViewModel(projectId: projectId))
    }

    var body: some View {
        ZStack(alignment: .bottomTrailing) {
            Theme.background.ignoresSafeArea()

            Group {
                if vm.isLoading && vm.project == nil {
                    VStack(spacing: 14) {
                        ProgressView().tint(Theme.accent).scaleEffect(1.2)
                        Text("Loading survey…")
                            .font(.subheadline)
                            .foregroundStyle(Theme.textSecondary)
                    }
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                } else if let err = vm.errorMsg {
                    ContentUnavailableView {
                        Label("Could not load survey", systemImage: "wifi.slash")
                    } description: { Text(err).foregroundStyle(Theme.textSecondary) } actions: {
                        Button("Retry") { Task { await vm.load() } }
                            .tealButtonStyle()
                            .frame(width: 120)
                    }
                } else {
                    ScrollView {
                        LazyVStack(spacing: 0, pinnedViews: .sectionHeaders) {
                            // Progress header
                            ProgressHeader(done: vm.doneCount,
                                           total: vm.totalCount,
                                           progress: vm.progress)
                                .padding(.horizontal, 16)
                                .padding(.top, 12)
                                .padding(.bottom, 4)

                            // Filter chips
                            FilterChips(selection: $vm.filter)
                                .padding(.horizontal, 16)
                                .padding(.vertical, 10)

                            // Building context header + flat location list
                            Section {
                                ForEach(vm.filteredLocations) { loc in
                                    LocationRow(location: loc) {
                                        selectedLocation = loc
                                    }
                                    .padding(.horizontal, 16)
                                    .padding(.vertical, 4)
                                }
                            } header: {
                                if let buildingName = vm.project?.buildingName {
                                    HStack {
                                        Text(buildingName.uppercased())
                                            .font(.caption.weight(.semibold))
                                            .foregroundStyle(Theme.textSecondary)
                                            .tracking(1.0)
                                        Spacer()
                                    }
                                    .padding(.horizontal, 16)
                                    .padding(.vertical, 8)
                                    .background(Theme.background)
                                }
                            }

                            // Bottom padding for FABs
                            Color.clear.frame(height: 100)
                        }
                    }
                    .refreshable { await vm.load() }
                }
            }

            // Floating buttons
            HStack(spacing: 12) {
                Button { showQuickRef = true } label: {
                    Image(systemName: "questionmark.circle.fill")
                        .font(.title3)
                        .foregroundStyle(Theme.textSecondary)
                        .frame(width: 46, height: 46)
                        .background(Theme.surface)
                        .clipShape(Circle())
                        .overlay(Circle().stroke(Theme.border, lineWidth: 1))
                        .shadow(color: .black.opacity(0.25), radius: 6, y: 3)
                }

                Button { showAddSheet = true } label: {
                    Label("Add Location", systemImage: "plus")
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(.white)
                        .padding(.horizontal, 18)
                        .padding(.vertical, 13)
                        .background(
                            Capsule().fill(
                                LinearGradient(colors: [Theme.accent, Theme.accentDeep],
                                               startPoint: .leading, endPoint: .trailing)
                            )
                        )
                        .shadow(color: Theme.accent.opacity(0.35), radius: 8, y: 4)
                }
            }
            .padding(20)
        }
        .navigationTitle(vm.project?.projectName ?? "Survey")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .navigationBarTrailing) {
                HStack(spacing: 8) {
                    NavigationLink(destination: VoiceTestView()) {
                        Image(systemName: "wrench.and.screwdriver")
                            .font(.system(size: 15))
                            .foregroundStyle(Theme.textSecondary)
                    }
                    MicIndicator()
                }
            }
        }
        .sheet(isPresented: $showAddSheet) {
            if let project = vm.project {
                AddLocationSheet(projectId: project.id) { newLoc in
                    vm.append(newLoc)
                }
            }
        }
        .navigationDestination(item: $selectedLocation) { loc in
            LocationDetailView(location: loc) { updated in
                vm.update(updated)
            }
        }
        .sheet(isPresented: $showQuickRef) {
            VoiceQuickRefView()
        }
        .task { await vm.load() }
        .onAppear { registerVoiceCommands() }
        .onDisappear { voice.unregister(id: "survey-board") }
    }

    private func registerVoiceCommands() {
        voice.register(id: "survey-board", commands: [
            VoiceCommand(keywords: ["add location", "new location"]) { _ in
                speech.speak("Opening add location") {
                    Task { @MainActor in showAddSheet = true }
                }
            },
        ])
    }
}

// MARK: - Sub-views

private struct ProgressHeader: View {
    let done: Int
    let total: Int
    let progress: Double

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(alignment: .top) {
                VStack(alignment: .leading, spacing: 2) {
                    Text("Survey Progress")
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(Theme.textSecondary)
                        .tracking(0.4)
                    Text("\(Int(progress * 100))%")
                        .font(.system(size: 38, weight: .bold, design: .rounded))
                        .foregroundStyle(Theme.textPrimary)
                }
                Spacer()
                VStack(alignment: .trailing, spacing: 2) {
                    Text("\(done) / \(total)")
                        .font(.title3.weight(.bold))
                        .foregroundStyle(Theme.textPrimary)
                    Text("locations surveyed")
                        .font(.caption)
                        .foregroundStyle(Theme.textSecondary)
                }
            }
            GeometryReader { geo in
                ZStack(alignment: .leading) {
                    Capsule()
                        .fill(Theme.surfaceElevated)
                        .frame(height: 6)
                    Capsule()
                        .fill(
                            LinearGradient(colors: [Theme.accent, Theme.accentDeep],
                                           startPoint: .leading, endPoint: .trailing)
                        )
                        .frame(width: geo.size.width * progress, height: 6)
                        .animation(.easeInOut(duration: 0.4), value: progress)
                }
            }
            .frame(height: 6)
        }
        .darkCard(padding: 18)
    }
}

private struct FilterChips: View {
    @Binding var selection: SurveyFilter
    var body: some View {
        HStack(spacing: 8) {
            ForEach(SurveyFilter.allCases, id: \.self) { f in
                Button(f.rawValue) { selection = f }
                    .font(.caption.weight(.semibold))
                    .padding(.horizontal, 14)
                    .padding(.vertical, 7)
                    .background(
                        selection == f
                        ? Theme.accentSoft
                        : Theme.surface
                    )
                    .foregroundStyle(
                        selection == f ? Theme.accent : Theme.textSecondary
                    )
                    .clipShape(Capsule())
                    .overlay(
                        Capsule().stroke(
                            selection == f ? Theme.accent.opacity(0.35) : Theme.border,
                            lineWidth: 1
                        )
                    )
            }
            Spacer()
        }
    }
}

private struct LocationRow: View {
    let location: SurveyLocation
    let onTap: () -> Void

    var body: some View {
        Button(action: onTap) {
            HStack(spacing: 14) {
                ZStack {
                    Circle()
                        .fill(location.isDone ? Theme.successSoft : Theme.surfaceElevated)
                        .frame(width: 36, height: 36)
                    Image(systemName: location.isDone ? "checkmark.circle.fill" : "circle")
                        .foregroundStyle(location.isDone ? Theme.success : Theme.textTertiary)
                        .font(.system(size: 18, weight: .semibold))
                }

                VStack(alignment: .leading, spacing: 3) {
                    Text(location.areaName)
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(Theme.textPrimary)
                    if let floor = location.floor {
                        Text("Floor \(floor)")
                            .font(.caption)
                            .foregroundStyle(Theme.textSecondary)
                    }
                }
                Spacer()

                if !location.images.isEmpty {
                    HStack(spacing: 3) {
                        Image(systemName: "photo")
                        Text("\(location.images.count)")
                    }
                    .font(.caption.weight(.medium))
                    .foregroundStyle(Theme.textSecondary)
                }

                Image(systemName: "chevron.right")
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(Theme.textTertiary)
            }
            .padding(14)
            .background(Theme.surface)
            .clipShape(RoundedRectangle(cornerRadius: 14))
            .overlay(RoundedRectangle(cornerRadius: 14).stroke(Theme.border, lineWidth: 1))
        }
        .buttonStyle(.plain)
    }
}

private struct MicIndicator: View {
    @StateObject private var voice = VoiceCommandManager.shared

    var body: some View {
        Button {
            voice.setEnabled(!voice.enabled)
        } label: {
            Image(systemName: micIcon)
                .foregroundStyle(micColor)
                .overlay(alignment: .bottomTrailing) {
                    if !voice.enabled {
                        Image(systemName: "xmark")
                            .font(.system(size: 8, weight: .bold))
                            .foregroundStyle(Theme.danger)
                    } else if voice.isListening {
                        Circle()
                            .fill(Theme.accent)
                            .frame(width: 6, height: 6)
                    }
                }
        }
    }

    private var micIcon: String {
        voice.enabled ? "mic.fill" : "mic.slash.fill"
    }
    private var micColor: Color {
        guard voice.enabled else { return Theme.textTertiary }
        switch voice.mode {
        case .waitingForValue: return Theme.warning
        case .idle:            return voice.isListening ? Theme.accent : Theme.textSecondary
        }
    }
}
