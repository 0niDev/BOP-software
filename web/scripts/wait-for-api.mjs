// Blocks the client dev server until the API answers /api/health, so Vite's
// proxy does not spray ECONNREFUSED while the server is still pinging SQLite
// Cloud. Gives up after 60s and lets the client start anyway.
const url = `${process.env.API_URL ?? "http://localhost:4000"}/api/health`;
const deadline = Date.now() + 60_000;

while (Date.now() < deadline) {
  try {
    const res = await fetch(url);
    if (res.ok) process.exit(0);
  } catch {
    // not listening yet
  }
  await new Promise((r) => setTimeout(r, 250));
}

console.warn(`[wait-for-api] ${url} did not respond after 60s, starting client anyway`);
