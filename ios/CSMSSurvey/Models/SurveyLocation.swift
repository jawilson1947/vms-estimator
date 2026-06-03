import Foundation

struct SurveyLocation: Codable, Identifiable, Hashable {
    let id: Int
    let buildingId: Int
    var areaName: String
    var floor: String?
    var surveyNotes: String?
    var notes: String?
    var mountingLocation: String?
    var coveragePurpose: String?
    var surveyedAt: String?          // ISO-8601 string or nil
    var images: [SurveyPhoto]
    var cameras: [LocationCamera]

    var isDone: Bool { surveyedAt != nil }

    // Hashable / Equatable on id only so NavigationStack path works
    static func == (lhs: SurveyLocation, rhs: SurveyLocation) -> Bool { lhs.id == rhs.id }
    func hash(into hasher: inout Hasher) { hasher.combine(id) }

    // Custom decoder so missing `cameras` or `images` arrays don't crash
    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id               = try c.decode(Int.self,    forKey: .id)
        buildingId       = try c.decode(Int.self,    forKey: .buildingId)
        areaName         = try c.decode(String.self, forKey: .areaName)
        floor            = try c.decodeIfPresent(String.self, forKey: .floor)
        surveyNotes      = try c.decodeIfPresent(String.self, forKey: .surveyNotes)
        notes            = try c.decodeIfPresent(String.self, forKey: .notes)
        mountingLocation = try c.decodeIfPresent(String.self, forKey: .mountingLocation)
        coveragePurpose  = try c.decodeIfPresent(String.self, forKey: .coveragePurpose)
        surveyedAt       = try c.decodeIfPresent(String.self, forKey: .surveyedAt)
        images           = (try? c.decodeIfPresent([SurveyPhoto].self,    forKey: .images))  ?? []
        cameras          = (try? c.decodeIfPresent([LocationCamera].self, forKey: .cameras)) ?? []
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
    let buildingId: Int
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
