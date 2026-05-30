# AgriTask (Mobile App)

AgriTask is a React Native (Expo) mobile app for managing field/team operations: tasks, attendance, location tracking, feedback collection, and notifications.

## Tech stack

- Expo SDK + React Native
- `expo-router` for navigation
- Axios for API calls
- Offline queue support (see `services/offlineQueue.js`)
- Maps/location via `expo-location` + `react-native-maps`

## Prerequisites

- Node.js **18+** (EAS config allows `>= 18`)
- One package manager:
  - Yarn (recommended if you prefer `yarn.lock`), or
  - npm
- Android Studio (for Android emulator) and/or a physical device
- (Optional) Expo Go on your phone for quick testing

## Setup

1) Install dependencies

- With Yarn:

  ```bash
  yarn install
  ```

- With npm:

  ```bash
  npm install
  ```

2) Configure environment variables

This repo intentionally does **not** commit `.env`.

- Create your local env file:

  ```bash
  cp .env.example .env
  ```

- Update at least:

  - `EXPO_PUBLIC_API_URL` (your backend base URL)

  Tip: for physical devices, use your machine’s LAN IP (not `localhost`).

## Run (development)

Start the Expo dev server:

```bash
npm run start
# or: yarn start
```

Then run on a platform:

- Android:

  ```bash
  npm run android
  # or: yarn android
  ```

- iOS (macOS required):

  ```bash
  npm run ios
  # or: yarn ios
  ```

- Web:

  ```bash
  npm run web
  # or: yarn web
  ```

## Build (EAS)

EAS is configured in `eas.json`.

- Preview APK (Android):

  ```bash
  eas build --profile preview --platform android
  ```

- Production AAB (Android):

  ```bash
  eas build --profile production --platform android
  ```

## Repo notes

- Do not commit secrets: `.env` is ignored via `.gitignore`.
- Do not commit installable dependencies: `node_modules/` is ignored.
- App routes live under `app/` (expo-router).

## Troubleshooting

- If Metro/expo caching causes weird issues:

  ```bash
  npx expo start -c
  ```
