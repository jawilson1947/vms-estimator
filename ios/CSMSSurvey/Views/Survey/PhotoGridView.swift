import SwiftUI
import PhotosUI

struct PhotoGridView: View {
    let photos:      [SurveyPhoto]
    let isUploading: Bool
    let atLimit:     Bool
    let onDelete:    (SurveyPhoto) -> Void
    let onPickerItem: (PhotosPickerItem?) -> Void

    @State private var pickerItem: PhotosPickerItem?
    @State private var deleteTarget: SurveyPhoto?

    private let columns = [GridItem(.adaptive(minimum: 90), spacing: 8)]

    var body: some View {
        GroupBox {
            VStack(alignment: .leading, spacing: 10) {
                HStack {
                    Text("Photos")
                        .font(.subheadline.bold())
                    Spacer()
                    Text("\(photos.count) / 5")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }

                if photos.isEmpty && !isUploading {
                    Text("No photos yet.")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                        .frame(maxWidth: .infinity, alignment: .center)
                        .padding(.vertical, 12)
                }

                LazyVGrid(columns: columns, spacing: 8) {
                    ForEach(photos) { photo in
                        ZStack(alignment: .topTrailing) {
                            AsyncImage(url: photo.url) { phase in
                                switch phase {
                                case .success(let img):
                                    img.resizable().scaledToFill()
                                case .failure:
                                    Image(systemName: "photo")
                                        .foregroundStyle(.secondary)
                                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                                        .background(Color(.secondarySystemBackground))
                                default:
                                    ProgressView()
                                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                                        .background(Color(.secondarySystemBackground))
                                }
                            }
                            .frame(width: 90, height: 90)
                            .clipShape(RoundedRectangle(cornerRadius: 8))

                            // Delete button
                            Button {
                                deleteTarget = photo
                            } label: {
                                Image(systemName: "xmark.circle.fill")
                                    .font(.title3)
                                    .foregroundStyle(.white)
                                    .shadow(radius: 2)
                            }
                            .padding(4)
                        }
                    }

                    // Upload spinner
                    if isUploading {
                        ZStack {
                            RoundedRectangle(cornerRadius: 8)
                                .fill(Color(.secondarySystemBackground))
                            ProgressView()
                        }
                        .frame(width: 90, height: 90)
                    }
                }

                // Add photo picker
                if !atLimit && !isUploading {
                    PhotosPicker(selection: $pickerItem, matching: .images) {
                        Label("Add Photo", systemImage: "camera.fill")
                            .font(.subheadline)
                            .frame(maxWidth: .infinity)
                            .padding(10)
                            .background(Color(.secondarySystemBackground))
                            .clipShape(RoundedRectangle(cornerRadius: 8))
                    }
                }
            }
        }
        .onChange(of: pickerItem) { _, item in
            onPickerItem(item)
            pickerItem = nil
        }
        .confirmationDialog("Delete this photo?", isPresented: .init(
            get: { deleteTarget != nil },
            set: { if !$0 { deleteTarget = nil } }
        ), titleVisibility: .visible) {
            Button("Delete", role: .destructive) {
                if let p = deleteTarget { onDelete(p) }
                deleteTarget = nil
            }
            Button("Cancel", role: .cancel) { deleteTarget = nil }
        }
    }
}
