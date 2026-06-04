import Foundation

@MainActor
final class CameraPickerViewModel: ObservableObject {
    @Published var cameras:     [CameraModel] = []
    @Published var searchText:  String        = ""
    @Published var isLoading    = false
    @Published var errorMsg:    String?

    private let api = APIClient.shared

    var filtered: [CameraModel] {
        guard !searchText.isEmpty else { return cameras }
        let q = searchText.lowercased()
        return cameras.filter {
            ($0.manufacturer?.lowercased().contains(q) ?? false) ||
            ($0.model?.lowercased().contains(q) ?? false) ||
            ($0.cameraType?.lowercased().contains(q) ?? false)
        }
    }

    func load() async {
        guard cameras.isEmpty else { return }
        isLoading = true
        errorMsg  = nil
        do {
            cameras = try await api.fetchCameras()
        } catch {
            errorMsg = error.localizedDescription
        }
        isLoading = false
    }
}
