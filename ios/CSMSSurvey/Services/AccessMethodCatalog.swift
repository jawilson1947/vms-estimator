import Foundation

/// In-memory + UserDefaults cache of the global `AccessMethod` list.
///
/// The list is small (~9 entries today; will grow with the BOM costing table on
/// the Windows side) and changes rarely, so we cache it the same way the app
/// caches other lookups: a single JSON blob in UserDefaults plus a published
/// in-memory snapshot for SwiftUI views.
///
/// Refresh policy: `refreshOnAppLaunch()` is called once on cold start. The
/// `AddAccessPointSheet` picker reads `methods` synchronously and triggers a
/// background refresh on appear so admins can add a method and have it appear
/// the next time the sheet opens.
@MainActor
final class AccessMethodCatalog: ObservableObject {
    static let shared = AccessMethodCatalog()

    /// Published snapshot — observable so the picker can react if the cache
    /// is refreshed while the sheet is open.
    @Published private(set) var methods: [AccessMethod] = []
    @Published private(set) var isLoading = false
    @Published private(set) var lastError: String?

    private let api = APIClient.shared
    private let defaults = UserDefaults.standard
    private let cacheKey = "AccessMethodCatalog.cachedMethods.v1"

    private init() {
        loadFromDisk()
    }

    // MARK: - Public

    /// Synchronous accessor for view code that needs the list right now.
    /// Returns the in-memory snapshot (which is populated from disk at init,
    /// so it's non-empty after the first successful fetch on any prior launch).
    func current() -> [AccessMethod] { methods }

    /// Looks up a single method by id. Used by `AddAccessPointSheet` to render
    /// the picker's selected-row label without keeping a separate `[Int: AccessMethod]`
    /// index — list is small enough that linear scan is fine.
    func method(id: Int) -> AccessMethod? {
        methods.first { $0.id == id }
    }

    /// Triggers a refresh from the server. Safe to call repeatedly — concurrent
    /// calls are coalesced by the `isLoading` guard. Failures are surfaced via
    /// `lastError` but never throw; the existing on-disk snapshot is preserved.
    func refresh() async {
        guard !isLoading else { return }
        isLoading = true
        lastError = nil
        defer { isLoading = false }
        do {
            let fetched = try await api.fetchAccessMethods()
            methods = fetched
            saveToDisk(fetched)
        } catch {
            lastError = error.localizedDescription
        }
    }

    /// Called once at app launch (see `CSMSSurveyApp`). Fires the refresh on a
    /// detached Task so it can't slow the launch path.
    func refreshOnAppLaunch() {
        Task { await refresh() }
    }

    // MARK: - Disk persistence

    private func loadFromDisk() {
        guard let data = defaults.data(forKey: cacheKey) else { return }
        if let decoded = try? JSONDecoder().decode([AccessMethod].self, from: data) {
            methods = decoded
        }
    }

    private func saveToDisk(_ list: [AccessMethod]) {
        guard let data = try? JSONEncoder().encode(list) else { return }
        defaults.set(data, forKey: cacheKey)
    }
}
