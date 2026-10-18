import type { EngineInterface } from 'claude-code'

export type SoundKind = 'complete' | 'question'

export type SoundSettings = {
  onComplete: boolean
  onQuestion: boolean
  // Absolute path of a WAV chosen by the user; undefined plays the bundled one
  completeFile?: string
  questionFile?: string
  // A completion sound is played only for answers at least this long
  completeMinSeconds: number
}

export type PluginOptions = Readonly<Record<string, unknown>>

type Player = 'windows' | 'afplay' | 'paplay' | 'aplay' | 'none'

// Several prompts can arrive together (a question and its permission dialog): one sound for the burst
const QUESTION_DEBOUNCE_MS = 3000

let player: Player | undefined
let lastQuestionSoundAt = Number.NEGATIVE_INFINITY

function customFile(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  const path = value.trim()
  return path === '' || path.toLowerCase() === 'default' ? undefined : path
}

export function readSoundSettings(options: PluginOptions): SoundSettings {
  const minSeconds = Number(options.completeMinSeconds)
  return {
    onComplete: options.soundOnComplete !== false,
    onQuestion: options.soundOnQuestion !== false,
    completeFile: customFile(options.completeSound),
    questionFile: customFile(options.questionSound),
    completeMinSeconds: Number.isFinite(minSeconds) && minSeconds >= 0 ? minSeconds : 15,
  }
}

async function commandExists($: EngineInterface, name: string): Promise<boolean> {
  try {
    const { exitCode } = await $.process.run(['sh', '-c', `command -v ${name}`], { timeoutMs: 5000 })
    return exitCode === 0
  } catch {
    return false
  }
}

// $.audio.play only has a player on macOS, so each platform gets its own command
async function detectPlayer($: EngineInterface): Promise<Player> {
  if ((await $.env.get('OS')) === 'Windows_NT') return 'windows'
  for (const candidate of ['afplay', 'paplay', 'aplay'] as const) {
    if (await commandExists($, candidate)) return candidate
  }
  return 'none'
}

async function resolveFile($: EngineInterface, kind: SoundKind, settings: SoundSettings): Promise<string> {
  const bundled = `${$.plugin.root}/sounds/${kind}.wav`
  const custom = kind === 'complete' ? settings.completeFile : settings.questionFile
  if (!custom) return bundled
  if (await $.fs.exists(custom)) return custom
  $.ui.toast(`Suono non trovato: ${custom}. Uso quello predefinito`)
  return bundled
}

export async function playSound($: EngineInterface, kind: SoundKind, settings: SoundSettings): Promise<void> {
  player ??= await detectPlayer($)
  const file = await resolveFile($, kind, settings)
  try {
    switch (player) {
      case 'windows':
        // The path travels in an environment variable, so no quoting of user paths is needed
        await $.process.run(
          ['powershell', '-NoProfile', '-NonInteractive', '-Command', '(New-Object System.Media.SoundPlayer $env:CSB_SOUND).PlaySync()'],
          { env: { CSB_SOUND: file }, timeoutMs: 30_000 },
        )
        return
      case 'afplay':
      case 'paplay':
      case 'aplay':
        await $.process.run([player, file], { timeoutMs: 30_000 })
        return
      case 'none':
        return
    }
  } catch {
    // A sound that cannot play must never disturb the session
  }
}

export async function playQuestionSound($: EngineInterface, settings: SoundSettings): Promise<void> {
  if (!settings.onQuestion) return
  const now = await $.clock.now()
  if (now - lastQuestionSoundAt < QUESTION_DEBOUNCE_MS) return
  lastQuestionSoundAt = now
  await playSound($, 'question', settings)
}

export async function playCompleteSound($: EngineInterface, settings: SoundSettings, durationMs: number): Promise<void> {
  if (!settings.onComplete || durationMs < settings.completeMinSeconds * 1000) return
  await playSound($, 'complete', settings)
}

// Persists a toggle the way /config does, so the menu and /config always agree; the mod reloads with it
export async function setSoundOption($: EngineInterface, field: 'soundOnComplete' | 'soundOnQuestion', value: boolean): Promise<void> {
  const result = await $.config.set({ key: `${$.plugin.name}.${field}`, value })
  if (result.deny !== undefined) $.ui.toast(`Impostazione non salvata: ${result.deny}`)
}
