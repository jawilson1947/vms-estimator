import Foundation

enum SurveyFilter: String, CaseIterable {
    case all     = "All"
    case pending = "Pending"
    case done    = "Done"
}

@MainActor
final class SurveyBoardViewModel: ObservableObject {
    @Published var site:       SurveySite?
    @Published var filter:     SurveyFilter = .all
    @Published var isLoading   = false
    @Published var errorMsg:   String?

    let siteId: Int
    private let api = APIClient.shared

    init(siteId: Int) { self.siteId = siteId }

    // MARK: - Derived

    var filteredBuildings: [SurveyBuilding] {
        guard let site else { return [] }
        return site.buildings.compactMap { building in
            let locs = building.locations.filter { loc in
                switch filter {
                case .all:     return true
                case .pending: return !loc.isDone
                case .done:    return loc.isDone
                }
            }
            guard !locs.isEmpty else { return nil }
            var copy = building
            copy.locations = locs
            return copy
        }
    }

    var allLocations: [SurveyLocation] {
        site?.buildings.flatMap(\.locations) ?? []
    }

    var doneCount:  Int { allLocations.filter(\.isDone).count }
    var totalCount: Int { allLocations.count }
    var progress:   Double { totalCount > 0 ? Double(doneCount) / Double(totalCount) : 0 }

    // MARK: - Load

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

    // MARK: - Mutations (optimistic)

    func append(_ location: SurveyLocation) {
        guard let idx = site?.buildings.firstIndex(where: { $0.id == location.buildingId }) else { return }
        site?.buildings[idx].locations.append(location)
    }

    func update(_ location: SurveyLocation) {
        guard let bi = site?.buildings.firstIndex(where: { $0.id == location.buildingId }),
              let li = site?.buildings[bi].locations.firstIndex(where: { $0.id == location.id })
        else { return }
        site?.buildings[bi].locations[li] = location
    }

    func remove(locationId: Int) {
        for bi in (site?.buildings.indices ?? []) {
            site?.buildings[bi].locations.removeAll { $0.id == locationId }
        }
    }
}
