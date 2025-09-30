import { Readable } from "node:stream";
import sharp from "sharp";

const MAX_BYTES = 100 * 1024; // 100KB

export default async function handler(req, res) {
  console.log("API called:", req.method, req.url);
  console.log("Headers:", req.headers);
  
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }
  
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  try {
    console.log("Request body received");
    const { dataUrl, filename } = req.body;
    
    if (!dataUrl || typeof dataUrl !== "string" || !dataUrl.startsWith("data:")) {
      console.log("Missing or invalid dataUrl");
      return res.status(400).json({ ok: false, error: "Missing dataUrl" });
    }

    console.log("Processing image...");
    // Parse data URL
    const comma = dataUrl.indexOf(",");
    const base64 = dataUrl.slice(comma + 1);
    const inputBuffer = Buffer.from(base64, "base64");

    console.log("Sharp processing...");
    // Re-encode as WEBP <= 100KB (iterate quality)
    let q = 85;
    let out = await sharp(inputBuffer).webp({ quality: q, effort: 6 }).toBuffer();
    while (out.byteLength > MAX_BYTES && q > 30) {
      q -= 10;
      out = await sharp(inputBuffer).webp({ quality: q, effort: 6 }).toBuffer();
    }

    console.log("Image processed, size:", out.byteLength);

    // For now, just return success without Arweave upload to test
    const name = filename && typeof filename === "string" ? filename : `polaroid-${Date.now()}.webp`;
    const mockUrl = `https://arweave.net/mock-${Date.now()}`;
    
    console.log("Returning mock success");
    return res.status(200).json({ ok: true, url: mockUrl, id: `mock-${Date.now()}`, size: out.byteLength });
    
  } catch (e) {
    console.error("Upload error:", e);
    const errorMessage = e instanceof Error ? e.message : String(e);
    console.error("Error details:", errorMessage);
    return res.status(500).json({ ok: false, error: errorMessage });
  }
}


