// Vercel serverless function: GET /api/price
// Keeps the Pyth API key on the server, so visitors never see it.
const ETH_USD =
  "0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace";

module.exports = async (req, res) => {
  const key = process.env.PYTH_API_KEY;
  if (!key) return res.status(500).json({ error: "PYTH_API_KEY is not set" });

  try {
    const upstream = await fetch(
      `https://hermes.pyth.network/v2/updates/price/latest?ids[]=${ETH_USD}&parsed=true`,
      { headers: { Authorization: `Bearer ${key}` } },
    );
    if (!upstream.ok)
      return res
        .status(upstream.status)
        .json({ error: "Hermes request failed" });

    const p = (await upstream.json()).parsed[0].price;
    const scale = 10 ** Number(p.expo); // expo is negative, e.g. -8

    // Cache at Vercel's edge for 2s so many visitors share one Hermes call
    res.setHeader("Cache-Control", "s-maxage=2, stale-while-revalidate=5");
    res.status(200).json({
      price: Number(p.price) * scale,
      conf: Number(p.conf) * scale,
      publishTime: p.publish_time,
    });
  } catch (e) {
    res.status(502).json({ error: "Could not reach Hermes" });
  }
};
