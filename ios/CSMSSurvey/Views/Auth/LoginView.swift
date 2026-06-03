import SwiftUI

struct LoginView: View {
    @EnvironmentObject var auth: AuthService
    @State private var email     = ""
    @State private var password  = ""
    @State private var isLoading = false
    @State private var errorMsg: String?

    // Grid animation
    @State private var activeCells: Set<Int> = [0, 3, 5, 6, 10]
    private let gridColumns = 4
    private let gridRows    = 3
    private var totalCells: Int { gridColumns * gridRows }

    var body: some View {
        ZStack {
            Theme.background.ignoresSafeArea()

            VStack(spacing: 0) {

                // MARK: - Hero header — CCTV thumbnail grid
                ZStack(alignment: .leading) {
                    // Grid of camera thumbnails
                    LazyVGrid(
                        columns: Array(repeating: GridItem(.flexible(), spacing: 3), count: gridColumns),
                        spacing: 3
                    ) {
                        ForEach(0..<totalCells, id: \.self) { i in
                            RoundedRectangle(cornerRadius: 4)
                                .fill(activeCells.contains(i)
                                      ? Theme.accent.opacity(0.30)
                                      : Theme.surfaceElevated)
                                .aspectRatio(16/9, contentMode: .fit)
                                .overlay(
                                    Group {
                                        if activeCells.contains(i) {
                                            Image(systemName: "video.fill")
                                                .font(.system(size: 10, weight: .medium))
                                                .foregroundStyle(Theme.accent)
                                        } else {
                                            Image(systemName: "video.slash")
                                                .font(.system(size: 9))
                                                .foregroundStyle(Theme.textTertiary)
                                        }
                                    }
                                )
                        }
                    }
                    .padding(10)

                    // Teal left accent bar
                    Rectangle()
                        .fill(Theme.accent)
                        .frame(width: 4)
                        .clipShape(RoundedRectangle(cornerRadius: 2))
                        .padding(.vertical, 10)
                }
                .frame(maxWidth: .infinity)
                .background(Color(red: 0.10, green: 0.12, blue: 0.13))

                // MARK: - Form section
                ScrollView {
                    VStack(alignment: .leading, spacing: 0) {

                        // Branding row
                        HStack(spacing: 10) {
                            Rectangle()
                                .fill(Theme.accent)
                                .frame(width: 3, height: 36)
                                .clipShape(RoundedRectangle(cornerRadius: 2))
                            VStack(alignment: .leading, spacing: 2) {
                                Text("CSMS Survey")
                                    .font(.system(size: 20, weight: .bold))
                                    .foregroundStyle(Theme.textPrimary)
                                Text("Video surveillance platform")
                                    .font(.caption)
                                    .foregroundStyle(Theme.textSecondary)
                            }
                        }
                        .padding(.top, 28)
                        .padding(.bottom, 24)
                        .padding(.horizontal, 24)

                        // Form card
                        VStack(spacing: 20) {
                            if let msg = errorMsg {
                                HStack(spacing: 10) {
                                    Image(systemName: "exclamationmark.triangle.fill")
                                        .foregroundStyle(Theme.danger)
                                    Text(msg)
                                        .font(.caption)
                                        .foregroundStyle(Theme.danger)
                                }
                                .padding(14)
                                .frame(maxWidth: .infinity, alignment: .leading)
                                .background(Theme.dangerSoft)
                                .clipShape(RoundedRectangle(cornerRadius: 10))
                                .overlay(RoundedRectangle(cornerRadius: 10).stroke(Theme.danger.opacity(0.25), lineWidth: 1))
                            }

                            labeledField(label: "Email") {
                                TextField("you@example.com", text: $email)
                                    .textContentType(.emailAddress)
                                    .keyboardType(.emailAddress)
                                    .autocapitalization(.none)
                                    .darkField()
                            }

                            labeledField(label: "Password") {
                                SecureField("Password", text: $password)
                                    .textContentType(.password)
                                    .darkField()
                            }

                            Button {
                                Task { await signIn() }
                            } label: {
                                if isLoading {
                                    ProgressView().tint(.white)
                                } else {
                                    Text("Sign In")
                                }
                            }
                            .tealButtonStyle(isLoading: isLoading)
                            .disabled(email.isEmpty || password.isEmpty || isLoading)
                            .padding(.top, 4)
                        }
                        .padding(24)
                        .background(Theme.surface)
                        .clipShape(RoundedRectangle(cornerRadius: 20))
                        .overlay(RoundedRectangle(cornerRadius: 20).stroke(Theme.border, lineWidth: 1))
                        .padding(.horizontal, 20)

                        Spacer(minLength: 32)

                        Text("Digital Support Systems")
                            .font(.caption2)
                            .foregroundStyle(Theme.textTertiary)
                            .frame(maxWidth: .infinity)
                            .padding(.bottom, 24)
                    }
                }
            }
        }
        .onAppear { startGridAnimation() }
    }

    // MARK: - Grid pulse animation

    private func startGridAnimation() {
        Timer.scheduledTimer(withTimeInterval: 1.8, repeats: true) { _ in
            withAnimation(.easeInOut(duration: 0.6)) {
                var next = activeCells
                let toDeactivate = activeCells.randomElement()
                let inactive = Set(0..<totalCells).subtracting(activeCells)
                let toActivate = inactive.randomElement()
                if let off = toDeactivate { next.remove(off) }
                if let on  = toActivate  { next.insert(on) }
                activeCells = next
            }
        }
    }

    // MARK: - Helpers

    @ViewBuilder
    private func labeledField<F: View>(label: String, @ViewBuilder content: () -> F) -> some View {
        VStack(alignment: .leading, spacing: 7) {
            Text(label)
                .font(.caption.weight(.semibold))
                .foregroundStyle(Theme.textSecondary)
                .tracking(0.4)
            content()
        }
    }

    private func signIn() async {
        isLoading = true
        errorMsg  = nil
        do {
            try await auth.login(email: email, password: password)
        } catch {
            errorMsg = error.localizedDescription
        }
        isLoading = false
    }
}
