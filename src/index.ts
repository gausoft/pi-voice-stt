import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { matchesKey, type KeyId } from "@earendil-works/pi-tui";
import { createFfmpegRecorder } from "./audio/ffmpeg-recorder";
import { loadConfig } from "./config/load-config";
import { resolveStartupOptions } from "./config/startup";
import { createDictationController, type DictationToast } from "./core/dictation-controller";
import { createProvider } from "./providers/factory";
import { assertProviderReady } from "./providers/readiness";
import { createStatusIndicator } from "./ui/status-indicator";
import { formatError } from "./utils/text";

const toastType = (variant: DictationToast["variant"]): "info" | "warning" | "error" => {
  if (variant === "error") return "error";
  if (variant === "warning") return "warning";
  return "info";
};

const notify = (ctx: ExtensionContext | undefined, toast: DictationToast): void => {
  if (!ctx?.hasUI) return;
  const message = toast.title ? `${toast.title}: ${toast.message}` : toast.message;
  ctx.ui.notify(message, toastType(toast.variant));
};

const reportError = (ctx: ExtensionContext | undefined, error: unknown): void => {
  notify(ctx, { title: "Pi Voice STT", message: formatError(error), variant: "error" });
};

export default function piVoiceSttExtension(pi: ExtensionAPI) {
  const startup = resolveStartupOptions();
  const keybind = startup.keybind;
  const statusIndicator = createStatusIndicator(keybind);

  const getConfig = () => loadConfig({ configPath: startup.configPath });

  const controller = createDictationController({
    keybind,
    loadConfig: getConfig,
    createRecorder: (config) => createFfmpegRecorder(config.capture),
    createProvider: (config) => createProvider(config.provider),
    appendPrompt: async (ctx, text) => {
      const current = ctx.ui.getEditorText();
      ctx.ui.setEditorText(`${current}${text}`);
    },
    submitPrompt: async (ctx) => {
      const prompt = ctx.ui.getEditorText().trimEnd();
      if (!prompt) {
        notify(ctx, { title: "Pi Voice STT", message: "Transcript is empty; nothing to send.", variant: "warning" });
        return;
      }

      ctx.ui.setEditorText("");
      if (ctx.isIdle()) pi.sendUserMessage(prompt);
      else pi.sendUserMessage(prompt, { deliverAs: "followUp" });
    },
    notify,
    onModeChange: (mode, ctx) => statusIndicator.setMode(mode, ctx),
    onError: reportError,
  });

  let unsubscribeTerminalInput: (() => void) | undefined;

  pi.registerShortcut(keybind as KeyId, {
    description: "Toggle voice dictation recording",
    handler: async (ctx) => {
      await controller.toggle(ctx).catch((error: unknown) => reportError(ctx, error));
    },
  });

  pi.registerCommand("stt", {
    description: "Voice dictation controls: start, stop, send, cancel, status, doctor.",
    getArgumentCompletions: (prefix) => {
      const commands = ["start", "stop", "send", "cancel", "status", "doctor"];
      return commands
        .filter((command) => command.startsWith(prefix.trim().toLowerCase()))
        .map((command) => ({ value: command, label: command }));
    },
    handler: async (args, ctx) => {
      const action = args.trim().toLowerCase() || "status";

      if (action === "start") {
        if (controller.getMode() === "idle") await controller.toggle(ctx).catch((error: unknown) => reportError(ctx, error));
        else ctx.ui.notify(`Pi Voice STT is already ${controller.getMode()}.`, "warning");
        return;
      }

      if (action === "stop") {
        await controller.stop(ctx).catch((error: unknown) => reportError(ctx, error));
        return;
      }

      if (action === "send") {
        await controller.stopAndSubmit(ctx).catch((error: unknown) => reportError(ctx, error));
        return;
      }

      if (action === "cancel") {
        await controller.cancel(ctx).catch((error: unknown) => reportError(ctx, error));
        return;
      }

      if (action === "doctor") {
        try {
          const config = await getConfig();
          assertProviderReady(config.provider);
          const ffmpeg = await pi.exec(config.capture.ffmpegPath, ["-version"], { timeout: 5000 });
          if (ffmpeg.code !== 0) throw new Error(`ffmpeg check failed: ${ffmpeg.stderr || ffmpeg.stdout}`);
          ctx.ui.notify(`Pi Voice STT ready (${config.provider.type}/${config.provider.model}).`, "info");
        } catch (error) {
          reportError(ctx, error);
        }
        return;
      }

      if (action !== "status") {
        ctx.ui.notify("Usage: /stt [start|stop|send|cancel|status|doctor]", "error");
        return;
      }

      const configPath = startup.configPath || "defaults only (set PI_STT_CONFIG or ~/.pi/agent/stt.json)";
      ctx.ui.notify(`Pi Voice STT: ${controller.getMode()} · keybind ${keybind} · config ${configPath}`, "info");
    },
  });

  pi.on("session_start", (_event, ctx) => {
    if (!ctx.hasUI) return;
    statusIndicator.attach(ctx);

    unsubscribeTerminalInput?.();
    unsubscribeTerminalInput = ctx.ui.onTerminalInput((data) => {
      const mode = controller.getMode();
      if (mode === "idle") return undefined;

      if (matchesKey(data, "escape")) {
        void controller.cancel(ctx).catch((error: unknown) => reportError(ctx, error));
        return { consume: true };
      }

      if (mode === "recording" && matchesKey(data, "enter")) {
        void controller.stopAndSubmit(ctx).catch((error: unknown) => reportError(ctx, error));
        return { consume: true };
      }

      return undefined;
    });
  });

  pi.on("session_shutdown", async (_event, ctx) => {
    unsubscribeTerminalInput?.();
    unsubscribeTerminalInput = undefined;
    await controller.dispose();
    statusIndicator.dispose(ctx);
  });
}
