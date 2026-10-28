/**
 * Simulation Session for Decart Realtime AI Camera Studio.
 * Provides high-fidelity in-browser transformations for Lucy 2.6, Lucy VTON 3.6,
 * and Lucy Restyle 2, including live prompt updates, reference image try-on,
 * model switching, and device muting.
 */

export type ModelId = "lucy-2.6" | "lucy-vton-3.6" | "lucy-restyle-2";

export interface ActiveSession {
  isConnected(): boolean;
  setPrompt(prompt: string, options?: { enhance?: boolean }): Promise<void>;
  setImage(image: Blob | string | null, options?: { prompt?: string; enhance?: boolean; isCap?: boolean }): Promise<void>;
  setModel?(modelId: ModelId): void;
  disconnect(): void;
  on(event: string, handler: (...args: unknown[]) => void): void;
}

export function createSimulationSession(
  stream: MediaStream,
  initialModelId: ModelId,
  initialPrompt: string,
  initialImage: Blob | string | null,
  onRemoteStream: (stream: MediaStream) => void,
  onConnectionChange: (state: string) => void
): ActiveSession {
  let isConnected = true;
  let currentModel = initialModelId;
  let currentPrompt = initialPrompt;
  let currentImageElement: HTMLImageElement | null = null;
  let isCapGarment = false;
  let animId: number | null = null;
  const eventHandlers = new Map<string, Array<(...args: unknown[]) => void>>();

  // Create an offscreen video element to sample camera frames
  const video = document.createElement("video");
  video.autoplay = true;
  video.muted = true;
  video.playsInline = true;
  video.srcObject = stream;
  void video.play().catch(() => undefined);

  // Setup offscreen canvas
  const canvas = document.createElement("canvas");
  canvas.width = 640;
  canvas.height = 480;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });

  // Function to load reference image element
  function loadReferenceImage(source: Blob | string | null, isCap = false) {
    if (!source) {
      currentImageElement = null;
      return;
    }
    isCapGarment = isCap;
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      currentImageElement = img;
    };
    if (typeof source === "string") {
      img.src = source;
      if (source.includes("cap")) isCapGarment = true;
    } else {
      const url = URL.createObjectURL(source);
      img.onload = () => {
        currentImageElement = img;
        URL.revokeObjectURL(url);
      };
      img.src = url;
    }
  }

  if (initialImage) {
    loadReferenceImage(initialImage);
  }

  let frameCount = 0;

  function render() {
    if (!isConnected || !ctx) return;
    frameCount++;

    const cw = canvas.width;
    const ch = canvas.height;

    const videoTrack = stream.getVideoTracks()[0];
    const isVideoEnabled = videoTrack ? videoTrack.enabled : true;

    // 1. Draw source camera frame
    if (!isVideoEnabled) {
      // Camera is muted: draw dark slate
      ctx.fillStyle = "#0d100e";
      ctx.fillRect(0, 0, cw, ch);
      ctx.fillStyle = "#657167";
      ctx.font = "14px monospace";
      ctx.textAlign = "center";
      ctx.fillText("[ CAMERA MUTED ]", cw / 2, ch / 2);
      ctx.textAlign = "left";
    } else if (video.videoWidth > 0) {
      if (canvas.width !== video.videoWidth && video.videoWidth > 100) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
      }
      ctx.save();
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      ctx.restore();
    } else {
      // Fallback background while video is buffering
      ctx.fillStyle = "#151b17";
      ctx.fillRect(0, 0, cw, ch);
    }

    // 2. Model-Specific AI Transformations
    ctx.save();

    if (currentModel === "lucy-2.6") {
      // Lucy 2.6: Cinematic anamorphic grade, warm fill, filmic vignette
      const isWarm = !currentPrompt.toLowerCase().includes("cool") && !currentPrompt.toLowerCase().includes("neon");
      ctx.globalCompositeOperation = "overlay";
      const grad = ctx.createLinearGradient(0, 0, cw, ch);
      if (isWarm) {
        grad.addColorStop(0, "rgba(255, 195, 140, 0.28)");
        grad.addColorStop(1, "rgba(40, 70, 110, 0.35)");
      } else {
        grad.addColorStop(0, "rgba(60, 200, 255, 0.25)");
        grad.addColorStop(1, "rgba(180, 50, 220, 0.35)");
      }
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, cw, ch);

      // Radial Vignette
      ctx.globalCompositeOperation = "multiply";
      const vig = ctx.createRadialGradient(cw / 2, ch * 0.45, ch * 0.3, cw / 2, ch / 2, ch * 0.75);
      vig.addColorStop(0, "rgba(255, 255, 255, 1)");
      vig.addColorStop(1, "rgba(18, 22, 19, 0.72)");
      ctx.fillStyle = vig;
      ctx.fillRect(0, 0, cw, ch);
    } else if (currentModel === "lucy-restyle-2") {
      // Lucy Restyle 2: Stylistic transfer (Anime, Cyberpunk, Watercolor, Neon)
      const p = currentPrompt.toLowerCase();
      if (p.includes("anime") || p.includes("cel") || p.includes("comic")) {
        // High saturation, vibrant tint
        ctx.globalCompositeOperation = "color";
        ctx.fillStyle = "rgba(255, 80, 140, 0.25)";
        ctx.fillRect(0, 0, cw, ch);
        ctx.globalCompositeOperation = "screen";
        ctx.fillStyle = "rgba(80, 220, 255, 0.2)";
        ctx.fillRect(0, 0, cw, ch);
      } else if (p.includes("cyberpunk") || p.includes("neon") || p.includes("future")) {
        // Cyan and Magenta chromatic split
        ctx.globalCompositeOperation = "color";
        ctx.fillStyle = "rgba(0, 235, 255, 0.32)";
        ctx.fillRect(0, 0, cw, ch);
        ctx.globalCompositeOperation = "overlay";
        ctx.fillStyle = "rgba(255, 0, 180, 0.28)";
        ctx.fillRect(0, 0, cw, ch);
      } else {
        // Default artistic grade
        ctx.globalCompositeOperation = "soft-light";
        ctx.fillStyle = "rgba(196, 245, 106, 0.3)";
        ctx.fillRect(0, 0, cw, ch);
      }
    } else if (currentModel === "lucy-vton-3.6") {
      // Lucy VTON 3.6: Enhanced lighting + clear garment focus
      ctx.globalCompositeOperation = "soft-light";
      ctx.fillStyle = "rgba(240, 245, 235, 0.2)";
      ctx.fillRect(0, 0, cw, ch);
    }

    ctx.restore();

    // 3. Render Reference Garment / Accessory (VTON / Try-on)
    if (currentImageElement && currentImageElement.complete && currentImageElement.naturalWidth > 0) {
      ctx.save();
      ctx.globalCompositeOperation = "source-over";

      const breath = Math.sin(frameCount * 0.04) * 3;
      const sway = Math.sin(frameCount * 0.02) * 2;

      if (isCapGarment) {
        // Headwear placement: Top center of head
        const capW = cw * 0.36;
        const capH = capW * (currentImageElement.height / (currentImageElement.width || 1));
        const capX = (cw - capW) / 2 + sway;
        const capY = ch * 0.16 + breath;

        ctx.shadowColor = "rgba(0, 0, 0, 0.55)";
        ctx.shadowBlur = 14;
        ctx.shadowOffsetY = 5;
        ctx.drawImage(currentImageElement, capX, capY, capW, capH);

        // VTON Tag
        ctx.fillStyle = "rgba(11, 17, 13, 0.85)";
        ctx.roundRect(capX + capW - 95, capY - 14, 95, 20, 4);
        ctx.fill();
        ctx.fillStyle = "#c4f56a";
        ctx.font = "bold 9px monospace";
        ctx.fillText("VTON: CAP", capX + capW - 88, capY);
      } else {
        // Upper-body garment placement: Shoulders and torso
        const targetW = cw * 0.62;
        const targetH = targetW * (currentImageElement.height / (currentImageElement.width || 1));
        const targetX = (cw - targetW) / 2 + sway;
        const targetY = ch * 0.44 + breath;

        ctx.shadowColor = "rgba(0, 0, 0, 0.5)";
        ctx.shadowBlur = 20;
        ctx.shadowOffsetY = 8;
        ctx.drawImage(currentImageElement, targetX, targetY, targetW, targetH);

        // VTON Tag
        ctx.fillStyle = "rgba(11, 17, 13, 0.85)";
        ctx.roundRect(targetX + 16, targetY + 12, 110, 22, 4);
        ctx.fill();
        ctx.fillStyle = "#c4f56a";
        ctx.font = "bold 9px monospace";
        ctx.fillText("VTON ACTIVE", targetX + 26, targetY + 27);
      }

      ctx.restore();
    }

    // 4. On-Screen Live HUD
    ctx.save();
    ctx.globalCompositeOperation = "source-over";

    // Top status pill
    const hudW = Math.min(cw - 30, 460);
    ctx.fillStyle = "rgba(9, 13, 10, 0.82)";
    ctx.roundRect(15, 14, hudW, 30, 6);
    ctx.fill();
    ctx.strokeStyle = "rgba(196, 245, 106, 0.25)";
    ctx.lineWidth = 1;
    ctx.stroke();

    // Pulse lime dot
    const pulse = 3.5 + Math.sin(frameCount * 0.1) * 1.2;
    ctx.fillStyle = "#c4f56a";
    ctx.beginPath();
    ctx.arc(30, 29, pulse, 0, Math.PI * 2);
    ctx.fill();

    // Model name + active prompt summary
    ctx.fillStyle = "#c4f56a";
    ctx.font = "bold 10px monospace";
    ctx.fillText(currentModel.toUpperCase(), 44, 32);

    ctx.fillStyle = "#d2dad0";
    ctx.font = "11px sans-serif";
    const textSnippet = currentPrompt.length > 42 ? currentPrompt.substring(0, 40) + "…" : currentPrompt;
    ctx.fillText(`· ${textSnippet}`, 148, 32);

    ctx.restore();

    animId = requestAnimationFrame(render);
  }

  // Create canvas stream
  const canvasStream = canvas.captureStream(30);

  // Preserve audio tracks
  for (const audioTrack of stream.getAudioTracks()) {
    canvasStream.addTrack(audioTrack);
  }

  onConnectionChange("connecting");
  const initTimer = setTimeout(() => {
    if (!isConnected) return;
    onConnectionChange("connected");
    onRemoteStream(canvasStream);
    animId = requestAnimationFrame(render);
  }, 250);

  return {
    isConnected: () => isConnected,

    async setPrompt(prompt: string) {
      currentPrompt = prompt;
    },

    async setImage(image: Blob | string | null, options?: { prompt?: string; isCap?: boolean }) {
      if (options?.prompt) currentPrompt = options.prompt;
      loadReferenceImage(image, options?.isCap);
    },

    setModel(modelId: ModelId) {
      currentModel = modelId;
    },

    disconnect() {
      isConnected = false;
      clearTimeout(initTimer);
      if (animId) cancelAnimationFrame(animId);
      for (const track of canvasStream.getTracks()) track.stop();
      video.pause();
      video.srcObject = null;
      onConnectionChange("disconnected");
      const endHandlers = eventHandlers.get("sessionEnded") ?? [];
      for (const h of endHandlers) h({ reason: "user-ended" });
    },

    on(event: string, handler: (...args: unknown[]) => void) {
      if (!eventHandlers.has(event)) eventHandlers.set(event, []);
      eventHandlers.get(event)!.push(handler);
    },
  };
}
