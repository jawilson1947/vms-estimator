# CSMS Survey — iOS App

Native SwiftUI app for the CSMS survey workflow. Calls the same REST API as the web app.

## Prerequisites

| Tool | Version | Install |
|------|---------|---------|
| Xcode | 15.x+ | Mac App Store |
| XcodeGen | any | `brew install xcodegen` |
| Next.js dev server | running | `npm run dev` in project root |

## First-time setup

### 1. Configure the API base URL

Edit `ios/Debug.xcconfig` and replace `YOUR_LOCAL_IP` with your Mac's LAN IP:

```
# Find your IP:
ipconfig getifaddr en0

# Then update:
API_BASE_URL = http://192.168.x.x:3000
```

For production builds, update `ios/Release.xcconfig`:

```
API_BASE_URL = https://your-production-domain.com
```

### 2. Generate the Xcode project

```bash
cd ios
xcodegen generate
```

This creates `CSMSSurvey.xcodeproj`. Re-run any time you add or remove Swift files.

### 3. Open and run

```bash
open CSMSSurvey.xcodeproj
```

- Select your iPhone as the run destination
- Press **Cmd+R** to build and run
- Set your Apple Team ID in project settings if Xcode asks for code signing

### 4. On first launch

- Allow microphone access when iOS prompts
- Allow speech recognition when iOS prompts
- Log in with your existing CSMS credentials

## Project structure

```
ios/
  project.yml                  — XcodeGen spec (source of truth for project config)
  Debug.xcconfig               — local dev URL (not committed with real IP)
  Release.xcconfig             — production URL
  CSMSSurvey/
    App/
      CSMSSurveyApp.swift      — @main, injects AuthService + VoiceCommandManager
      AppEnvironment.swift     — base URL from Info.plist, shared URLSession
    Models/
      Site.swift               — SurveySite, SurveyBuilding, SiteSummary
      SurveyLocation.swift     — SurveyLocation, LocationCamera, request bodies
      SurveyPhoto.swift        — SurveyPhoto
    Services/
      AuthService.swift        — NextAuth credentials login / session cookie
      APIClient.swift          — async/await wrappers for all 7 survey endpoints
    ViewModels/
      SiteListViewModel.swift
      SurveyBoardViewModel.swift
      LocationDetailViewModel.swift
    Views/
      Auth/
        LoginView.swift
      Survey/
        SiteListView.swift
        SurveyBoardView.swift
        AddLocationSheet.swift
        LocationDetailView.swift
        PhotoGridView.swift
        VoiceQuickRefView.swift
    Voice/
      SpeechOutputManager.swift  — AVSpeechSynthesizer (bypasses silent switch)
      VoiceCommandManager.swift  — SFSpeechRecognizer continuous recognition
    Resources/
      Assets.xcassets
```

## Adding new Swift files

1. Create the `.swift` file in the appropriate folder
2. Run `xcodegen generate` to add it to the project
3. Xcode picks it up automatically on next build

## Voice command architecture

The voice system mirrors the web app exactly:

- `VoiceCommandManager` is a shared singleton (`@StateObject` in the App entry)
- Views call `register(id:commands:)` on `onAppear` and `unregister(id:)` on `onDisappear`
- `waitForValue(_:then:)` opens a 6-second capture window for field values
- `SpeechOutputManager.speak(_:then:)` pauses recognition (via `pauseForSpeech()`) while TTS plays, then resumes — same feedback-loop prevention as the web fix
- All acknowledgement strings are identical to the web version for consistency

## Known differences from the web app

| Feature | Web | iOS |
|---------|-----|-----|
| TTS engine | `speechSynthesis` (buggy on iOS) | `AVSpeechSynthesizer` |
| Silent mode | Respects ringer switch | Bypasses via `.playback` AVAudioSession |
| Auth | NextAuth cookie via browser | Same cookie via URLSession |
| Photo format | Browser-native (any) | JPEG at 0.85 quality |
| Floor plans | Displayed on survey board | Not in MVP |

## Troubleshooting

**"Could not reach the server"** — Check that `Debug.xcconfig` has the correct LAN IP, the Next.js server is running, and both devices are on the same Wi-Fi network.

**No voice recognition** — Open iOS Settings → Privacy & Security → Speech Recognition and ensure CSMS Survey is allowed.

**Auth fails with 403** — The CSRF token fetch may have failed. Kill the app and relaunch; it fetches a fresh token on each login attempt.

**Photos not uploading** — Ensure `BLOB_READ_WRITE_TOKEN` in `.env.local` is set to a real Vercel Blob token (not the placeholder).
