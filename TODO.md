# TODO — Decart Realtime AI Camera MVP

- [x] **Official Next.js starter and Decart token route:** Clone/adapt the official `DecartAI/sdk/examples/nextjs-realtime` project. Preserve its realtime connection/reconnect and prompt-update pattern. Use a server endpoint to mint short-lived client tokens with the permanent Decart API key kept server-side.
  - Progress: Adapted the official starter, retained reconnect/prompt behavior, and restricted short-lived tokens to the three approved models. TypeScript/build pass; the client-token `apiKey` field was confirmed against the installed SDK and official example. Live token issuance remains untested until a key is supplied.
- [x] **Start screen and model choice:** Show local camera preview, camera and microphone toggles, and a pre-session model selector for Lucy 2.6, Lucy VTON 3.6, or Lucy Restyle 2. Start the realtime AI session from this screen.
  - Progress: Implemented in the start/control UI; source stream attachment for the live original-feed preview was corrected. Build passes.
- [ ] **Live transformed session:** Show AI-transformed video as the main stream and the original camera as a visible preview. Show clear connection/session states. Keep camera and microphone controls available in-session and provide an end-session action.
  - Progress: Implemented, but an actual Decart WebRTC session and camera/microphone interaction are not verified without the API key and browser media permissions.
- [ ] **Live prompt controls:** Let the user edit the transformation prompt and apply prompt changes during the active session.
  - Progress: Prompt editing/update path is wired to the SDK; live application remains unverified until a session can be started.
- [ ] **Session-only reference image workflow:** Offer bundled reference-image presets and a device-upload control. Preview the selected image; apply, change, or clear it during the session. Uploaded images must not persist beyond the current session or app reload.
  - Progress: Five preset assets resolve from managed storage; device uploads remain in browser memory and clear with the session/component lifecycle. Applying a reference to a live Decart session remains unverified pending a key.
- [x] **Mobile-responsive MVP scope:** Make the experience usable on phones and desktop. Exclude person-to-person conferencing, persistent image libraries, saved recordings/results, call history/dashboard, and advanced settings.
  - Progress: Responsive breakpoints and the stated solo-camera scope are implemented; no conferencing, stored results/history, dashboard, or advanced-settings surface was added.
