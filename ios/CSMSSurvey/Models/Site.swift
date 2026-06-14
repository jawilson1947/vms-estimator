import Foundation

// MARK: - Project type (mode)

/// Mirrors the Windows-side Prisma enum `ProjectType`.
/// Wire format is the Prisma identifier (`"VIDEO_SURVEILLANCE"` / `"ACCESS_CONTROL"`),
/// not the human-friendly `@map` strings.
///
/// Decoding tolerates missing, null, or unknown values and falls back to
/// `.videoSurveillance` so that legacy projects (and the current
/// `GET /api/survey/[projectId]` response, which omits the field) still load.
enum ProjectType: String, Codable, CaseIterable, Hashable {
    case videoSurveillance = "VIDEO_SURVEILLANCE"
    case accessControl     = "ACCESS_CONTROL"
}

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
    /// Carried by `/api/survey/sites-list` so the picker can dispatch to the
    /// right survey view (camera vs. access-control) on tap. Optional because
    /// the older `/api/survey/sites/:id` response, and any legacy callers,
    /// don't include it. Decoder is tolerant of missing/null/unknown values
    /// and collapses any of them to `nil`; callers should treat nil as
    /// `.videoSurveillance` (same convention as `SurveyProject`).
    var projectType: ProjectType?

    enum CodingKeys: String, CodingKey {
        case id, projectName, projectType
    }

    init(id: Int, projectName: String, projectType: ProjectType? = nil) {
        self.id = id
        self.projectName = projectName
        self.projectType = projectType
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id          = try c.decode(Int.self, forKey: .id)
        projectName = try c.decode(String.self, forKey: .projectName)
        if let raw = try? c.decodeIfPresent(String.self, forKey: .projectType) {
            projectType = ProjectType(rawValue: raw)
        } else {
            projectType = nil
        }
    }

    func encode(to encoder: Encoder) throws {
        var c = encoder.container(keyedBy: CodingKeys.self)
        try c.encode(id, forKey: .id)
        try c.encode(projectName, forKey: .projectName)
        try c.encodeIfPresent(projectType, forKey: .projectType)
    }

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
    /// Optional because legacy projects, or responses from `/api/survey/[projectId]`
    /// that don't yet include the field, decode as `nil`. Callers should treat `nil`
    /// as `.videoSurveillance` via `effectiveProjectType` (no force-pick UX on iOS).
    var projectType: ProjectType?
    var locations: [SurveyLocation]

    /// Convenience so callers don't need to unwrap building everywhere
    var buildingName: String { building?.buildingName ?? "" }
    var buildingId: Int?     { building?.id }

    /// `projectType ?? .videoSurveillance` — the runtime default for any project
    /// arriving without a mode (legacy, missing field, or unknown raw value).
    var effectiveProjectType: ProjectType { projectType ?? .videoSurveillance }

    enum CodingKeys: String, CodingKey {
        case id, projectName, building, projectType, locations
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id          = try c.decode(Int.self, forKey: .id)
        projectName = try c.decode(String.self, forKey: .projectName)
        // try? (not bare try) so a malformed nested building object — e.g. server
        // omits buildingName on the `/api/survey/[projectId]` include — doesn't
        // take down the whole project load. Matches the `locations` pattern below.
        // `buildingName` / `buildingId` callers already cope with `building == nil`.
        building    = try? c.decodeIfPresent(SurveyProjectBuilding.self, forKey: .building)
        locations   = (try? c.decodeIfPresent([SurveyLocation].self, forKey: .locations)) ?? []
        // Tolerant decode: missing field, JSON null, or an unknown raw value all
        // collapse to nil here; UI code reads `effectiveProjectType` to get the default.
        if let raw = try? c.decodeIfPresent(String.self, forKey: .projectType) {
            projectType = ProjectType(rawValue: raw)
        } else {
            projectType = nil
        }
    }

    func encode(to encoder: Encoder) throws {
        var c = encoder.container(keyedBy: CodingKeys.self)
        try c.encode(id, forKey: .id)
        try c.encode(projectName, forKey: .projectName)
        try c.encodeIfPresent(building, forKey: .building)
        try c.encodeIfPresent(projectType, forKey: .projectType)
        try c.encode(locations, forKey: .locations)
    }

    static func == (lhs: SurveyProject, rhs: SurveyProject) -> Bool { lhs.id == rhs.id }
    func hash(into hasher: inout Hasher) { hasher.combine(id) }
}
