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
        e.keyEncodingStrategy = .convertToSnakeCase
        return e
    }()

    // MARK: - Site list

    func fetchSitesList() async throws -> [SiteSummary] {
        try await get("/api/survey/sites-list")
    }

    // MARK: - Full site

    func fetchSite(_ id: Int) async throws -> SurveySite {
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
        } catch {
            throw APIError.decodingError(error.localizedDescription)
        }
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
