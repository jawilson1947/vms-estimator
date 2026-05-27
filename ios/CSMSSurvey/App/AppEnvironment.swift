import Foundation

/// Shared environment values injected at the top of the app.
struct AppEnvironment {

    /// The Next.js server base URL, read from Info.plist (set by xcconfig).
    static var baseURL: URL {
        guard
            let raw = Bundle.main.infoDictionary?["API_BASE_URL"] as? String,
            !raw.isEmpty,
            !raw.hasPrefix("$("),          // catches un-substituted xcconfig placeholder
            let url = URL(string: raw)
        else {
            // Fallback for Simulator when xcconfig is not yet configured
            return URL(string: "http://localhost:3000")!
        }
        return url
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
