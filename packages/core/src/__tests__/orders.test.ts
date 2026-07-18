import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { demoTradingReason, liveTradingEnabled, placeOrder } from "../sodex";

const ENV_KEYS = ["SODEX_API_KEY", "SODEX_API_SECRET", "MOSAIC_USE_MOCKS", "MOSAIC_DRY_RUN", "MOSAIC_REAL_ORDERS"];
const saved: Record<string, string | undefined> = {};

beforeEach(() => {
  for (const k of ENV_KEYS) saved[k] = process.env[k];
  delete process.env.MOSAIC_DRY_RUN;
  delete process.env.MOSAIC_REAL_ORDERS;
});
afterEach(() => {
  for (const k of ENV_KEYS) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k]!;
  }
  vi.unstubAllGlobals();
});

describe("trading mode gate (simulated-as-real regression)", () => {
  it("is DEMO only when mocks are forced or credentials are missing", () => {
    delete process.env.SODEX_API_KEY;
    delete process.env.SODEX_API_SECRET;
    expect(liveTradingEnabled()).toBe(false);
    expect(demoTradingReason()).toMatch(/not configured/);

    process.env.SODEX_API_KEY = "key-name";
    process.env.SODEX_API_SECRET = "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d";
    process.env.MOSAIC_USE_MOCKS = "false";
    expect(liveTradingEnabled()).toBe(true);
    expect(demoTradingReason()).toBeNull();
  });

  it("demo fills are explicitly labeled simulated", async () => {
    delete process.env.SODEX_API_KEY;
    delete process.env.SODEX_API_SECRET;
    process.env.MOSAIC_USE_MOCKS = "true";
    const fill = await placeOrder({ market: "BTC/USDC", side: "buy", notionalUsd: 100 });
    expect(fill.simulated).toBe(true);
    expect(fill.status).toBe("SIMULATED");
    expect(fill.note).toMatch(/DEMO MODE/);
  });

  it("a failed live SoDEX call THROWS — it can never return a simulated success", async () => {
    process.env.SODEX_API_KEY = "key-name";
    process.env.SODEX_API_SECRET = "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d";
    process.env.MOSAIC_USE_MOCKS = "false";
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network down")));

    let result: unknown = null;
    let threw = false;
    try {
      result = await placeOrder({ market: "BTC/USDC", side: "buy", notionalUsd: 100 });
    } catch {
      threw = true;
    }
    expect(threw).toBe(true);
    expect(result).toBeNull(); // no fill object of any kind escaped
  });

  it("a SoDEX HTTP error surfaces as an error, not a fill", async () => {
    process.env.SODEX_API_KEY = "key-name";
    process.env.SODEX_API_SECRET = "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d";
    process.env.MOSAIC_USE_MOCKS = "false";
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response("unauthorized", { status: 401 })
      )
    );
    await expect(
      placeOrder({ market: "BTC/USDC", side: "buy", notionalUsd: 100 })
    ).rejects.toThrow();
  });
});
