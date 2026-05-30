import XCTest
@testable import CSMSSurvey

/// Unit tests for VoiceCommandManager.handle(text:) and registration lifecycle.
///
/// These tests bypass the audio engine entirely — they call simulateInput() / handle(text:)
/// directly, so no microphone permission is required.
@MainActor
final class VoiceCommandManagerTests: XCTestCase {

    private var vm: VoiceCommandManager!

    override func setUp() async throws {
        // Use a fresh shared instance state; unregister any lingering registrations.
        vm = VoiceCommandManager.shared
        vm.unregister(id: "_test")
    }

    override func tearDown() async throws {
        vm.unregister(id: "_test")
    }

    // MARK: - Exact keyword match

    func testExactKeywordMatch() {
        var fired = false
        vm.register(id: "_test", commands: [
            VoiceCommand(keywords: ["save"]) { _ in fired = true }
        ])

        vm.handle(text: "save")

        XCTAssertTrue(fired, "Exact keyword should trigger the command")
    }

    // MARK: - Prefix match with remainder

    func testPrefixMatchPassesRemainder() {
        var captured = ""
        vm.register(id: "_test", commands: [
            VoiceCommand(keywords: ["name"]) { captured = $0 }
        ])

        vm.handle(text: "name server room")

        XCTAssertEqual(captured, "server room",
                       "Remainder after keyword+space should be passed to action")
    }

    // MARK: - No match

    func testNoMatchDoesNothing() {
        var fired = false
        vm.register(id: "_test", commands: [
            VoiceCommand(keywords: ["save"]) { _ in fired = true }
        ])

        vm.handle(text: "unrecognised phrase xyz")

        XCTAssertFalse(fired, "Unrecognised phrase should not fire any command")
    }

    // MARK: - waitForValue consumed by next input

    func testWaitForValueConsumedByInput() {
        var captured = ""
        vm.waitForValue("floor") { captured = $0 }

        // The next spoken phrase — even if it matches a keyword — should be treated as a value.
        vm.handle(text: "second floor")

        XCTAssertEqual(captured, "second floor",
                       "Input while in waitingForValue should be delivered to the callback")
        XCTAssertEqual(vm.mode, .idle,
                       "Mode should return to idle after value is consumed")
        XCTAssertNil(vm.activeField,
                     "activeField should be cleared after value is consumed")
    }

    // MARK: - waitForValue clears mode & field

    func testWaitForValueClearsStateAfterCapture() {
        vm.waitForValue("notes") { _ in }

        XCTAssertEqual(vm.mode, .waitingForValue)
        XCTAssertEqual(vm.activeField, "notes")

        vm.handle(text: "some notes text")

        XCTAssertEqual(vm.mode, .idle)
        XCTAssertNil(vm.activeField)
    }

    // MARK: - Unregister removes commands

    func testUnregisterPreventsCommandFiring() {
        var fired = false
        vm.register(id: "_test", commands: [
            VoiceCommand(keywords: ["close"]) { _ in fired = true }
        ])
        vm.unregister(id: "_test")

        vm.handle(text: "close")

        XCTAssertFalse(fired, "Command should not fire after its context is unregistered")
    }
}
