import Foundation

// MARK: - Site list (lightweight, for the site picker)

struct SiteSummary: Codable, Identifiable {
    let id: Int
    let siteName: String
    let buildings: [BuildingSummary]
}

struct BuildingSummary: Codable, Identifiable {
    let id: Int
    let buildingName: String
}

// MARK: - Full site (survey board)

struct SurveySite: Codable, Identifiable {
    let id: Int
    let siteName: String
    var buildings: [SurveyBuilding]
}

struct SurveyBuilding: Codable, Identifiable, Hashable {
    let id: Int
    let buildingName: String
    var locations: [SurveyLocation]

    static func == (lhs: SurveyBuilding, rhs: SurveyBuilding) -> Bool { lhs.id == rhs.id }
    func hash(into hasher: inout Hasher) { hasher.combine(id) }
}
