import SwiftUI

struct VoiceDebugPanel: View {
    @StateObject private var voice  = VoiceCommandManager.shared
    @StateObject private var speech = SpeechOutputManager.shared

    var body: some View {
        ZStack {
            Theme.background.ignoresSafeArea()
            ScrollView {
                VStack(spacing: 14) {
                    networkCard
                    listenerCard
                    valueCard
                    speechCard
                    lastHeardCard
                }
                .padding(16)
            }
        }
        .navigationTitle("Debug: Live State")
        .navigationBarTitleDisplayMode(.inline)
    }

    // MARK: - Network

    private var networkCard: some View {
        let url     = AppEnvironment.baseURL.absoluteString
        let isLocal = url.contains("localhost") || url.contains("127.0.0.1")

        return VStack(alignment: .leading, spacing: 12) {
            DarkSectionHeader(title: "API")

            row("Base URL") {
                Text(url)
                    .font(.system(.caption, design: .monospaced))
                    .foregroundStyle(isLocal ? Theme.danger : Theme.success)
                    .lineLimit(1)
                    .minimumScaleFactor(0.7)
            }

            if isLocal {
                HStack(spacing: 6) {
                    Image(systemName: "exclamationmark.triangle.fill")
                        .foregroundStyle(Theme.danger)
                        .font(.caption)
                    Text("Hitting localhost — xcconfig not wired. Check Xcode project → Info → Configurations.")
                        .font(.caption2)
                        .foregroundStyle(Theme.danger)
                }
            }
        }
        .darkCard()
    }

    // MARK: - Listener state

    private var listenerCard: some View {
        VStack(alignment: .leading, spacing: 12) {
            DarkSectionHeader(title: "Listener")

            row("Permissions") {
                StatusBadge(
                    label: voice.permissionGranted ? "Granted" : "Denied",
                    icon:  voice.permissionGranted ? "checkmark.circle" : "xmark.circle",
                    color: voice.permissionGranted ? Theme.success : Theme.danger
                )
            }

            row("Enabled") {
                Toggle("", isOn: Binding(
                    get: { voice.enabled },
                    set: { voice.setEnabled($0) }
                ))
                .labelsHidden()
                .tint(Theme.accent)
            }

            row("Listening") {
                HStack(spacing: 6) {
                    if voice.isListening {
                        Circle()
                            .fill(Theme.danger)
                            .frame(width: 8, height: 8)
                    }
                    Text(voice.isListening ? "Active" : "Idle")
                        .font(.caption.bold())
                        .foregroundStyle(voice.isListening ? Theme.danger : Theme.textSecondary)
                }
            }

            row("Mode") {
                Text(voice.mode == .idle ? "idle" : "waitingForValue")
                    .font(.system(.caption, design: .monospaced))
                    .foregroundStyle(voice.mode == .idle ? Theme.textSecondary : Theme.warning)
            }
        }
        .darkCard()
    }

    // MARK: - Value-capture state

    private var valueCard: some View {
        VStack(alignment: .leading, spacing: 12) {
            DarkSectionHeader(title: "Value Capture")

            row("Active Field") {
                Text(voice.activeField ?? "none")
                    .font(.system(.caption, design: .monospaced))
                    .foregroundStyle(voice.activeField != nil ? Theme.warning : Theme.textTertiary)
            }
        }
        .darkCard()
    }

    // MARK: - Speech output state

    private var speechCard: some View {
        VStack(alignment: .leading, spacing: 12) {
            DarkSectionHeader(title: "Speech Output")

            row("Speaking") {
                HStack(spacing: 6) {
                    if speech.isSpeaking {
                        Circle().fill(Theme.accent).frame(width: 8, height: 8)
                    }
                    Text(speech.isSpeaking ? "Yes" : "No")
                        .font(.caption.bold())
                        .foregroundStyle(speech.isSpeaking ? Theme.accent : Theme.textSecondary)
                }
            }

            if speech.isSpeaking {
                Button {
                    speech.stop()
                } label: {
                    Label("Stop", systemImage: "stop.fill")
                        .font(.caption.bold())
                        .foregroundStyle(Theme.danger)
                        .padding(.horizontal, 12)
                        .padding(.vertical, 6)
                        .background(Theme.dangerSoft)
                        .clipShape(Capsule())
                }
            }
        }
        .darkCard()
    }

    // MARK: - Last heard

    private var lastHeardCard: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                DarkSectionHeader(title: "Last Heard")
                Spacer()
                Button("Clear") { voice.lastHeard = "" }
                    .font(.caption)
                    .foregroundStyle(Theme.textSecondary)
            }

            Text(voice.lastHeard.isEmpty ? "—" : "\"\(voice.lastHeard)\"")
                .font(.system(.subheadline, design: .monospaced))
                .foregroundStyle(voice.lastHeard.isEmpty ? Theme.textTertiary : Theme.accent)
                .frame(maxWidth: .infinity, alignment: .leading)
        }
        .darkCard()
    }

    // MARK: - Helper

    @ViewBuilder
    private func row<V: View>(_ label: String, @ViewBuilder value: () -> V) -> some View {
        HStack {
            Text(label)
                .font(.subheadline)
                .foregroundStyle(Theme.textSecondary)
            Spacer()
            value()
        }
    }
}
