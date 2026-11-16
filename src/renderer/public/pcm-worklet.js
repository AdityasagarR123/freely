// Runs on the audio thread. The AudioContext is created at 16 kHz, so input is already
// resampled; this converts float samples to 16-bit PCM and posts ~100 ms batches.
class PcmWorklet extends AudioWorkletProcessor {
  constructor() {
    super()
    this.batch = new Int16Array(1600)
    this.length = 0
  }

  process(inputs) {
    const channel = inputs[0] && inputs[0][0]
    if (!channel) return true
    for (let i = 0; i < channel.length; i++) {
      const s = Math.max(-1, Math.min(1, channel[i]))
      this.batch[this.length++] = s < 0 ? s * 0x8000 : s * 0x7fff
      if (this.length === this.batch.length) {
        const out = this.batch.slice().buffer
        this.port.postMessage(out, [out])
        this.length = 0
      }
    }
    return true
  }
}

registerProcessor('pcm-worklet', PcmWorklet)
