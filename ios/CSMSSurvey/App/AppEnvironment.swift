import Foundation

/// Shared environment values injected at the top of the app.
struct AppEnvironment {

    /// The Next.js server base URL, assembled from API_BASE_SCHEME + API_BASE_HOST in Info.plist.
    /// Splitting across two keys avoids the xcconfig "//" comment-stripping bug.
    static var baseURL: URL {
        let info   = Bundle.main.infoDictionary
        let scheme = info?["API_BASE_SCHEME"] as? String ?? ""
        let host   = info?["API_BASE_HOST"]   as? String ?? ""
        let isValid = !scheme.isEmpty && !scheme.hasPrefix("$(")
                   && !host.isEmpty   && !host.hasPrefix("$(")
        if isValid, let url = URL(string: "\(scheme)://\(host)") {
            return url
        }
        // Fallback for Simulator when xcconfig is not yet configured
        return URL(string: "http://192.168.0.190:3000")!
    }

    /// Claude API key, read from Info.plist (set by xcconfig CLAUDE_API_KEY).
    /// Returns "" if the xcconfig substitution hasn't been configured yet
    /// (guards against the literal "$(CLAUDE_API_KEY)" placeholder shipping).
    static var claudeAPIKey: String {
        let raw = Bundle.main.infoDictionary?["CLAUDE_API_KEY"] as? String ?? ""
        guard !raw.isEmpty, !raw.hasPrefix("$(") else { return "" }
        return raw
    }

    /// Shared URLSession — carries cookies automatically after login.
    static let session: URLSession = {
        let config = URLSessionConfiguration.default
        config.httpCookieAcceptPolicy = .always
        config.httpShouldSetCookies   = true
        config.httpCookieStorage      = HTTPCookieStorage.shared
        return URLSession(configuration: config)
    }()
}
