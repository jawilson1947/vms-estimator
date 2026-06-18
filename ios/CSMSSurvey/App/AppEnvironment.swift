import Foundation

/// Shared environment values injected at the top of the app.
struct AppEnvironment {

    /// App + build numbers read from Info.plist, driven by MARKETING_VERSION /
    /// CURRENT_PROJECT_VERSION in project.yml (e.g. "v1.0 (1)").
    static var appVersion: String {
        let info  = Bundle.main.infoDictionary
        let short = info?["CFBundleShortVersionString"] as? String ?? "?"
        let build = info?["CFBundleVersion"]            as? String ?? "?"
        return "v\(short) (\(build))"
    }

    /// Short source marker — bump this whenever you ship a change you want to
    /// confirm is actually running on the device.
    static let buildStamp = "img413-fix-06-14"

    /// One-line version marker shown at the bottom of the home screen and
    /// printed at launch. If this doesn't match what you expect after a build,
    /// the binary is stale or Xcode is building a different checkout.
    static var versionLabel: String { "\(appVersion) · \(buildStamp)" }

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
