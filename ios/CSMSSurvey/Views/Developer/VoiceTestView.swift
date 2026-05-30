import SwiftUI

struct VoiceTestView: View {
    var body: some View {
        ZStack {
            Theme.background.ignoresSafeArea()
            List {
                // Banner
                Section {
                    HStack(alignment: .top, spacing: 10) {
                        Image(systemName: "wrench.and.screwdriver.fill")
                            .foregroundStyle(Theme.warning)
                            .font(.title3)
                        VStack(alignment: .leading, spacing: 3) {
                            Text("Developer Tools")
                                .font(.subheadline.bold())
                                .foregroundStyle(Theme.textPrimary)
                            Text("Test and inspect the voice command and speech synthesis systems.")
                                .font(.caption)
                                .foregroundStyle(Theme.textSecondary)
                        }
                    }
                    .padding(.vertical, 4)
                    .listRowBackground(
                        RoundedRectangle(cornerRadius: 12)
                            .fill(Theme.warningSoft)
                            .overlay(RoundedRectangle(cornerRadius: 12).stroke(Theme.warning.opacity(0.2)))
                            .padding(.vertical, 3)
                    )
                }
                .listSectionSeparator(.hidden)

                // Tools
                Section {
                    toolRow(
                        title: "Live Debug",
                        subtitle: "Listener state, mode, last heard phrase",
                        icon: "dot.radiowaves.left.and.right",
                        color: Theme.accent,
                        destination: VoiceDebugPanel()
                    )
                    toolRow(
                        title: "Command Tester",
                        subtitle: "Fire or inject commands, browse registered keywords",
                        icon: "mic.badge.plus",
                        color: Theme.success,
                        destination: VoiceCommandTestPanel()
                    )
                    toolRow(
                        title: "Speech Tester",
                        subtitle: "Audition all TTS phrases, adjust speech rate",
                        icon: "speaker.wave.3.fill",
                        color: Theme.warning,
                        destination: SpeechOutputTestPanel()
                    )
                }
                .listRowBackground(
                    RoundedRectangle(cornerRadius: 12)
                        .fill(Theme.surface)
                        .overlay(RoundedRectangle(cornerRadius: 12).stroke(Theme.border))
                        .padding(.vertical, 3)
                )
                .listRowSeparator(.hidden)
            }
            .listStyle(.plain)
            .scrollContentBackground(.hidden)
        }
        .navigationTitle("Developer Tools")
        .navigationBarTitleDisplayMode(.inline)
    }

    @ViewBuilder
    private func toolRow<D: View>(
        title: String,
        subtitle: String,
        icon: String,
        color: Color,
        destination: D
    ) -> some View {
        NavigationLink(destination: destination) {
            HStack(spacing: 14) {
                ZStack {
                    RoundedRectangle(cornerRadius: 10)
                        .fill(color.opacity(0.15))
                        .frame(width: 42, height: 42)
                    Image(systemName: icon)
                        .font(.system(size: 18))
                        .foregroundStyle(color)
                }
                VStack(alignment: .leading, spacing: 2) {
                    Text(title)
                        .font(.subheadline.bold())
                        .foregroundStyle(Theme.textPrimary)
                    Text(subtitle)
                        .font(.caption)
                        .foregroundStyle(Theme.textSecondary)
                }
                Spacer()
            }
            .padding(.vertical, 6)
        }
    }
}
