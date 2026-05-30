import Foundation

/// Static catalogue of every phrase the app can speak via SpeechOutputManager.
/// Used by SpeechOutputTestPanel to let developers audition all TTS output.
enum VoiceTestPhrases {

    struct Group: Identifiable {
        let id   = UUID()
        let name: String
        let phrases: [String]
    }

    static let groups: [Group] = [
        Group(name: "Survey Board", phrases: [
            "Opening add location",
        ]),
        Group(name: "Add Location", phrases: [
            "Say the area name",
            "Name set to Server Room",
            "Say the floor",
            "Floor 2",
            "Say your notes",
            "Notes recorded",
            "Tap to capture a photo",
            "Photo limit reached",
            "Server Room saved.",
            "Server Room saved. Ready for next location.",
            "Please say a name first",
            "Closing",
        ]),
        Group(name: "Location Detail", phrases: [
            "Say the area name",
            "Name set to Server Room",
            "Say the floor",
            "Floor 2",
            "Say your notes",
            "Notes recorded",
            "Server Room marked as surveyed",
            "Changes saved",
            "Photo added. 1 of 5.",
            "Photo added. 5 of 5.",
            "Photo limit reached",
            "Tap to add a photo",
            "Closing",
        ]),
        Group(name: "System", phrases: [
            "Timed out. Try again.",
        ]),
    ]

    /// Flat list of all phrases across all groups.
    static var all: [String] { groups.flatMap(\.phrases) }
}
