import SwiftUI

struct SiteListView: View {
    @StateObject private var vm   = SiteListViewModel()
    @EnvironmentObject var auth:    AuthService
    @State private var searchText  = ""

    var filtered: [SiteSummary] {
        guard !searchText.isEmpty else { return vm.sites }
        return vm.sites.filter {
            $0.siteName.localizedCaseInsensitiveContains(searchText)
        }
    }

    var body: some View {
        NavigationStack {
            ZStack {
                Theme.background.ignoresSafeArea()

                Group {
                    if vm.isLoading && vm.sites.isEmpty {
                        VStack(spacing: 14) {
                            ProgressView()
                                .tint(Theme.accent)
                                .scaleEffect(1.2)
                            Text("Loading sites…")
                                .font(.subheadline)
                                .foregroundStyle(Theme.textSecondary)
                        }
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                    } else if let err = vm.errorMsg {
                        ContentUnavailableView {
                            Label("Could not load sites", systemImage: "wifi.slash")
                        } description: {
                            Text(err).foregroundStyle(Theme.textSecondary)
                        } actions: {
                            Button("Retry") { Task { await vm.load() } }
                                .tealButtonStyle()
                                .frame(width: 120)
                        }
                    } else if vm.sites.isEmpty {
                        ContentUnavailableView {
                            Label("No Sites", systemImage: "building.2")
                        } description: {
                            Text("No survey sites have been created yet.")
                                .foregroundStyle(Theme.textSecondary)
                        }
                    } else {
                        ScrollView {
                            LazyVStack(spacing: 10) {
                                ForEach(filtered) { site in
                                    NavigationLink(value: site.id) {
                                        SiteRow(site: site)
                                    }
                                    .buttonStyle(.plain)
                                }
                            }
                            .padding(.horizontal, 16)
                            .padding(.top, 8)
                            .padding(.bottom, 24)
                        }
                        .refreshable { await vm.load() }
                        .searchable(text: $searchText, prompt: "Search sites")
                    }
                }
            }
            .navigationTitle("Survey Sites")
            .navigationDestination(for: Int.self) { siteId in
                SurveyBoardView(siteId: siteId)
            }
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Menu {
                        NavigationLink(destination: VoiceTestView()) {
                            Label("Developer Tools", systemImage: "wrench.and.screwdriver")
                        }
                        Divider()
                        Button(role: .destructive) {
                            Task { await auth.logout() }
                        } label: {
                            Label("Sign Out", systemImage: "rectangle.portrait.and.arrow.right")
                        }
                    } label: {
                        Image(systemName: "person.circle")
                            .foregroundStyle(Theme.textSecondary)
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
        HStack(spacing: 14) {
            // Icon
            ZStack {
                RoundedRectangle(cornerRadius: 10)
                    .fill(Theme.accentSoft)
                    .frame(width: 42, height: 42)
                Image(systemName: "building.2.fill")
                    .font(.system(size: 17, weight: .semibold))
                    .foregroundStyle(Theme.accent)
            }

            VStack(alignment: .leading, spacing: 3) {
                Text(site.siteName)
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(Theme.textPrimary)
                Text("\(site.buildings.count) building\(site.buildings.count == 1 ? "" : "s")")
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
