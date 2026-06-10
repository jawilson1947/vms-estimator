import Foundation

@MainActor
final class ProjectListViewModel: ObservableObject {
    @Published var site:      SurveySite?
    @Published var isLoading  = false
    @Published var errorMsg:  String?

    let siteId: Int
    private let api = APIClient.shared

    init(siteId: Int) { self.siteId = siteId }

    func load() async {
        isLoading = true
        errorMsg  = nil
        do {
            site = try await api.fetchSite(siteId)
        } catch {
            errorMsg = error.localizedDescription
        }
        isLoading = false
    }
}
