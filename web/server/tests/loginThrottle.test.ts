/**
 * The sign-in throttle exists because the app is publicly reachable with no
 * reverse proxy in front of it: without this, `admin` can be guessed forever
 * at full speed. Bootstrap seeds `admin` / `admin123` into every fresh database.
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Server } from "node:http";
import { createApp } from "../src/http/app.js";
import { freshDb, type TestContext } from "./helpers/db.js";

let ctx: TestContext;
let server: Server;
let baseUrl: string;

beforeEach(async () => {
  ctx = await freshDb();
  server = createApp(ctx.db).listen(0);
  await new Promise<void>((resolve) => server.once("listening", () => resolve()));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("no port");
  baseUrl = `http://127.0.0.1:${address.port}`;
});

afterEach(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await ctx.db.close();
});

function login(username: string, password: string): Promise<Response> {
  return fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
}

describe("login throttle", () => {
  it("locks a username out after five failures, even for the right password", async () => {
    for (let attempt = 1; attempt <= 5; attempt += 1) {
      expect((await login("admin", "wrong-password")).status).toBe(401);
    }

    expect((await login("admin", "wrong-password")).status).toBe(429);
    // Locked out whether or not the password is right.
    expect((await login("admin", "admin123")).status).toBe(429);
  });

  it("does not lock an account nobody has failed against", async () => {
    for (let attempt = 1; attempt <= 5; attempt += 1) {
      await login("admin", "wrong-password");
    }

    const response = await login("someone-else", "whatever");
    expect(response.status).toBe(401);
  });
});
