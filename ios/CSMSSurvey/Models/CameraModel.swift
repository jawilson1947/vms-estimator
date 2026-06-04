import Foundation

struct CameraModel: Codable, Identifiable, Hashable {
    let id: Int
    let manufacturer: String?
    let model: String?
    let cameraType: String?
    let ptz: Bool?
    let resolution: String?
    let resolutionClass: String?
    let megapixels: String?    // Prisma Decimal serializes as string
    let indoorOutdoor: String?
    let imageUrl: String?
    let nightVision: Bool?
    let vandalProof: Bool?
    let audio: Bool?
    let humanVehicleDetect: Bool?
    let mount: String?
    let cost: String?          // Prisma Decimal serializes as string

    var displayName: String { "\(manufacturer ?? "") \(model ?? "")".trimmingCharacters(in: .whitespaces) }

    var typeLabel: String {
        guard let t = cameraType else { return "Camera" }
        return t
    }

    static func == (lhs: CameraModel, rhs: CameraModel) -> Bool { lhs.id == rhs.id }
    func hash(into hasher: inout Hasher) { hasher.combine(id) }
}
