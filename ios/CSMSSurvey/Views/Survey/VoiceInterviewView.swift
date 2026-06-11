import SwiftUI

// MARK: - Main overlay

struct VoiceInterviewView: View {

    @ObservedObject var manager: VoiceInterviewManager
    let onCancel: () -> Void

    @State private var showHelp = false

    var body: some View {
        ZStack {
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
                    HStack(spacing: 14) {
                        Button { showHelp = true } label: {
                            Image(systemName: "questionmark.circle")
                                .font(.title3)
                                .foregroundStyle(Theme.textSecondary)
                        }
                        Button(action: {
                            manager.stop()
                            onCancel()
                        }) {
                            Image(systemName: "xmark.circle.fill")
                                .font(.title2)
                                .foregroundStyle(Theme.textTertiary)
                        }
                    }
                }
                .padding(.horizontal, 22)
                .padding(.top, 22)
                .padding(.bottom, 16)

                Divider().background(Theme.border)

                ScrollView {

                    VStack(spacing: 20) {

                        // ── Live form fields ──────────────────────────────
                        liveFieldsPanel
                            .padding(.horizontal, 20)
                            .padding(.top, 20)

                        // ── Mic / state indicator ─────────────────────────
                        micStatusSection
                            .padding(.horizontal, 20)

                        // ── Command reference ─────────────────────────────
                        commandHints
                            .padding(.horizontal, 20)
                            .padding(.bottom, 20)
                    }
                }

                Divider().background(Theme.border)

                // ── Done button ───────────────────────────────────────────
                Button {
                    manager.doneButtonTapped()
                } label: {
                    Label("Done", systemImage: "checkmark.circle.fill")
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(.white)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 16)
                        .background(manager.areaName.isEmpty ? Theme.accent.opacity(0.35) : Theme.accent)
                        .clipShape(RoundedRectangle(cornerRadius: 14))
                }
                .disabled(manager.areaName.isEmpty)
                .padding(.horizontal, 20)
                .padding(.vertical, 16)
            }
        }
        .sheet(isPresented: $showHelp) { VoiceQuickRefView() }
    }

    // MARK: - Live fields panel

    private var liveFieldsPanel: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text("SURVEY FIELDS")
                .font(.caption2.weight(.semibold))
                .foregroundStyle(Theme.textTertiary)
                .tracking(0.8)
                .padding(.bottom, 6)

            fieldRow(label: "Area Name",
                     value: manager.areaName,
                     fieldKey: "areaName",
                     required: true)

            Divider().background(Theme.border.opacity(0.5))

            fieldRow(label: "Floor",
                     value: manager.floor,
                     fieldKey: "floor",
                     required: false)

            Divider().background(Theme.border.opacity(0.5))

            fieldRow(label: "Notes",
                     value: manager.surveyNotes,
                     fieldKey: "surveyNotes",
                     required: false)
        }
        .padding(16)
        .background(Theme.surface)
        .clipShape(RoundedRectangle(cornerRadius: 14))
        .overlay(RoundedRectangle(cornerRadius: 14).stroke(Theme.border, lineWidth: 1))
    }

    @ViewBuilder
    private func fieldRow(label: String, value: String,
                          fieldKey: String, required: Bool) -> some View {
        let isActive = manager.activeField == fieldKey
        HStack(alignment: .top, spacing: 12) {
            VStack(alignment: .leading, spacing: 2) {
                HStack(spacing: 4) {
                    Text(label)
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(isActive ? Theme.accent : Theme.textSecondary)
                    if required {
                        Text("*")
                            .font(.caption.weight(.bold))
                            .foregroundStyle(Theme.danger)
                    }
                }
                Text(value.isEmpty ? (required ? "required" : "optional") : value)
                    .font(.subheadline)
                    .foregroundStyle(
                        value.isEmpty ? Theme.textTertiary.opacity(0.6) : Theme.textPrimary
                    )
                    .italic(value.isEmpty)
                    .animation(.easeInOut(duration: 0.2), value: value)
            }
            Spacer()
            if isActive {
                Image(systemName: "mic.fill")
                    .font(.caption)
                    .foregroundStyle(Theme.accent)
            }
        }
        .padding(.vertical, 8)
        .background(isActive ? Theme.accent.opacity(0.05) : Color.clear)
        .clipShape(RoundedRectangle(cornerRadius: 8))
        .animation(.easeInOut(duration: 0.2), value: isActive)
    }

    // MARK: - Mic status

    @ViewBuilder
    private var micStatusSection: some View {
        switch manager.state {

        case .idle:
            VStack(spacing: 12) {
                PulsingMicView(active: false)
                Text("Say "Begin Survey" to start")
                    .font(.subheadline)
                    .foregroundStyle(Theme.textSecondary)
            }

        case .active:
            VStack(spacing: 12) {
                PulsingMicView(active: manager.isListening)
                Text(manager.isListening ? "Listening…" : "Ready")
                    .font(.subheadline.weight(.medium))
                    .foregroundStyle(manager.isListening ? Theme.accent : Theme.textSecondary)
                    .animation(.easeInOut, value: manager.isListening)
            }

        case .saving:
            VStack(spacing: 12) {
                ProgressView()
                    .tint(Theme.accent)
                    .scaleEffect(1.4)
                Text("Saving…")
                    .font(.subheadline)
                    .foregroundStyle(Theme.textSecondary)
            }

        case .done:
            VStack(spacing: 12) {
                ZStack {
                    Circle()
                        .fill(Theme.successSoft)
                        .frame(width: 72, height: 72)
                    Image(systemName: "checkmark.circle.fill")
                        .font(.system(size: 40))
                        .foregroundStyle(Theme.success)
                }
                Text("Interview complete")
                    .font(.subheadline.weight(.medium))
                    .foregroundStyle(Theme.textPrimary)
            }
        }
    }

    // MARK: - Command hints

    private var commandHints: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text("VOICE COMMANDS")
                .font(.caption2.weight(.semibold))
                .foregroundStyle(Theme.textTertiary)
                .tracking(0.8)
                .padding(.bottom, 4)

            commandRow(command: "Area Name = [value]",  description: "Set area name")
            commandRow(command: "Floor = [value]",       description: "Set floor")
            commandRow(command: "Skip",                  description: "Omit floor")
            commandRow(command: "Notes = [value]",       description: "Add notes")
            commandRow(command: "Save and Next",         description: "Save, start next")
            commandRow(command: "Finish",                description: "End interview")
            commandRow(command: "Review Survey",         description: "Clear and restart")
        }
        .padding(16)
        .background(Theme.surface)
        .clipShape(RoundedRectangle(cornerRadius: 14))
        .overlay(RoundedRectangle(cornerRadius: 14).stroke(Theme.border, lineWidth: 1))
    }

    private func commandRow(command: String, description: String) -> some View {
        HStack {
            Text(command)
                .font(.caption.weight(.semibold))
                .foregroundStyle(Theme.accent)
            Spacer()
            Text(description)
                .font(.caption)
                .foregroundStyle(Theme.textSecondary)
        }
        .padding(.vertical, 5)
    }
}

// MARK: - Pulsing mic indicator

struct PulsingMicView: View {

    var active: Bool = true
    @State private var pulse = false

    var body: some View {
        ZStack {
            if active {
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
                    .animation(
                        .easeInOut(duration: 0.85).repeatForever(autoreverses: true).delay(0.15),
                        value: pulse)
            } else {
                Circle()
                    .fill(Theme.surface)
                    .frame(width: 88, height: 88)
            }

            Image(systemName: active ? "mic.fill" : "mic.slash")
                .font(.system(size: 32))
                .foregroundStyle(active ? Theme.accent : Theme.textTertiary)
        }
        .onAppear { if active { pulse = true } }
        .onChange(of: active) { newVal in pulse = newVal }
    }
}
