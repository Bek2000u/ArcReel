class DictationProcessor extends AudioWorkletProcessor {
  buffer = new Int16Array(Math.round(sampleRate / 10));
  used = 0;
  stopped = false;

  constructor() {
    super();
    this.port.onmessage = () => {
      this.stopped = true;
      this.flush();
      this.port.postMessage("stop");
    };
  }

  flush() {
    if (!this.used) return;
    const chunk = this.buffer.slice(0, this.used);
    this.port.postMessage(chunk.buffer, [chunk.buffer]);
    this.used = 0;
  }

  process(inputs) {
    if (this.stopped) return false;
    for (const sample of inputs[0]?.[0] ?? []) {
      this.buffer[this.used++] = Math.max(-32768, Math.min(32767, sample * 32768));
      if (this.used === this.buffer.length) this.flush();
    }
    return true;
  }
}

registerProcessor("dictation", DictationProcessor);
