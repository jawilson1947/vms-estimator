import Foundation

// MARK: - Site list (lightweight, for the site/project picker)

struct SiteSummary: Codable, Identifiable {
    let id: Int
    let siteName: String
    let buildings: [BuildingSummary]
}

struct BuildingSummary: Codable, Identifiable {
    let id: Int
    let buildingName: String
    let projects: [ProjectSummary]
}

struct ProjectSummary: Codable, Identifiable {
    let id: Int
    let projectName: String
}

// MARK: - Full site (project list screen)

struct SurveySite: Codable, Identifiable {
    let id: Int
    let siteName: String
    var buildings: [SurveyBuilding]
}

struct SurveyBuilding: Codable, Identifiable, Hashable {
    let id: Int
    let buildingName: String
    var projects: [SurveyProject]

    static func == (lhs: SurveyBuilding, rhs: SurveyBuilding) -> Bool { lhs.id == rhs.id }
    func hash(into hasher: inout Hasher) { hasher.combine(id) }
}

// MARK: - Full project (survey board)

struct SurveyProject: Codable, Identifiable, Hashable {
    let id: Int
    let projectName: String
    let buildingId: Int
    let buildingName: String
    var locations: [SurveyLocation]

    static func == (lhs: SurveyProject, rhs: SurveyProject) -> Bool { lhs.id == rhs.id }
    func hash(into hasher: inout Hasher) { hasher.combine(id) }
}
