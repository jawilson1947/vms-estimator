import SwiftUI

// MARK: - Color Palette

enum Theme {
    // Backgrounds
    static let background       = Color(red: 0.07, green: 0.09, blue: 0.12)
    static let surface          = Color(red: 0.12, green: 0.15, blue: 0.20)
    static let surfaceElevated  = Color(red: 0.17, green: 0.21, blue: 0.27)

    // Accent
    static let accent           = Color(red: 0.22, green: 0.50, blue: 0.98)
    static let accentDeep       = Color(red: 0.12, green: 0.36, blue: 0.88)
    static let accentSoft       = Color(red: 0.22, green: 0.50, blue: 0.98).opacity(0.15)

    // Semantic
    static let success          = Color(red: 0.18, green: 0.80, blue: 0.46)
    static let successSoft      = Color(red: 0.18, green: 0.80, blue: 0.46).opacity(0.15)
    static let warning          = Color(red: 1.00, green: 0.64, blue: 0.18)
    static let warningSoft      = Color(red: 1.00, green: 0.64, blue: 0.18).opacity(0.15)
    static let danger           = Color(red: 1.00, green: 0.32, blue: 0.32)
    static let dangerSoft       = Color(red: 1.00, green: 0.32, blue: 0.32).opacity(0.15)

    // Text
    static let textPrimary      = Color.white
    static let textSecondary    = Color.white.opacity(0.55)
    static let textTertiary     = Color.white.opacity(0.28)

    // Borders
    static let border           = Color.white.opacity(0.09)
    static let borderFocus      = Color(red: 0.22, green: 0.50, blue: 0.98).opacity(0.55)
}

// MARK: - Dark Card Modifier

struct DarkCardModifier: ViewModifier {
    var padding: CGFloat
    func body(content: Content) -> some View {
        content
            .padding(padding)
            .background(Theme.surface)
            .clipShape(RoundedRectangle(cornerRadius: 14))
            .overlay(
                RoundedRectangle(cornerRadius: 14)
                    .stroke(Theme.border, lineWidth: 1)
            )
    }
}

extension View {
    func darkCard(padding: CGFloat = 16) -> some View {
        modifier(DarkCardModifier(padding: padding))
    }
}

// MARK: - Dark Text Field Modifier

struct DarkFieldModifier: ViewModifier {
    func body(content: Content) -> some View {
        content
            .foregroundStyle(Theme.textPrimary)
            .tint(Theme.accent)
            .padding(.horizontal, 14)
            .padding(.vertical, 11)
            .background(Theme.surfaceElevated)
            .clipShape(RoundedRectangle(cornerRadius: 10))
            .overlay(
                RoundedRectangle(cornerRadius: 10)
                    .stroke(Theme.border, lineWidth: 1)
            )
    }
}

extension View {
    func darkField() -> some View {
        modifier(DarkFieldModifier())
    }
}

// MARK: - Section Header

struct DarkSectionHeader: View {
    let title: String
    var body: some View {
        Text(title.uppercased())
            .font(.caption.bold())
            .foregroundStyle(Theme.textSecondary)
            .tracking(0.8)
    }
}

// MARK: - Status Badge

struct StatusBadge: View {
    let label: String
    let icon:  String
    let color: Color

    var body: some View {
        Label(label, systemImage: icon)
            .font(.caption.bold())
            .foregroundStyle(color)
            .padding(.horizontal, 10)
            .padding(.vertical, 5)
            .background(color.opacity(0.15))
            .clipShape(Capsule())
            .overlay(Capsule().stroke(color.opacity(0.25), lineWidth: 1))
    }
}

// MARK: - Mic Button
//
// Tap-to-activate voice pill shown on all survey screens.
// Displays recognition state (off / listening / waiting for value) and
// toggles voice on/off when tapped.

struct MicButton: View {
    @StateObject private var voice = VoiceCommandManager.shared
    @State private var pulse = false

    var body: some View {
        Button { voice.setEnabled(!voice.enabled) } label: {
            HStack(spacing: 10) {
                micIcon
                statusText
            }
            .padding(.horizontal, 14)
            .padding(.vertical, 9)
            .background(Capsule().fill(pillBackground)
                .overlay(Capsule().stroke(pillBorder, lineWidth: 1)))
            .shadow(color: shadowColor, radius: 8, y: 3)
        }
        .buttonStyle(.plain)
        .onAppear  { pulse = voice.enabled && voice.isListening }
        .onChange(of: voice.isListening) { _, v in pulse = voice.enabled && v }
        .onChange(of: voice.enabled)     { _, e in pulse = e && voice.isListening }
    }

    // MARK: Sub-views (split out to avoid type-checker timeouts)

    @ViewBuilder private var micIcon: some View {
        ZStack {
            if voice.enabled && voice.isListening {
                Circle()
                    .stroke(ringColor.opacity(0.35), lineWidth: 2)
                    .frame(width: 34, height: 34)
                    .scaleEffect(pulse ? 1.55 : 1.0)
                    .opacity(pulse ? 0 : 1)
                    .animation(.easeOut(duration: 1.0).repeatForever(autoreverses: false),
                               value: pulse)
            }
            Circle()
                .fill(iconBackground)
                .frame(width: 34, height: 34)
            Image(systemName: voice.enabled ? "mic.fill" : "mic.slash.fill")
                .font(.system(size: 15, weight: .semibold))
                .foregroundStyle(iconForeground)
        }
    }

    @ViewBuilder private var statusText: some View {
        VStack(alignment: .leading, spacing: 1) {
            Text(headline)
                .font(.caption.bold())
                .foregroundStyle(headlineColor)
            Text(subline)
                .font(.caption2)
                .foregroundStyle(Theme.textTertiary)
        }
    }

    // MARK: State-driven colours

    private var isWaiting: Bool { voice.mode == .waitingForValue }

    private var ringColor: Color     { isWaiting ? Theme.warning : Theme.danger }
    private var iconBackground: Color {
        if !voice.enabled      { return Theme.surface }
        if isWaiting           { return Theme.warningSoft }
        if voice.isListening   { return Theme.danger.opacity(0.18) }
        return Theme.accentSoft
    }
    private var iconForeground: Color {
        if !voice.enabled      { return Theme.textTertiary }
        if isWaiting           { return Theme.warning }
        if voice.isListening   { return Theme.danger }
        return Theme.accent
    }
    private var headline: String {
        if !voice.enabled      { return "Voice Off" }
        if isWaiting           { return "\(voice.activeField ?? "Value")…" }
        if voice.isListening   { return "Listening…" }
        return "Voice On"
    }
    private var subline: String {
        if !voice.enabled      { return "Tap to enable" }
        if isWaiting           { return "Speak now" }
        if voice.isListening   { return "Say a command" }
        return "Waiting for mic"
    }
    private var headlineColor: Color {
        if !voice.enabled      { return Theme.textSecondary }
        if isWaiting           { return Theme.warning }
        if voice.isListening   { return Theme.danger }
        return Theme.accent
    }
    private var pillBackground: Color {
        if !voice.enabled      { return Theme.surface }
        if isWaiting           { return Theme.warningSoft }
        if voice.isListening   { return Theme.danger.opacity(0.10) }
        return Theme.accentSoft
    }
    private var pillBorder: Color {
        if !voice.enabled      { return Theme.border }
        if isWaiting           { return Theme.warning.opacity(0.35) }
        if voice.isListening   { return Theme.danger.opacity(0.35) }
        return Theme.accent.opacity(0.30)
    }
    private var shadowColor: Color {
        if !voice.enabled      { return .clear }
        if voice.isListening   { return Theme.danger.opacity(0.20) }
        return Theme.accent.opacity(0.15)
    }
}
