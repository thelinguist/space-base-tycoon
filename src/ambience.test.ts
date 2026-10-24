import { describe, expect, it } from "vitest"
import { Ambience, AMBIENCE_MASTER } from "./ambience"

/** Just enough of the Web Audio API to record what Ambience builds. */
class FakeParam {
  ramps: [number, number][] = []
  inputs: FakeNode[] = []
  constructor(public value = 0) {}
  cancelScheduledValues() {}
  setValueAtTime(v: number) {
    this.value = v
  }
  linearRampToValueAtTime(v: number, at: number) {
    this.ramps.push([v, at])
  }
}

class FakeNode {
  outputs: (FakeNode | FakeParam)[] = []
  started = false
  type = ""
  loop = false
  buffer: unknown = null
  gain = new FakeParam(1)
  frequency = new FakeParam()
  Q = new FakeParam()
  constructor(public kind: string) {}
  connect<T extends FakeNode | FakeParam>(target: T): T {
    this.outputs.push(target)
    if (target instanceof FakeParam) target.inputs.push(this)
    return target
  }
  start() {
    this.started = true
  }
}

function fakeContext() {
  const nodes: FakeNode[] = []
  const make = (kind: string) => {
    const n = new FakeNode(kind)
    nodes.push(n)
    return n
  }
  const ctx = {
    currentTime: 10,
    sampleRate: 100,
    destination: new FakeNode("destination"),
    createGain: () => make("gain"),
    createOscillator: () => make("oscillator"),
    createBiquadFilter: () => make("filter"),
    createBufferSource: () => make("bufferSource"),
    createBuffer: (_: number, length: number) => {
      const data = new Float32Array(length)
      return { getChannelData: () => data, data }
    },
  }
  return {
    ctx: ctx as unknown as BaseAudioContext,
    nodes,
    destination: ctx.destination,
  }
}

const of = (nodes: FakeNode[], kind: string) =>
  nodes.filter((n) => n.kind === kind)

describe("Ambience", () => {
  it("starts silent, mixed into the destination", () => {
    const { ctx, destination } = fakeContext()
    const amb = new Ambience(ctx)
    expect(amb.output.gain.value).toBe(0)
    expect((amb.output as unknown as FakeNode).outputs).toEqual([destination])
  })

  it("loops filtered noise for wind, gusting with two slow LFOs", () => {
    const { ctx, nodes } = fakeContext()
    new Ambience(ctx, () => 1)
    const [noise] = of(nodes, "bufferSource")
    expect(noise.loop).toBe(true)
    expect(noise.started).toBe(true)
    // 2s of noise at the fake 100Hz sample rate, all at full scale.
    const buffer = noise.buffer as { data: Float32Array }
    expect(buffer.data).toHaveLength(200)
    expect(buffer.data.every((v) => v === 1)).toBe(true)

    const wind = of(nodes, "filter").find((f) => f.type === "bandpass")!
    expect(noise.outputs).toEqual([wind])
    // LFOs drive the wind's pitch and its volume.
    expect(wind.frequency.inputs).toHaveLength(1)
    const windLevel = wind.outputs[0] as FakeNode
    expect(windLevel.gain.inputs).toHaveLength(1)
    const lfoRates = of(nodes, "oscillator")
      .filter((o) => o.frequency.value < 1)
      .map((o) => o.frequency.value)
    expect(lfoRates).toEqual([0.05, 0.13])
  })

  it("is just the wind: no tones besides the gust LFOs", () => {
    const { ctx, nodes } = fakeContext()
    new Ambience(ctx)
    expect(of(nodes, "oscillator").map((o) => o.frequency.value)).toEqual([
      0.05, 0.13,
    ])
  })

  it("fades to a level, scaled by the ambience master", () => {
    const { ctx } = fakeContext()
    const amb = new Ambience(ctx)
    const gain = amb.output.gain as unknown as FakeParam
    amb.setLevel(1, 3)
    expect(gain.ramps).toEqual([[AMBIENCE_MASTER, 13]])
    amb.setLevel(0.5)
    expect(gain.ramps[1]).toEqual([AMBIENCE_MASTER * 0.5, 10.2])
  })
})
