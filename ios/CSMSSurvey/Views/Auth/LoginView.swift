import SwiftUI

struct LoginView: View {
    @EnvironmentObject var auth: AuthService
    @State private var email     = ""
    @State private var password  = ""
    @State private var isLoading = false
    @State private var errorMsg: String?

    // Concentric ring pulse animation
    @State private var pulse = false

    var body: some View {
        ZStack {
            Color(red: 0.06, green: 0.07, blue: 0.08).ignoresSafeArea()

            VStack(spacing: 0) {
                Spacer()

                // MARK: - Logo — concentric rings
                ZStack {
                    Circle()
                        .stroke(Theme.accent.opacity(0.12), lineWidth: 1)
                        .frame(width: 140, height: 140)
                        .scaleEffect(pulse ? 1.18 : 1.0)
                        .opacity(pulse ? 0 : 0.6)
                        .animation(.easeOut(duration: 2.4).repeatForever(autoreverses: false),
                                   value: pulse)

                    Circle()
                        .stroke(Theme.accent.opacity(0.20), lineWidth: 1)
                        .frame(width: 110, height: 110)

                    Circle()
                        .stroke(Theme.accent.opacity(0.35), lineWidth: 1.5)
                        .frame(width: 82, height: 82)

                    Circle()
                        .fill(Theme.accent.opacity(0.12))
                        .frame(width: 60, height: 60)

                    RoundedRectangle(cornerRadius: 12)
                        .fill(Theme.accent)
                        .frame(width: 36, height: 36)
                        .overlay(
                            Image(systemName: "camera.fill")
                                .font(.system(size: 16, weight: .semibold))
                                .foregroundStyle(.white)
                        )
                }
                .padding(.bottom, 28)

                // MARK: - Wordmark
                VStack(spacing: 4) {
                    Text("CSMS")
                        .font(.system(size: 28, weight: .bold, design: .default))
                        .foregroundStyle(Theme.textPrimary)
                        .tracking(6)
                    Text("SURVEY")
                        .font(.system(size: 11, weight: .medium))
                        .foregroundStyle(Theme.textSecondary)
                        .tracking(8)
                }
                .padding(.bottom, 48)

                // MARK: - Form
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
                        .overlay(RoundedRectangle(cornerRadius: 10)
                            .stroke(Theme.danger.opacity(0.25), lineWidth: 1))
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
                .padding(.horizontal, 28)

                Spacer()

                // MARK: - Footer
                HStack(spacing: 8) {
                    Rectangle()
                        .fill(Theme.textTertiary)
                        .frame(width: 24, height: 0.5)
                    Text("Digital Support Systems")
                        .font(.caption2)
                        .foregroundStyle(Theme.textTertiary)
                        .tracking(1)
                    Rectangle()
                        .fill(Theme.textTertiary)
                        .frame(width: 24, height: 0.5)
                }
                .padding(.bottom, 32)
            }
        }
        .onAppear { pulse = true }
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
