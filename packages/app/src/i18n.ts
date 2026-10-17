import { nb } from './messages/nb'

export type Params = Record<string, string | number>

/**
 * UI messages. Keys are the English text; a catalogue maps them to another language,
 * and a missing entry falls back to English. Placeholders are written {name}.
 */
const catalogues: Record<string, Record<string, string>> = { nb, nn: nb }

let current: Record<string, string> = {}

/** Picks the catalogue for a language tag ("nb", "nn-NO", "en"); unknown tags show English. */
export function setUiLanguage (tag: string): void {
  current = catalogues[tag] ?? catalogues[tag.split('-')[0]] ?? {}
}

export function format (message: string, params?: Params): string {
  if (!params) return message
  return message.replace(/\{(\w+)\}/g, (m, name: string) => name in params ? String(params[name]) : m)
}

export function t (key: string, params?: Params): string {
  return format(current[key] ?? key, params)
}

/** Picks the singular or plural message by count, which is passed as {n}. */
export function n (count: number, one: string, other: string, params?: Params): string {
  return t(count === 1 ? one : other, { n: count, ...params })
}
