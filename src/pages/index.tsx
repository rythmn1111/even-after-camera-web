import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/router";
import { Geist, Geist_Mono } from "next/font/google";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

type SupportedZoom = {
  min: number;
  max: number;
  step: number;
};

type CapWithZoom = MediaTrackCapabilities & { zoom?: SupportedZoom };
type ConstraintsWithZoom = MediaTrackConstraints & {
  advanced?: Array<{ zoom?: number }>;
};

export default function Home() {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [isRear, setIsRear] = useState(true);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [zoomSupport, setZoomSupport] = useState<SupportedZoom | null>(null);
  const [snapshotDataUrl, setSnapshotDataUrl] = useState<string | null>(null);

  useEffect(() => {
    startCamera();
    const onResize = () => drawGrid();
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      stopCamera();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRear]);

  useEffect(() => {
    const id = setInterval(drawGrid, 500);
    return () => clearInterval(id);
  }, []);

  const startCamera = async () => {
    try {
      setError(null);
      stopCamera();
      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: isRear ? { ideal: "environment" } : { ideal: "user" },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: false,
      };
      const media = await navigator.mediaDevices.getUserMedia(constraints);
      setStream(media);
      if (videoRef.current) {
        videoRef.current.srcObject = media;
        await videoRef.current.play();
      }
      await detectZoomCapability(media);
      drawGrid();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const stopCamera = () => {
    if (!stream) return;
    stream.getTracks().forEach((t) => t.stop());
    setStream(null);
  };

  const detectZoomCapability = async (media: MediaStream) => {
    const [track] = media.getVideoTracks();
    const capabilities = (track.getCapabilities?.() as CapWithZoom) || ({} as CapWithZoom);
    if (capabilities.zoom) {
      const { min, max, step } = capabilities.zoom;
      setZoomSupport({ min, max, step: step || 0.1 });
      setZoomLevel(1);
    } else {
      setZoomSupport(null);
      setZoomLevel(1);
    }
  };

  const applyZoom = (level: number) => {
    setZoomLevel(level);
    if (stream) {
      const [track] = stream.getVideoTracks();
      const capabilities = (track.getCapabilities?.() as CapWithZoom) || ({} as CapWithZoom);
      if (capabilities.zoom && track.applyConstraints) {
        const newZoom = Math.min(capabilities.zoom.max, Math.max(capabilities.zoom.min, level));
        track
          .applyConstraints({ advanced: [{ zoom: newZoom }] } as ConstraintsWithZoom)
          .catch(() => {});
      } else if (videoRef.current) {
        const cssScale = level;
        videoRef.current.style.transform = `scale(${cssScale})`;
      }
    }
  };

  const toggleZoom = () => {
    if (zoomSupport) {
      const next = zoomLevel < 2 ? 2 : 1; // simple 1x <-> 2x
      applyZoom(next);
    } else {
      const next = zoomLevel < 1.8 ? 1.8 : 1; // CSS fallback
      applyZoom(next);
    }
  };

  const takePhoto = () => {
    const video = videoRef.current;
    const canvas = document.createElement("canvas");
    if (!video) return;
    const rect = video.getBoundingClientRect();
    canvas.width = rect.width * devicePixelRatio;
    canvas.height = rect.height * devicePixelRatio;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.scale(devicePixelRatio, devicePixelRatio);
    // Draw video frame
    ctx.drawImage(video, 0, 0, rect.width, rect.height);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.92);
    setSnapshotDataUrl(dataUrl);
    try {
      sessionStorage.setItem("lastPhotoDataURL", dataUrl);
    } catch {}
    router.push("/polaroid");
  };

  const drawGrid = () => {
    const canvas = canvasRef.current;
    const container = document.getElementById("camera-frame");
    if (!canvas || !container) return;
    const rect = container.getBoundingClientRect();
    canvas.width = rect.width * devicePixelRatio;
    canvas.height = rect.height * devicePixelRatio;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = "rgba(255,255,255,0.6)";
    ctx.lineWidth = 1 * devicePixelRatio;
    const thirdsX = [rect.width / 3, (rect.width * 2) / 3];
    const thirdsY = [rect.height / 3, (rect.height * 2) / 3];
    ctx.scale(devicePixelRatio, devicePixelRatio);
    thirdsX.forEach((x) => {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, rect.height);
      ctx.stroke();
    });
    thirdsY.forEach((y) => {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(rect.width, y);
      ctx.stroke();
    });
  };

  return (
    <div
      className={`${geistSans.className} ${geistMono.className} font-sans min-h-dvh w-full bg-black text-white`}
    >
      <div className="relative mx-auto max-w-[420px] h-dvh overflow-hidden">
        {/* Top controls mimic */}
        <div className="absolute top-3 left-3 z-20 flex flex-col gap-3">
          <button className="h-12 w-12 rounded-full bg-[rgba(40,40,40,0.9)] shadow-inner grid place-items-center border border-white/10">
            <span className="w-6 h-6 rounded-md bg-gradient-to-br from-zinc-400/70 to-white/40 grid place-items-center text-black text-xs font-bold">
              ≡
            </span>
          </button>
          <button className="h-12 w-12 rounded-full bg-[rgba(40,40,40,0.9)] shadow-inner grid place-items-center border border-white/10">
            <span className="text-white font-bold">A</span>
          </button>
        </div>

        <div className="absolute top-2 left-1/2 -translate-x-1/2 z-20">
          <div
            className="h-16 w-56 rounded-3xl"
            style={{
              background:
                "repeating-linear-gradient(90deg, #5b2ccf 0 14px, #4f23c7 14px 28px)",
              boxShadow: "inset 0 6px 10px rgba(0,0,0,.6), 0 6px 20px rgba(0,0,0,.45)",
            }}
          />
        </div>

        <div className="absolute top-3 right-3 z-20">
          <div className="h-16 w-16 rounded-full bg-neutral-800 border border-white/10 shadow-inner" />
        </div>

        {/* Camera Frame */}
        <div id="camera-frame" className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[92%] aspect-[9/16] rounded-[28px] overflow-hidden bg-neutral-900">
          <video ref={videoRef} playsInline muted className="h-full w-full object-cover" />
          <canvas ref={canvasRef} className="pointer-events-none absolute inset-0" />
        </div>

        {/* Bottom controls */}
        <div className="absolute bottom-6 left-6 z-20">
          <button
            onClick={toggleZoom}
            className="h-16 w-[64px] rounded-[32px] bg-[rgba(40,40,40,0.9)] text-white/90 text-xl font-semibold grid place-items-center border border-white/10"
          >
            {zoomLevel < 1.5 ? "1x" : "2x"}
          </button>
        </div>

        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 flex items-end gap-6">
          <button
            onClick={takePhoto}
            aria-label="Shutter"
            className="h-28 w-28 rounded-full bg-white text-black grid place-items-center shadow-[0_0_0_6px_rgba(255,255,255,0.4)]"
          >
            <span className="text-3xl font-bold">+</span>
          </button>
        </div>

        {/* Right-side dial removed per request */}

        {/* Flip camera button */}
        <div className="absolute bottom-4 right-1/2 translate-x-[140px] z-20">
          <button
            onClick={() => setIsRear((v) => !v)}
            className="h-12 px-4 rounded-full bg-white/10 border border-white/15 backdrop-blur text-white text-sm"
          >
            Flip
          </button>
        </div>

        {/* Error or snapshot preview */}
        {error && (
          <div className="absolute inset-x-0 bottom-28 mx-auto max-w-sm text-center text-red-300 text-sm px-4">
            {error}
          </div>
        )}

        {snapshotDataUrl && (
          <div className="absolute inset-x-0 bottom-28 mx-auto w-24 h-24 rounded-lg overflow-hidden border border-white/20">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={snapshotDataUrl} alt="snapshot" className="h-full w-full object-cover" />
          </div>
        )}
      </div>
    </div>
  );
}
