import type { NextApiRequest, NextApiResponse } from "next";
import { Readable } from "node:stream";
import sharp from "sharp";

type Resp = { ok: true; url: string; id: string; size: number } | { ok: false; error: string };

const MAX_BYTES = 100 * 1024; // 100KB

export default async function handler(req: NextApiRequest, res: NextApiResponse<Resp>) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  try {
    const { dataUrl, filename } = req.body as { dataUrl?: string; filename?: string };
    if (!dataUrl || typeof dataUrl !== "string" || !dataUrl.startsWith("data:")) {
      return res.status(400).json({ ok: false, error: "Missing dataUrl" });
    }

    // Parse data URL
    const comma = dataUrl.indexOf(",");
    const base64 = dataUrl.slice(comma + 1);
    const inputBuffer = Buffer.from(base64, "base64");

    // Re-encode as WEBP <= 100KB (iterate quality)
    let q = 85;
    let out = await sharp(inputBuffer).webp({ quality: q, effort: 6 }).toBuffer();
    while (out.byteLength > MAX_BYTES && q > 30) {
      q -= 10;
      out = await sharp(inputBuffer).webp({ quality: q, effort: 6 }).toBuffer();
    }

    // Upload to Arweave via Turbo SDK (embedded wallet)
    const jwk = {
      "kty": "RSA",
      "n": "your_public_key_here",
      "e": "AQAB",
      "d": "your_private_key_here",
      "p": "your_p_prime_here",
      "q": "your_q_prime_here",
      "dp": "your_dp_here",
      "dq": "your_dq_here",
      "qi": "your_qi_here"
    };
    const { TurboFactory } = await import("@ardrive/turbo-sdk");
    const turbo = await TurboFactory.authenticated({ privateKey: jwk });

    const name = filename && typeof filename === "string" ? filename : `polaroid-${Date.now()}.webp`;
    const size = out.byteLength;
    const result = await turbo.uploadFile({
      fileStreamFactory: () => Readable.from(out),
      fileSizeFactory: () => size,
      dataItemOpts: { tags: [{ name: "Content-Type", value: "image/webp" }, { name: "App-Name", value: "even-after-camera-web" }, { name: "File-Name", value: name }] },
    });

    const url = `https://arweave.net/${result.id}`;
    return res.status(200).json({ ok: true, url, id: result.id, size });
  } catch (e: unknown) {
    const errorMessage = e instanceof Error ? e.message : String(e);
    return res.status(500).json({ ok: false, error: errorMessage });
  }
}


