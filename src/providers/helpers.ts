import { readFile } from "node:fs/promises";
import { formatError, truncate } from "../utils/text";

export const audioBlobFromPath = async (audioPath: string): Promise<Blob> => {
  const audio = await readFile(audioPath);
  return new Blob([new Uint8Array(audio)], { type: "audio/wav" });
};

export const audioBytesFromPath = async (audioPath: string): Promise<Uint8Array> => {
  const audio = await readFile(audioPath);
  return new Uint8Array(audio);
};

export const fetchJson = async (input: RequestInfo | URL, init: RequestInit, errorPrefix: string): Promise<unknown> => {
  const response = await fetch(input, init).catch((error: unknown) => {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error(`${errorPrefix} timed out or was cancelled.`);
    }
    throw error;
  });

  if (!response.ok) {
    throw new Error(`${errorPrefix} failed (${response.status}): ${truncate(await response.text())}`);
  }

  try {
    return await response.json();
  } catch (error) {
    throw new Error(`${errorPrefix} returned invalid JSON: ${formatError(error)}`);
  }
};

export const objectAt = (value: unknown, key: string): Record<string, unknown> => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const child = (value as Record<string, unknown>)[key];
  if (!child || typeof child !== "object" || Array.isArray(child)) return {};
  return child as Record<string, unknown>;
};

export const arrayAt = (value: unknown, key: string): unknown[] => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return [];
  const child = (value as Record<string, unknown>)[key];
  return Array.isArray(child) ? child : [];
};

export const textAt = (value: unknown, key: string): string => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return "";
  const child = (value as Record<string, unknown>)[key];
  return typeof child === "string" ? child.trim() : "";
};

export const sleep = async (ms: number, signal?: AbortSignal): Promise<void> => {
  if (signal?.aborted) throw new Error("STT transcription timed out or was cancelled.");

  await new Promise<void>((resolve, reject) => {
    const cleanup = () => signal?.removeEventListener("abort", onAbort);
    const timer = setTimeout(() => {
      cleanup();
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      cleanup();
      reject(new Error("STT transcription timed out or was cancelled."));
    };
    signal?.addEventListener("abort", onAbort, { once: true });
  });
};
