import Foundation

/// Mirrors the Windows-side `AccessMethod` table.
///
/// The Prisma model has additional fields (`active`, `items` — the Bill-of-Materials
/// chain used for server-side costing). iOS only needs `id`, `name`, `grouping`, and
/// `sortOrder` to render the picker; `items` is intentionally ignored.
///
/// The `GET /api/access-methods` response is camelCase (Prisma JS client default),
/// so it round-trips through `APIClient`'s `.convertFromSnakeCase` decoder without
/// transformation.
struct AccessMethod: Codable, Identifiable, Hashable {
    let id: Int
    let name: String
    let grouping: String?
    let sortOrder: Int

    enum CodingKeys: String, CodingKey {
        case id, name, grouping, sortOrder
    }

    init(id: Int, name: String, grouping: String? = nil, sortOrder: Int = 0) {
        self.id = id
        self.name = name
        self.grouping = grouping
        self.sortOrder = sortOrder
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id        = try c.decode(Int.self, forKey: .id)
        name      = try c.decode(String.self, forKey: .name)
        grouping  = try c.decodeIfPresent(String.self, forKey: .grouping)
        sortOrder = (try? c.decodeIfPresent(Int.self, forKey: .sortOrder)) ?? 0
    }
}

/// Slim reference embedded on a `SurveyLocation` row. The POST
/// `/api/survey/locations` response returns `accessMethod: { id, name }` rather
/// than echoing `accessMethodId` directly, so the iOS model carries the
/// embedded summary and derives the foreign-key id from it when needed.
struct AccessMethodSummary: Codable, Hashable {
    let id: Int
    let name: String
}
