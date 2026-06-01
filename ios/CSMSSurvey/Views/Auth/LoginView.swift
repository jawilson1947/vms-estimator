import SwiftUI

struct LoginView: View {
    @EnvironmentObject var auth: AuthService
    @State private var email    = ""
    @State private var password = ""
    @State private var isLoading = false
    @State private var errorMsg: String?

    var body: some View {
        ZStack {
            // Warm charcoal gradient background
            LinearGradient(
                colors: [
                    Color(red: 0.09, green: 0.10, blue: 0.11),
                    Color(red: 0.12, green: 0.14, blue: 0.15),
                ],
                startPoint: .topLeading, endPoint: .bottomTrailing
            )
            .ignoresSafeArea()

            VStack(spacing: 0) {
                Spacer()

                // Logo block
                VStack(spacing: 10) {
                    ZStack {
                        RoundedRectangle(cornerRadius: 18)
                            .fill(
                                LinearGradient(
                                    colors: [Theme.accent, Theme.accentDeep],
                                    startPoint: .topLeading, endPoint: .bottomTrailing
                                )
                            )
                            .frame(width: 72, height: 72)
                            .shadow(color: Theme.accent.opacity(0.35), radius: 16, y: 6)
                        Image(systemName: "camera.fill")
                            .font(.system(size: 30, weight: .semibold))
                            .foregroundStyle(.white)
                    }
                    .padding(.bottom, 4)

                    Text("CSMS Survey")
                        .font(.system(size: 30, weight: .bold, design: .default))
                        .foregroundStyle(Theme.textPrimary)
                    Text("Professional site survey tool")
                        .font(.subheadline)
                        .foregroundStyle(Theme.textSecondary)
                }
                .padding(.bottom, 44)

                // Card
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
                .padding(28)
                .background(Theme.surface)
                .clipShape(RoundedRectangle(cornerRadius: 22))
                .overlay(RoundedRectangle(cornerRadius: 22).stroke(Theme.border, lineWidth: 1))
                .shadow(color: .black.opacity(0.30), radius: 28, y: 12)
                .padding(.horizontal, 24)

                Spacer()

                Text("Digital Support Systems")
                    .font(.caption2)
                    .foregroundStyle(Theme.textTertiary)
                    .padding(.bottom, 28)
            }
        }
    }

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
