import SwiftUI

@main
struct CSMSSurveyApp: App {
    @StateObject private var auth  = AuthService()
    @StateObject private var voice = VoiceCommandManager.shared

    init() {
        configureNavigationAppearance()
    }

    var body: some Scene {
        WindowGroup {
            ContentView()
                .environmentObject(auth)
                .environmentObject(voice)
                .preferredColorScheme(.dark)
                .task {
                    print("[CSMSSurvey] running \(AppEnvironment.versionLabel)")
                    // Restore existing session on launch
                    await auth.checkSession()
                    // Request mic + speech permissions
                    await voice.requestPermission()
                    // Refresh the access-methods catalog so access-control mode
                    // projects can render their picker offline if needed.
                    await AccessMethodCatalog.shared.refresh()
                }
        }
    }

    private func configureNavigationAppearance() {
        let teal    = UIColor(red: 0.16, green: 0.58, blue: 0.54, alpha: 1)
        let surface = UIColor(red: 0.14, green: 0.15, blue: 0.17, alpha: 1)
        let cream   = UIColor(red: 0.94, green: 0.93, blue: 0.90, alpha: 1)
        let creamMid = UIColor(red: 0.94, green: 0.93, blue: 0.90, alpha: 0.52)

        // Navigation bar
        let appearance = UINavigationBarAppearance()
        appearance.configureWithOpaqueBackground()
        appearance.backgroundColor = surface
        appearance.titleTextAttributes = [
            .foregroundColor: teal,
            .font: UIFont.systemFont(ofSize: 17, weight: .semibold)
        ]
        appearance.largeTitleTextAttributes = [
            .foregroundColor: teal,
            .font: UIFont.systemFont(ofSize: 34, weight: .bold)
        ]
        appearance.shadowColor = UIColor(white: 1, alpha: 0.06)

        // scrollEdgeAppearance is used when the scroll view is at the top —
        // must be set explicitly, otherwise iOS falls back to a translucent style
        // that ignores our title colour.
        let scrollEdge = appearance.copy()
        scrollEdge.configureWithOpaqueBackground()
        scrollEdge.backgroundColor = surface
        scrollEdge.largeTitleTextAttributes = [
            .foregroundColor: teal,
            .font: UIFont.systemFont(ofSize: 34, weight: .bold)
        ]
        scrollEdge.titleTextAttributes = [
            .foregroundColor: teal,
            .font: UIFont.systemFont(ofSize: 17, weight: .semibold)
        ]
        scrollEdge.shadowColor = UIColor(white: 1, alpha: 0.06)

        UINavigationBar.appearance().standardAppearance   = appearance
        UINavigationBar.appearance().compactAppearance    = appearance
        UINavigationBar.appearance().scrollEdgeAppearance = scrollEdge
        UINavigationBar.appearance().tintColor = teal

        // Search bar — text, placeholder, cursor, cancel button
        UISearchBar.appearance().barTintColor = surface
        UISearchBar.appearance().tintColor    = teal  // cursor + cancel button
        UITextField.appearance(whenContainedInInstancesOf: [UISearchBar.self])
            .defaultTextAttributes = [.foregroundColor: cream]
        UITextField.appearance(whenContainedInInstancesOf: [UISearchBar.self])
            .attributedPlaceholder = NSAttributedString(
                string: "Search sites",
                attributes: [.foregroundColor: creamMid]
            )

        // List / table views — match dark background
        UITableView.appearance().backgroundColor         = UIColor(red: 0.09, green: 0.10, blue: 0.11, alpha: 1)
        UITableView.appearance().separatorColor          = UIColor(white: 1, alpha: 0.06)
        UITableViewCell.appearance().backgroundColor     = .clear
    }
}

struct ContentView: View {
    @EnvironmentObject var auth: AuthService

    var body: some View {
        if auth.isLoggedIn {
            SiteListView()
        } else {
            LoginView()
        }
    }
}
