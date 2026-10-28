# Decart Realtime AI Camera MVP — Plan

## Product and implementation

Adapt Decart’s official `DecartAI/sdk/examples/nextjs-realtime` Next.js starter in this project. Preserve its realtime session lifecycle, prompt update pattern, reconnect handling, and server-minted client-token route. Extend the UI into the approved solo-camera MVP: select one of Lucy 2.6, Lucy VTON 3.6, or Lucy Restyle 2; preview camera and microphone state; start and end a live transformation session; display transformed output with the original feed; edit and apply the prompt; and select a bundled preset or session-only local upload as the reference image. Users can preview, apply, change, or clear a reference image. Uploads remain in browser memory in this app and are cleared at session end; the live camera stream and applied images are sent to Decart for processing, whose retention policies this app does not control. Keep the permanent Decart API key on the server and expose only short-lived client tokens. No login or rate limiting is added in this MVP.

## Design

Visual directions considered: dark studio console (probability 0.07); bright editorial camera workspace (0.04); playful analog camcorder (0.02). Chosen: dark studio console, extending the official starter rather than replacing its Decart integration or identity.

Use an editorial studio-console treatment: graphite surfaces frame the camera stage, crisp neutral panels hold controls, and a restrained electric-lime accent signals active processing. The core principles are stage-first hierarchy, explicit live/device states, compact controls, and fidelity to Decart’s identity. Favor a large video stage and compact stacked controls on phones, with transformed/original previews side by side and controls adjacent at desktop widths. Signature elements are a camera-stage frame, lime connection glint, and monospaced technical labels. Keep the video visible above the fold, with a clear status badge and recognizable camera/mic switches. Use short transitions only for panel and status changes; never delay camera/session controls. Use DM Sans for interface copy and DM Mono for technical labels, with system fallbacks. Brand essence: a direct, responsive live camera transformation studio; personality: clear, playful, capable. Voice is concise and action-oriented, for example “Choose a look” and “Apply to live video.” Use Decart’s official wordmark and do not invent a replacement logo.

## Project structure

- `app/page.tsx` and `app/layout.tsx`: single-page responsive experience and document shell.
- `app/api/realtime-token/route.ts`: server-side short-lived token issuance using `DECART_API_KEY`.
- `components/`: session lifecycle, video stage, camera/microphone controls, model selection, prompt and reference-image controls.
- `public/`: route manifest and official Decart wordmark; reference presets and subtle studio artwork use managed project storage.
- Existing starter package/config files: preserve the Next.js/SDK-compatible toolchain and scripts.

## Serving and operational constraints

Next.js serves the UI at port 3000; the static route manifest declares only `/`, and the token endpoint executes server-side. No persistent database, user identity, call history, or recording pipeline is added. A browser permission and Decart API key are required for a live session; this MVP token endpoint is intentionally unauthenticated and not rate-limited. The app itself does not persist uploads, and the website remains unpublished unless explicitly requested.
