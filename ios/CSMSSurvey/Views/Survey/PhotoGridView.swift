import SwiftUI
import PhotosUI

struct PhotoGridView: View {
    let photos:       [SurveyPhoto]
    let isUploading:  Bool
    let atLimit:      Bool
    let onDelete:     (SurveyPhoto) -> Void
    let onPickerItem: (PhotosPickerItem?) -> Void

    @State private var pickerItem:   PhotosPickerItem?
    @State private var deleteTarget: SurveyPhoto?
    @State private var expandedPhoto: SurveyPhoto?

    private let columns = [GridItem(.adaptive(minimum: 90), spacing: 8)]

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            // Header
            HStack {
                DarkSectionHeader(title: "Photos")
                Spacer()
                Text("\(photos.count) / 5")
                    .font(.caption.weight(.medium))
                    .foregroundStyle(Theme.textSecondary)
            }

            if photos.isEmpty && !isUploading {
                Text("No photos yet.")
                    .font(.caption)
                    .foregroundStyle(Theme.textTertiary)
                    .frame(maxWidth: .infinity, alignment: .center)
                    .padding(.vertical, 12)
            }

            LazyVGrid(columns: columns, spacing: 8) {
                ForEach(photos) { photo in
                    ZStack(alignment: .topTrailing) {
                        // Thumbnail — tap to expand
                        Button { expandedPhoto = photo } label: {
                            AsyncImage(url: photo.url) { phase in
                                switch phase {
                                case .success(let img):
                                    img.resizable().scaledToFill()
                                case .failure:
                                    Image(systemName: "photo")
                                        .foregroundStyle(Theme.textTertiary)
                                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                                        .background(Theme.surfaceElevated)
                                default:
                                    ProgressView().tint(Theme.accent)
                                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                                        .background(Theme.surfaceElevated)
                                }
                            }
                            .frame(width: 90, height: 90)
                            .clipShape(RoundedRectangle(cornerRadius: 10))
                        }
                        .buttonStyle(.plain)

                        // Delete button
                        Button { deleteTarget = photo } label: {
                            Image(systemName: "xmark.circle.fill")
                                .font(.title3)
                                .foregroundStyle(.white)
                                .shadow(color: .black.opacity(0.4), radius: 2)
                        }
                        .padding(4)
                    }
                }

                // Upload spinner
                if isUploading {
                    ZStack {
                        RoundedRectangle(cornerRadius: 10)
                            .fill(Theme.surfaceElevated)
                        ProgressView().tint(Theme.accent)
                    }
                    .frame(width: 90, height: 90)
                }
            }

            // Add photo picker
            if !atLimit && !isUploading {
                PhotosPicker(selection: $pickerItem, matching: .images) {
                    Label("Add Photo", systemImage: "camera.fill")
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(Theme.accent)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 13)
                        .background(Theme.accentSoft)
                        .clipShape(RoundedRectangle(cornerRadius: 12))
                        .overlay(RoundedRectangle(cornerRadius: 12).stroke(Theme.accent.opacity(0.28), lineWidth: 1))
                }
            }
        }
        .darkCard()
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
        .fullScreenCover(item: $expandedPhoto) { photo in
            PhotoExpandedView(photo: photo, allPhotos: photos) {
                expandedPhoto = nil
            }
        }
    }
}

// MARK: - Full-screen expanded photo viewer

struct PhotoExpandedView: View {
    let photo:     SurveyPhoto
    let allPhotos: [SurveyPhoto]
    let onDismiss: () -> Void

    @State private var currentIndex: Int
    @State private var scale:  CGFloat = 1.0
    @State private var offset: CGSize = .zero

    init(photo: SurveyPhoto, allPhotos: [SurveyPhoto], onDismiss: @escaping () -> Void) {
        self.photo     = photo
        self.allPhotos = allPhotos
        self.onDismiss = onDismiss
        _currentIndex  = State(initialValue: allPhotos.firstIndex(where: { $0.id == photo.id }) ?? 0)
    }

    var body: some View {
        ZStack(alignment: .topTrailing) {
            Color.black.ignoresSafeArea()

            // Paged photo viewer
            TabView(selection: $currentIndex) {
                ForEach(allPhotos.indices, id: \.self) { i in
                    AsyncImage(url: allPhotos[i].url) { phase in
                        switch phase {
                        case .success(let img):
                            img.resizable()
                                .scaledToFit()
                                .scaleEffect(scale)
                                .offset(offset)
                                .gesture(
                                    MagnificationGesture()
                                        .onChanged { scale = max(1, $0) }
                                        .onEnded   { _ in
                                            withAnimation(.spring()) { scale = 1; offset = .zero }
                                        }
                                )
                        case .failure:
                            Image(systemName: "photo")
                                .font(.system(size: 48))
                                .foregroundStyle(Theme.textTertiary)
                        default:
                            ProgressView().tint(Theme.accent)
                        }
                    }
                    .tag(i)
                }
            }
            .tabViewStyle(.page(indexDisplayMode: allPhotos.count > 1 ? .always : .never))
            .ignoresSafeArea()

            // Counter + close button
            HStack {
                if allPhotos.count > 1 {
                    Text("\(currentIndex + 1) / \(allPhotos.count)")
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(.white.opacity(0.8))
                        .padding(.horizontal, 12)
                        .padding(.vertical, 6)
                        .background(.black.opacity(0.4))
                        .clipShape(Capsule())
                }
                Spacer()
                Button(action: onDismiss) {
                    Image(systemName: "xmark.circle.fill")
                        .font(.title)
                        .foregroundStyle(.white.opacity(0.85))
                        .shadow(color: .black.opacity(0.5), radius: 4)
                }
            }
            .padding(.horizontal, 20)
            .padding(.top, 56)
        }
        // Swipe down to dismiss
        .gesture(
            DragGesture()
                .onEnded { val in
                    if val.translation.height > 100 { onDismiss() }
                }
        )
    }
}
