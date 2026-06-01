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
        Group(name: "Voice Interview — Prompts", phrases: [
            "Which building? The options are: Main Building; Annex; Warehouse.",
            "What is the area name?",
            "What floor is this on? Say skip to leave blank.",
            "Any survey notes? Say skip to leave blank.",
            "Do you need to add photos for this location? Say yes or no.",
            "Great, you can add photos after saving.",
            "Please say yes or no.",
        ]),
        Group(name: "Voice Interview — Confirmations", phrases: [
            "I heard Server Room — correct?",
            "I heard Main Building — correct?",
            "I heard Floor 2 — correct?",
            "Okay, let's try again.",
        ]),
        Group(name: "Voice Interview — Review", phrases: [
            "Here's what I have. Building: Main Building. Area Name: Server Room. Floor: 2. Survey Notes: skipped. Say save, save and next, or cancel.",
            "Say save, save and next, or cancel.",
        ]),
        Group(name: "Voice Interview — Errors", phrases: [
            "Microphone failed to start. Please try again.",
            "Microphone not ready. Please try again.",
        ]),
        Group(name: "System", phrases: [
            "Timed out. Try again.",
        ]),
    ]

    /// Flat list of all phrases across all groups.
    static var all: [String] { groups.flatMap(\.phrases) }
}
