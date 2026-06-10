import SwiftUI

struct BuildingListView: View {
    let site: SiteSummary

    var body: some View {
        ZStack {
            Theme.background.ignoresSafeArea()

            Group {
                if site.buildings.isEmpty {
                    ContentUnavailableView {
                        Label("No Buildings", systemImage: "building")
                    } description: {
                        Text("No buildings have been added to this site.")
                            .foregroundStyle(Theme.textSecondary)
                    }
                } else {
                    ScrollView {
                        LazyVStack(spacing: 10) {
                            ForEach(site.buildings) { building in
                                NavigationLink(value: building) {
                                    BuildingRow(building: building)
                                }
                                .buttonStyle(.plain)
                            }
                        }
                        .padding(.horizontal, 16)
                        .padding(.top, 8)
                        .padding(.bottom, 24)
                    }
                }
            }
        }
        .navigationTitle(site.siteName)
        .navigationBarTitleDisplayMode(.large)
        .navigationDestination(for: BuildingSummary.self) { building in
            ProjectListView(building: building)
        }
    }
}

private struct BuildingRow: View {
    let building: BuildingSummary

    var body: some View {
        HStack(spacing: 14) {
            ZStack {
                RoundedRectangle(cornerRadius: 10)
                    .fill(Theme.accentSoft)
                    .frame(width: 42, height: 42)
                Image(systemName: "building.fill")
                    .font(.system(size: 17, weight: .semibold))
                    .foregroundStyle(Theme.accent)
            }

            VStack(alignment: .leading, spacing: 3) {
                Text(building.buildingName)
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(Theme.textPrimary)
                let count = building.projects.count
                Text("\(count) project\(count == 1 ? "" : "s")")
                    .font(.caption)
                    .foregroundStyle(Theme.textSecondary)
            }

            Spacer()

            Image(systemName: "chevron.right")
                .font(.caption.weight(.semibold))
                .foregroundStyle(Theme.textTertiary)
        }
        .padding(14)
        .background(Theme.surface)
        .clipShape(RoundedRectangle(cornerRadius: 14))
        .overlay(RoundedRectangle(cornerRadius: 14).stroke(Theme.border, lineWidth: 1))
    }
}
