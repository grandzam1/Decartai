# Decart Realtime AI Camera MVP

A mobile-responsive, single-user camera transformation app adapted from Decart's official Next.js realtime example. It includes Lucy 2.6, Lucy VTON 3.6, and Lucy Restyle 2; camera/microphone controls; a live prompt; five bundled garment-reference presets; and a session-only image upload.

## Run locally

```bash
cp .env.example .env.local
# Set DECART_API_KEY in .env.local
pnpm install
pnpm dev
```

Open `http://localhost:3000`. The browser asks for camera permission when you enable the preview. The server's `/api/realtime-token` route uses `DECART_API_KEY` to mint short-lived client tokens; the permanent key is never sent to browser code. Without a Decart API key, the interface and build still run, but starting a realtime session returns a clear configuration error.

During a live session, the camera stream and any applied reference image are sent to Decart for processing. This app does not persist them; Decart's own data handling is governed by its policies. The token endpoint is unauthenticated and not rate-limited in this MVP, so add access controls and abuse protection before exposing it broadly.

## Controls and image handling

Choose a model before starting. Select one of the bundled reference presets or upload a PNG, JPEG, or WebP from the device. Uploads are kept in browser memory only and cleared when the session ends or the page reloads; applying an image sends it to Decart. Applying a new model requires ending the current session and starting again.

The app is a solo-camera transformation experience, not a person-to-person video conferencing service. The app itself does not retain calls, recordings, uploaded images, or user accounts.

## Upstream sources

- Next.js realtime starter and Decart integration: [DecartAI/sdk, `examples/nextjs-realtime`](https://github.com/DecartAI/sdk/tree/main/examples/nextjs-realtime), MIT License.
- Bundled garment preset images: [DecartAI/tryon-examples, `examples/ecommerce`](https://github.com/DecartAI/tryon-examples/tree/main/examples/ecommerce), MIT License. The images were resized/compressed for this app. See [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
- Realtime API reference: [Decart JavaScript SDK docs](https://docs.platform.decart.ai/sdks/javascript-realtime).
