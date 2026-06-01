import SwiftUI

// MARK: - Main overlay

struct VoiceInterviewView: View {

    @ObservedObject var manager: VoiceInterviewManager
    let onCancel: () -> Void

    var body: some View {
        ZStack {
            // Rich warm charcoal with subtle teal tint
            Theme.background
                .overlay(
                    LinearGradient(
                        colors: [Theme.accentDeep.opacity(0.08), Color.clear],
                        startPoint: .topLeading, endPoint: .bottomTrailing
                    )
                )
                .ignoresSafeArea()

            VStack(spacing: 0) {
                // Navigation bar
                HStack {
                    HStack(spacing: 8) {
                        Image(systemName: "waveform.and.mic")
                            .font(.system(size: 14, weight: .semibold))
                            .foregroundStyle(Theme.accent)
                        Text("Voice Interview")
                            .font(.headline)
                            .foregroundStyle(Theme.textPrimary)
                    }
                    Spacer()
                    Button(action: {
                        manager.stop()
                        onCancel()
                    }) {
                        Image(systemName: "xmark.circle.fill")
                            .font(.title2)
                            .foregroundStyle(Theme.textTertiary)
                    }
                }
                .padding(.horizontal, 22)
                .padding(.top, 22)
                .padding(.bottom, 16)

                Divider()
                    .background(Theme.border)

                Spacer()

                // State-driven content
                stateView
                    .padding(.horizontal, 28)

                Spacer()

                // Collected values summary
                if !manager.collectedValues.isEmpty {
                    collectedValuesPanel
                        .padding(.horizontal, 20)
                        .padding(.bottom, 20)
                }

                // Debug error banner — shows the raw API/parse error
                if let err = manager.lastAPIError {
                    Text(err)
                        .font(.caption2)
                        .foregroundStyle(Theme.danger.opacity(0.85))
                        .multilineTextAlignment(.center)
                        .padding(.horizontal, 20)
                        .padding(.bottom, 12)
                }
            }
        }
    }

    // MARK: - State view

    @ViewBuilder
    private var stateView: some View {
        switch manager.state {

        case .idle:
            EmptyView()

        case .prompting(let field):
            VStack(spacing: 18) {
                fieldBadge(field)
                ProgressView()
                    .tint(Theme.accent)
                    .scaleEffect(1.4)
                Text("Speaking…")
                    .font(.subheadline)
                    .foregroundStyle(Theme.textSecondary)
            }

        case .listening(let field):
            VStack(spacing: 22) {
                fieldBadge(field)
                PulsingMicView()
                Text("Listening…")
                    .font(.title3.weight(.medium))
                    .foregroundStyle(Theme.textPrimary)
            }

        case .processing(let field):
            VStack(spacing: 18) {
                fieldBadge(field)
                if !manager.lastTranscription.isEmpty {
                    Text("\"\(manager.lastTranscription)\"")
                        .font(.body)
                        .foregroundStyle(Theme.textSecondary)
                        .multilineTextAlignment(.center)
                        .italic()
                        .padding(.horizontal, 8)
                }
                ProgressView()
                    .tint(Theme.accent)
                    .scaleEffect(1.4)
                Text("Checking with Claude…")
                    .font(.subheadline)
                    .foregroundStyle(Theme.textSecondary)
            }

        case .confirming(let field, _, let phrase):
            VStack(spacing: 22) {
                fieldBadge(field)
                Text(phrase)
                    .font(.title3.weight(.medium))
                    .foregroundStyle(Theme.textPrimary)
                    .multilineTextAlignment(.center)
                if manager.isListening {
                    PulsingMicView()
                }
                Text("Say \"yes\" to confirm or \"no\" to try again")
                    .font(.caption)
                    .foregroundStyle(Theme.textSecondary)
            }

        case .reviewing:
            VStack(spacing: 18) {
                ZStack {
                    Circle()
                        .fill(Theme.successSoft)
                        .frame(width: 72, height: 72)
                    Image(systemName: "checkmark.circle.fill")
                        .font(.system(size: 40))
                        .foregroundStyle(Theme.success)
                }
                Text("Review")
                    .font(.title2.bold())
                    .foregroundStyle(Theme.textPrimary)
                if manager.isListening {
                    PulsingMicView()
                }
                Text("Say \"save\", \"save and next\", or \"cancel\"")
                    .font(.caption)
                    .foregroundStyle(Theme.textSecondary)
            }

        case .saving:
            VStack(spacing: 18) {
                ProgressView()
                    .tint(Theme.accent)
                    .scaleEffect(1.6)
                Text("Saving…")
                    .font(.title3.weight(.medium))
                    .foregroundStyle(Theme.textPrimary)
            }

        case .done:
            VStack(spacing: 18) {
                ZStack {
                    Circle()
                        .fill(Theme.successSoft)
                        .frame(width: 80, height: 80)
                    Image(systemName: "checkmark.circle.fill")
                        .font(.system(size: 44))
                        .foregroundStyle(Theme.success)
                }
                Text("Done!")
                    .font(.title2.bold())
                    .foregroundStyle(Theme.textPrimary)
            }

        case .failed(let msg):
            VStack(spacing: 22) {
                ZStack {
                    Circle()
                        .fill(Theme.dangerSoft)
                        .frame(width: 72, height: 72)
                    Image(systemName: "exclamationmark.triangle.fill")
                        .font(.system(size: 36))
                        .foregroundStyle(Theme.danger)
                }
                Text(msg)
                    .font(.body)
                    .foregroundStyle(Theme.textPrimary)
                    .multilineTextAlignment(.center)
                Button("Close") {
                    manager.stop()
                    onCancel()
                }
                .foregroundStyle(Theme.accent)
                .font(.subheadline.weight(.semibold))
            }
        }
    }

    // MARK: - Collected values panel

    private var collectedValuesPanel: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("Collected so far")
                .font(.caption2.weight(.semibold))
                .foregroundStyle(Theme.textTertiary)
                .textCase(.uppercase)
                .tracking(0.8)
                .padding(.bottom, 2)

            ForEach(orderedCollected, id: \.0) { key, value in
                HStack {
                    Text(labelFor(key))
                        .font(.caption)
                        .foregroundStyle(Theme.textSecondary)
                    Spacer()
                    Text(value)
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(Theme.textPrimary)
                }
            }
        }
        .padding(16)
        .background(Theme.surface)
        .clipShape(RoundedRectangle(cornerRadius: 14))
        .overlay(RoundedRectangle(cornerRadius: 14).stroke(Theme.border, lineWidth: 1))
    }

    /// Returns collected values in field definition order
    private var orderedCollected: [(String, String)] {
        let order = ["building", "areaName", "floor", "surveyNotes"]
        return order.compactMap { key in
            guard let val = manager.collectedValues[key] else { return nil }
            return (key, val)
        }
    }

    private func labelFor(_ key: String) -> String {
        switch key {
        case "building":    return "Building"
        case "areaName":    return "Area Name"
        case "floor":       return "Floor"
        case "surveyNotes": return "Survey Notes"
        default:            return key
        }
    }

    // MARK: - Helpers

    @ViewBuilder
    private func fieldBadge(_ field: String) -> some View {
        Text(field.uppercased())
            .font(.caption.weight(.semibold))
            .foregroundStyle(Theme.accent)
            .tracking(1.4)
            .padding(.horizontal, 12)
            .padding(.vertical, 5)
            .background(Theme.accentSoft)
            .clipShape(Capsule())
            .overlay(Capsule().stroke(Theme.accent.opacity(0.25), lineWidth: 1))
    }
}

// MARK: - Pulsing mic indicator

struct PulsingMicView: View {

    @State private var pulse = false

    var body: some View {
        ZStack {
            Circle()
                .fill(Theme.accentSoft)
                .frame(width: 88, height: 88)
                .scaleEffect(pulse ? 1.35 : 1.0)
                .animation(.easeInOut(duration: 0.85).repeatForever(autoreverses: true),
                           value: pulse)

            Circle()
                .fill(Theme.accent.opacity(0.08))
                .frame(width: 110, height: 110)
                .scaleEffect(pulse ? 1.2 : 0.9)
                .animation(.easeInOut(duration: 0.85).repeatForever(autoreverses: true).delay(0.15),
                           value: pulse)

            Image(systemName: "mic.fill")
                .font(.system(size: 32))
                .foregroundStyle(Theme.accent)
        }
        .onAppear { pulse = true }
    }
}
