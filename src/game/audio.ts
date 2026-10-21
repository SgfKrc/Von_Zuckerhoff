// ============================================================
// 音频：WebAudio 合成，零外部文件
// 场景氛围（drone + 钟 + 雨）+ BGM（见 bgm.ts）+ 简易音效
// ============================================================

import { BgmEngine, makeImpulse, type BgmFade, type BgmName } from './bgm'

export type SceneAudio =
  | 'silent'    // 纯静音（开场分镜的旧入口，保留兼容）
  | 'title'     // 标题
  | 'railway'   // 开场分镜：轮轨 + 机体震动 + 「群山」
  | 'train'     // 车厢
  | 'station'   // 糖堡站
  | 'road'      // 山路
  | 'gate'      // 城堡正门 / 桥（同属城堡外围，风大）
  | 'interior'  // 聚斯霍芬堡内部（门厅 / 走廊 / 图书室 / 接待厅 / 卧室 / 餐厅）
  | 'fog'
  | 'night'
  | 'cellar'
  | 'garden'

/**
 * 场景 → BGM 曲目。
 * 每个地图一首；聚斯霍芬堡内部（含酒窖、花园）共用 interior，
 * 城堡外围（正门与桥）共用 gate —— 「同一类地图同一首」是刻意设计的。
 */
const BGM_FOR_SCENE: Record<SceneAudio, BgmName | null> = {
  title: 'title',
  railway: 'opening',
  train: 'train',
  station: 'station',
  road: 'road',
  gate: 'gate',
  interior: 'interior',
  cellar: 'interior',
  garden: 'interior',
  fog: null,
  night: null,
  silent: null,
}

/** 开场分镜那一刀：借最后的黑场，2s 淡出 / 2s 淡入 */
const OPENING_FADE: BgmFade = { out: 2.0, in: 2.0 }

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
  private readonly bgm = new BgmEngine()
  /** 音效专用混响：只建一次，播放时不新增常驻节点 */
  private sfxConv: ConvolverNode | null = null

  ensure(): AudioContext | null {
    try {
      if (!this.ctx) {
        this.ctx = new AudioContext()
        this.master = this.ctx.createGain()
        this.master.gain.value = 0.8
        this.master.connect(this.ctx.destination)
        this.bgm.attach(this.ctx, this.master)
      }
      if (this.ctx.state === 'suspended') void this.ctx.resume()
      return this.ctx
    } catch {
      return null
    }
  }

  /** 浏览器要求 AudioContext 由用户手势启动：没交互过就不要建 */
  private canOpenAudio(): boolean {
    if (this.ctx) return true
    try {
      const ua = navigator.userActivation
      return !ua || ua.hasBeenActive
    } catch {
      return true
    }
  }

  start(): void {
    if (this.started) return
    this.started = true
    this.setScene(this.scene)
  }

  /**
   * 标题画面调用：确保标题场景与标题曲就绪。
   * 返回 true 表示音频已可发声（随后可让齿轮开始转）。
   */
  enterTitle(): boolean {
    if (!this.canOpenAudio()) return false
    const ctx = this.ensure()
    if (!ctx) return false
    this.started = true
    this.setScene('title')
    this.bgm.ensurePlaying()
    return true
  }

  setBgm(name: BgmName | null): void {
    this.bgm.setTrack(name)
  }

  bgmOn(): void {
    this.bgm.setEnabled(true)
  }

  bgmOff(): void {
    this.bgm.setEnabled(false)
  }

  toggleBgm(): boolean {
    const next = !this.bgm.isEnabled()
    this.bgm.setEnabled(next)
    return next
  }

  isBgmOn(): boolean {
    return this.bgm.isEnabled()
  }

  /** 诊断用：活跃播放实例 / 音符组数量（泄漏验收采样） */
  debugAudio(): { players: number; voices: number; track: BgmName | null; enabled: boolean } {
    return this.bgm.debugState()
  }

  setMuted(m: boolean): void {
    this.muted = m
    if (this.master) this.master.gain.value = m ? 0 : 0.8
  }

  isMuted(): boolean { return this.muted }

  setScene(scene: SceneAudio): void {
    // 开场分镜：Opening.tsx 调 'railway'，一次拿到「轮轨环境音 + 群山」。
    // 旧写法调的是 'silent'；只要这一步是从标题过来的，同样按开场处理 ——
    // 这段绝不能再是静音（标题与列车之间没有 BGM 是本次要修的 bug）。
    const openingEntry = scene === 'railway' || (scene === 'silent' && this.scene === 'title')

    if (scene === this.scene && this.layers.length) return
    this.scene = scene
    const ctx = this.ensure()
    if (!ctx) return
    this.clearLayers()

    const next = openingEntry ? 'opening' : BGM_FOR_SCENE[scene]
    const prev = this.bgm.getTrack()
    // 只要切换涉及开场曲，就借黑场做 2s/2s 的长淡变；地图之间保持 1.2s/2.4s
    const opening = next === 'opening' || prev === 'opening'
    this.bgm.setTrack(next, opening ? OPENING_FADE : undefined)

    if (scene === 'silent') return

    switch (scene) {
      case 'title':
        this.layers.push(this.drone(55, 0.05, 'sine'))
        this.layers.push(this.drone(82.5, 0.03, 'sine'))
        this.layers.push(this.bellPattern(0.09, [1, 0, 0, 0, 0, 1, 0, 0]))
        break
      case 'railway':
        // 开场分镜的车厢：远处滚动的轮轨 + 极低频的机体震动
        this.layers.push(this.drone(48, 0.06, 'sawtooth', 260))
        this.layers.push(this.railway(0.035))
        break
      case 'train':
        // 48Hz 锯齿不压高频会一直"嗡嗡"带毛刺，低通到 260Hz 只留轮轨的隆隆
        this.layers.push(this.drone(48, 0.06, 'sawtooth', 260))
        this.layers.push(this.railway(0.035))
        break
      case 'station':
        // 雨夜站台：雨点打在铁皮雨棚上（高频噪声）+ 远处的一股电流嗡鸣 + 站台的钟
        this.layers.push(this.noise(0.052, 1700))
        this.layers.push(this.drone(52, 0.028, 'sine'))
        this.layers.push(this.bellPattern(0.045, [1, 0, 0, 0, 0, 0, 1, 0]))
        break
      case 'road':
        // 山路：风穿过树林，低音只留一点点
        this.layers.push(this.noise(0.045, 760))
        this.layers.push(this.drone(46, 0.03, 'sine'))
        break
      case 'gate':
        // 城堡正门：风更硬，压得更低
        this.layers.push(this.noise(0.036, 520))
        this.layers.push(this.drone(38, 0.045, 'sine'))
        break
      case 'interior':
        this.layers.push(this.drone(58, 0.035, 'sine'))
        this.layers.push(this.bellPattern(0.05, [1, 0, 0, 1, 0, 0, 1, 0]))
        break
      case 'fog':
        this.layers.push(this.noise(0.035, 900))
        this.layers.push(this.drone(62, 0.022, 'sine'))
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

  private drone(freq: number, vol: number, type: OscillatorType, cutoff = 0): Layer {
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
    // 锯齿波的低频谐波很密，不压高频就会一直"嗡嗡"带毛刺
    let filter: BiquadFilterNode | null = null
    let head: AudioNode = osc
    if (cutoff > 0) {
      filter = ctx.createBiquadFilter()
      filter.type = 'lowpass'
      filter.frequency.value = cutoff
      filter.Q.value = 0.5
      osc.connect(filter)
      head = filter
    }
    head.connect(gain)
    gain.connect(this.master!)
    osc.start()
    lfo.start()
    gain.gain.linearRampToValueAtTime(vol, ctx.currentTime + 3)
    return {
      stop: () => {
        try {
          const t = ctx.currentTime
          gain.gain.cancelScheduledValues(t)
          gain.gain.linearRampToValueAtTime(0, t + 0.8)
          osc.stop(t + 0.9)
          lfo.stop(t + 0.9)
          osc.addEventListener('ended', () => {
            try {
              osc.disconnect(); lfo.disconnect(); lfoGain.disconnect(); gain.disconnect()
              if (filter) filter.disconnect()
            } catch { /* ignore */ }
          }, { once: true })
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
          const t = ctx.currentTime
          gain.gain.cancelScheduledValues(t)
          gain.gain.linearRampToValueAtTime(0, t + 0.6)
          src.stop(t + 0.7)
          src.addEventListener('ended', () => {
            try { src.disconnect(); filter.disconnect(); gain.disconnect() } catch { /* ignore */ }
          }, { once: true })
        } catch { /* ignore */ }
      },
    }
  }

  private railway(vol: number): Layer {
    const ctx = this.ctx!
    // 48Hz 三角波做轮轨空转，再被 0.9Hz 方波开合成「轰——轰——」的节奏。
    // 原来的 0.9Hz 方波直接当音源是次声：听不见，还一直在空转。
    const osc = ctx.createOscillator()
    const out = ctx.createGain()
    const gate = ctx.createGain()
    const gateLfo = ctx.createOscillator()
    const gateAmt = ctx.createGain()
    const filter = ctx.createBiquadFilter()
    osc.type = 'triangle'
    osc.frequency.value = 48
    filter.type = 'lowpass'
    filter.frequency.value = 160
    gate.gain.value = 0.55
    gateLfo.type = 'square'
    gateLfo.frequency.value = 0.9
    gateAmt.gain.value = 0.45
    out.gain.value = 0
    gateLfo.connect(gateAmt)
    gateAmt.connect(gate.gain)
    osc.connect(filter)
    filter.connect(gate)
    gate.connect(out)
    out.connect(this.master!)
    osc.start()
    gateLfo.start()
    out.gain.linearRampToValueAtTime(vol, ctx.currentTime + 2)
    return {
      stop: () => {
        try {
          const t = ctx.currentTime
          out.gain.cancelScheduledValues(t)
          out.gain.linearRampToValueAtTime(0, t + 0.5)
          osc.stop(t + 0.6)
          gateLfo.stop(t + 0.6)
          osc.addEventListener('ended', () => {
            try {
              osc.disconnect(); filter.disconnect(); gate.disconnect()
              gateLfo.disconnect(); gateAmt.disconnect(); out.disconnect()
            } catch { /* ignore */ }
          }, { once: true })
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
        osc.addEventListener('ended', () => {
          try { osc.disconnect(); gain.disconnect() } catch { /* ignore */ }
        }, { once: true })
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
        osc.addEventListener('ended', () => {
          try { osc.disconnect(); gain.disconnect() } catch { /* ignore */ }
        }, { once: true })
      } catch { /* ignore */ }
    }, 2600 + Math.random() * 2000)
    return { stop: () => window.clearInterval(timer) }
  }

  /** 一次性音效 */
  sfx(name: string): void {
    const ctx = this.ensure()
    if (!ctx || this.muted) return
    const t = ctx.currentTime
    // 汽笛是多节点图（失谐双振荡 + 带通 + 混响），走自己的构造函数
    if (name === 'whistle') { this.whistle(ctx, t); return }
    // 打字机击键：极短的低沉按压声，走自己的构造函数
    if (name === 'type') { this.typeClick(ctx, t); return }
    const g = ctx.createGain()
    g.connect(this.master!)
    const o = ctx.createOscillator()
    o.connect(g)
    // 一次性音效结束后断开整条链，避免节点随播放次数堆积
    o.addEventListener('ended', () => {
      try { o.disconnect(); g.disconnect() } catch { /* ignore */ }
    }, { once: true })
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
        g.gain.setValueAtTime(0.045, t)
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
        g.gain.setValueAtTime(0.06, t)
        g.gain.exponentialRampToValueAtTime(0.001, t + 1.6)
        o.start(t); o.stop(t + 1.7); return
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

  /**
   * 打字机击键（type）：低沉的一下，像指节敲在木头上，而不是高频「嗒」。
   *
   * 第一版用 800–1600Hz 方波 + 带通，实测听感太清脆、会从 BGM 上「跳」出来
   * （高频短脉冲对音乐中低频的遮蔽极强，听上去像把 BGM 戳断了）。
   * 现在改成压在低中频：
   * - 时长 18–25ms（随机）
   * - 音源：200–360Hz 三角波，音高再 ±8% 随机 —— 不抖的话每一下同高，连起来像节拍器
   * - 频率在 20 多毫秒内滑到 0.65 倍：做出「敲下去被阻尼」的闷响
   * - 低通 1100Hz 再削一道三角波的高次谐波，让它稳稳垫在 BGM 下面
   * - 峰值音量 0.020–0.026（比门 / 翻页都轻）
   *
   * 回收沿用 disposeGraphOnEnded 模式：主振荡器 ended 时把振荡器、低通、增益
   * 整条链一次 disconnect，每响一次都不留下节点。（打字机每 3 个字响一次，
   * 一秒不到十响，但连续几小时对话下来节点数必须回到零。）
   */
  private typeClick(ctx: AudioContext, t: number): void {
    const dur = 0.018 + Math.random() * 0.007                              // 18–25ms
    const f0 = (200 + Math.random() * 160) * (0.92 + Math.random() * 0.16) // 200–360Hz，±8%
    const peak = 0.020 + Math.random() * 0.006                             // 0.020–0.026

    const o = ctx.createOscillator()
    o.type = 'triangle'
    o.frequency.setValueAtTime(f0, t)
    // 短促下滑：低频体 + 阻尼感，比固定音高更像一次「按压」
    o.frequency.exponentialRampToValueAtTime(f0 * 0.65, t + dur)

    const lp = ctx.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.setValueAtTime(1100, t)
    lp.Q.value = 0.7

    const g = ctx.createGain()
    g.gain.setValueAtTime(0.0001, t)
    g.gain.linearRampToValueAtTime(peak, t + 0.002)
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur)

    o.connect(lp)
    lp.connect(g)
    g.connect(this.master!)

    const nodes: AudioNode[] = [o, lp, g]
    o.addEventListener('ended', () => {
      for (const node of nodes) { try { node.disconnect() } catch { /* ignore */ } }
    }, { once: true })

    o.start(t)
    o.stop(t + dur + 0.004)
  }

  /** 音效混响：沿用 bgm.ts 的脉冲响应算法，整个生命周期只建一个 Convolver */
  private sfxReverb(ctx: AudioContext): ConvolverNode {
    if (!this.sfxConv) {
      const conv = ctx.createConvolver()
      conv.buffer = makeImpulse(ctx, 2.6, 2.4)
      conv.connect(this.master!)
      this.sfxConv = conv
    }
    return this.sfxConv
  }

  /**
   * 蒸汽机车汽笛（whistle）：两个失谐振荡（220Hz 锯齿 + 277Hz 方波，故意错开成
   * 不协和的双音）→ 带通 900Hz → 低通 2400Hz → 包络：
   * 慢起音 0.15s、持续 1.2s、释放 1.8s。
   * 带通把 220/277 的基频削掉、只留 4–5 次谐波，再给偏高的混响湿声（0.85），
   * 听上去就像隔着山谷传过来的一列蒸汽机车。
   *
   * 回收沿用 disposeGraphOnEnded 模式：主振荡器 ended 时整组 disconnect，
   * 效果每响一次都不留下节点。
   */
  private whistle(ctx: AudioContext, t: number): void {
    const atk = 0.15
    const hold = 1.2
    const rel = 1.8
    const peak = 0.45
    const end = t + atk + hold + rel

    const mix = ctx.createGain(); mix.gain.value = 0.5
    const bp = ctx.createBiquadFilter()
    bp.type = 'bandpass'
    bp.frequency.setValueAtTime(900, t)
    bp.Q.value = 1.4
    const lp = ctx.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.setValueAtTime(2400, t)
    lp.Q.value = 0.6

    const env = ctx.createGain()
    env.gain.setValueAtTime(0.0001, t)
    env.gain.linearRampToValueAtTime(peak, t + atk)
    env.gain.setValueAtTime(peak, t + atk + hold)
    env.gain.linearRampToValueAtTime(0.0001, end)

    const dry = ctx.createGain(); dry.gain.value = 0.42
    const wet = ctx.createGain(); wet.gain.value = 0.85

    const a = ctx.createOscillator()
    a.type = 'sawtooth'
    a.frequency.value = 220
    const b = ctx.createOscillator()
    b.type = 'square'
    b.frequency.value = 277
    b.detune.value = 9   // 两管之间再错开一点拍频，才不像电子音

    a.connect(mix); b.connect(mix)
    mix.connect(bp)
    bp.connect(lp)
    lp.connect(env)
    env.connect(dry)
    env.connect(wet)
    dry.connect(this.master!)
    wet.connect(this.sfxReverb(ctx))

    const oscs = [a, b]
    const nodes: AudioNode[] = [mix, bp, lp, env, dry, wet]
    a.addEventListener('ended', () => {
      for (const osc of oscs) { try { osc.disconnect() } catch { /* ignore */ } }
      for (const node of nodes) { try { node.disconnect() } catch { /* ignore */ } }
    }, { once: true })

    const stopAt = end + 0.06
    a.start(t); b.start(t)
    a.stop(stopAt); b.stop(stopAt)
  }
}

export const Snd = new SoundEngine()

/** 地图 → 场景音频 */
export function sceneForMap(map: string, ambient: string): SceneAudio {
  if (map === 'train') return 'train'
  if (map === 'station') return 'station'
  if (map === 'road') return 'road'
  // 城堡外围：正门与桥同一类（风大、都是压下来的），共用 gate 曲
  if (map === 'gate' || map === 'bridge') return 'gate'
  if (map === 'cellar') return 'cellar'
  if (map === 'garden') return 'garden'
  // 聚斯霍芬堡内部：门厅 / 东西走廊 / 图书室 / 接待厅 / 卧室 / 餐厅
  if (ambient === 'indoor') return 'interior'
  if (ambient === 'night') return 'night'
  return 'fog'
}
