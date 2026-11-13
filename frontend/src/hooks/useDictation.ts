import { useCallback, useEffect, useRef, useState } from "react";
import { requestJson } from "@/api/transport";
import { useAppStore } from "@/stores/app-store";
import { useAssistantStore } from "@/stores/assistant-store";
import { getToken } from "@/utils/auth";

type Phase = "idle" | "connecting" | "recording" | "processing";
type DictationError = "microphone" | "unavailable" | "empty";

interface Recording {
  socket: WebSocket;
  context?: AudioContext;
  stream?: MediaStream;
  source?: MediaStreamAudioSourceNode;
  processor?: AudioWorkletNode;
  limit?: ReturnType<typeof setTimeout>;
  stopping?: boolean;
}

function releaseMicrophone(recording: Recording) {
  recording.stream?.getTracks().forEach((track) => track.stop());
  recording.source?.disconnect();
  recording.processor?.disconnect();
  if (recording.context && recording.context.state !== "closed") void recording.context.close().catch(() => {});
  clearTimeout(recording.limit);
}

function closeRecording(recording: Recording | null) {
  if (!recording) return;
  releaseMicrophone(recording);
  recording.socket.close();
}

export function useDictation(onTranscript: (text: string) => void) {
  const active = useRef<Recording | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [partial, setPartial] = useState("");
  const [error, setError] = useState<DictationError | null>(null);
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    const abort = new AbortController();
    void requestJson<{ enabled: boolean }>("/dictation/status", { signal: abort.signal }).then(
      (result) => { if (!abort.signal.aborted) setEnabled(result.enabled); },
      () => {},
    );
    return () => abort.abort();
  }, []);

  const finish = useCallback((recording: Recording, reason: DictationError | null) => {
    if (active.current !== recording) return;
    active.current = null;
    closeRecording(recording);
    setPhase("idle");
    setPartial("");
    setError(reason);
  }, []);

  useEffect(() => {
    const cancel = () => { if (active.current) finish(active.current, null); };
    const panel = useAppStore.subscribe((state, previous) => {
      if (previous.assistantPanelOpen && !state.assistantPanelOpen) cancel();
    });
    const chat = useAssistantStore.subscribe((state, previous) => {
      if (state.pendingQuestion || state.currentProject !== previous.currentProject || state.currentSessionId !== previous.currentSessionId) cancel();
    });
    return () => {
      panel();
      chat();
      const recording = active.current;
      active.current = null;
      closeRecording(recording);
    };
  }, [finish]);

  function stop(recording: Recording) {
    if (!recording.processor || recording.stopping) return;
    recording.stopping = true;
    setPhase("processing");
    recording.processor.port.postMessage("stop");
  }

  function start() {
    if (active.current) return;
    setError(null);
    if (!navigator.mediaDevices?.getUserMedia || !window.AudioWorkletNode) {
      setError("microphone");
      return;
    }

    const url = new URL("/api/v1/dictation", window.location.href);
    url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
    const socket = new WebSocket(url);
    const recording: Recording = { socket };
    active.current = recording;
    setPhase("connecting");
    socket.onopen = () => socket.send(JSON.stringify({ token: getToken() }));
    socket.onclose = () => finish(recording, "unavailable");
    socket.onerror = () => finish(recording, "unavailable");

    const prepareAudio = async () => {
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1 } });
      } catch {
        finish(recording, "microphone");
        return;
      }
      if (active.current !== recording) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      recording.stream = stream;
      try {
        const context = new AudioContext({ sampleRate: 48_000 });
        recording.context = context;
        await context.audioWorklet.addModule("/dictation-processor.js");
        await context.resume();
        if (active.current !== recording) return;
        const source = context.createMediaStreamSource(stream);
        const processor = new AudioWorkletNode(context, "dictation", { channelCount: 1, numberOfOutputs: 0 });
        recording.source = source;
        recording.processor = processor;
        processor.port.onmessage = ({ data }: MessageEvent<ArrayBuffer | "stop">) => {
          if (active.current !== recording || socket.readyState !== WebSocket.OPEN) return;
          if (data === "stop") releaseMicrophone(recording);
          socket.send(data);
        };
        source.connect(processor);
        recording.limit = setTimeout(() => stop(recording), 85_000);
        setPhase("recording");
      } catch {
        finish(recording, "microphone");
      }
    };

    socket.onmessage = ({ data }: MessageEvent<string>) => {
      if (active.current !== recording) return;
      const message = JSON.parse(data) as { type: string; text?: string };
      if (message.type === "ready") void prepareAudio();
      if (message.type === "partial") setPartial(message.text ?? "");
      if (message.type === "error") finish(recording, "unavailable");
      if (message.type === "final") {
        const text = message.text?.trim();
        if (text) onTranscript(text);
        finish(recording, text ? null : "empty");
      }
    };
  }

  return { enabled, phase, partial, error, toggle: () => {
    if (phase === "idle") start();
    if (phase === "recording" && active.current) stop(active.current);
    if (phase === "connecting" && active.current) finish(active.current, null);
  } };
}
