import Foundation

enum AuthError: LocalizedError {
    case invalidCredentials
    case networkError(String)
    case csrfFailed

    var errorDescription: String? {
        switch self {
        case .invalidCredentials: return "Invalid email or password."
        case .networkError(let msg): return "Network error: \(msg)"
        case .csrfFailed: return "Could not reach the server. Check your connection."
        }
    }
}

@MainActor
final class AuthService: ObservableObject {

    @Published var isLoggedIn = false
    @Published var userEmail: String = ""

    private let base = AppEnvironment.baseURL
    private let session = AppEnvironment.session

    // MARK: - Login

    func login(email: String, password: String) async throws {
        // Step 1: Fetch CSRF token (required by NextAuth)
        let csrf = try await fetchCSRFToken()

        // Step 2: POST credentials
        var req = URLRequest(url: base.appending(path: "/api/auth/callback/credentials"))
        req.httpMethod = "POST"
        req.setValue("application/x-www-form-urlencoded", forHTTPHeaderField: "Content-Type")
        req.setValue(base.absoluteString, forHTTPHeaderField: "Origin")
        req.setValue(base.appending(path: "/login").absoluteString, forHTTPHeaderField: "Referer")

        let params: [String: String] = [
            "csrfToken":   csrf,
            "email":       email,
            "password":    password,
            "redirect":    "false",
            "callbackUrl": base.absoluteString,
            "json":        "true",
        ]
        req.httpBody = params
            .map { "\($0.key)=\($0.value.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? "")" }
            .joined(separator: "&")
            .data(using: .utf8)

        let (data, response) = try await session.data(for: req)

        guard let http = response as? HTTPURLResponse else {
            throw AuthError.networkError("No HTTP response")
        }

        // NextAuth returns 200 with a JSON body { url, error } when redirect=false
        if http.statusCode == 200 {
            if let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
               let error = json["error"] as? String, !error.isEmpty {
                throw AuthError.invalidCredentials
            }
            // Verify we actually have a session cookie
            if hasSesionCookie() {
                isLoggedIn = true
                userEmail  = email
                return
            }
        }

        // Fallback: some NextAuth configurations redirect on success (302)
        // URLSession follows it; if we land on a non-error URL, auth succeeded
        if http.statusCode == 200 || http.statusCode == 302 {
            if hasSesionCookie() {
                isLoggedIn = true
                userEmail  = email
                return
            }
        }

        throw AuthError.invalidCredentials
    }

    // MARK: - Logout

    func logout() async {
        var req = URLRequest(url: base.appending(path: "/api/auth/signout"))
        req.httpMethod = "POST"
        req.setValue("application/x-www-form-urlencoded", forHTTPHeaderField: "Content-Type")
        if let csrf = try? await fetchCSRFToken() {
            req.httpBody = "csrfToken=\(csrf)".data(using: .utf8)
        }
        _ = try? await session.data(for: req)

        // Clear cookies
        if let storage = session.configuration.httpCookieStorage {
            storage.cookies?.forEach { storage.deleteCookie($0) }
        }
        isLoggedIn = false
        userEmail  = ""
    }

    // MARK: - Session check (call on app launch)

    func checkSession() async {
        guard let url = URL(string: base.appendingPathComponent("/api/auth/session").absoluteString) else { return }
        guard let (data, _) = try? await session.data(from: url) else { return }
        if let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
           let user = json["user"] as? [String: Any],
           let email = user["email"] as? String {
            isLoggedIn = true
            userEmail  = email
        }
    }

    // MARK: - Helpers

    private func fetchCSRFToken() async throws -> String {
        let url = base.appending(path: "/api/auth/csrf")
        let (data, _) = try await session.data(from: url)
        guard
            let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
            let token = json["csrfToken"] as? String
        else { throw AuthError.csrfFailed }
        return token
    }

    private func hasSesionCookie() -> Bool {
        let storage = session.configuration.httpCookieStorage ?? HTTPCookieStorage.shared
        return storage.cookies?.contains(where: {
            $0.name.hasPrefix("next-auth") || $0.name == "__Secure-next-auth.session-token"
        }) ?? false
    }
}

// URL helper
private extension URL {
    func appending(path: String) -> URL {
        if #available(iOS 16, *) {
            return self.appending(path: path)
        }
        return appendingPathComponent(path)
    }
}
