import SwiftUI

struct ProjectListView: View {
    @StateObject private var vm: ProjectListViewModel

    init(siteId: Int) {
        _vm = StateObject(wrappedValue: ProjectListViewModel(siteId: siteId))
    }

    var body: some View {
        ZStack {
            Theme.background.ignoresSafeArea()

            Group {
                if vm.isLoading && vm.site == nil {
                    VStack(spacing: 14) {
                        ProgressView()
                            .tint(Theme.accent)
                            .scaleEffect(1.2)
                        Text("Loading projects…")
                            .font(.subheadline)
                            .foregroundStyle(Theme.textSecondary)
                    }
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                } else if let err = vm.errorMsg {
                    ContentUnavailableView {
                        Label("Could not load projects", systemImage: "wifi.slash")
                    } description: {
                        Text(err).foregroundStyle(Theme.textSecondary)
                    } actions: {
                        Button("Retry") { Task { await vm.load() } }
                            .tealButtonStyle()
                            .frame(width: 120)
                    }
                } else if vm.site?.buildings.allSatisfy({ $0.projects.isEmpty }) ?? true {
                    ContentUnavailableView {
                        Label("No Projects", systemImage: "folder")
                    } description: {
                        Text("No survey projects have been created for this site.")
                            .foregroundStyle(Theme.textSecondary)
                    }
                } else {
                    projectList
                }
            }
        }
        .navigationTitle(vm.site?.siteName ?? "Projects")
        .navigationBarTitleDisplayMode(.inline)
        .navigationDestination(for: Int.self) { projectId in
            SurveyBoardView(projectId: projectId)
        }
        .task { await vm.load() }
        .refreshable { await vm.load() }
    }

    private var projectList: some View {
        ScrollView {
            LazyVStack(spacing: 0, pinnedViews: .sectionHeaders) {
                ForEach(vm.site?.buildings ?? []) { building in
                    if !building.projects.isEmpty {
                        Section {
                            ForEach(building.projects) { project in
                                NavigationLink(value: project.id) {
                                    ProjectRow(project: project)
                                }
                                .buttonStyle(.plain)
                                .padding(.horizontal, 16)
                                .padding(.vertical, 4)
                            }
                            .padding(.bottom, 8)
                        } header: {
                            HStack {
                                Text(building.buildingName.uppercased())
                                    .font(.caption.weight(.semibold))
                                    .foregroundStyle(Theme.textSecondary)
                                    .tracking(1.0)
                                Spacer()
                            }
                            .padding(.horizontal, 16)
                            .padding(.vertical, 8)
                            .background(Theme.background)
                        }
                    }
                }
                Color.clear.frame(height: 24)
            }
            .padding(.top, 8)
        }
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
