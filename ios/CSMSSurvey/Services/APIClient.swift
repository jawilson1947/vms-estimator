import Foundation

enum APIError: LocalizedError {
    case unauthorized
    case notFound
    case serverError(Int)
    case decodingError(String)
    case networkError(String)

    var errorDescription: String? {
        switch self {
        case .unauthorized:          return "Session expired. Please log in again."
        case .notFound:              return "Resource not found."
        case .serverError(let c):    return "Server error (\(c))."
        case .decodingError(let m):  return "Data error: \(m)"
        case .networkError(let m):   return "Network error: \(m)"
        }
    }
}

final class APIClient {

    static let shared = APIClient()

    private let base    = AppEnvironment.baseURL
    private let session = AppEnvironment.session

    private let decoder: JSONDecoder = {
        let d = JSONDecoder()
        d.keyDecodingStrategy = .convertFromSnakeCase
        return d
    }()

    private let encoder: JSONEncoder = {
        let e = JSONEncoder()
        // Server expects camelCase keys — use default (no conversion)
        return e
    }()

    // MARK: - Site list

    func fetchSitesList() async throws -> [SiteSummary] {
        try await get("/api/survey/sites-list")
    }

    // MARK: - Full site (building + project tree, no locations)

    func fetchSite(_ id: Int) async throws -> SurveySite {
        try await get("/api/survey/sites/\(id)")
    }

    // MARK: - Full project (with locations)

    func fetchProject(_ id: Int) async throws -> SurveyProject {
        try await get("/api/survey/\(id)")
    }

    // MARK: - Create location

    func createLocation(_ body: NewLocationBody) async throws -> SurveyLocation {
        try await post("/api/survey/locations", body: body)
    }

    // MARK: - Update location

    func updateLocation(_ id: Int, body: UpdateLocationBody) async throws -> SurveyLocation {
        try await patch("/api/survey/locations/\(id)", body: body)
    }

    // MARK: - Upload photo

    func uploadPhoto(locationId: Int, imageData: Data, mimeType: String) async throws -> SurveyPhoto {
        let path = "/api/survey/locations/\(locationId)/photos"
        let url  = base.appending(path: path)
        var req  = URLRequest(url: url)
        req.httpMethod = "POST"

        let boundary = "Boundary-\(UUID().uuidString)"
        req.setValue("multipart/form-data; boundary=\(boundary)", forHTTPHeaderField: "Content-Type")

        var body = Data()
        let ext = mimeType == "image/png" ? "png" : "jpg"
        body.appendString("--\(boundary)\r\n")
        body.appendString("Content-Disposition: form-data; name=\"photo\"; filename=\"photo.\(ext)\"\r\n")
        body.appendString("Content-Type: \(mimeType)\r\n\r\n")
        body.append(imageData)
        body.appendString("\r\n--\(boundary)--\r\n")
        req.httpBody = body

        return try await execute(req)
    }

    // MARK: - Delete photo

    func deletePhoto(locationId: Int, photoId: Int) async throws {
        let path = "/api/survey/locations/\(locationId)/photos/\(photoId)"
        try await delete(path)
    }

    // MARK: - Camera catalog

    func fetchCameras() async throws -> [CameraModel] {
        try await get("/api/survey/cameras")
    }

    // MARK: - Access methods catalog (access-control mode picker)

    /// Fetches the global `AccessMethod` list. The server response includes a
    /// `items` Bill-of-Materials sub-array used for Windows-side costing — the
    /// iOS `AccessMethod` decoder ignores that field, so we only pay decode
    /// cost for `id`, `name`, `grouping`, `sortOrder`.
    func fetchAccessMethods() async throws -> [AccessMethod] {
        try await get("/api/access-methods")
    }

    // MARK: - Assign / remove camera model on a location

    func assignCamera(locationId: Int, cameraModelId: Int) async throws -> SurveyLocation {
        let body = CameraAssignBody(cameraModelId: cameraModelId)
        return try await patch("/api/survey/locations/\(locationId)", body: body)
    }

    func removeCamera(locationId: Int) async throws -> SurveyLocation {
        let body = CameraRemoveBody(cameraModelId: nil)
        return try await patch("/api/survey/locations/\(locationId)", body: body)
    }

    // MARK: - Delete location

    func deleteLocation(_ id: Int) async throws {
        try await delete("/api/survey/locations/\(id)")
    }

    // MARK: - Private helpers

    private func get<T: Decodable>(_ path: String) async throws -> T {
        let req = URLRequest(url: base.appending(path: path))
        return try await execute(req)
    }

    private func post<B: Encodable, T: Decodable>(_ path: String, body: B) async throws -> T {
        var req = URLRequest(url: base.appending(path: path))
        req.httpMethod = "POST"
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.httpBody = try encoder.encode(body)
        return try await execute(req)
    }

    private func patch<B: Encodable, T: Decodable>(_ path: String, body: B) async throws -> T {
        var req = URLRequest(url: base.appending(path: path))
        req.httpMethod = "PATCH"
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.httpBody = try encoder.encode(body)
        return try await execute(req)
    }

    private func delete(_ path: String) async throws {
        var req = URLRequest(url: base.appending(path: path))
        req.httpMethod = "DELETE"
        let (_, response) = try await session.data(for: req)
        try checkStatus(response)
    }

    private func execute<T: Decodable>(_ req: URLRequest) async throws -> T {
        let (data, response): (Data, URLResponse)
        do {
            (data, response) = try await session.data(for: req)
        } catch {
            throw APIError.networkError(error.localizedDescription)
        }
        try checkStatus(response)
        do {
            return try decoder.decode(T.self, from: data)
        } catch let decodingError as DecodingError {
            // Default `error.localizedDescription` for a DecodingError is the
            // famously useless "The data couldn't be read because it is missing."
            // Format the codingPath + case so we can actually see which field
            // failed when the server response shape drifts. Also log the raw
            // response body to the Xcode console so the next decode failure can
            // be diagnosed without having to add prints by hand.
            let url = req.url?.absoluteString ?? "<no url>"
            let bodyPreview = Self.previewBody(data)
            print("[APIClient] Decode failed for \(url): \(Self.describe(decodingError))")
            print("[APIClient] Response body (\(data.count) bytes): \(bodyPreview)")
            throw APIError.decodingError(Self.describe(decodingError))
        } catch {
            throw APIError.decodingError(error.localizedDescription)
        }
    }

    /// Formats a `DecodingError` into a single line that names the failing
    /// case and the dotted codingPath. Surfaced through `APIError.decodingError`
    /// so it shows up in the in-app error banner ("Data error: …") instead of
    /// being lost to the system's stock localizedDescription.
    ///
    /// Every branch leads with `at '<path>'` so the codingPath is the first
    /// thing the reader sees, even when `context.debugDescription` is the
    /// Cocoa default ("The data couldn't be read because it is missing.").
    /// `.dataCorrupted` in particular falls through to that default when the
    /// payload is empty / non-JSON, which is what the survey-board error was
    /// previously displaying with no clue as to where it came from.
    static func describe(_ error: DecodingError) -> String {
        func path(_ context: DecodingError.Context, extra: CodingKey? = nil) -> String {
            let keys = context.codingPath + (extra.map { [$0] } ?? [])
            let joined = keys.map(\.stringValue).joined(separator: ".")
            return joined.isEmpty ? "<root>" : joined
        }
        func underlying(_ context: DecodingError.Context) -> String {
            guard let err = context.underlyingError else { return "" }
            return " (underlying: \(err.localizedDescription))"
        }
        switch error {
        case .keyNotFound(let key, let context):
            return "keyNotFound at '\(path(context, extra: key))' — \(context.debugDescription)\(underlying(context))"
        case .valueNotFound(let type, let context):
            return "valueNotFound at '\(path(context))': non-optional \(type) was null — \(context.debugDescription)\(underlying(context))"
        case .typeMismatch(let type, let context):
            return "typeMismatch at '\(path(context))': expected \(type) — \(context.debugDescription)\(underlying(context))"
        case .dataCorrupted(let context):
            return "dataCorrupted at '\(path(context))' — \(context.debugDescription)\(underlying(context))"
        @unknown default:
            return "unknown DecodingError case — \(error.localizedDescription)"
        }
    }

    /// Returns up to ~400 chars of the response body as a string for diagnostic
    /// console logs. Falls back to a hex prefix for non-UTF-8 payloads so empty
    /// / binary responses still leave a trace.
    private static func previewBody(_ data: Data) -> String {
        if data.isEmpty { return "<empty>" }
        if let s = String(data: data, encoding: .utf8) {
            return s.count > 400 ? String(s.prefix(400)) + "…" : s
        }
        let hex = data.prefix(64).map { String(format: "%02x", $0) }.joined()
        return "<\(data.count) bytes, hex prefix: \(hex)…>"
    }

    private func checkStatus(_ response: URLResponse) throws {
        guard let http = response as? HTTPURLResponse else { return }
        switch http.statusCode {
        case 200...299: break
        case 401:        throw APIError.unauthorized
        case 404:        throw APIError.notFound
        default:         throw APIError.serverError(http.statusCode)
        }
    }
}

// MARK: - Data helper

private extension Data {
    mutating func appendString(_ s: String) {
        if let d = s.data(using: .utf8) { append(d) }
    }
}

// MARK: - URL helper

extension URL {
    func appending(path: String) -> URL {
        appendingPathComponent(path)
    }
}
