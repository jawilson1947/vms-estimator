import Foundation

enum SurveyFilter: String, CaseIterable {
    case all     = "All"
    case pending = "Pending"
    case done    = "Done"
}

@MainActor
final class SurveyBoardViewModel: ObservableObject {
    @Published var project:    SurveyProject?
    @Published var filter:     SurveyFilter = .all
    @Published var isLoading   = false
    @Published var errorMsg:   String?

    let projectId: Int
    private let api = APIClient.shared

    init(projectId: Int) { self.projectId = projectId }

    // MARK: - Derived

    var filteredLocations: [SurveyLocation] {
        guard let project else { return [] }
        return project.locations.filter { loc in
            switch filter {
            case .all:     return true
            case .pending: return !loc.isDone
            case .done:    return loc.isDone
            }
        }
    }

    var allLocations: [SurveyLocation] { project?.locations ?? [] }

    var doneCount:  Int { allLocations.filter(\.isDone).count }
    var totalCount: Int { allLocations.count }
    var progress:   Double { totalCount > 0 ? Double(doneCount) / Double(totalCount) : 0 }

    // MARK: - Load

    func load() async {
        isLoading = true
        errorMsg  = nil
        do {
            project = try await api.fetchProject(projectId)
        } catch {
            errorMsg = error.localizedDescription
        }
        isLoading = false
    }

    // MARK: - Mutations (optimistic)

    func append(_ location: SurveyLocation) {
        project?.locations.append(location)
    }

    func update(_ location: SurveyLocation) {
        guard let idx = project?.locations.firstIndex(where: { $0.id == location.id }) else { return }
        project?.locations[idx] = location
    }

    func remove(locationId: Int) {
        project?.locations.removeAll { $0.id == locationId }
    }
}
