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
    var cameras: [LocationCamera] = []

    var isDone: Bool { surveyedAt != nil }

    // Hashable / Equatable on id only so NavigationStack path works
    static func == (lhs: SurveyLocation, rhs: SurveyLocation) -> Bool { lhs.id == rhs.id }
    func hash(into hasher: inout Hasher) { hasher.combine(id) }
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
