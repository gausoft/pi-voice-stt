import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import assert from "node:assert/strict";
import { endpointRequiresAuth, secureEndpointFrom } from "../src/config/endpoint";
import { loadConfig } from "../src/config/load-config";

test("secureEndpointFrom accepts HTTPS endpoints", () => {
  assert.equal(secureEndpointFrom("https://example.com/v1/audio/transcriptions", ""), "https://example.com/v1/audio/transcriptions");
});

test("secureEndpointFrom accepts localhost HTTP endpoints", () => {
  assert.equal(secureEndpointFrom("http://localhost:10301/v1/audio/transcriptions", ""), "http://localhost:10301/v1/audio/transcriptions");
});

test("secureEndpointFrom rejects non-local HTTP endpoints", () => {
  assert.throws(() => secureEndpointFrom("http://example.com/v1/audio/transcriptions", ""), /HTTPS/);
});

test("endpointRequiresAuth skips auth for local HTTP", () => {
  assert.equal(endpointRequiresAuth("http://localhost:10301/v1/audio/transcriptions"), false);
  assert.equal(endpointRequiresAuth("https://api.openai.com/v1/audio/transcriptions"), true);
});

test("loadConfig supports Groq convenience provider", async () => {
  const dir = await mkdtemp(join(tmpdir(), "pi-voice-stt-test-"));
  const configPath = join(dir, "config.json");
  await writeFile(configPath, JSON.stringify({ provider: { type: "groq", apiKey: "test", language: "fr" } }), "utf8");

  try {
    const config = await loadConfig({ configPath });
    assert.equal(config.provider.type, "openai-compatible");
    assert.equal(config.provider.endpoint, "https://api.groq.com/openai/v1/audio/transcriptions");
    assert.equal(config.provider.model, "whisper-large-v3-turbo");
    assert.equal(config.provider.language, "fr");
    assert.equal(config.provider.apiKey, "test");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
