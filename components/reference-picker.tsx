"use client";

import { useEffect, useRef, useState, type ChangeEvent } from "react";

export interface SelectedReference {
  id: string;
  name: string;
  src: string;
  blob?: Blob;
  source: "preset" | "upload";
  promptSuggestion?: string;
  isCap?: boolean;
}

export const PRESETS = [
  {
    id: "bomber",
    name: "Bomber",
    src: "/presets/decart-bomber.webp",
    prompt: "Substitute the current top with a black bomber jacket with a clean modern fit",
    isCap: false,
  },
  {
    id: "hoodie",
    name: "Hoodie",
    src: "/presets/decart-hoodie.webp",
    prompt: "Substitute the current top with a navy blue hoodie with a relaxed fit",
    isCap: false,
  },
  {
    id: "cap",
    name: "Cap",
    src: "/presets/decart-cap.webp",
    prompt: "Add a dark baseball cap to the person's head",
    isCap: true,
  },
  {
    id: "crewneck",
    name: "Crewneck",
    src: "/presets/decart-crewneck.webp",
    prompt: "Substitute the current top with a soft grey crewneck sweatshirt",
    isCap: false,
  },
  {
    id: "rain-shell",
    name: "Rain shell",
    src: "/presets/decart-rainjacket.webp",
    prompt: "Substitute the current top with a bright yellow hooded rain shell",
    isCap: false,
  },
];

interface ReferencePickerProps {
  selected: SelectedReference | null;
  isLive: boolean;
  isBusy: boolean;
  isApplied: boolean;
  onSelect: (reference: SelectedReference) => void;
  onApply: () => void;
  onClear: () => void;
}

export function ReferencePicker({
  selected,
  isLive,
  isBusy,
  isApplied,
  onSelect,
  onApply,
  onClear,
}: ReferencePickerProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [loadingPreset, setLoadingPreset] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const preview = selected?.source === "upload" ? selected.src : null;
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [selected]);

  // Load a preset and select it immediately
  async function choosePreset(preset: (typeof PRESETS)[number]) {
    setMessage("");
    setLoadingPreset(preset.id);

    try {
      // Fetch the actual blob for the Decart SDK / Canvas engine
      let blob: Blob | undefined;
      try {
        const response = await fetch(preset.src);
        if (response.ok) {
          blob = await response.blob();
        }
      } catch {
        // Fallback: draw image to offscreen canvas to obtain blob
        const img = new Image();
        img.crossOrigin = "anonymous";
        await new Promise<void>((res) => {
          img.onload = () => res();
          img.onerror = () => res();
          img.src = preset.src;
        });
        const cvs = document.createElement("canvas");
        cvs.width = img.width || 480;
        cvs.height = img.height || 480;
        const ctx = cvs.getContext("2d");
        if (ctx) {
          ctx.drawImage(img, 0, 0);
          blob = await new Promise<Blob | undefined>((r) => cvs.toBlob((b) => r(b || undefined), "image/webp"));
        }
      }

      onSelect({
        id: preset.id,
        name: preset.name,
        src: preset.src,
        blob,
        source: "preset",
        promptSuggestion: preset.prompt,
        isCap: preset.isCap,
      });

      // If already live, automatically apply the garment for seamless UX
      if (isLive) {
        setTimeout(() => {
          onApply();
        }, 80);
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not load this preset.");
    } finally {
      setLoadingPreset(null);
    }
  }

  function chooseUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    setMessage("");
    if (!file) return;

    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setMessage("Choose a PNG, JPEG, or WebP image.");
      return;
    }
    if (file.size > 12 * 1024 * 1024) {
      setMessage("Choose an image smaller than 12 MB.");
      return;
    }

    const previewUrl = URL.createObjectURL(file);
    const isCap = file.name.toLowerCase().includes("cap") || file.name.toLowerCase().includes("hat");

    onSelect({
      id: `upload-${crypto.randomUUID()}`,
      name: file.name,
      src: previewUrl,
      blob: file,
      source: "upload",
      promptSuggestion: `Apply the uploaded ${file.name.replace(/\.[^.]+$/, "")} to the person`,
      isCap,
    });

    if (isLive) {
      setTimeout(() => {
        onApply();
      }, 100);
    }
  }

  return (
    <section className="panel reference-panel">
      <div className="panel-title-row">
        <div>
          <p className="eyebrow">STEP 04 / REFERENCE</p>
          <h2>Bring an image</h2>
        </div>
        <span className="panel-index">{selected ? "SELECTED" : "OPTIONAL"}</span>
      </div>
      <p className="reference-intro">
        Outfit presets and uploads are tuned for <strong>Lucy VTON 3.6</strong>. Selecting an outfit updates your prompt and applies to the live video stream.
      </p>

      {selected && (
        <div className="selected-reference">
          <img src={selected.src} alt={`Selected reference: ${selected.name}`} />
          <div className="selected-reference-copy">
            <span className="eyebrow">
              {selected.source === "upload" ? "CUSTOM UPLOAD · SESSION ONLY" : "PRESET GARMENT"}
              {isApplied ? " · APPLIED" : " · READY"}
            </span>
            <strong>{selected.name}</strong>
          </div>
          <button type="button" className="clear-reference" onClick={onClear} aria-label="Clear reference image" title="Remove reference">
            ×
          </button>
        </div>
      )}

      <div className="preset-row" aria-label="Bundled reference presets">
        {PRESETS.map((preset) => {
          const isCurrent = selected?.id === preset.id;
          return (
            <button
              type="button"
              className={`preset-tile ${isCurrent ? "preset-selected" : ""}`}
              key={preset.id}
              onClick={() => void choosePreset(preset)}
              disabled={loadingPreset !== null}
              aria-pressed={isCurrent}
              title={`Select ${preset.name} (${preset.prompt})`}
            >
              <span className="preset-image-wrap">
                <img src={preset.src} alt={preset.name} loading="eager" />
                {loadingPreset === preset.id && <span className="preset-loading" />}
              </span>
              <span className="preset-name">{preset.name}</span>
            </button>
          );
        })}
      </div>

      <div className="reference-actions">
        <input
          ref={fileInputRef}
          className="visually-hidden"
          type="file"
          accept="image/png,image/jpeg,image/webp"
          onChange={chooseUpload}
          aria-label="Upload a reference image"
        />
        <button className="button-upload" type="button" onClick={() => fileInputRef.current?.click()}>
          <span className="upload-plus">+</span> Upload from device
        </button>

        {selected && (
          <button
            className={`button-secondary ${isApplied ? "button-applied" : ""}`}
            type="button"
            onClick={onApply}
            disabled={isBusy}
          >
            {isBusy ? "Applying…" : isApplied ? "✓ Applied to Video" : "Apply Image Now"}
            <span aria-hidden="true">↗</span>
          </button>
        )}
      </div>

      {message && (
        <p className="reference-error" role="alert">
          {message}
        </p>
      )}

      {selected && (
        <div className="reference-footer-row">
          <p className="session-only-note">
            {selected.source === "upload"
              ? "Uploaded files remain in browser memory for this session only."
              : `Preset active: "${selected.promptSuggestion || selected.name}"`}
          </p>
          <button
            className="clear-text-button"
            type="button"
            onClick={onClear}
            disabled={!selected && !isApplied}
          >
            Clear reference
          </button>
        </div>
      )}
    </section>
  );
}
