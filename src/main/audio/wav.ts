/** Wraps raw 16-bit little-endian mono PCM in a WAV container. */
export function pcmToWav(pcm: Buffer, sampleRate: number): Buffer {
  const header = Buffer.alloc(44)
  header.write('RIFF', 0)
  header.writeUInt32LE(36 + pcm.length, 4)
  header.write('WAVE', 8)
  header.write('fmt ', 12)
  header.writeUInt32LE(16, 16) // fmt chunk size
  header.writeUInt16LE(1, 20) // PCM
  header.writeUInt16LE(1, 22) // mono
  header.writeUInt32LE(sampleRate, 24)
  header.writeUInt32LE(sampleRate * 2, 28) // byte rate
  header.writeUInt16LE(2, 32) // block align
  header.writeUInt16LE(16, 34) // bits per sample
  header.write('data', 36)
  header.writeUInt32LE(pcm.length, 40)
  return Buffer.concat([header, pcm])
}

/** Root-mean-square level of 16-bit PCM in 0..1, used to skip silent chunks. */
export function pcmLevel(pcm: Buffer): number {
  const samples = Math.floor(pcm.length / 2)
  if (!samples) return 0
  let sum = 0
  for (let i = 0; i < samples; i++) {
    const s = pcm.readInt16LE(i * 2) / 32768
    sum += s * s
  }
  return Math.sqrt(sum / samples)
}
