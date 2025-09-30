import { useEffect, useState } from "react";
import Link from "next/link";
import QRCode from "qrcode";

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const im = new Image();
    im.onload = () => resolve(im);
    im.onerror = reject;
    im.src = src;
  });
}

// Compose a baked polaroid frame around the image and return a data URL
async function composePolaroid(image: HTMLImageElement): Promise<string | null> {
  const frameWidth = Math.min(1024, Math.max(640, image.naturalWidth));
  const paddingSide = Math.round(frameWidth * 0.06); // ~6% side/top
  const paddingTop = paddingSide;
  const innerSize = frameWidth - paddingSide * 2; // square image area
  const paddingBottom = Math.round(innerSize * 0.28); // big bottom border
  const frameHeight = paddingTop + innerSize + paddingBottom;

  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  canvas.width = frameWidth;
  canvas.height = frameHeight;

  // Build rounded-rect path for the paper frame
  const r = Math.max(6, Math.round(frameWidth * 0.02));
  ctx.beginPath();
  ctx.moveTo(r, 0);
  ctx.arcTo(frameWidth, 0, frameWidth, frameHeight, r);
  ctx.arcTo(frameWidth, frameHeight, 0, frameHeight, r);
  ctx.arcTo(0, frameHeight, 0, 0, r);
  ctx.arcTo(0, 0, frameWidth, 0, r);
  ctx.closePath();

  // Clip to the paper shape, then paint the texture only (no white overlay over image area)
  ctx.save();
  ctx.clip();
  try {
    const bg = await loadImage("/bg.png");
    ctx.drawImage(bg, 0, 0, frameWidth, frameHeight);
  } catch {
    ctx.fillStyle = "#eaeaea";
    ctx.fillRect(0, 0, frameWidth, frameHeight);
  }
  ctx.restore();

  // Slight shadow at edges to simulate depth
  const shadow = ctx.createLinearGradient(0, 0, 0, frameHeight);
  shadow.addColorStop(0, "rgba(0,0,0,0.04)");
  shadow.addColorStop(0.2, "rgba(0,0,0,0)");
  shadow.addColorStop(0.8, "rgba(0,0,0,0)");
  shadow.addColorStop(1, "rgba(0,0,0,0.05)");
  ctx.fillStyle = shadow;
  ctx.fillRect(0, 0, frameWidth, frameHeight);

  // Draw inner image cropped to square (center crop)
  const srcSize = Math.min(image.naturalWidth, image.naturalHeight);
  const sx = Math.floor((image.naturalWidth - srcSize) / 2);
  const sy = Math.floor((image.naturalHeight - srcSize) / 2);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  // Ensure no blending from frame: clip strictly to inner window before drawing image
  ctx.save();
  // rounded inner window
  const ir = Math.max(8, Math.round(innerSize * 0.04));
  ctx.beginPath();
  ctx.moveTo(paddingSide + ir, paddingTop);
  ctx.arcTo(paddingSide + innerSize, paddingTop, paddingSide + innerSize, paddingTop + innerSize, ir);
  ctx.arcTo(paddingSide + innerSize, paddingTop + innerSize, paddingSide, paddingTop + innerSize, ir);
  ctx.arcTo(paddingSide, paddingTop + innerSize, paddingSide, paddingTop, ir);
  ctx.arcTo(paddingSide, paddingTop, paddingSide + innerSize, paddingTop, ir);
  ctx.closePath();
  ctx.clip();
  // Create a grayscale version of the cropped square
  const temp = document.createElement("canvas");
  temp.width = srcSize;
  temp.height = srcSize;
  const tctx = temp.getContext("2d");
  if (tctx) {
    tctx.drawImage(image, sx, sy, srcSize, srcSize, 0, 0, srcSize, srcSize);
    const img = tctx.getImageData(0, 0, srcSize, srcSize);
    const d = img.data;
    for (let i = 0; i < d.length; i += 4) {
      // luminance formula
      const y = 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2];
      d[i] = d[i + 1] = d[i + 2] = y;
    }
    tctx.putImageData(img, 0, 0);
    ctx.drawImage(temp, paddingSide, paddingTop, innerSize, innerSize);
  }
  ctx.restore();

  // Logo at bottom center (from /logo.png)
  try {
    const logo = await loadImage("/logo.png");
    const maxLogoW = Math.round(frameWidth * 0.28);
    const maxLogoH = Math.round(paddingBottom * 0.55);
    const aspect = logo.naturalWidth / Math.max(1, logo.naturalHeight);
    let w = maxLogoW;
    let h = Math.round(w / aspect);
    if (h > maxLogoH) { h = maxLogoH; w = Math.round(h * aspect); }
    const cx = Math.round((frameWidth - w) / 2);
    const cy = paddingTop + innerSize + Math.round((paddingBottom - h) / 2);
    ctx.drawImage(logo, cx, cy, w, h);
  } catch {}

  return canvas.toDataURL("image/jpeg", 0.92);
}

export default function PolaroidPage() {
  const [photo, setPhoto] = useState<string | null>(null);
  const [processed, setProcessed] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadedUrl, setUploadedUrl] = useState<string | null>(null);
  const [finalUrl, setFinalUrl] = useState<string | null>(null);

  useEffect(() => {
    try {
      const d = sessionStorage.getItem("lastPhotoDataURL");
      setPhoto(d);
    } catch {}
  }, []);

  useEffect(() => {
    if (!photo) return;
    const img = new Image();
    img.onload = () => {
      composePolaroid(img).then((out) => setProcessed(out));
    };
    img.src = photo;
  }, [photo]);

  async function uploadToArweave() {
    if (!processed) return;
    setUploading(true);
    setUploadedUrl(null);
    setFinalUrl(null);
    try {
      const r = await fetch("/api/upload-simple", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dataUrl: processed, filename: `polaroid-${Date.now()}.webp` }),
      });
      const j = await r.json();
      if (j.ok) {
        setUploadedUrl(j.url);
        // Now bake QR + text into the image and re-upload
        await bakeAndReupload(j.url);
      }
    } finally {
      setUploading(false);
    }
  }

  async function bakeAndReupload(arweaveUrl: string) {
    if (!processed) return;
    try {
      // Generate QR code
      const qrDataUrl = await QRCode.toDataURL(arweaveUrl, { width: 200, margin: 1 });
      
      // Load the original processed image
      const img = new Image();
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
        img.src = processed!;
      });

      // Create new canvas with QR and text baked in
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      
      // Draw original image
      ctx.drawImage(img, 0, 0);
      
      // Add QR code in bottom right
      const qrImg = new Image();
      await new Promise((resolve, reject) => {
        qrImg.onload = resolve;
        qrImg.onerror = reject;
        qrImg.src = qrDataUrl;
      });
      
      const qrSize = Math.min(120, canvas.width * 0.15);
      const qrX = canvas.width - qrSize - 20;
      const qrY = canvas.height - qrSize - 60;
      ctx.drawImage(qrImg, qrX, qrY, qrSize, qrSize);
      
      // Add text below QR (centered horizontally)
      ctx.fillStyle = "#333";
      ctx.font = "14px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("your permanent memory", canvas.width / 2, qrY + qrSize + 20);
      
      // Upload the QR-baked image
      const bakedDataUrl = canvas.toDataURL("image/jpeg", 0.92);
      const r = await fetch("/api/upload-simple", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dataUrl: bakedDataUrl, filename: `polaroid-qr-${Date.now()}.webp` }),
      });
      const j = await r.json();
      if (j.ok) setFinalUrl(j.url);
    } catch (e) {
      console.error("QR bake failed:", e);
    }
  }

  return (
    <div className="min-h-dvh w-full bg-neutral-100 text-neutral-900">
      <div className="mx-auto max-w-[520px] min-h-dvh px-6 py-6">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="rounded-full border border-black/10 bg-white px-4 py-2 shadow-sm"
          >
            ← Back
          </Link>
          <h1 className="text-lg font-semibold">Polaroid</h1>
        </div>

        <div className="mt-8 flex justify-center">
          <div className="bg-transparent">
            {processed ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={processed} alt="polaroid" className="w-[320px] h-auto" />
            ) : (
              <div className="w-[320px] h-[360px] grid place-items-center text-neutral-400 text-sm bg-white rounded">
                Processing...
              </div>
            )}
          </div>
        </div>

        <div className="mt-6 flex flex-col items-center gap-3">
          <button
            disabled={!processed || uploading}
            onClick={uploadToArweave}
            className="rounded-full bg-black text-white px-5 py-2 disabled:opacity-50"
          >
            {uploading ? "Uploading…" : "Upload to Arweave (<=100KB)"}
          </button>
          {uploadedUrl && (
            <a href={uploadedUrl} target="_blank" rel="noreferrer" className="text-blue-600 underline">
              View on Arweave
            </a>
          )}
          {finalUrl && (
            <div className="mt-2">
              <a href={finalUrl} target="_blank" rel="noreferrer" className="text-green-600 underline">
                View Final Image with QR
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}


