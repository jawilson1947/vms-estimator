import SwiftUI

struct VoiceQuickRefView: View {
    @Environment(\.dismiss) private var dismiss

    private struct CommandRow { let say: String; let responds: String; let note: String? }
    private struct Section    { let title: String; let subtitle: String?; let commands: [CommandRow] }

    private let sections: [Section] = [
        Section(title: "Survey Board", subtitle: "Once inside a site", commands: [
            CommandRow(say: "\"Add location\" / \"New location\"", responds: "\"Opening add location\"", note: nil),
        ]),
        Section(title: "Add Location — Fields", subtitle: "While the Add Location sheet is open", commands: [
            CommandRow(say: "\"Name\" -> speak value",          responds: "\"Say the area name\" / \"Name set to [val]\"", note: nil),
            CommandRow(say: "\"Floor\" -> speak value",         responds: "\"Say the floor\" / \"Floor [val]\"",          note: nil),
            CommandRow(say: "\"Notes\" -> speak value",         responds: "\"Say your notes\" / \"Notes recorded\"",      note: nil),
            CommandRow(say: "\"Photo\"",                        responds: "\"Tap to capture a photo\"",                   note: "★ one tap"),
            CommandRow(say: "\"Save\"",                         responds: "\"[Name] saved\"",                             note: nil),
            CommandRow(say: "\"Next\"",                         responds: "\"[Name] saved. Ready for next.\"",            note: nil),
            CommandRow(say: "\"Exit\" / \"Cancel\" / \"Close\"",responds: "\"Closing\"",                                  note: nil),
        ]),
        Section(title: "Location Detail", subtitle: "While a location is open", commands: [
            CommandRow(say: "\"Save\" / \"Mark surveyed\"",     responds: "\"[Name] marked as surveyed\"",                note: nil),
            CommandRow(say: "\"Photo\"",                        responds: "\"Tap to add a photo\"",                       note: "★ one tap"),
            CommandRow(say: "\"Close\" / \"Back\" / \"Exit\"",  responds: "\"Closing\"",                                  note: nil),
        ]),
    ]

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 20) {
                    // Tip banner
                    HStack(alignment: .top, spacing: 8) {
                        Text("★").font(.body)
                        Text("**Photo capture** is the only step requiring a screen tap. Everything else is fully hands-free.")
                            .font(.caption)
                    }
                    .padding(12)
                    .background(Color.orange.opacity(0.1))
                    .overlay(RoundedRectangle(cornerRadius: 10).stroke(Color.orange.opacity(0.3)))
                    .clipShape(RoundedRectangle(cornerRadius: 10))

                    // Sections
                    ForEach(sections.indices, id: \.self) { si in
                        let section = sections[si]
                        VStack(alignment: .leading, spacing: 6) {
                            Text(section.title)
                                .font(.caption.bold())
                                .foregroundStyle(.blue)
                                .textCase(.uppercase)
                            if let sub = section.subtitle {
                                Text(sub)
                                    .font(.caption2)
                                    .foregroundStyle(.secondary)
                            }

                            VStack(spacing: 0) {
                                // Header row
                                HStack(spacing: 0) {
                                    Text("You say")
                                        .font(.caption.bold())
                                        .foregroundStyle(.white)
                                        .frame(maxWidth: .infinity, alignment: .leading)
                                        .padding(.horizontal, 10)
                                        .padding(.vertical, 6)
                                        .background(Color.blue)
                                    Text("Device responds")
                                        .font(.caption.bold())
                                        .foregroundStyle(.white)
                                        .frame(maxWidth: .infinity, alignment: .leading)
                                        .padding(.horizontal, 10)
                                        .padding(.vertical, 6)
                                        .background(Color.blue)
                                }

                                ForEach(section.commands.indices, id: \.self) { ci in
                                    let cmd  = section.commands[ci]
                                    let even = ci % 2 == 0
                                    HStack(spacing: 0) {
                                        HStack(spacing: 4) {
                                            Text(cmd.say)
                                                .font(.system(.caption, design: .monospaced))
                                                .foregroundStyle(.blue)
                                            if let note = cmd.note {
                                                Text(note)
                                                    .font(.caption2.bold())
                                                    .foregroundStyle(.orange)
                                            }
                                        }
                                        .frame(maxWidth: .infinity, alignment: .leading)
                                        .padding(.horizontal, 10)
                                        .padding(.vertical, 6)
                                        .background(even ? Color(.systemBackground) : Color(.secondarySystemBackground))

                                        Text(cmd.responds)
                                            .font(.caption)
                                            .italic()
                                            .foregroundStyle(.green)
                                            .frame(maxWidth: .infinity, alignment: .leading)
                                            .padding(.horizontal, 10)
                                            .padding(.vertical, 6)
                                            .background(even ? Color(.systemBackground) : Color(.secondarySystemBackground))
                                    }
                                    Divider()
                                }
                            }
                            .clipShape(RoundedRectangle(cornerRadius: 10))
                            .overlay(RoundedRectangle(cornerRadius: 10).stroke(Color(.systemGray4)))
                        }
                    }

                    // Timeout note
                    HStack(alignment: .top, spacing: 8) {
                        Text("⏱").font(.body)
                        Text("After a field prompt, you have **6 seconds** to speak the value. If missed, the device says *\"Timed out. Try again.\"* — repeat the field command to retry.")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                    .padding(12)
                    .background(Color(.secondarySystemBackground))
                    .clipShape(RoundedRectangle(cornerRadius: 10))
                }
                .padding()
            }
            .navigationTitle("Voice Commands")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Done") { dismiss() }
                }
            }
        }
    }
}
