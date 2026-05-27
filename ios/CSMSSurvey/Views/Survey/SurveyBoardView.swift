import SwiftUI

struct SurveyBoardView: View {
    @StateObject private var vm: SurveyBoardViewModel
    @StateObject private var voice = VoiceCommandManager.shared
    private let speech = SpeechOutputManager.shared

    @State private var showAddSheet   = false
    @State private var selectedLocation: SurveyLocation?
    @State private var showQuickRef   = false

    init(siteId: Int) {
        _vm = StateObject(wrappedValue: SurveyBoardViewModel(siteId: siteId))
    }

    var body: some View {
        ZStack(alignment: .bottomTrailing) {
            Group {
                if vm.isLoading && vm.site == nil {
                    ProgressView("Loading survey…")
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                } else if let err = vm.errorMsg {
                    ContentUnavailableView {
                        Label("Could not load survey", systemImage: "wifi.slash")
                    } description: { Text(err) } actions: {
                        Button("Retry") { Task { await vm.load() } }
                            .buttonStyle(.borderedProminent)
                    }
                } else {
                    ScrollView {
                        LazyVStack(spacing: 0, pinnedViews: .sectionHeaders) {
                            // Progress header
                            ProgressHeader(done: vm.doneCount,
                                           total: vm.totalCount,
                                           progress: vm.progress)
                                .padding()

                            // Filter chips
                            FilterChips(selection: $vm.filter)
                                .padding(.horizontal)
                                .padding(.bottom, 8)

                            // Buildings + locations
                            ForEach(vm.filteredBuildings) { building in
                                Section {
                                    ForEach(building.locations) { loc in
                                        LocationRow(location: loc) {
                                            selectedLocation = loc
                                        }
                                        .padding(.horizontal)
                                        .padding(.vertical, 4)
                                    }
                                } header: {
                                    Text(building.buildingName)
                                        .font(.caption.bold())
                                        .foregroundStyle(.secondary)
                                        .textCase(.uppercase)
                                        .frame(maxWidth: .infinity, alignment: .leading)
                                        .padding(.horizontal)
                                        .padding(.vertical, 6)
                                        .background(Color(.systemGroupedBackground))
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
                // Voice quick reference
                Button { showQuickRef = true } label: {
                    Image(systemName: "questionmark.circle")
                        .font(.title3)
                        .frame(width: 44, height: 44)
                        .background(Color(.systemBackground))
                        .clipShape(Circle())
                        .shadow(radius: 4, y: 2)
                }

                // Add location
                Button { showAddSheet = true } label: {
                    Label("Add Location", systemImage: "plus")
                        .fontWeight(.semibold)
                        .padding(.horizontal, 16)
                        .padding(.vertical, 12)
                        .background(Color.blue)
                        .foregroundStyle(.white)
                        .clipShape(Capsule())
                        .shadow(radius: 4, y: 2)
                }
            }
            .padding(20)
        }
        .navigationTitle(vm.site?.siteName ?? "Survey")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .navigationBarTrailing) {
                MicIndicator()
            }
        }
        .sheet(isPresented: $showAddSheet) {
            if let site = vm.site {
                AddLocationSheet(buildings: site.buildings) { newLoc in
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
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                VStack(alignment: .leading) {
                    Text("Survey Progress")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                    Text("\(Int(progress * 100))%")
                        .font(.system(size: 32, weight: .bold))
                }
                Spacer()
                VStack(alignment: .trailing) {
                    Text("\(done) / \(total)")
                        .font(.subheadline.bold())
                    Text("locations surveyed")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            }
            ProgressView(value: progress)
                .tint(.green)
        }
        .padding()
        .background(Color(.systemBackground))
        .clipShape(RoundedRectangle(cornerRadius: 12))
        .shadow(color: .black.opacity(0.06), radius: 4, y: 2)
    }
}

private struct FilterChips: View {
    @Binding var selection: SurveyFilter
    var body: some View {
        HStack(spacing: 8) {
            ForEach(SurveyFilter.allCases, id: \.self) { f in
                Button(f.rawValue) { selection = f }
                    .font(.caption.bold())
                    .padding(.horizontal, 12)
                    .padding(.vertical, 6)
                    .background(selection == f ? Color.blue : Color(.secondarySystemBackground))
                    .foregroundStyle(selection == f ? .white : .primary)
                    .clipShape(Capsule())
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
            HStack(spacing: 12) {
                Image(systemName: location.isDone ? "checkmark.circle.fill" : "circle")
                    .foregroundStyle(location.isDone ? .green : .secondary)
                    .font(.title3)

                VStack(alignment: .leading, spacing: 2) {
                    Text(location.areaName)
                        .font(.subheadline.bold())
                        .foregroundStyle(.primary)
                    if let floor = location.floor {
                        Text("Floor \(floor)")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                }
                Spacer()

                if !location.images.isEmpty {
                    Label("\(location.images.count)", systemImage: "photo")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }

                Image(systemName: "chevron.right")
                    .font(.caption)
                    .foregroundStyle(.tertiary)
            }
            .padding(12)
            .background(Color(.systemBackground))
            .clipShape(RoundedRectangle(cornerRadius: 10))
            .shadow(color: .black.opacity(0.05), radius: 2, y: 1)
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
                            .foregroundStyle(.red)
                    } else if voice.isListening {
                        Circle()
                            .fill(.red)
                            .frame(width: 6, height: 6)
                    }
                }
        }
    }

    private var micIcon: String {
        voice.enabled ? "mic.fill" : "mic.slash.fill"
    }
    private var micColor: Color {
        guard voice.enabled else { return .secondary }
        switch voice.mode {
        case .waitingForValue: return .orange
        case .idle:            return voice.isListening ? .red : .secondary
        }
    }
}
