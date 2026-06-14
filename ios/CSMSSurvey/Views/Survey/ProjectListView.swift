import SwiftUI

struct ProjectListView: View {
    let building: BuildingSummary

    var body: some View {
        ZStack {
            Theme.background.ignoresSafeArea()

            Group {
                if building.projects.isEmpty {
                    ContentUnavailableView {
                        Label("No Projects", systemImage: "folder")
                    } description: {
                        Text("No survey projects have been created for this building.")
                            .foregroundStyle(Theme.textSecondary)
                    }
                } else {
                    ScrollView {
                        LazyVStack(spacing: 10) {
                            ForEach(building.projects) { project in
                                NavigationLink(value: project) {
                                    ProjectRow(project: project)
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
        .navigationTitle(building.buildingName)
        .navigationBarTitleDisplayMode(.large)
        // Destination for ProjectSummary (→ SurveyBoardView) is declared once at the
        // NavigationStack root (SiteListView). Declaring it here nested the closure
        // inside the Building destination, so SwiftUI built SurveyBoardView eagerly
        // and its .task fired fetchProject on a single site tap. SurveyBoardView now
        // mounts only when a ProjectSummary is actually pushed by tapping a project.
    }
}

private struct ProjectRow: View {
    let project: ProjectSummary

    var body: some View {
        HStack(spacing: 14) {
            ZStack {
                RoundedRectangle(cornerRadius: 10)
                    .fill(Theme.accentSoft)
                    .frame(width: 42, height: 42)
                Image(systemName: "checklist")
                    .font(.system(size: 17, weight: .semibold))
                    .foregroundStyle(Theme.accent)
            }

            VStack(alignment: .leading, spacing: 3) {
                Text(project.projectName)
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(Theme.textPrimary)
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
