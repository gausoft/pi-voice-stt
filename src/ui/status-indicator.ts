import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import type { DictationMode } from "../core/dictation-controller";

const LEVELS = ["▁", "▂", "▃", "▄", "▅", "▆", "▇"];

const levelAt = (tick: number, index: number, mode: DictationMode): string => {
  if (mode === "processing") return LEVELS[(tick + index) % 3] ?? "▁";
  const wave = Math.abs(Math.sin((tick + index * 1.7) / 2.2));
  return LEVELS[Math.min(LEVELS.length - 1, Math.floor(wave * LEVELS.length))] ?? "▁";
};

export const createStatusIndicator = (keybind: string) => {
  let interval: ReturnType<typeof setInterval> | undefined;
  let tick = 0;
  let mode: DictationMode = "idle";
  let context: ExtensionContext | undefined;

  const render = () => {
    if (!context?.hasUI) return;
    const theme = context.ui.theme;
    if (mode === "idle") {
      context.ui.setStatus("pi-voice-stt", `${theme.fg("accent", keybind)} ${theme.fg("dim", "voice")}`);
      return;
    }

    const wave = [0, 1, 2, 3, 4].map((index) => levelAt(tick, index, mode)).join("");
    const label = mode === "recording" ? "listening" : "transcribing";
    context.ui.setStatus("pi-voice-stt", `${theme.fg("accent", wave)} ${theme.fg("dim", label)}`);
  };

  const stop = () => {
    if (!interval) return;
    clearInterval(interval);
    interval = undefined;
  };

  const start = () => {
    if (interval) return;
    interval = setInterval(() => {
      tick += 1;
      render();
    }, 140);
  };

  return {
    attach(ctx: ExtensionContext) {
      context = ctx;
      render();
    },
    setMode(nextMode: DictationMode, ctx?: ExtensionContext) {
      if (ctx) context = ctx;
      mode = nextMode;
      tick += 1;
      render();
      if (mode === "idle") stop();
      else start();
    },
    dispose(ctx?: ExtensionContext) {
      stop();
      (ctx ?? context)?.ui.setStatus("pi-voice-stt", undefined);
      context = undefined;
      mode = "idle";
    },
  };
};
