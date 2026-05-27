import Foundation

struct SurveyPhoto: Codable, Identifiable {
    let id: Int
    let imageUrl: String
    let caption: String?
    let createdAt: String

    var url: URL? { URL(string: imageUrl) }
}
