import Foundation

// MARK: - Site list (lightweight, for the site/project picker)

struct SiteSummary: Codable, Identifiable, Hashable {
    let id: Int
    let siteName: String
    let buildings: [BuildingSummary]

    static func == (lhs: SiteSummary, rhs: SiteSummary) -> Bool { lhs.id == rhs.id }
    func hash(into hasher: inout Hasher) { hasher.combine(id) }
}

struct BuildingSummary: Codable, Identifiable, Hashable {
    let id: Int
    let buildingName: String
    let projects: [ProjectSummary]

    static func == (lhs: BuildingSummary, rhs: BuildingSummary) -> Bool { lhs.id == rhs.id }
    func hash(into hasher: inout Hasher) { hasher.combine(id) }
}

struct ProjectSummary: Codable, Identifiable, Hashable {
    let id: Int
    let projectName: String

    static func == (lhs: ProjectSummary, rhs: ProjectSummary) -> Bool { lhs.id == rhs.id }
    func hash(into hasher: inout Hasher) { hasher.combine(id) }
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
    var projects: [ProjectSummary]   // lightweight — id + name only from /api/survey/sites/:id

    static func == (lhs: SurveyBuilding, rhs: SurveyBuilding) -> Bool { lhs.id == rhs.id }
    func hash(into hasher: inout Hasher) { hasher.combine(id) }
}

// MARK: - Full project (survey board)

struct SurveyProjectBuilding: Codable, Hashable {
    let id: Int
    let buildingName: String
    let siteName: String?
}

struct SurveyProject: Codable, Identifiable, Hashable {
    let id: Int
    let projectName: String
    let building: SurveyProjectBuilding?   // nested object from server
    var locations: [SurveyLocation]

    /// Convenience so callers don't need to unwrap building everywhere
    var buildingName: String { building?.buildingName ?? "" }
    var buildingId: Int?     { building?.id }

    static func == (lhs: SurveyProject, rhs: SurveyProject) -> Bool { lhs.id == rhs.id }
    func hash(into hasher: inout Hasher) { hasher.combine(id) }
}
