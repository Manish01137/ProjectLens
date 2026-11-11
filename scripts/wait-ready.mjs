#!/usr/bin/env node
// Waits until the ML service and the website both answer, then prints one clear line.
const ML = process.env.ML_API_URL ?? "http://localhost:8000";
const WEB = `http://localhost:${process.env.PORT ?? 3000}`;
const deadline = Date.now() + 15 * 60_000; // first start may download the model

async function get(url) {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(3000) });
    return res;
  } catch {
    return null;
  }
}

let ml = null;
let webUp = false;
while (Date.now() < deadline && (!ml || !webUp)) {
  if (!ml) {
    const res = await get(`${ML}/health`);
    if (res?.ok) {
      const body = await res.json().catch(() => ({}));
      if (body.status === "ok" || body.status === "no_model") ml = body;
    }
  }
  if (!webUp) webUp = Boolean(await get(`${WEB}/api/health?ping=1`));
  if (!ml || !webUp) await new Promise((r) => setTimeout(r, 1500));
}

if (!ml || !webUp) {
  console.log(`✗ Timed out waiting for ${!ml ? "the ML service" : "the website"}. See the logs above.`);
  process.exit(0);
}
if (ml.status === "ok") {
  console.log(`✓ ProjectLens is ready → ${WEB}  (ML service ${ML}, ${ml.projects_indexed.toLocaleString()} projects indexed)`);
} else {
  console.log(`⚠ ProjectLens is up at ${WEB}, but the ML service has no model: ${ml.message ?? "see ml logs"}`);
}
