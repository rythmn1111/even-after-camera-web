export default function handler(req, res) {
  console.log("Test API called:", req.method, req.url);
  res.status(200).json({ ok: true, message: "API is working", method: req.method });
}
