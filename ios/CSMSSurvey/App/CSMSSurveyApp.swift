import SwiftUI

@main
struct CSMSSurveyApp: App {
    @StateObject private var auth  = AuthService()
    @StateObject private var voice = VoiceCommandManager.shared

    var body: some Scene {
        WindowGroup {
            ContentView()
                .environmentObject(auth)
                .environmentObject(voice)
                .task {
                    // Restore existing session on launch
                    await auth.checkSession()
                    // Request mic + speech permissions
                    await voice.requestPermission()
                }
        }
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
