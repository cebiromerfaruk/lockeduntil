# Future Vault (lockeduntil)

Future Vault is a lightweight time‑locked vault that keeps your important information sealed until the date you choose. Data is encrypted with AES‑256‑GCM, keys are managed through Google Cloud KMS, and everything is stored securely in Firestore.

## Features

- 🔐 **Time lock:** Set an opening date for each message.
- 🗝️ **Dual password system:** Generates separate passwords for the creator and the viewer.
- ☁️ **Cloud‑backed security:** Scales with Firestore and KMS.
- 🌐 **Web interface and API:** Interact via pages under `server/public` or through the REST API.
- 🕒 **Trusted time source:** Server fetches UTC time from Google Public NTP (`time.google.com`) and falls back to the last
  known good value on failure.

## Getting Started

```
cd server
npm install
npm start
```

The server listens on port `8080` by default.

Configure the following environment variables to use KMS and Firestore:

```
GOOGLE_CLOUD_PROJECT  # Google Cloud project ID
KMS_LOCATION          # Default: europe-west1
KMS_KEYRING           # KMS key ring
KMS_KEYNAME           # KMS key name
```

## License

MIT

