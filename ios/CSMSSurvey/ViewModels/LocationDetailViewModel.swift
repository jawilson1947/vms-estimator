import Foundation
import UIKit

@MainActor
final class LocationDetailViewModel: ObservableObject {
    @Published var location:   SurveyLocation
    @Published var isSaving    = false
    @Published var isUploading = false
    @Published var errorMsg:   String?

    var onUpdate: ((SurveyLocation) -> Void)?
    var onDelete: (() -> Void)?

    private let api = APIClient.shared
    static let maxPhotos = 5

    init(location: SurveyLocation) { self.location = location }

    // MARK: - Mark surveyed

    func markSurveyed() async {
        isSaving = true
        errorMsg = nil
        do {
            let body = UpdateLocationBody(
                surveyNotes: location.surveyNotes,
                markSurveyed: true
            )
            let updated = try await api.updateLocation(location.id, body: body)
            location = updated
            onUpdate?(updated)
        } catch {
            errorMsg = error.localizedDescription
        }
        isSaving = false
    }

    // MARK: - Save notes

    func saveNotes(_ notes: String) async {
        isSaving = true
        errorMsg = nil
        do {
            let body = UpdateLocationBody(surveyNotes: notes)
            let updated = try await api.updateLocation(location.id, body: body)
            location = updated
            onUpdate?(updated)
        } catch {
            errorMsg = error.localizedDescription
        }
        isSaving = false
    }

    // MARK: - Save details (area / floor / notes) — used by voice edit

    func saveDetails(area: String, floor: String, notes: String) async {
        isSaving = true
        errorMsg = nil
        do {
            let body = UpdateLocationBody(
                areaName:    area.isEmpty  ? nil : area,
                floor:       floor.isEmpty ? nil : floor,
                surveyNotes: notes
            )
            let updated = try await api.updateLocation(location.id, body: body)
            location = updated
            onUpdate?(updated)
        } catch {
            errorMsg = error.localizedDescription
        }
        isSaving = false
    }

    // MARK: - Upload photo

    func uploadPhoto(_ image: UIImage) async {
        guard location.images.count < Self.maxPhotos else { return }
        isUploading = true
        errorMsg    = nil
        do {
            let resized = image.resizedToMaxDimension(1920)
            guard let data = resized.jpegData(compressionQuality: 0.82) else { return }
            let photo = try await api.uploadPhoto(locationId: location.id, imageData: data, mimeType: "image/jpeg")
            location.images.append(photo)
            onUpdate?(location)
        } catch {
            errorMsg = error.localizedDescription
        }
        isUploading = false
    }

    // MARK: - Assign camera

    func assignCamera(_ camera: CameraModel) async {
        isSaving = true
        errorMsg = nil
        do {
            let updated = try await api.assignCamera(locationId: location.id, cameraModelId: camera.id)
            location = updated
            onUpdate?(updated)
        } catch {
            errorMsg = error.localizedDescription
        }
        isSaving = false
    }

    // MARK: - Assign access method (access-control mode)

    func assignAccessMethod(_ id: Int) async {
        isSaving = true
        errorMsg = nil
        do {
            let body = UpdateLocationBody(accessMethodId: id)
            let updated = try await api.updateLocation(location.id, body: body)
            location = updated
            onUpdate?(updated)
        } catch {
            errorMsg = error.localizedDescription
        }
        isSaving = false
    }

    // MARK: - Remove camera

    func removeCamera() async {
        isSaving = true
        errorMsg = nil
        do {
            let updated = try await api.removeCamera(locationId: location.id)
            location = updated
            onUpdate?(updated)
        } catch {
            errorMsg = error.localizedDescription
        }
        isSaving = false
    }

    // MARK: - Delete photo

    func deletePhoto(_ photo: SurveyPhoto) async {
        do {
            try await api.deletePhoto(locationId: location.id, photoId: photo.id)
            location.images.removeAll { $0.id == photo.id }
            onUpdate?(location)
        } catch {
            errorMsg = error.localizedDescription
        }
    }

    var atPhotoLimit: Bool { location.images.count >= Self.maxPhotos }

    // MARK: - Delete location

    func deleteLocation() async {
        isSaving = true
        errorMsg = nil
        do {
            try await api.deleteLocation(location.id)
            onDelete?()
        } catch {
            errorMsg = error.localizedDescription
            isSaving = false
        }
    }
}
