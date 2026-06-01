import Foundation

// MARK: - Request / Response

struct InterviewParseRequest: Encodable {
    let fieldKey: String
    let fieldLabel: String
    let hint: String
    let transcription: String
    let options: [String]?
}

struct InterviewParseResponse: Decodable {
    let parsedValue: String
    let confirmPhrase: String
    let isLowConfidence: Bool
}

// MARK: - Client

/// Calls the Claude Messages API directly to parse a spoken field value.
/// The API key is read from Info.plist (injected via xcconfig CLAUDE_API_KEY).
@MainActor
final class ClaudeInterviewClient {

    static let shared = ClaudeInterviewClient()
    private init() {}

    private let endpoint = URL(string: "https://api.anthropic.com/v1/messages")!
    private let session  = AppEnvironment.session

    private let encoder: JSONEncoder = {
        let e = JSONEncoder()
        e.keyEncodingStrategy = .convertToSnakeCase
        return e
    }()

    private let decoder: JSONDecoder = {
        let d = JSONDecoder()
        d.keyDecodingStrategy = .convertFromSnakeCase
        return d
    }()

    // MARK: - Public

    func parse(_ request: InterviewParseRequest) async throws -> InterviewParseResponse {
        let apiKey = AppEnvironment.claudeAPIKey
        guard !apiKey.isEmpty else { throw InterviewError.missingAPIKey }

        let userContent = buildUserContent(request)
        let body = ClaudeRequest(
            model: "claude-haiku-4-5-20251001",
            maxTokens: 200,
            system: systemPrompt,
            messages: [ClaudeMessage(role: "user", content: userContent)]
        )

        var urlRequest = URLRequest(url: endpoint)
        urlRequest.httpMethod = "POST"
        urlRequest.setValue("application/json",  forHTTPHeaderField: "content-type")
        urlRequest.setValue("2023-06-01",         forHTTPHeaderField: "anthropic-version")
        urlRequest.setValue(apiKey, forHTTPHeaderField: "x-api-key")
        urlRequest.httpBody = try encoder.encode(body)

        let (data, response) = try await session.data(for: urlRequest)
        guard let http = response as? HTTPURLResponse else {
            throw InterviewError.apiError(status: 0, body: "No HTTP response")
        }
        guard (200...299).contains(http.statusCode) else {
            let body = String(data: data, encoding: .utf8) ?? "(unreadable)"
            throw InterviewError.apiError(status: http.statusCode, body: body)
        }

        let claudeResponse: ClaudeResponse
        do {
            claudeResponse = try decoder.decode(ClaudeResponse.self, from: data)
        } catch {
            let raw = String(data: data, encoding: .utf8) ?? "(unreadable)"
            throw InterviewError.decodeFailed(raw: raw)
        }
        guard let text = claudeResponse.content.first?.text else {
            throw InterviewError.emptyResponse
        }

        return try parseJSON(from: text)
    }

    // MARK: - Private helpers

    private func buildUserContent(_ req: InterviewParseRequest) -> String {
        var lines = [
            "Field: \(req.fieldLabel)",
            "Hint: \(req.hint)",
        ]
        if let options = req.options, !options.isEmpty {
            lines.append("Valid options: \(options.joined(separator: ", "))")
        }
        lines.append("Transcription: \"\(req.transcription)\"")
        return lines.joined(separator: "\n")
    }

    private func parseJSON(from text: String) throws -> InterviewParseResponse {
        // Claude may wrap JSON in markdown code fences — strip them
        var cleaned = text.trimmingCharacters(in: .whitespacesAndNewlines)
        if cleaned.hasPrefix("```") {
            cleaned = cleaned
                .components(separatedBy: "\n")
                .dropFirst()
                .dropLast()
                .joined(separator: "\n")
        }
        guard let data = cleaned.data(using: .utf8) else {
            throw InterviewError.badJSON(raw: cleaned)
        }
        do {
            return try decoder.decode(InterviewParseResponse.self, from: data)
        } catch {
            throw InterviewError.badJSON(raw: cleaned)
        }
    }

    // MARK: - Prompts

    private let systemPrompt = """
    You are a voice interview assistant for a CCTV survey iOS app. \
    Parse the user's spoken response for a specific form field, extract the intended value, \
    and generate a short friendly confirmation phrase.

    Always respond with valid JSON only — no extra text — in this exact format:
    {"parsed_value":"...","confirm_phrase":"...","is_low_confidence":false}

    Rules:
    - parsed_value: clean, normalised value to store (e.g. "Server Room", "2", "Ground Floor")
    - confirm_phrase: natural spoken confirmation under 12 words (e.g. "I heard Server Room — correct?")
    - is_low_confidence: true if the transcription was unclear or ambiguous
    - For option fields, match to the closest valid option by name
    - Capitalise area names and building names properly
    """
}

// MARK: - Claude API wire types

private struct ClaudeRequest: Encodable {
    let model: String
    let maxTokens: Int
    let system: String
    let messages: [ClaudeMessage]
}

private struct ClaudeMessage: Encodable {
    let role: String
    let content: String
}

private struct ClaudeResponse: Decodable {
    struct Block: Decodable { let text: String }
    let content: [Block]
}

// MARK: - Errors

enum InterviewError: LocalizedError {
    case missingAPIKey
    case apiError(status: Int, body: String)
    case decodeFailed(raw: String)
    case emptyResponse
    case badJSON(raw: String)

    var errorDescription: String? {
        switch self {
        case .missingAPIKey:
            return "Claude API key not configured."
        case .apiError(let status, let body):
            return "API error \(status): \(body.prefix(120))"
        case .decodeFailed(let raw):
            return "Response decode failed: \(raw.prefix(120))"
        case .emptyResponse:
            return "Claude returned an empty response."
        case .badJSON(let raw):
            return "JSON parse failed: \(raw.prefix(120))"
        }
    }
}
