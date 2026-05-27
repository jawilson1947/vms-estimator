import SwiftUI

struct SiteListView: View {
    @StateObject private var vm   = SiteListViewModel()
    @EnvironmentObject var auth:    AuthService
    @State private var searchText  = ""
    @State private var selectedId: Int?

    var filtered: [SiteSummary] {
        guard !searchText.isEmpty else { return vm.sites }
        return vm.sites.filter {
            $0.siteName.localizedCaseInsensitiveContains(searchText)
        }
    }

    var body: some View {
        NavigationStack {
            Group {
                if vm.isLoading && vm.sites.isEmpty {
                    ProgressView("Loading sites…")
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                } else if let err = vm.errorMsg {
                    ContentUnavailableView {
                        Label("Could not load sites", systemImage: "wifi.slash")
                    } description: {
                        Text(err)
                    } actions: {
                        Button("Retry") { Task { await vm.load() } }
                            .buttonStyle(.borderedProminent)
                    }
                } else if vm.sites.isEmpty {
                    ContentUnavailableView(
                        "No Sites",
                        systemImage: "building.2",
                        description: Text("No survey sites have been created yet.")
                    )
                } else {
                    List(filtered) { site in
                        NavigationLink(value: site.id) {
                            SiteRow(site: site)
                        }
                    }
                    .searchable(text: $searchText, prompt: "Search sites")
                    .refreshable { await vm.load() }
                }
            }
            .navigationTitle("Survey Sites")
            .navigationDestination(for: Int.self) { siteId in
                SurveyBoardView(siteId: siteId)
            }
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Menu {
                        Button(role: .destructive) {
                            Task { await auth.logout() }
                        } label: {
                            Label("Sign Out", systemImage: "rectangle.portrait.and.arrow.right")
                        }
                    } label: {
                        Image(systemName: "person.circle")
                    }
                }
            }
        }
        .task { await vm.load() }
    }
}

private struct SiteRow: View {
    let site: SiteSummary
    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(site.siteName)
                .font(.headline)
            Text("\(site.buildings.count) building\(site.buildings.count == 1 ? "" : "s")")
                .font(.caption)
                .foregroundStyle(.secondary)
        }
        .padding(.vertical, 4)
    }
}
