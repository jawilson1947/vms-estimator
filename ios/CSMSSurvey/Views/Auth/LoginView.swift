import SwiftUI

struct LoginView: View {
    @EnvironmentObject var auth: AuthService
    @State private var email    = ""
    @State private var password = ""
    @State private var isLoading = false
    @State private var errorMsg: String?

    var body: some View {
        ZStack {
            Color(red: 0.118, green: 0.227, blue: 0.373)
                .ignoresSafeArea()

            VStack(spacing: 0) {
                Spacer()

                // Logo block
                VStack(spacing: 8) {
                    ZStack {
                        RoundedRectangle(cornerRadius: 16)
                            .fill(Color.blue)
                            .frame(width: 64, height: 64)
                        Image(systemName: "camera.fill")
                            .font(.system(size: 28))
                            .foregroundStyle(.white)
                    }
                    Text("CSMS Survey")
                        .font(.system(size: 28, weight: .bold))
                        .foregroundStyle(.white)
                    Text("Site survey tool")
                        .font(.subheadline)
                        .foregroundStyle(.white.opacity(0.6))
                }
                .padding(.bottom, 40)

                // Card
                VStack(spacing: 16) {
                    if let msg = errorMsg {
                        HStack(spacing: 8) {
                            Image(systemName: "exclamationmark.triangle.fill")
                                .foregroundStyle(.red)
                            Text(msg)
                                .font(.caption)
                                .foregroundStyle(.red)
                        }
                        .padding(12)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .background(Color.red.opacity(0.1))
                        .clipShape(RoundedRectangle(cornerRadius: 8))
                    }

                    VStack(alignment: .leading, spacing: 6) {
                        Text("Email").font(.caption).foregroundStyle(.secondary)
                        TextField("you@example.com", text: $email)
                            .textContentType(.emailAddress)
                            .keyboardType(.emailAddress)
                            .autocapitalization(.none)
                            .textFieldStyle(.roundedBorder)
                    }

                    VStack(alignment: .leading, spacing: 6) {
                        Text("Password").font(.caption).foregroundStyle(.secondary)
                        SecureField("Password", text: $password)
                            .textContentType(.password)
                            .textFieldStyle(.roundedBorder)
                    }

                    Button {
                        Task { await signIn() }
                    } label: {
                        Group {
                            if isLoading {
                                ProgressView().tint(.white)
                            } else {
                                Text("Sign In")
                                    .fontWeight(.semibold)
                            }
                        }
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 12)
                    }
                    .buttonStyle(.borderedProminent)
                    .disabled(email.isEmpty || password.isEmpty || isLoading)
                }
                .padding(24)
                .background(Color(.systemBackground))
                .clipShape(RoundedRectangle(cornerRadius: 20))
                .shadow(radius: 20, y: 8)
                .padding(.horizontal, 24)

                Spacer()
            }
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
