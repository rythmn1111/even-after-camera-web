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
    console.log("Request body:", req.body);
    const { dataUrl, filename } = req.body;
    if (!dataUrl || typeof dataUrl !== "string" || !dataUrl.startsWith("data:")) {
      console.log("Missing or invalid dataUrl");
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
      "e": "AQAB",
      "n": "sr0alSqhRo4NMOkmDQ2mogu_7IHoIGX8SKgITfPG-0MSKi0fo_qmoz038VOU50N_uqQ6iyb9hd93ZMjxPhHYvx_ca0pVyfQbhj0nl8iYFTMyHOjWdEU3zGsGJBkMbzjGSl450DCiEGKa_c8omFUHFjNi7qtvUoMlXvbWdGXgk49a7-o9dPv15o1MQt33REW6EYzuLOuvBOG4crgoGoJ07sxBiezfVAUwQJK5b-Z1ROWf21odqK5HxCAzdhJHPZAK5XmgVQuyDLqR88KG76MR9xsXYJLENUDGJv2Sd3Jl2EWm-Iqd-l9NPTt2Xb5-_D39_fMwuQPdcd6kzT0k0R1-cqi_n4WTdxxpOfYP1inTx5DyJZA4onzYuLwUCBuVY-XNSvXstm-vnrjtH9s2Y72a9Ltaiy4ErzirSj66mvWjPuXBIAa8AyKG6nL5XYggn1hl0unzAdL_uLQ4iXGA3SItOEPMyC0LuPjRqEflrwetELoABmeihVjGPym2HMu0HR7ubm_7QZILpZ2MK_VqW4HWAZ427IJSRg-iGdLJ4fYsUzh1fCCI0OvAxh1nibu6U5FdaNCm55E3XeLAiQ676Un7gqSl3l01wagdVAmnCvhC_1IILaPEYbvcp5BPYGgOzCJHJvgR0T7XuDT4gAwMFAhaXbMjj9GGPf630K1pH2vQk4s",
      "d": "FakA_a6q2KgCRTkb2V0cImsWGQ0tGjABwLRMPVYbePuJyf6p5O9NHl8e1mnwk44EfpPEXHSfKIgKKfaH9aOoBpFP3tilSNICO-RRVf2DIJ6Rphs5UeHJf0ZA-kLm1NumfACrNOWP3jh02-ks3DkBoNkdVhsEZJVsA_QZzQVDj95BgO18AR8_j270HO5VNrrUb6gKfPsavJa2CYDzqzLABOhP0O0Zq07tqAWf30WoVG8XTje_fF-SZtwYIGjapUU9bM2udl_ydcRuR4H9ZDD4zl9EF_nxORreaH82Lq94VBssvtXdiyfdblw0Xevl659_ljTQZLtpLJF0m0KboZPXbM05dd4otETSmr1vkElwOCwxNFGvP0kiTwdpcZ5GvPoLeZsopgwlFaLBfkwDKpUe_ETflmMKUF2ROPJ6ACCvaz-KMx-DW9bF7BOPbbiaBi0hHywNSIsqbQGo7TDET2rKBvp74KgGMyA4-YCHE_BOJkZ5kHyMjGJvt4CbCx1ME3ai06iuGXO75yl-MOlqp-vOz6T59IRyqGAFnB2SJfpR508mq9p3VQZflPOe48-kh_wWz_2-NNBdZEp2bxBmcXDRvnsXsvEVTRb9YubUujpGyZo0K-hZkCgZcmfSVTQqVFtpHVETE31HsV1bV_mC5qUcTYvoxahzVj9UeZ-lQCqoN0E",
      "p": "-d0O6d765_KKWgFrNOZfZHQk7Y6S67Zq4_79HAPHwH5I4uAYrVwJZ0PoGwMYnHOfH5F1GbJRBYXxT4Ptdf-AVjF14HiIQyAocVkRMk51ztwhMFb6q8GDr3a8X9unPlcc4FJtktanK3ne9ph6qvGa-g0Un_d7go3cm9Metvx0eT2nvm3IRvAOfU3zyureGcdn23wqAMiMsspNG4wYANPWxTXBqxH5xRAvq8aOzcHiXFvHWSn6rSLbrFhNjQccdFt_sxTCxk4Qy4IZRuLWXDr523t58EWNXNMPa7GK3_Igx5O5xrm0yxlIVMIE8NiGlOT_CDhSXg6Gw26nzO_Ovb5ssQ",
      "q": "tyDeoEOGRvAHFy3jBvZAYlexP1WDRgrlrHysXoSMEXAn1PV_f5D2mv0OUG5kEbIF_vDi778DwYDPXuevihkTwXoL9KwyJjG8_py2D49I1Ms_c3RL_W_XaL-EbI96pCkVgW1893bKCUtaYp_msuwdN0iGsirIXuNKPVltmTlXt7tnXLippjiSX_UqMHFkklL0Jpo4VuMdIuMkOXT8ztzJAOJpYv0DcyDpX-fIoLo-QgDKQbdAGZTXknF3bzhRmLrJu-yV_OJ2o2iPyUoidjiBNWFgU_jJGa7v155hmm-OvTldx2lexw_nK89rSMBoo8dJYvaJKStMpT8zchPZe5Si-w",
      "dp": "3YhLgru6hhAa7nY3kS14Al6fpygzx11zJDaeP0pyvo65HL5H4typUa95iQmTtpMk0B5tTp01DMqXC0MTNP2V0dYEh0MWvT0z3ltzzcCW3xN5MZzMn5_xm46QsgTUIYenCJTMpdY_XWKudsD2cb3JBE64rKQGE9inclka8G6g7iXmJga7_Xk1v49vyce3p--Oe6F4tD0b0iFfgD8TwRgRYcSps306kKgrPAfN8Uwn4G9XLgz0PrGbRxD7oUBe0COX8zVDBAOPDICK3LieCiQYB6tQj-F61oQjNf6x_KB2w7yMiE96pmACK3PiYY_4subd33HgRZhnj7r6d89e5AiD4Q",
      "dq": "pUO8pdVKcOpc-8YlhDrnj9ij1QxPE_7xluBMjmAAKByXVdDX5z_jzatiJ6P4GyAV2SV7J_GyagbdHkDoYjCPa6PA9mYQO_fXH9A9XX1ptOBXutHRYj50n8t2rqItg8iv58XvaUSCwDCIuUik4gPDughxxohlm3xzmzoBdq4RQ3aUqVDdiWy0bHTMRjuPD55dSBkVjxQXT0y9fDzfibAmle2-Pd8oJdYlxq9el-58EQS1gujlqDBy-2364xxoRvUK6dVw5m9Zsc7DNFz7DMWhlZLzY9S5Z7xAJs6ANudGYe5Le5LUPcFUVm0x3M4HoQZQbEchMU4qNVb8Do9rTeOt0Q",
      "qi": "XY-Y22GkbWAdlxpwaUsbH1dnHiIfDmdNJ79QJwXH3SLuXauacQ1_P7cB7W8_A9o8W8-88t8qZJqC317kGJyyky9bnnvzYiKdHWeW-AlopvZxba4jqPKOnCqr49ZvSSLuFquG_ddJx6TapWKuS2Tzuep-ggUuEBAJ6UbnYD7uvyEVRyyOc95LGcPBMtbdrvYhreFI-CM-Qo_o-65uXpDR1Iqr04U2kCOD-4gAzwZK4xm85m7QdMFgS9UDjFrJ44pBPVhf6eGmEIfBHWmX6s7Wp_kSA3JzYiDtqY9SFF82SCcowpcitTPJNiHK-k8wm6Igq3Mlo-uhyqXD88JRnSKVBQ"
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
    console.log("Upload successful:", url);
    return res.status(200).json({ ok: true, url, id: result.id, size });
  } catch (e) {
    console.error("Upload error:", e);
    const errorMessage = e instanceof Error ? e.message : String(e);
    console.error("Error details:", errorMessage);
    return res.status(500).json({ ok: false, error: errorMessage });
  }
}


