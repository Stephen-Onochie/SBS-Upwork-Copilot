function playSoundOffscreen(soundId: string, volume: number): void {
  const gain = Math.max(0, Math.min(1, volume / 100))
  if (soundId === 'none' || gain === 0) return

  const ctx = new AudioContext()
  const masterGain = ctx.createGain()
  masterGain.gain.value = gain
  masterGain.connect(ctx.destination)

  function tone(freq: number, type: OscillatorType, start: number, duration: number): void {
    const osc = ctx.createOscillator()
    const g = ctx.createGain()
    osc.type = type
    osc.frequency.value = freq
    g.gain.setValueAtTime(gain, ctx.currentTime + start)
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + start + duration)
    osc.connect(g)
    g.connect(ctx.destination)
    osc.start(ctx.currentTime + start)
    osc.stop(ctx.currentTime + start + duration)
  }

  if (soundId === 'ding') {
    tone(880, 'sine', 0, 0.4)
  } else if (soundId === 'chime') {
    tone(523, 'sine', 0, 0.5)
    tone(659, 'sine', 0.1, 0.4)
  } else if (soundId === 'alert') {
    tone(1000, 'square', 0, 0.1)
    tone(1000, 'square', 0.15, 0.1)
    tone(1000, 'square', 0.3, 0.1)
  } else if (soundId === 'bell') {
    tone(440, 'sine', 0, 0.6)
    tone(880, 'sine', 0, 0.3)
  }

  // Close context after sounds finish
  setTimeout(() => { void ctx.close() }, 1500)
}

chrome.runtime.onMessage.addListener((message) => {
  if (message.type === 'PLAY_SOUND') {
    playSoundOffscreen(message.sound as string, message.volume as number)
  }
  return true
})
