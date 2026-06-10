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

    var isDone: Bool { surveyedAt != nil }

    enum CodingKeys: String, CodingKey {
        case id, projectId, areaName, floor, surveyNotes, notes
        case mountingLocation, coveragePurpose, surveyedAt
        case images, cameras, cameraModel
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
