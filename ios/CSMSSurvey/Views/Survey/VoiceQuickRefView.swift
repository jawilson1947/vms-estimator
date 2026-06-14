import SwiftUI

struct VoiceQuickRefView: View {
    @Environment(\.dismiss) private var dismiss

    // MARK: - Data model

    private struct Cmd {
        let say: String
        let responds: String
        let note: String?
        init(_ say: String, _ responds: String, note: String? = nil) {
            self.say = say; self.responds = responds; self.note = note
        }
    }

    private struct Section {
        let icon: String
        let title: String
        let subtitle: String
        let commands: [Cmd]
    }

    private let sections: [Section] = [
        Section(
            icon: "waveform.and.mic",
            title: "Voice Interview",
            subtitle: "Starts automatically — the app says \"Listening\"",
            commands: [
                Cmd("Area Name [value]",  "Sets the area name"),
                Cmd("Floor [value]",      "Sets the floor"),
                Cmd("Skip",               "Floor omitted"),
                Cmd("(just speak)",       "Anything else is added to Notes"),
                Cmd("Finish",             "Stops listening — then choose a save"),
                Cmd("Save",               "Saved. — commits & closes"),
                Cmd("Save and Next",      "Saved. Ready for the next location."),
                Cmd("Done",               "Done. — commits & closes"),
            ]
        ),
        Section(
            icon: "rectangle.and.pencil.and.ellipsis",
            title: "Add Location — Quick Commands",
            subtitle: "Field-by-field shortcut while the sheet is open",
            commands: [
                Cmd("\"Name\" → speak value",    "Say the area name / Name set to [val]"),
                Cmd("\"Floor\" → speak value",   "Say the floor / Floor [val]"),
                Cmd("\"Notes\" → speak value",   "Say your notes / Notes recorded"),
                Cmd("\"Photo\"",                 "Tap to capture a photo",            note: "★ tap"),
                Cmd("\"Save\"",                  "[Name] saved"),
                Cmd("\"Next\"",                  "[Name] saved. Ready for next."),
                Cmd("\"Exit\" / \"Cancel\"",     "Closing"),
            ]
        ),
        Section(
            icon: "map",
            title: "Survey Board",
            subtitle: "While on the main survey board",
            commands: [
                Cmd("\"Add location\" / \"New location\"", "Opening add location"),
            ]
        ),
        Section(
            icon: "doc.text.magnifyingglass",
            title: "Location Detail",
            subtitle: "While a location record is open",
            commands: [
                Cmd("\"Save\" / \"Mark surveyed\"", "[Name] marked as surveyed"),
                Cmd("\"Photo\"",                    "Tap to add a photo",         note: "★ tap"),
                Cmd("\"Close\" / \"Back\"",         "Closing"),
            ]
        ),
    ]

    // MARK: - Body

    var body: some View {
        NavigationStack {
            ZStack {
                Theme.background.ignoresSafeArea()
                ScrollView {
                    VStack(alignment: .leading, spacing: 20) {

                        // Tip banner
                        tipBanner(
                            icon: "★",
                            iconColor: .orange,
                            text: "Photo capture is the only step requiring a screen tap. Everything else is fully hands-free."
                        )

                        ForEach(sections.indices, id: \.self) { i in
                            sectionCard(sections[i])
                        }

                        // Timeout note
                        tipBanner(
                            icon: "⏱",
                            iconColor: Theme.textTertiary,
                            text: "Quick-command field prompts time out after 6 seconds. Say the field command again to retry. The narrative Voice Interview has no timeout — speak at your own pace."
                        )
                    }
                    .padding(16)
                }
            }
            .navigationTitle("Voice Commands")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Done") { dismiss() }
                        .foregroundStyle(Theme.accent)
                }
            }
        }
    }

    // MARK: - Section card

    @ViewBuilder
    private func sectionCard(_ section: Section) -> some View {
        VStack(alignment: .leading, spacing: 10) {

            // Header
            HStack(spacing: 8) {
                Image(systemName: section.icon)
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(Theme.accent)
                VStack(alignment: .leading, spacing: 1) {
                    Text(section.title)
                        .font(.caption.weight(.bold))
                        .foregroundStyle(Theme.textPrimary)
                        .textCase(.uppercase)
                        .tracking(0.6)
                    Text(section.subtitle)
                        .font(.caption2)
                        .foregroundStyle(Theme.textSecondary)
                }
            }

            // Table
            VStack(spacing: 0) {
                // Column headers
                HStack(spacing: 0) {
                    tableHeaderCell("You say")
                    tableHeaderCell("Device responds")
                }

                ForEach(section.commands.indices, id: \.self) { ci in
                    let cmd  = section.commands[ci]
                    let even = ci % 2 == 0

                    HStack(spacing: 0) {
                        // Say cell
                        HStack(spacing: 4) {
                            Text(cmd.say)
                                .font(.system(.caption, design: .monospaced))
                                .foregroundStyle(Theme.accent)
                            if let note = cmd.note {
                                Text(note)
                                    .font(.caption2.weight(.bold))
                                    .foregroundStyle(.orange)
                            }
                        }
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding(.horizontal, 10)
                        .padding(.vertical, 7)
                        .background(even ? Theme.surface : Theme.surfaceElevated)

                        // Responds cell
                        Text(cmd.responds)
                            .font(.caption)
                            .italic()
                            .foregroundStyle(Theme.success)
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .padding(.horizontal, 10)
                            .padding(.vertical, 7)
                            .background(even ? Theme.surface : Theme.surfaceElevated)
                    }

                    if ci < section.commands.count - 1 {
                        Divider().background(Theme.border.opacity(0.5))
                    }
                }
            }
            .clipShape(RoundedRectangle(cornerRadius: 10))
            .overlay(RoundedRectangle(cornerRadius: 10).stroke(Theme.border, lineWidth: 1))
        }
    }

    @ViewBuilder
    private func tableHeaderCell(_ label: String) -> some View {
        Text(label)
            .font(.caption.weight(.semibold))
            .foregroundStyle(.white)
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.horizontal, 10)
            .padding(.vertical, 6)
            .background(Theme.accent)
    }

    // MARK: - Tip banner

    @ViewBuilder
    private func tipBanner(icon: String, iconColor: Color, text: String) -> some View {
        HStack(alignment: .top, spacing: 8) {
            Text(icon)
                .font(.body)
                .foregroundStyle(iconColor)
            Text(text)
                .font(.caption)
                .foregroundStyle(Theme.textSecondary)
        }
        .padding(12)
        .background(Theme.surface)
        .clipShape(RoundedRectangle(cornerRadius: 10))
        .overlay(RoundedRectangle(cornerRadius: 10).stroke(Theme.border, lineWidth: 1))
    }
}
