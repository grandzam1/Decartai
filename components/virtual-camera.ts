/**
 * Virtual Studio Camera Feed.
 * Generates an animated, realistic studio portrait stream when
 * physical camera hardware is unavailable, permission is denied,
 * or the user wants to test the studio with a demo feed.
 */

export function createVirtualCameraStream(): MediaStream {
  const canvas = document.createElement("canvas");
  canvas.width = 640;
  canvas.height = 480;
  const ctx = canvas.getContext("2d")!;

  let animId: number;
  let frame = 0;

  function draw() {
    frame++;
    const w = canvas.width;
    const h = canvas.height;

    // 1. Studio backdrop with soft lighting
    const bgGrad = ctx.createRadialGradient(w / 2, h * 0.35, 60, w / 2, h / 2, w * 0.7);
    bgGrad.addColorStop(0, "#2c332d");
    bgGrad.addColorStop(0.6, "#151a16");
    bgGrad.addColorStop(1, "#0a0d0b");
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, w, h);

    // Subtle background studio panel grid
    ctx.strokeStyle = "rgba(255, 255, 255, 0.03)";
    ctx.lineWidth = 1;
    for (let x = 40; x < w; x += 80) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }

    // Natural breathing movement & slight head sway
    const breath = Math.sin(frame * 0.04) * 3;
    const sway = Math.sin(frame * 0.02) * 2;
    const blink = (frame % 160 < 6); // Blink every ~5 seconds

    const cx = w / 2 + sway;
    const cy = h * 0.42 + breath;

    // 2. Torso / Shoulders (Base clothing)
    ctx.save();
    ctx.fillStyle = "#1e2420";
    ctx.beginPath();
    // Neck base
    ctx.moveTo(cx - 36, cy + 85);
    // Shoulders
    ctx.bezierCurveTo(cx - 90, cy + 105, cx - 180, cy + 150, cx - 210, h);
    ctx.lineTo(cx + 210, h);
    ctx.bezierCurveTo(cx + 180, cy + 150, cx + 90, cy + 105, cx + 36, cy + 85);
    ctx.closePath();
    ctx.fill();

    // Shirt collar highlight
    ctx.strokeStyle = "#38453c";
    ctx.lineWidth = 2;
    ctx.stroke();

    // 3. Neck
    ctx.fillStyle = "#d4a373";
    ctx.beginPath();
    ctx.moveTo(cx - 28, cy + 35);
    ctx.lineTo(cx - 32, cy + 90);
    ctx.quadraticCurveTo(cx, cy + 98, cx + 32, cy + 90);
    ctx.lineTo(cx + 28, cy + 35);
    ctx.closePath();
    ctx.fill();

    // Neck shadow under chin
    ctx.fillStyle = "rgba(0, 0, 0, 0.18)";
    ctx.beginPath();
    ctx.moveTo(cx - 30, cy + 40);
    ctx.quadraticCurveTo(cx, cy + 62, cx + 30, cy + 40);
    ctx.lineTo(cx + 28, cy + 50);
    ctx.quadraticCurveTo(cx, cy + 70, cx - 28, cy + 50);
    ctx.closePath();
    ctx.fill();

    // 4. Head / Face (Oval)
    ctx.fillStyle = "#e0af80";
    ctx.beginPath();
    ctx.ellipse(cx, cy, 62, 80, 0, 0, Math.PI * 2);
    ctx.fill();

    // Subtle face lighting (soft highlight left cheek)
    const faceLight = ctx.createRadialGradient(cx - 18, cy - 12, 5, cx, cy, 75);
    faceLight.addColorStop(0, "rgba(255, 235, 215, 0.28)");
    faceLight.addColorStop(1, "rgba(0, 0, 0, 0.15)");
    ctx.fillStyle = faceLight;
    ctx.beginPath();
    ctx.ellipse(cx, cy, 62, 80, 0, 0, Math.PI * 2);
    ctx.fill();

    // 5. Hair
    ctx.fillStyle = "#1e1713";
    ctx.beginPath();
    ctx.ellipse(cx, cy - 42, 68, 52, 0, Math.PI, Math.PI * 2);
    ctx.bezierCurveTo(cx + 70, cy - 10, cx + 64, cy + 20, cx + 58, cy + 32);
    ctx.bezierCurveTo(cx + 52, cy + 10, cx + 45, cy - 35, cx, cy - 38);
    ctx.bezierCurveTo(cx - 45, cy - 35, cx - 52, cy + 10, cx - 58, cy + 32);
    ctx.bezierCurveTo(cx - 64, cy + 20, cx - 70, cy - 10, cx - 68, cy - 42);
    ctx.closePath();
    ctx.fill();

    // 6. Eyes
    const eyeY = cy - 2;
    for (const side of [-1, 1]) {
      const eyeX = cx + side * 22;
      if (blink) {
        // Closed eyelid line
        ctx.strokeStyle = "#4a3528";
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(eyeX - 8, eyeY);
        ctx.quadraticCurveTo(eyeX, eyeY + 2, eyeX + 8, eyeY);
        ctx.stroke();
      } else {
        // Eye whites
        ctx.fillStyle = "#f8f9fa";
        ctx.beginPath();
        ctx.ellipse(eyeX, eyeY, 8, 5, 0, 0, Math.PI * 2);
        ctx.fill();
        // Iris / Pupil
        ctx.fillStyle = "#3e2723";
        ctx.beginPath();
        ctx.arc(eyeX + side * 0.5, eyeY, 4, 0, Math.PI * 2);
        ctx.fill();
        // Catchlight
        ctx.fillStyle = "#ffffff";
        ctx.beginPath();
        ctx.arc(eyeX - 1, eyeY - 1.5, 1.2, 0, Math.PI * 2);
        ctx.fill();
      }

      // Eyebrows
      ctx.strokeStyle = "#2c1d14";
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(eyeX - 10, eyeY - 10);
      ctx.quadraticCurveTo(eyeX, eyeY - 13, eyeX + 10, eyeY - 9);
      ctx.stroke();
    }

    // 7. Nose
    ctx.strokeStyle = "rgba(130, 80, 50, 0.4)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx, cy + 6);
    ctx.lineTo(cx + 3, cy + 22);
    ctx.quadraticCurveTo(cx, cy + 26, cx - 4, cy + 24);
    ctx.stroke();

    // 8. Lips / Mouth
    ctx.fillStyle = "#b86b62";
    ctx.beginPath();
    ctx.ellipse(cx, cy + 42, 14, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(90, 40, 35, 0.5)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cx - 13, cy + 42);
    ctx.lineTo(cx + 13, cy + 42);
    ctx.stroke();

    ctx.restore();

    // 9. Studio overlay HUD indicator
    ctx.save();
    ctx.fillStyle = "rgba(11, 15, 12, 0.72)";
    ctx.roundRect(14, 14, 150, 24, 4);
    ctx.fill();
    ctx.fillStyle = "#c4f56a";
    ctx.beginPath();
    ctx.arc(26, 26, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.font = "bold 9px monospace";
    ctx.fillStyle = "#edf2e9";
    ctx.fillText("DEMO STUDIO FEED", 37, 29);
    ctx.restore();

    animId = requestAnimationFrame(draw);
  }

  animId = requestAnimationFrame(draw);

  const stream = canvas.captureStream(30);

  // Create an audio track with silent / subtle audio so getAudioTracks works
  try {
    const audioCtx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    gain.gain.value = 0.0001; // Silent
    osc.connect(gain);
    const dest = audioCtx.createMediaStreamDestination();
    gain.connect(dest);
    osc.start();
    const audioTrack = dest.stream.getAudioTracks()[0];
    if (audioTrack) stream.addTrack(audioTrack);
  } catch {
    // Ignore audio context restrictions
  }

  // Attach teardown hook
  const origStop = stream.getTracks()[0].stop.bind(stream.getTracks()[0]);
  stream.getTracks()[0].stop = () => {
    cancelAnimationFrame(animId);
    origStop();
  };

  return stream;
}
