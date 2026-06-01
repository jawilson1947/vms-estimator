import SwiftUI
import AVFoundation

struct SpeechOutputTestPanel: View {
    @ObservedObject private var speech = SpeechOutputManager.shared
    @State private var customText   = ""
    @State private var rate: Float  = AVSpeechUtteranceDefaultSpeechRate * 1.15

    private let defaultRate = AVSpeechUtteranceDefaultSpeechRate * 1.15

    var body: some View {
        ZStack {
            Theme.background.ignoresSafeArea()
            ScrollView {
                VStack(spacing: 14) {
                    customCard
                    rateCard
                    catalogueCard
                }
                .padding(16)
            }
        }
        .navigationTitle("Speech Tester")
        .navigationBarTitleDisplayMode(.inline)
        .onDisappear {
            // Restore default rate when leaving
            speech.testRate = nil
            speech.stop()
        }
    }

    // MARK: - Custom phrase

    private var customCard: some View {
        VStack(alignment: .leading, spacing: 12) {
            DarkSectionHeader(title: "Custom Phrase")

            TextEditor(text: $customText)
                .frame(minHeight: 70)
                .foregroundStyle(Theme.textPrimary)
                .tint(Theme.accent)
                .padding(10)
                .background(Theme.surfaceElevated)
                .clipShape(RoundedRectangle(cornerRadius: 10))
                .overlay(RoundedRectangle(cornerRadius: 10).stroke(Theme.border))
                .scrollContentBackground(.hidden)

            speakStopRow(text: customText, disabled: customText.isEmpty)
        }
        .darkCard()
    }

    // MARK: - Rate slider

    private var rateCard: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                DarkSectionHeader(title: "Speech Rate")
                Spacer()
                Text(String(format: "%.2f×", rate / AVSpeechUtteranceDefaultSpeechRate))
                    .font(.caption.bold())
                    .foregroundStyle(Theme.accent)
            }

            Slider(value: $rate,
                   in: AVSpeechUtteranceMinimumSpeechRate...AVSpeechUtteranceMaximumSpeechRate,
                   step: 0.01)
                .tint(Theme.accent)
                .onChange(of: rate) { _, newRate in
                    speech.testRate = newRate
                }

            HStack {
                Text("Slow")
                    .font(.caption2)
                    .foregroundStyle(Theme.textTertiary)
                Spacer()
                Button("Reset") {
                    rate = defaultRate
                    speech.testRate = nil
                }
                .font(.caption)
                .foregroundStyle(Theme.textSecondary)
                Spacer()
                Text("Fast")
                    .font(.caption2)
                    .foregroundStyle(Theme.textTertiary)
            }
        }
        .darkCard()
    }

    // MARK: - Phrase catalogue

    private var catalogueCard: some View {
        VStack(alignment: .leading, spacing: 14) {
            DarkSectionHeader(title: "Phrase Catalogue")

            ForEach(VoiceTestPhrases.groups) { group in
                VStack(alignment: .leading, spacing: 8) {
                    Text(group.name.uppercased())
                        .font(.caption2.bold())
                        .foregroundStyle(Theme.textTertiary)
                        .tracking(0.6)

                    ForEach(group.phrases, id: \.self) { phrase in
                        HStack(spacing: 10) {
                            Text(phrase)
                                .font(.subheadline)
                                .foregroundStyle(Theme.textPrimary)
                                .frame(maxWidth: .infinity, alignment: .leading)

                            Button {
                                speech.speak(phrase)
                            } label: {
                                Image(systemName: "play.fill")
                                    .font(.caption.bold())
                                    .foregroundStyle(Theme.accent)
                                    .frame(width: 32, height: 32)
                                    .background(Theme.accentSoft)
                                    .clipShape(Circle())
                            }
                            .disabled(speech.isSpeaking)
                        }
                        .padding(.horizontal, 12)
                        .padding(.vertical, 8)
                        .background(Theme.surfaceElevated)
                        .clipShape(RoundedRectangle(cornerRadius: 8))
                        .overlay(RoundedRectangle(cornerRadius: 8).stroke(Theme.border))
                    }
                }
            }
        }
        .darkCard()
    }

    // MARK: - Reusable speak / stop row

    @ViewBuilder
    private func speakStopRow(text: String, disabled: Bool) -> some View {
        HStack(spacing: 10) {
            Button {
                speech.speak(text)
            } label: {
                Label(speech.isSpeaking ? "Speaking…" : "Speak", systemImage: "play.fill")
                    .font(.subheadline.bold())
                    .foregroundStyle(.white)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 11)
                    .background(
                        disabled || speech.isSpeaking
                            ? AnyShapeStyle(Theme.surfaceElevated)
                            : AnyShapeStyle(LinearGradient(
                                colors: [Theme.accent, Theme.accentDeep],
                                startPoint: .topLeading, endPoint: .bottomTrailing))
                    )
                    .clipShape(RoundedRectangle(cornerRadius: 10))
            }
            .disabled(disabled || speech.isSpeaking)

            if speech.isSpeaking {
                Button {
                    speech.stop()
                } label: {
                    Image(systemName: "stop.fill")
                        .font(.subheadline.bold())
                        .foregroundStyle(Theme.danger)
                        .frame(width: 44, height: 44)
                        .background(Theme.dangerSoft)
                        .clipShape(RoundedRectangle(cornerRadius: 10))
                }
            }
        }
    }
}
