export default async function handler(req, res) {
  console.log("Simple upload API called:", req.method, req.url);
  
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
    console.log("Simple upload - request body received");
    const { dataUrl, filename } = req.body;
    
    if (!dataUrl || typeof dataUrl !== "string" || !dataUrl.startsWith("data:")) {
      console.log("Missing or invalid dataUrl");
      return res.status(400).json({ ok: false, error: "Missing dataUrl" });
    }

    console.log("Simple upload - processing successful");
    
    // Return mock success
    const mockUrl = `https://arweave.net/simple-${Date.now()}`;
    const mockSize = Math.floor(Math.random() * 50000) + 10000; // Random size between 10-60KB
    
    console.log("Simple upload - returning mock success");
    return res.status(200).json({ ok: true, url: mockUrl, id: `simple-${Date.now()}`, size: mockSize });
    
  } catch (e) {
    console.error("Simple upload error:", e);
    const errorMessage = e instanceof Error ? e.message : String(e);
    return res.status(500).json({ ok: false, error: errorMessage });
  }
}
