import Foundation

struct SurveyLocation: Codable, Identifiable, Hashable {
    let id: Int
    let projectId: Int
    var areaName: String
    var floor: String?
    var surveyNotes: String?
    var notes: String?
    var mountingLocation: String?
    var coveragePurpose: String?
    var surveyedAt: String?          // ISO-8601 string or nil
    var images: [SurveyPhoto]
    var cameras: [LocationCamera]
    var cameraModel: CameraModel?
    /// FK to `AccessMethod.id`. Populated for access-control mode rows; nil for
    /// camera-mode rows. The server's `POST /api/survey/locations` response
    /// returns the nested `accessMethod` summary rather than echoing the id, so
    /// the decoder derives this from `accessMethod.id` when only the relation is
    /// present on the wire. `GET /api/survey/[projectId]` doesn't yet include
    /// either field (known backend gap) — decoder defaults both to nil.
    var accessMethodId: Int?
    /// Embedded `{ id, name }` reference, populated by the create/update endpoints.
    var accessMethod: AccessMethodSummary?

    var isDone: Bool { surveyedAt != nil }

    enum CodingKeys: String, CodingKey {
        case id, projectId, areaName, floor, surveyNotes, notes
        case mountingLocation, coveragePurpose, surveyedAt
        case images, cameras, cameraModel
        case accessMethodId, accessMethod
    }

    // Hashable / Equatable on id only so NavigationStack path works
    static func == (lhs: SurveyLocation, rhs: SurveyLocation) -> Bool { lhs.id == rhs.id }
    func hash(into hasher: inout Hasher) { hasher.combine(id) }

    // Custom decoder so missing `cameras` or `images` arrays don't crash
    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id               = try c.decode(Int.self,    forKey: .id)
        projectId        = try c.decode(Int.self,    forKey: .projectId)
        areaName         = try c.decode(String.self, forKey: .areaName)
        floor            = try c.decodeIfPresent(String.self, forKey: .floor)
        surveyNotes      = try c.decodeIfPresent(String.self, forKey: .surveyNotes)
        notes            = try c.decodeIfPresent(String.self, forKey: .notes)
        mountingLocation = try c.decodeIfPresent(String.self, forKey: .mountingLocation)
        coveragePurpose  = try c.decodeIfPresent(String.self, forKey: .coveragePurpose)
        surveyedAt       = try c.decodeIfPresent(String.self, forKey: .surveyedAt)
        images           = (try? c.decodeIfPresent([SurveyPhoto].self,    forKey: .images))  ?? []
        cameras          = (try? c.decodeIfPresent([LocationCamera].self, forKey: .cameras)) ?? []
        cameraModel      = try? c.decodeIfPresent(CameraModel.self,       forKey: .cameraModel)
        accessMethod     = try? c.decodeIfPresent(AccessMethodSummary.self, forKey: .accessMethod)
        // Prefer the explicit id if the server sends it; otherwise fall back to
        // the nested relation's id so the field stays populated whichever endpoint
        // we came from.
        if let id = try? c.decodeIfPresent(Int.self, forKey: .accessMethodId) {
            accessMethodId = id
        } else {
            accessMethodId = accessMethod?.id
        }
    }

    // Custom encoder required when custom init(from:) is present
    func encode(to encoder: Encoder) throws {
        var c = encoder.container(keyedBy: CodingKeys.self)
        try c.encode(id,               forKey: .id)
        try c.encode(projectId,        forKey: .projectId)
        try c.encode(areaName,         forKey: .areaName)
        try c.encodeIfPresent(floor,            forKey: .floor)
        try c.encodeIfPresent(surveyNotes,      forKey: .surveyNotes)
        try c.encodeIfPresent(notes,            forKey: .notes)
        try c.encodeIfPresent(mountingLocation, forKey: .mountingLocation)
        try c.encodeIfPresent(coveragePurpose,  forKey: .coveragePurpose)
        try c.encodeIfPresent(surveyedAt,       forKey: .surveyedAt)
        try c.encode(images,      forKey: .images)
        try c.encode(cameras,     forKey: .cameras)
        try c.encodeIfPresent(cameraModel, forKey: .cameraModel)
        try c.encodeIfPresent(accessMethodId, forKey: .accessMethodId)
        try c.encodeIfPresent(accessMethod, forKey: .accessMethod)
    }
}

// MARK: - Lightweight camera info shown on location

struct LocationCamera: Codable, Identifiable {
    let id: Int
    let cameraCode: String
    let cameraName: String
    let status: String
    let locationId: Int?
    let model: CameraModelInfo?
}

struct CameraModelInfo: Codable {
    let manufacturer: String?
    let modelNumber: String?
    let cameraType: String?
}

// MARK: - Request bodies

struct NewLocationBody: Encodable {
    let projectId: Int
    let areaName: String
    let floor: String?
    let surveyNotes: String?
    /// Populated only for access-control mode rows. Camera-mode callers leave nil
    /// (the existing `AddLocationSheet` callsite continues to default this).
    var accessMethodId: Int? = nil
}

struct UpdateLocationBody: Encodable {
    var areaName: String?
    var floor: String?
    var surveyNotes: String?
    var notes: String?
    var markSurveyed: Bool?
}

struct CameraAssignBody: Encodable {
    let cameraModelId: Int
}

struct CameraRemoveBody: Encodable {
    let cameraModelId: Int?
}
