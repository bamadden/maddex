// Subtle UI sound effects via the Web Audio API — no audio files, just
// short synthesised tones. Off by default (localStorage-persisted opt-in),
// per the brief's "non-intrusive" default.
const SOUND_KEY = 'maddex_sound_enabled'

const SOUNDS = {
  alert:   { freq: 880,  duration: 0.3,  vol: 0.08 },
  success: { freq: 1046, duration: 0.2,  vol: 0.06 },
  ping:    { freq: 660,  duration: 0.15, vol: 0.05 },
  tick:    { freq: 440,  duration: 0.05, vol: 0.03 },
  open:    { freq: 523,  duration: 0.1,  vol: 0.04 },
  error:   { freq: 220,  duration: 0.3,  vol: 0.06 },
}

class SoundService {
  constructor() {
    this.enabled = this.load()
    this.ctx = null
    this.listeners = new Set()
  }

  load() {
    try { return localStorage.getItem(SOUND_KEY) === 'true' } catch { return false }
  }

  subscribe(cb) {
    this.listeners.add(cb)
    return () => this.listeners.delete(cb)
  }

  getContext() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext
      this.ctx = new AudioCtx()
    }
    return this.ctx
  }

  toggle() {
    this.enabled = !this.enabled
    try { localStorage.setItem(SOUND_KEY, String(this.enabled)) } catch { /* best-effort */ }
    if (this.enabled) this.play('ping') // preview so turning it on is confirmed audibly
    this.listeners.forEach((cb) => cb())
    return this.enabled
  }

  play(type) {
    if (!this.enabled) return
    const ctx = this.getContext()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)

    const s = SOUNDS[type] || SOUNDS.ping
    osc.frequency.value = s.freq
    osc.type = 'sine'
    gain.gain.setValueAtTime(s.vol, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + s.duration)
    osc.start(ctx.currentTime)
    osc.stop(ctx.currentTime + s.duration)
  }

  priceAlert()   { this.play('alert') }
  aiComplete()   { this.play('ping') }
  actionSuccess() { this.play('success') }
  tickUp()       { this.play('tick') }
  marketOpen()   { this.play('open') }
  error()        { this.play('error') }
}

export const soundService = new SoundService()
