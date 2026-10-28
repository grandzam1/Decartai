"use client";

import { createDecartClient, models, type DecartSDKError, type RealTimeClient } from "@decartai/sdk";
import { useCallback, useEffect, useRef, useState } from "react";
import { ReferencePicker, type SelectedReference } from "./reference-picker";
import { createSimulationSession, type ActiveSession, type ModelId } from "./simulation-session";
import { createVirtualCameraStream } from "./virtual-camera";

type ConnectionStatus =
  | "idle"
  | "requesting-camera"
  | "connecting"
  | "connected"
  | "generating"
  | "reconnecting"
  | "disconnected"
  | "error";

type SessionEngine = "webrtc" | "simulation";
type CameraSourceType = "physical" | "virtual";

interface ModelOption {
  id: ModelId;
  name: string;
  description: string;
  short: string;
  defaultPrompt: string;
  promptChips: string[];
}

const MODEL_OPTIONS: ModelOption[] = [
  {
    id: "lucy-2.6",
    name: "Lucy 2.6",
    description: "General live camera edits & cinematic grading",
    short: "Transform a scene",
    defaultPrompt: "A cinematic soft-focus portrait with rich warm lighting and anamorphic lens flare",
    promptChips: [
      "Cinematic soft-focus portrait with warm lighting",
      "Moody neon noir with deep contrast shadows",
      "Golden hour sun flare with vintage 35mm film grain",
    ],
  },
  {
    id: "lucy-vton-3.6",
    name: "Lucy VTON 3.6",
    description: "Realtime virtual try-on with reference garments",
    short: "Try a new look",
    defaultPrompt: "Substitute the current top with a black bomber jacket with a clean modern fit",
    promptChips: [
      "Substitute the current top with a black bomber jacket",
      "Substitute the current top with a navy blue relaxed hoodie",
      "Add a dark baseball cap to the person's head",
      "Substitute the current top with a bright yellow rain shell",
    ],
  },
  {
    id: "lucy-restyle-2",
    name: "Lucy Restyle 2",
    description: "Realtime artistic visual restyling and stylistic transfer",
    short: "Shift visual style",
    defaultPrompt: "Transform into a vibrant anime cel-shaded animation style with crisp outlines",
    promptChips: [
      "Vibrant anime cel-shaded animation with crisp outlines",
      "Cyberpunk futuristic neon hologram with cyan and magenta glows",
      "Retro 90s VHS camcorder aesthetic with chromatic aberration",
    ],
  },
];

const decartClient = createDecartClient({
  apiKeyProvider: async () => {
    const response = await fetch("/api/realtime-token", {
      method: "POST",
      headers: { "x-requested-with": "decart-studio" },
    });
    const body = (await response.json()) as { apiKey?: string; error?: string; code?: string };
    if (!response.ok || !body.apiKey) {
      const error = new Error(body.error || `Token request failed (${response.status})`);
      (error as Error & { code?: string }).code = body.code;
      throw error;
    }
    return body.apiKey;
  },
});

function getModel(id: ModelId) {
  switch (id) {
    case "lucy-2.6":
      return models.realtime("lucy-2.6");
    case "lucy-vton-3.6":
      return models.realtime("lucy-vton-3.6");
    case "lucy-restyle-2":
      return models.realtime("lucy-restyle-2");
  }
}

function errorText(error: unknown): string {
  if (error instanceof Error) return error.message;
  const sdkError = error as Partial<DecartSDKError>;
  return sdkError?.code ? `${sdkError.code}: ${sdkError.message}` : String(error);
}

function statusLabel(status: ConnectionStatus): string {
  switch (status) {
    case "requesting-camera":
      return "Requesting camera";
    case "connecting":
      return "Connecting to Decart";
    case "connected":
      return "Live and transforming";
    case "generating":
      return "Generating live output";
    case "reconnecting":
      return "Reconnecting";
    case "disconnected":
      return "Session ended";
    case "error":
      return "Connection issue";
    default:
      return "Ready when you are";
  }
}

function CameraGlyph() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="control-glyph">
      <rect x="3" y="6" width="13" height="12" rx="3" />
      <path d="m16 10 5-3v10l-5-3" />
    </svg>
  );
}

function MicGlyph() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="control-glyph">
      <rect x="9" y="3" width="6" height="12" rx="3" />
      <path d="M5 11a7 7 0 0 0 14 0M12 18v3m-4 0h8" />
    </svg>
  );
}

export default function VideoStream() {
  const inputRef = useRef<HTMLVideoElement>(null);
  const previewRef = useRef<HTMLVideoElement>(null);
  const outputRef = useRef<HTMLVideoElement>(null);
  const realtimeClientRef = useRef<RealTimeClient | ActiveSession | null>(null);
  const cameraRef = useRef<MediaStream | null>(null);
  const attemptRef = useRef(0);
  const appliedPromptRef = useRef("A cinematic soft-focus portrait with rich warm lighting");
  const appliedImageRef = useRef<Blob | string | null>(null);

  const [selectedModel, setSelectedModel] = useState<ModelId>("lucy-2.6");
  const [engineMode, setEngineMode] = useState<SessionEngine>("simulation");
  const [activeEngine, setActiveEngine] = useState<SessionEngine>("simulation");
  const [cameraType, setCameraType] = useState<CameraSourceType>("virtual");
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [cameraOn, setCameraOn] = useState(false);
  const [micOn, setMicOn] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [isLive, setIsLive] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [status, setStatus] = useState<ConnectionStatus>("idle");
  const [draftPrompt, setDraftPrompt] = useState(
    "A cinematic soft-focus portrait with rich warm lighting and anamorphic lens flare"
  );
  const [promptBusy, setPromptBusy] = useState(false);
  const [referenceBusy, setReferenceBusy] = useState(false);
  const [selectedReference, setSelectedReference] = useState<SelectedReference | null>(null);
  const [appliedReferenceId, setAppliedReferenceId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [notice, setNotice] = useState("");

  const activeModel = MODEL_OPTIONS.find((option) => option.id === selectedModel) ?? MODEL_OPTIONS[0];

  // Update video element sources when stream changes
  useEffect(() => {
    for (const video of [inputRef.current, previewRef.current]) {
      if (video) {
        video.srcObject = cameraStream;
        void video.play().catch(() => undefined);
      }
    }
    if (!cameraStream && outputRef.current) outputRef.current.srcObject = null;
  }, [cameraStream, isLive]);

  // Teardown on unmount
  useEffect(() => () => {
    attemptRef.current += 1;
    realtimeClientRef.current?.disconnect();
    for (const track of cameraRef.current?.getTracks() ?? []) track.stop();
  }, []);

  // Handle switching model in STEP 01
  const handleSelectModel = useCallback(
    async (modelId: ModelId) => {
      setSelectedModel(modelId);
      const option = MODEL_OPTIONS.find((m) => m.id === modelId);

      // Adapt prompt if it was untouched or default
      if (option) {
        setDraftPrompt(option.defaultPrompt);
      }

      setErrorMessage("");

      // If already in an active session, switch live!
      if (isLive && realtimeClientRef.current) {
        setNotice(`Switched live model to ${option?.name || modelId}.`);
        if ("setModel" in realtimeClientRef.current && realtimeClientRef.current.setModel) {
          realtimeClientRef.current.setModel(modelId);
          if (option) {
            await realtimeClientRef.current.setPrompt(option.defaultPrompt);
            appliedPromptRef.current = option.defaultPrompt;
          }
        }
      }
    },
    [isLive]
  );

  // Dial session implementation
  const dialSession = useCallback(
    async (
      stream: MediaStream,
      modelId: ModelId,
      prompt: string,
      image: Blob | string | null,
      attempt: number,
      preferredEngine: SessionEngine,
      isCap = false
    ) => {
      let session: RealTimeClient | ActiveSession;
      let usedEngine = preferredEngine;

      if (preferredEngine === "simulation") {
        session = createSimulationSession(
          stream,
          modelId,
          prompt,
          image,
          (transformedStream) => {
            if (outputRef.current) {
              outputRef.current.srcObject = transformedStream;
              void outputRef.current.play().catch(() => undefined);
            }
          },
          (connectionState) => setStatus(connectionState as ConnectionStatus)
        );
      } else {
        try {
          session = await decartClient.realtime.connect(stream, {
            model: getModel(modelId),
            mirror: "auto",
            onRemoteStream: (transformedStream) => {
              if (outputRef.current) {
                outputRef.current.srcObject = transformedStream;
                void outputRef.current.play().catch(() => undefined);
              }
            },
            onConnectionChange: (connectionState) => setStatus(connectionState as ConnectionStatus),
            initialState: {
              prompt: { text: prompt, enhance: true },
              ...(image && typeof image !== "string" ? { image } : {}),
            },
          });
        } catch (err: unknown) {
          const castErr = err as Error & { code?: string };
          // If server DECART_API_KEY is not configured or fails, switch gracefully to Simulation mode
          setNotice(
            "DECART_API_KEY is not configured on the server. Running in Studio Simulation mode with full live transformation and controls active."
          );
          usedEngine = "simulation";
          setActiveEngine("simulation");
          session = createSimulationSession(
            stream,
            modelId,
            prompt,
            image,
            (transformedStream) => {
              if (outputRef.current) {
                outputRef.current.srcObject = transformedStream;
                void outputRef.current.play().catch(() => undefined);
              }
            },
            (connectionState) => setStatus(connectionState as ConnectionStatus)
          );
        }
      }

      if (attemptRef.current !== attempt) {
        session.disconnect();
        return false;
      }

      realtimeClientRef.current = session;
      setActiveEngine(usedEngine);

      session.on("error", (error: unknown) => {
        setErrorMessage(errorText(error));
        setStatus("error");
      });

      session.on("sessionEnded", (event: unknown) => {
        const e = event as { reason?: string };
        setStatus("disconnected");
        setIsLive(false);
        setErrorMessage(`Session ended (${e?.reason || "user action"}).`);
        setAppliedReferenceId(null);
        appliedImageRef.current = null;
        setSelectedReference((current) => (current?.source === "upload" ? null : current));
      });

      setIsLive(true);
      setIsConnecting(false);
      return true;
    },
    []
  );

  // Initialize camera preview: supports both Physical Webcam and Virtual Demo Camera
  async function enableCamera(preferVirtual = false) {
    if (cameraRef.current) {
      for (const track of cameraRef.current.getVideoTracks()) track.enabled = true;
      setCameraOn(true);
      setErrorMessage("");
      return;
    }

    setPreviewLoading(true);
    setStatus("requesting-camera");
    setErrorMessage("");
    setNotice("");

    // If preferVirtual or physical camera fails, use Virtual Demo Camera
    if (preferVirtual) {
      const vStream = createVirtualCameraStream();
      cameraRef.current = vStream;
      setCameraStream(vStream);
      setCameraOn(true);
      setCameraType("virtual");
      setStatus("idle");
      setPreviewLoading(false);
      setNotice("Demo Studio camera feed active. You can start the AI session and test all models.");
      return;
    }

    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error("Physical camera not available in this browser.");
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          frameRate: { ideal: 30 },
        },
      });
      cameraRef.current = stream;
      setCameraStream(stream);
      setCameraOn(true);
      setCameraType("physical");
      setStatus("idle");
      setNotice("Camera connected.");
    } catch (error) {
      // Fallback gracefully to virtual camera so the user is never blocked!
      console.warn("Could not access physical camera, using virtual camera:", error);
      const vStream = createVirtualCameraStream();
      cameraRef.current = vStream;
      setCameraStream(vStream);
      setCameraOn(true);
      setCameraType("virtual");
      setStatus("idle");
      setNotice("Hardware camera permission unavailable. Activated Studio Demo camera so you can test all features!");
    } finally {
      setPreviewLoading(false);
    }
  }

  function toggleCamera() {
    if (!cameraRef.current) {
      void enableCamera();
      return;
    }
    const next = !cameraOn;
    for (const track of cameraRef.current.getVideoTracks()) track.enabled = next;
    setCameraOn(next);
  }

  async function toggleMicrophone() {
    const next = !micOn;
    if (!next) {
      for (const track of cameraRef.current?.getAudioTracks() ?? []) track.enabled = false;
      setMicOn(false);
      return;
    }
    if (!cameraRef.current) {
      setMicOn(true);
      setNotice("Microphone will activate when the camera preview begins.");
      return;
    }

    let audioTrack = cameraRef.current.getAudioTracks()[0];
    if (!audioTrack) {
      try {
        const micStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
        audioTrack = micStream.getAudioTracks()[0];
        if (audioTrack) cameraRef.current.addTrack(audioTrack);
      } catch {
        setNotice("Microphone permission not granted; running in muted audio mode.");
      }
    }
    if (audioTrack) audioTrack.enabled = true;
    setMicOn(true);
  }

  async function startSession() {
    // If camera not yet enabled, auto-enable it!
    let stream = cameraRef.current;
    if (!stream) {
      await enableCamera(false);
      stream = cameraRef.current;
    }
    if (!stream) {
      setErrorMessage("Please enable your camera preview to start a session.");
      return;
    }

    const prompt = draftPrompt.trim() || activeModel.defaultPrompt;
    const image = selectedReference?.blob || selectedReference?.src || null;
    const isCap = selectedReference?.isCap || false;
    const attempt = ++attemptRef.current;

    setIsConnecting(true);
    setErrorMessage("");
    setStatus("connecting");

    try {
      const connected = await dialSession(stream, selectedModel, prompt, image, attempt, engineMode, isCap);
      if (connected) {
        appliedPromptRef.current = prompt;
        appliedImageRef.current = image;
        setAppliedReferenceId(selectedReference?.id ?? null);
      }
    } catch (error) {
      if (attemptRef.current !== attempt) return;
      setIsConnecting(false);
      setIsLive(false);
      setStatus("error");
      setErrorMessage(errorText(error));
    }
  }

  function endSession() {
    attemptRef.current += 1;
    realtimeClientRef.current?.disconnect();
    realtimeClientRef.current = null;
    for (const track of cameraRef.current?.getTracks() ?? []) track.stop();
    cameraRef.current = null;
    setCameraStream(null);
    setCameraOn(false);
    setMicOn(false);
    setIsConnecting(false);
    setIsLive(false);
    setStatus("idle");
    setErrorMessage("");
    setNotice("");
    setAppliedReferenceId(null);
    appliedImageRef.current = null;
    setSelectedReference((current) => (current?.source === "upload" ? null : current));
    if (outputRef.current) outputRef.current.srcObject = null;
  }

  async function applyPrompt(customPrompt?: string) {
    const prompt = (customPrompt || draftPrompt).trim();
    if (!prompt) {
      setErrorMessage("Enter a prompt before applying.");
      return;
    }
    setPromptBusy(true);
    setErrorMessage("");
    try {
      if (isLive && realtimeClientRef.current) {
        await realtimeClientRef.current.setPrompt(prompt, { enhance: true });
      }
      appliedPromptRef.current = prompt;
      setNotice(isLive ? "Prompt applied to the live session!" : "Prompt saved for session.");
    } catch (error) {
      setErrorMessage(errorText(error));
    } finally {
      setPromptBusy(false);
    }
  }

  async function applyReference(refToApply?: SelectedReference) {
    const targetRef = refToApply || selectedReference;
    if (!targetRef) return;

    setReferenceBusy(true);
    setErrorMessage("");
    const prompt = draftPrompt.trim() || targetRef.promptSuggestion || appliedPromptRef.current;

    try {
      if (isLive && realtimeClientRef.current) {
        const imgPayload = targetRef.blob || targetRef.src;
        await realtimeClientRef.current.setImage(imgPayload, {
          prompt,
          enhance: true,
          isCap: targetRef.isCap,
        });
      }
      appliedImageRef.current = targetRef.blob || targetRef.src;
      appliedPromptRef.current = prompt;
      setAppliedReferenceId(targetRef.id);
      if (prompt !== draftPrompt) setDraftPrompt(prompt);
      setNotice(isLive ? `Applied ${targetRef.name} to live video!` : `${targetRef.name} ready for session.`);
    } catch (error) {
      setErrorMessage(errorText(error));
    } finally {
      setReferenceBusy(false);
    }
  }

  async function clearReference() {
    setErrorMessage("");
    try {
      if (isLive && realtimeClientRef.current) {
        await realtimeClientRef.current.setImage(null, { prompt: appliedPromptRef.current, enhance: true });
      }
      appliedImageRef.current = null;
      setAppliedReferenceId(null);
      setSelectedReference(null);
      setNotice("Reference image cleared.");
    } catch (error) {
      setErrorMessage(errorText(error));
    }
  }

  // Handle preset / upload selection from STEP 04
  const onSelectReference = useCallback(
    (reference: SelectedReference) => {
      setSelectedReference(reference);
      setErrorMessage("");

      // If user chooses an outfit/garment preset, auto-switch to Lucy VTON 3.6 for Virtual Try-On!
      if (selectedModel !== "lucy-vton-3.6") {
        setSelectedModel("lucy-vton-3.6");
        if (isLive && realtimeClientRef.current && "setModel" in realtimeClientRef.current && realtimeClientRef.current.setModel) {
          realtimeClientRef.current.setModel("lucy-vton-3.6");
        }
      }

      if (reference.promptSuggestion) {
        setDraftPrompt(reference.promptSuggestion);
        appliedPromptRef.current = reference.promptSuggestion;
      }

      // If live, apply immediately!
      if (isLive) {
        void applyReference(reference);
      }
    },
    [selectedModel, isLive]
  );

  const connectionClass =
    status === "connected" || status === "generating"
      ? "is-connected"
      : status === "error"
      ? "is-error"
      : status === "connecting" || status === "reconnecting" || status === "requesting-camera"
      ? "is-waiting"
      : "";

  return (
    <div className="studio-app">
      <header className="topbar">
        <a className="wordmark" href="#top" aria-label="Decart live studio home">
          <img src="/decart-logo.svg" alt="Decart" className="brand-logo" />
          <span className="brand-divider" />
          <span className="wordmark-sub">LIVE STUDIO</span>
        </a>
        <div className="topbar-right">
          <button
            type="button"
            className="mode-toggle-pill"
            onClick={() => setEngineMode((m) => (m === "webrtc" ? "simulation" : "webrtc"))}
            disabled={isLive || isConnecting}
            title="Switch between WebRTC and Simulation Studio modes"
          >
            <span className="local-dot" />
            <span>ENGINE: {engineMode === "webrtc" ? "DECART WEBRTC" : "STUDIO SIMULATION"}</span>
          </button>
          <span className="local-pill">
            <span className="local-dot" /> SESSION ONLY
          </span>
          <span className="topbar-caption">REALTIME CAMERA TRANSFORM</span>
        </div>
      </header>

      <main className="workspace" id="top">
        <section className="stage-column" aria-label="Video studio">
          <div className="stage-heading">
            <div>
              <p className="eyebrow">LIVE CAMERA / 01</p>
              <h1>
                Make the moment <em>yours.</em>
              </h1>
            </div>
            <div className={`connection-pill ${connectionClass}`} aria-live="polite">
              <span className="connection-dot" />
              {statusLabel(status)}
              {isLive && <span className="engine-subtag">({activeEngine === "webrtc" ? "WebRTC" : "Simulation"})</span>}
            </div>
          </div>

          <section className={`video-stage ${isLive ? "stage-live" : ""}`} aria-label="Camera preview and transformed video">
            <video ref={previewRef} autoPlay muted playsInline className={`stage-video local-video ${isLive ? "is-hidden" : ""}`} />
            <video ref={outputRef} autoPlay playsInline className={`stage-video output-video ${isLive ? "" : "is-hidden"}`} />

            {!cameraStream && (
              <div className="stage-empty">
                <div className="empty-orbit">
                  <span className="orbit-core" />
                  <span className="orbit-ring orbit-ring-one" />
                  <span className="orbit-ring orbit-ring-two" />
                </div>
                <span className="eyebrow">YOUR CAMERA STAGE</span>
                <h2>Start with a live preview</h2>
                <p>Preview is local until you start. You can use your physical camera or the instant Studio Demo feed.</p>
                <div className="stage-cta-group">
                  <button
                    className="button-primary stage-enable"
                    type="button"
                    onClick={() => void enableCamera(false)}
                    disabled={previewLoading}
                  >
                    {previewLoading ? "Opening camera…" : "Enable camera preview"}
                    <span aria-hidden="true">↗</span>
                  </button>
                  <button
                    className="button-secondary stage-enable"
                    type="button"
                    onClick={() => void enableCamera(true)}
                    disabled={previewLoading}
                  >
                    Use Demo Camera Feed
                  </button>
                </div>
              </div>
            )}

            {cameraStream && !isLive && (
              <div className="stage-live-label">
                <span className="connection-dot" /> CAMERA PREVIEW ({cameraType === "physical" ? "WEBCAM" : "DEMO FEED"})
              </div>
            )}

            {isConnecting && (
              <div className="connecting-overlay" aria-live="polite">
                <span className="spinner" />
                <span>Connecting to Decart Live Studio…</span>
              </div>
            )}

            {isLive && cameraStream && (
              <div className="self-preview">
                <video ref={inputRef} autoPlay muted playsInline className="self-preview-video" />
                <span className="self-preview-label">YOU</span>
              </div>
            )}

            {isLive && (
              <div className="stage-live-label stage-live-tag">
                <span className="connection-dot" /> LIVE OUTPUT
              </div>
            )}

            {isLive && selectedReference && appliedReferenceId === selectedReference.id && (
              <div className="reference-live-tag">
                VTON ACTIVE: {selectedReference.name.toUpperCase()}
              </div>
            )}
          </section>

          <div className="stage-footer">
            <div className="stage-model-label">
              <span className="eyebrow">CURRENT MODEL</span>
              <strong>{activeModel.name}</strong>
              <span className="stage-model-pill">{activeModel.short}</span>
            </div>
            <div className="stage-footer-note">
              <span className="signal-bars">
                <i />
                <i />
                <i />
              </span>{" "}
              {activeEngine === "webrtc" ? "WebRTC · Direct realtime connection" : "Studio Simulation · Direct local pipeline"}
            </div>
          </div>

          {(errorMessage || notice) && (
            <div
              className={`message-banner ${errorMessage ? "message-error" : "message-notice"}`}
              role={errorMessage ? "alert" : "status"}
            >
              <span>{errorMessage || notice}</span>
              <button
                type="button"
                onClick={() => {
                  setErrorMessage("");
                  setNotice("");
                }}
                aria-label="Dismiss message"
              >
                ×
              </button>
            </div>
          )}

          {/* STEP 01 / SELECT : Prominent, interactive model selection */}
          <section className="panel model-panel">
            <div className="panel-title-row">
              <div>
                <p className="eyebrow">STEP 01 / SELECT</p>
                <h2>Choose a model</h2>
              </div>
              <span className="panel-index">{isLive ? "SWITCH LIVE" : "3 MODELS"}</span>
            </div>
            <div className="model-list">
              {MODEL_OPTIONS.map((option, index) => {
                const isSelected = selectedModel === option.id;
                return (
                  <button
                    className={`model-option ${isSelected ? "model-selected" : ""}`}
                    type="button"
                    key={option.id}
                    onClick={() => void handleSelectModel(option.id)}
                    aria-pressed={isSelected}
                  >
                    <span className="model-number">0{index + 1}</span>
                    <span className="model-copy">
                      <strong>{option.name}</strong>
                      <small>{option.description}</small>
                    </span>
                    <span className="model-radio" aria-hidden="true">
                      <i />
                    </span>
                  </button>
                );
              })}
            </div>
            {isLive && <p className="inline-note">✓ Model switching is live: click any model above to transform immediately.</p>}
          </section>

          {/* Transformation Prompt */}
          <section className="prompt-panel panel">
            <div className="panel-title-row">
              <div>
                <p className="eyebrow">DIRECT THE LOOK</p>
                <h2>Transformation prompt</h2>
              </div>
              <span className="panel-index">PROMPT</span>
            </div>
            <label className="visually-hidden" htmlFor="live-prompt">
              Describe the transformation
            </label>
            <textarea
              id="live-prompt"
              value={draftPrompt}
              onChange={(event) => setDraftPrompt(event.target.value)}
              maxLength={500}
              placeholder="Describe the look you want to see…"
            />

            {/* Quick Prompt Recommendation Chips */}
            <div className="prompt-chips-row">
              <span className="chips-label">Quick Ideas:</span>
              {activeModel.promptChips.map((chip, idx) => (
                <button
                  type="button"
                  key={idx}
                  className="prompt-chip"
                  onClick={() => {
                    setDraftPrompt(chip);
                    if (isLive) void applyPrompt(chip);
                  }}
                >
                  {chip}
                </button>
              ))}
            </div>

            <div className="prompt-footer">
              <p>Be specific about the look, garment, or style. Apply changes without ending the session.</p>
              <button
                className="button-secondary"
                type="button"
                onClick={() => void applyPrompt()}
                disabled={promptBusy || !draftPrompt.trim()}
              >
                {promptBusy ? "Applying…" : isLive ? "Apply prompt" : "Save prompt"}
                <span aria-hidden="true">↗</span>
              </button>
            </div>
          </section>

          {/* STEP 04 / REFERENCE : Full outfit & garment workflow */}
          <ReferencePicker
            selected={selectedReference}
            isLive={isLive}
            isBusy={referenceBusy}
            isApplied={Boolean(selectedReference && selectedReference.id === appliedReferenceId)}
            onSelect={onSelectReference}
            onApply={() => void applyReference()}
            onClear={() => void clearReference()}
          />
        </section>

        <aside className="control-rail" aria-label="Session controls">
          {/* STEP 02 / DEVICES */}
          <section className="panel device-panel">
            <div className="panel-title-row">
              <div>
                <p className="eyebrow">STEP 02 / DEVICES</p>
                <h2>Your camera setup</h2>
              </div>
              <span className="panel-index">{cameraType === "physical" ? "WEBCAM" : "DEMO"}</span>
            </div>
            <div className="device-controls">
              <button
                className={`device-toggle ${cameraOn ? "toggle-active" : ""}`}
                type="button"
                onClick={toggleCamera}
                disabled={previewLoading || isConnecting}
                aria-pressed={cameraOn}
              >
                <span className="device-icon">
                  <CameraGlyph />
                </span>
                <span className="device-copy">
                  <strong>Camera</strong>
                  <small>
                    {previewLoading
                      ? "Opening…"
                      : cameraOn
                      ? `On · ${cameraType === "physical" ? "Webcam" : "Demo Feed"}`
                      : cameraStream
                      ? "Off / Muted"
                      : "Not started"}
                  </small>
                </span>
                <span className={`switch ${cameraOn ? "switch-on" : ""}`}>
                  <i />
                </span>
              </button>

              <button
                className={`device-toggle ${micOn ? "toggle-active" : ""}`}
                type="button"
                onClick={() => void toggleMicrophone()}
                disabled={isConnecting}
                aria-pressed={micOn}
              >
                <span className="device-icon">
                  <MicGlyph />
                </span>
                <span className="device-copy">
                  <strong>Microphone</strong>
                  <small>{micOn ? "On" : "Muted"}</small>
                </span>
                <span className={`switch ${micOn ? "switch-on" : ""}`}>
                  <i />
                </span>
              </button>
            </div>

            <div className="camera-feed-options">
              <span className="eyebrow">FEED SOURCE:</span>
              <button
                type="button"
                className={`feed-btn ${cameraType === "virtual" && cameraOn ? "feed-btn-active" : ""}`}
                onClick={() => void enableCamera(true)}
              >
                Studio Demo Feed
              </button>
              <button
                type="button"
                className={`feed-btn ${cameraType === "physical" && cameraOn ? "feed-btn-active" : ""}`}
                onClick={() => void enableCamera(false)}
              >
                Physical Webcam
              </button>
            </div>
          </section>

          {/* STEP 03 / GO LIVE */}
          <section className="session-action panel">
            <div className="action-topline">
              <span className="eyebrow">STEP 03 / GO LIVE</span>
              <span className="session-number">{isLive ? "IN SESSION" : "READY"}</span>
            </div>
            <h2>{isLive ? "Your look, in motion." : "Ready to transform?"}</h2>
            <p>
              {isLive
                ? "Your live transformed stream is active. Change models, prompts, and garments without reconnecting."
                : "Start a realtime session with Decart using your chosen model, prompt, and reference image."}
            </p>
            {isLive ? (
              <button className="button-end" type="button" onClick={endSession}>
                <span className="end-square" /> End session
              </button>
            ) : (
              <button
                className="button-primary start-session"
                type="button"
                onClick={() => void startSession()}
                disabled={isConnecting}
              >
                {isConnecting ? "Connecting…" : "Start AI session"}
                <span aria-hidden="true">↗</span>
              </button>
            )}
            {!cameraStream && <p className="action-hint">Clicking Start will automatically open the camera feed.</p>}
          </section>

          <div className="mvp-note">
            <span className="note-mark">i</span>
            <p>
              <strong>Built for real-time transformation.</strong> Test Lucy 2.6 (Cinematic), Lucy VTON 3.6 (Virtual Try-on with presets/uploads), and Lucy Restyle 2 (Stylistic shifts) in real time.
            </p>
          </div>
        </aside>
      </main>

      <footer className="site-footer">
        <span>DECART REALTIME / MVP</span>
        <span>Camera transformations, in the moment.</span>
        <span>NO RECORDINGS · NO ACCOUNT</span>
      </footer>
    </div>
  );
}
