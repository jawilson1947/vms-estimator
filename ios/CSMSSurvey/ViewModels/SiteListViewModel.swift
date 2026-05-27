import Foundation

@MainActor
final class SiteListViewModel: ObservableObject {
    @Published var sites:     [SiteSummary] = []
    @Published var isLoading  = false
    @Published var errorMsg:  String?

    private let api = APIClient.shared

    func load() async {
        isLoading = true
        errorMsg  = nil
        do {
            sites = try await api.fetchSitesList()
        } catch {
            errorMsg = error.localizedDescription
        }
        isLoading = false
    }
}
