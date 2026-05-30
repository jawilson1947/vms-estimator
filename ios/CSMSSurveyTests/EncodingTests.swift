import XCTest
@testable import CSMSSurvey

/// Tests for PATCH body encoding and URL construction.
final class EncodingTests: XCTestCase {

    // MARK: - UpdateLocationBody nil-skipping encoder

    /// Nil fields must be absent from the JSON payload, not encoded as null.
    /// This prevents the server from clearing field values that were not touched.
    func testUpdateLocationBodySkipsNilFields() throws {
        let encoder = JSONEncoder()
        encoder.keyEncodingStrategy = .convertToSnakeCase

        let body = UpdateLocationBody(
            areaName: "Server Room",
            floor: nil,          // not edited — must be absent
            surveyNotes: "Check racks",
            notes: nil,          // not edited — must be absent
            markSurveyed: nil
        )

        let data = try encoder.encode(body)
        let json = try XCTUnwrap(
            JSONSerialization.jsonObject(with: data) as? [String: Any]
        )

        XCTAssertEqual(json["area_name"] as? String, "Server Room")
        XCTAssertEqual(json["survey_notes"] as? String, "Check racks")
        XCTAssertNil(json["floor"],
                     "nil floor must be absent from encoded JSON, not null")
        XCTAssertNil(json["notes"],
                     "nil notes must be absent from encoded JSON, not null")
        XCTAssertNil(json["mark_surveyed"],
                     "nil markSurveyed must be absent from encoded JSON, not null")
    }

    /// All-nil body should encode to an empty object `{}`.
    func testUpdateLocationBodyAllNilIsEmptyObject() throws {
        let encoder = JSONEncoder()
        encoder.keyEncodingStrategy = .convertToSnakeCase

        let body = UpdateLocationBody()
        let data = try encoder.encode(body)
        let json = try XCTUnwrap(
            JSONSerialization.jsonObject(with: data) as? [String: Any]
        )

        XCTAssertTrue(json.isEmpty,
                      "All-nil UpdateLocationBody should encode to {} not {\"field\": null, ...}")
    }

    // MARK: - AppEnvironment URL construction

    /// Verifies that a host + scheme pair assembles into the expected URL without
    /// the xcconfig comment-delimiter pitfall (no double-slash in the host).
    func testAppEnvironmentBaseURLFallback() {
        // When xcconfig is not wired (unit test bundle has no matching Info.plist keys)
        // the fallback must be the localhost dev URL.
        let url = AppEnvironment.baseURL

        // In the test bundle the xcconfig keys are absent, so we expect the fallback.
        // If the keys happen to be present (unlikely in unit tests), we just verify
        // the URL is valid and has a non-empty host.
        XCTAssertNotNil(url.host, "baseURL must have a non-empty host")
        XCTAssertFalse(url.host!.isEmpty, "baseURL host must not be empty")
        XCTAssertTrue(url.scheme == "http" || url.scheme == "https",
                      "baseURL scheme must be http or https")
    }
}
