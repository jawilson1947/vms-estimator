import SwiftUI

struct VoiceCommandTestPanel: View {
    @ObservedObject private var voice = VoiceCommandManager.shared
    @State private var freeformText = ""
    @State private var lastFired:   String? = nil
    @State private var fixturesLoaded = false

    var body: some View {
        ZStack {
            Theme.background.ignoresSafeArea()
            ScrollView {
                VStack(spacing: 14) {
                    freeformCard
                    fixtureCard
                    commandsCard
                }
                .padding(16)
            }
        }
        .navigationTitle("Command Tester")
        .navigationBarTitleDisplayMode(.inline)
        .onDisappear {
            if fixturesLoaded { unloadFixtures() }
        }
    }

    // MARK: - Freeform injection

    private var freeformCard: some View {
        VStack(alignment: .leading, spacing: 12) {
            DarkSectionHeader(title: "Freeform Inject")

            HStack(spacing: 10) {
                TextField("Type a phrase…", text: $freeformText)
                    .darkField()
                    .autocapitalization(.none)
                    .disableAutocorrection(true)

                Button {
                    inject(freeformText)
                    freeformText = ""
                } label: {
                    Text("Inject")
                        .font(.subheadline.bold())
                        .foregroundStyle(.white)
                        .padding(.horizontal, 14)
                        .padding(.vertical, 11)
                        .background(
                            freeformText.isEmpty
                                ? AnyShapeStyle(Theme.surfaceElevated)
                                : AnyShapeStyle(LinearGradient(
                                    colors: [Theme.accent, Theme.accentDeep],
                                    startPoint: .topLeading, endPoint: .bottomTrailing))
                        )
                        .clipShape(RoundedRectangle(cornerRadius: 10))
                }
                .disabled(freeformText.isEmpty)
            }

            if let last = lastFired {
                HStack(spacing: 6) {
                    Image(systemName: "checkmark.circle.fill")
                        .foregroundStyle(Theme.success)
                        .font(.caption)
                    Text("Injected: \"\(last)\"")
                        .font(.caption)
                        .foregroundStyle(Theme.textSecondary)
                }
            }
        }
        .darkCard()
    }

    // MARK: - Fixture loader

    private var fixtureCard: some View {
        VStack(alignment: .leading, spacing: 10) {
            DarkSectionHeader(title: "Test Fixtures")
            Text("Load a set of representative commands so you can test without navigating to a survey screen first.")
                .font(.caption)
                .foregroundStyle(Theme.textSecondary)

            HStack(spacing: 10) {
                Button(fixturesLoaded ? "Unload Fixtures" : "Load Fixtures") {
                    if fixturesLoaded { unloadFixtures() } else { loadFixtures() }
                }
                .font(.caption.bold())
                .foregroundStyle(fixturesLoaded ? Theme.danger : Theme.accent)
                .padding(.horizontal, 14)
                .padding(.vertical, 8)
                .background(fixturesLoaded ? Theme.dangerSoft : Theme.accentSoft)
                .clipShape(Capsule())
                .overlay(Capsule().stroke(
                    fixturesLoaded ? Theme.danger.opacity(0.25) : Theme.accent.opacity(0.25)
                ))

                if fixturesLoaded {
                    Label("Fixtures active", systemImage: "wrench.and.screwdriver.fill")
                        .font(.caption)
                        .foregroundStyle(Theme.warning)
                }
            }
        }
        .darkCard()
    }

    // MARK: - Registered commands list

    @ViewBuilder
    private var commandsCard: some View {
        let groups = voice.registeredCommands

        VStack(alignment: .leading, spacing: 12) {
            DarkSectionHeader(title: "Registered Commands (\(groups.flatMap(\.keywords).count))")

            if groups.isEmpty {
                VStack(spacing: 6) {
                    Image(systemName: "mic.slash")
                        .font(.title2)
                        .foregroundStyle(Theme.textTertiary)
                    Text("No commands registered")
                        .font(.subheadline)
                        .foregroundStyle(Theme.textTertiary)
                    Text("Load fixtures above, or navigate to a survey screen and return.")
                        .font(.caption)
                        .foregroundStyle(Theme.textTertiary)
                        .multilineTextAlignment(.center)
                }
                .frame(maxWidth: .infinity)
                .padding(.vertical, 20)
            } else {
                ForEach(groups, id: \.context) { group in
                    VStack(alignment: .leading, spacing: 8) {
                        Text(group.context.uppercased())
                            .font(.caption2.bold())
                            .foregroundStyle(Theme.textTertiary)
                            .tracking(0.6)

                        ForEach(group.keywords, id: \.self) { keyword in
                            HStack {
                                Text("\"\(keyword)\"")
                                    .font(.system(.subheadline, design: .monospaced))
                                    .foregroundStyle(Theme.accent)
                                Spacer()
                                Button("Fire") { inject(keyword) }
                                    .font(.caption.bold())
                                    .foregroundStyle(.white)
                                    .padding(.horizontal, 12)
                                    .padding(.vertical, 5)
                                    .background(
                                        LinearGradient(
                                            colors: [Theme.accent, Theme.accentDeep],
                                            startPoint: .topLeading, endPoint: .bottomTrailing)
                                    )
                                    .clipShape(Capsule())
                            }
                            .padding(.horizontal, 12)
                            .padding(.vertical, 8)
                            .background(Theme.surfaceElevated)
                            .clipShape(RoundedRectangle(cornerRadius: 8))
                        }
                    }
                }
            }
        }
        .darkCard()
    }

    // MARK: - Helpers

    private func inject(_ text: String) {
        guard !text.trimmingCharacters(in: .whitespaces).isEmpty else { return }
        lastFired = text
        voice.simulateInput(text)
    }

    private func loadFixtures() {
        voice.register(id: "_fixtures", commands: [
            VoiceCommand(keywords: ["add location", "new location"]) { _ in },
            VoiceCommand(keywords: ["name"])    { _ in },
            VoiceCommand(keywords: ["floor"])   { _ in },
            VoiceCommand(keywords: ["survey note", "add note"]) { _ in },
            VoiceCommand(keywords: ["add photo", "survey photo"]) { _ in },
            VoiceCommand(keywords: ["save"])    { _ in },
            VoiceCommand(keywords: ["next"])    { _ in },
            VoiceCommand(keywords: ["mark surveyed"]) { _ in },
            VoiceCommand(keywords: ["save changes"])  { _ in },
            VoiceCommand(keywords: ["close", "back", "exit"]) { _ in },
        ])
        fixturesLoaded = true
    }

    private func unloadFixtures() {
        voice.unregister(id: "_fixtures")
        fixturesLoaded = false
    }
}
