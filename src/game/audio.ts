// ============================================================
// 音频：WebAudio 合成，零外部文件
// 场景氛围（drone + 钟 + 雨）+ 简易音效
// ============================================================

export type SceneAudio =
  | 'silent' | 'title' | 'train' | 'fog' | 'indoor' | 'night' | 'cellar' | 'garden'

interface Layer {
  stop: () => void
}

class SoundEngine {
  private ctx: AudioContext | null = null
  private master: GainNode | null = null
  private layers: Layer[] = []
  private scene: SceneAudio = 'silent'
  private started = false
  private muted = false

  ensure(): AudioContext | null {
    try {
      if (!this.ctx) {
        this.ctx = new AudioContext()
        this.master = this.ctx.createGain()
        this.master.gain.value = 0.55
        this.master.connect(this.ctx.destination)
      }
      if (this.ctx.state === 'suspended') void this.ctx.resume()
      return this.ctx
    } catch {
      return null
    }
  }

  start(): void {
    if (this.started) return
    this.started = true
    this.setScene(this.scene)
  }

  setMuted(m: boolean): void {
    this.muted = m
    if (this.master) this.master.gain.value = m ? 0 : 0.55
  }

  isMuted(): boolean { return this.muted }

  setScene(scene: SceneAudio): void {
    if (scene === this.scene && this.layers.length) return
    this.scene = scene
    const ctx = this.ensure()
    if (!ctx) return
    this.clearLayers()
    if (scene === 'silent') return

    switch (scene) {
      case 'title':
        this.layers.push(this.drone(55, 0.05, 'sine'))
        this.layers.push(this.drone(82.5, 0.03, 'sine'))
        this.layers.push(this.bellPattern(0.09, [1, 0, 0, 0, 0, 1, 0, 0]))
        break
      case 'train':
        this.layers.push(this.drone(48, 0.06, 'sawtooth'))
        this.layers.push(this.railway(0.035))
        break
      case 'fog':
        this.layers.push(this.noise(0.035, 900))
        this.layers.push(this.drone(62, 0.022, 'sine'))
        break
      case 'indoor':
        this.layers.push(this.drone(58, 0.035, 'sine'))
        this.layers.push(this.bellPattern(0.05, [1, 0, 0, 1, 0, 0, 1, 0]))
        break
      case 'night':
        this.layers.push(this.drone(44, 0.05, 'sine'))
        this.layers.push(this.drone(66, 0.018, 'sine'))
        break
      case 'cellar':
        this.layers.push(this.drone(38, 0.06, 'sine'))
        this.layers.push(this.drip(0.02))
        break
      case 'garden':
        this.layers.push(this.noise(0.022, 1400))
        this.layers.push(this.drone(70, 0.02, 'sine'))
        break
    }
  }

  private clearLayers(): void {
    for (const l of this.layers) { try { l.stop() } catch { /* ignore */ } }
    this.layers = []
  }

  // ---- 层 ----

  private drone(freq: number, vol: number, type: OscillatorType): Layer {
    const ctx = this.ctx!
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    const lfo = ctx.createOscillator()
    const lfoGain = ctx.createGain()
    osc.type = type
    osc.frequency.value = freq
    gain.gain.value = 0
    lfo.frequency.value = 0.07 + Math.random() * 0.06
    lfoGain.gain.value = freq * 0.004
    lfo.connect(lfoGain)
    lfoGain.connect(osc.frequency)
    osc.connect(gain)
    gain.connect(this.master!)
    osc.start()
    lfo.start()
    gain.gain.linearRampToValueAtTime(vol, ctx.currentTime + 3)
    return {
      stop: () => {
        try {
          gain.gain.cancelScheduledValues(ctx.currentTime)
          gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.8)
          osc.stop(ctx.currentTime + 0.9)
          lfo.stop(ctx.currentTime + 0.9)
        } catch { /* ignore */ }
      },
    }
  }

  private noise(vol: number, cutoff: number): Layer {
    const ctx = this.ctx!
    const len = ctx.sampleRate * 2
    const buf = ctx.createBuffer(1, len, ctx.sampleRate)
    const data = buf.getChannelData(0)
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1
    const src = ctx.createBufferSource()
    src.buffer = buf
    src.loop = true
    const filter = ctx.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.value = cutoff
    const gain = ctx.createGain()
    gain.gain.value = 0
    src.connect(filter)
    filter.connect(gain)
    gain.connect(this.master!)
    src.start()
    gain.gain.linearRampToValueAtTime(vol, ctx.currentTime + 2)
    return {
      stop: () => {
        try {
          gain.gain.cancelScheduledValues(ctx.currentTime)
          gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.6)
          src.stop(ctx.currentTime + 0.7)
        } catch { /* ignore */ }
      },
    }
  }

  private railway(vol: number): Layer {
    const ctx = this.ctx!
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'square'
    osc.frequency.value = 0.9
    gain.gain.value = 0
    const filter = ctx.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.value = 120
    osc.connect(filter)
    filter.connect(gain)
    gain.connect(this.master!)
    osc.start()
    gain.gain.linearRampToValueAtTime(vol, ctx.currentTime + 2)
    const timer = window.setInterval(() => {
      try {
        gain.gain.cancelScheduledValues(ctx.currentTime)
        gain.gain.setValueAtTime(vol, ctx.currentTime)
        gain.gain.linearRampToValueAtTime(vol * 0.3, ctx.currentTime + 0.6)
      } catch { /* ignore */ }
    }, 1400)
    return {
      stop: () => {
        window.clearInterval(timer)
        try {
          gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.5)
          osc.stop(ctx.currentTime + 0.6)
        } catch { /* ignore */ }
      },
    }
  }

  private bellPattern(vol: number, pattern: number[]): Layer {
    const ctx = this.ctx!
    let step = 0
    const timer = window.setInterval(() => {
      if (this.muted) return
      const on = pattern[step % pattern.length]
      step++
      if (!on) return
      try {
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.type = 'sine'
        osc.frequency.value = 196 + Math.random() * 40
        gain.gain.setValueAtTime(0, ctx.currentTime)
        gain.gain.linearRampToValueAtTime(vol, ctx.currentTime + 0.02)
        gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 2.4)
        osc.connect(gain)
        gain.connect(this.master!)
        osc.start()
        osc.stop(ctx.currentTime + 2.5)
      } catch { /* ignore */ }
    }, 1700)
    return { stop: () => window.clearInterval(timer) }
  }

  private drip(vol: number): Layer {
    const ctx = this.ctx!
    const timer = window.setInterval(() => {
      if (this.muted) return
      try {
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.type = 'sine'
        osc.frequency.setValueAtTime(900, ctx.currentTime)
        osc.frequency.exponentialRampToValueAtTime(300, ctx.currentTime + 0.12)
        gain.gain.setValueAtTime(vol, ctx.currentTime)
        gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.2)
        osc.connect(gain)
        gain.connect(this.master!)
        osc.start()
        osc.stop(ctx.currentTime + 0.22)
      } catch { /* ignore */ }
    }, 2600 + Math.random() * 2000)
    return { stop: () => window.clearInterval(timer) }
  }

  /** 一次性音效 */
  sfx(name: string): void {
    const ctx = this.ensure()
    if (!ctx || this.muted) return
    const t = ctx.currentTime
    const g = ctx.createGain()
    g.connect(this.master!)
    const o = ctx.createOscillator()
    o.connect(g)
    switch (name) {
      case 'sting':
        o.type = 'sawtooth'
        o.frequency.setValueAtTime(240, t)
        o.frequency.exponentialRampToValueAtTime(52, t + 0.55)
        g.gain.setValueAtTime(0.16, t)
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.7)
        o.start(t); o.stop(t + 0.72); return
      case 'door':
        o.type = 'square'
        o.frequency.setValueAtTime(88, t)
        o.frequency.exponentialRampToValueAtTime(58, t + 0.4)
        g.gain.setValueAtTime(0.09, t)
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.45)
        o.start(t); o.stop(t + 0.47); return
      case 'page':
        o.type = 'triangle'
        o.frequency.setValueAtTime(1600, t)
        g.gain.setValueAtTime(0.045, t)
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.13)
        o.start(t); o.stop(t + 0.14); return
      case 'bell':
        o.type = 'sine'
        o.frequency.setValueAtTime(392, t)
        g.gain.setValueAtTime(0.13, t)
        g.gain.exponentialRampToValueAtTime(0.001, t + 2.2)
        o.start(t); o.stop(t + 2.3); return
      case 'sugar':
        o.type = 'sine'
        o.frequency.setValueAtTime(880, t)
        o.frequency.exponentialRampToValueAtTime(1320, t + 0.09)
        g.gain.setValueAtTime(0.05, t)
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.16)
        o.start(t); o.stop(t + 0.17); return
      default:
        o.type = 'sine'
        o.frequency.setValueAtTime(330, t)
        g.gain.setValueAtTime(0.04, t)
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.2)
        o.start(t); o.stop(t + 0.21)
    }
  }
}

export const Snd = new SoundEngine()

/** 地图 → 场景音频 */
export function sceneForMap(map: string, ambient: string): SceneAudio {
  if (map === 'train') return 'train'
  if (map === 'station' || map === 'road' || map === 'gate') return 'fog'
  if (map === 'cellar') return 'cellar'
  if (map === 'garden' || map === 'bridge') return 'garden'
  if (ambient === 'night') return 'night'
  if (ambient === 'indoor') return 'indoor'
  return 'fog'
}
