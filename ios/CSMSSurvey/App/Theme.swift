import SwiftUI

// MARK: - Color Palette
// Warm Professional — deep slate/charcoal with teal accent and cream text.

enum Theme {
    // Backgrounds — warm charcoal, not cool blue
    static let background       = Color(red: 0.09, green: 0.10, blue: 0.11)
    static let surface          = Color(red: 0.14, green: 0.15, blue: 0.17)
    static let surfaceElevated  = Color(red: 0.19, green: 0.21, blue: 0.23)

    // Accent — deep teal
    static let accent           = Color(red: 0.16, green: 0.58, blue: 0.54)   // #29948A
    static let accentDeep       = Color(red: 0.10, green: 0.44, blue: 0.40)   // #1A706A
    static let accentSoft       = Color(red: 0.16, green: 0.58, blue: 0.54).opacity(0.14)

    // Semantic
    static let success          = Color(red: 0.22, green: 0.74, blue: 0.50)   // softer green
    static let successSoft      = Color(red: 0.22, green: 0.74, blue: 0.50).opacity(0.14)
    static let warning          = Color(red: 0.92, green: 0.68, blue: 0.26)   // warm amber
    static let warningSoft      = Color(red: 0.92, green: 0.68, blue: 0.26).opacity(0.14)
    static let danger           = Color(red: 0.88, green: 0.34, blue: 0.34)
    static let dangerSoft       = Color(red: 0.88, green: 0.34, blue: 0.34).opacity(0.14)

    // Text — warm cream, not pure white
    static let textPrimary      = Color(red: 0.94, green: 0.93, blue: 0.90)
    static let textSecondary    = Color(red: 0.94, green: 0.93, blue: 0.90).opacity(0.52)
    static let textTertiary     = Color(red: 0.94, green: 0.93, blue: 0.90).opacity(0.26)

    // Borders — subtle warm dividers
    static let border           = Color(red: 0.94, green: 0.93, blue: 0.90).opacity(0.08)
    static let borderFocus      = Color(red: 0.16, green: 0.58, blue: 0.54).opacity(0.50)
}

// MARK: - Card Modifier

struct DarkCardModifier: ViewModifier {
    var padding: CGFloat
    func body(content: Content) -> some View {
        content
            .padding(padding)
            .background(Theme.surface)
            .clipShape(RoundedRectangle(cornerRadius: 16))
            .overlay(
                RoundedRectangle(cornerRadius: 16)
                    .stroke(Theme.border, lineWidth: 1)
            )
    }
}

extension View {
    func darkCard(padding: CGFloat = 18) -> some View {
        modifier(DarkCardModifier(padding: padding))
    }
}

// MARK: - Text Field Modifier

struct DarkFieldModifier: ViewModifier {
    func body(content: Content) -> some View {
        content
            .foregroundStyle(Theme.textPrimary)
            .tint(Theme.accent)
            .padding(.horizontal, 14)
            .padding(.vertical, 12)
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
            .font(.caption.weight(.semibold))
            .foregroundStyle(Theme.textSecondary)
            .tracking(1.0)
    }
}

// MARK: - Status Badge

struct StatusBadge: View {
    let label: String
    let icon:  String
    let color: Color

    var body: some View {
        Label(label, systemImage: icon)
            .font(.caption.weight(.semibold))
            .foregroundStyle(color)
            .padding(.horizontal, 10)
            .padding(.vertical, 5)
            .background(color.opacity(0.12))
            .clipShape(Capsule())
            .overlay(Capsule().stroke(color.opacity(0.22), lineWidth: 1))
    }
}

// MARK: - Primary Button Style

struct TealButtonStyle: ButtonStyle {
    var isLoading: Bool = false
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.subheadline.weight(.semibold))
            .foregroundStyle(.white)
            .frame(maxWidth: .infinity)
            .padding(.vertical, 14)
            .background(
                RoundedRectangle(cornerRadius: 12)
                    .fill(configuration.isPressed
                          ? Theme.accentDeep
                          : Theme.accent)
            )
            .opacity(isLoading ? 0.7 : 1.0)
            .animation(.easeInOut(duration: 0.12), value: configuration.isPressed)
    }
}

extension View {
    func tealButtonStyle(isLoading: Bool = false) -> some View {
        buttonStyle(TealButtonStyle(isLoading: isLoading))
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

    private var ringColor: Color     { isWaiting ? Theme.warning : Theme.accent }
    private var iconBackground: Color {
        if !voice.enabled      { return Theme.surface }
        if isWaiting           { return Theme.warningSoft }
        if voice.isListening   { return Theme.accentSoft }
        return Theme.accentSoft
    }
    private var iconForeground: Color {
        if !voice.enabled      { return Theme.textTertiary }
        if isWaiting           { return Theme.warning }
        if voice.isListening   { return Theme.accent }
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
        if voice.isListening   { return Theme.accent }
        return Theme.accent
    }
    private var pillBackground: Color {
        if !voice.enabled      { return Theme.surface }
        if isWaiting           { return Theme.warningSoft }
        if voice.isListening   { return Theme.accentSoft }
        return Theme.accentSoft
    }
    private var pillBorder: Color {
        if !voice.enabled      { return Theme.border }
        if isWaiting           { return Theme.warning.opacity(0.35) }
        if voice.isListening   { return Theme.accent.opacity(0.40) }
        return Theme.accent.opacity(0.28)
    }
    private var shadowColor: Color {
        if !voice.enabled      { return .clear }
        if voice.isListening   { return Theme.accent.opacity(0.22) }
        return Theme.accent.opacity(0.12)
    }
}
