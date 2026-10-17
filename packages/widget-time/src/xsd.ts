/** Lexical helpers for the XSD date and time datatypes the widget edits. */
export const XSD = 'http://www.w3.org/2001/XMLSchema#'
export const DATE_TIME_STAMP = `${XSD}dateTimeStamp`
export const DATE_TIME = `${XSD}dateTime`
export const DATE = `${XSD}date`
export const TIME = `${XSD}time`
export const G_YEAR = `${XSD}gYear`
export const G_YEAR_MONTH = `${XSD}gYearMonth`
export const DURATION = `${XSD}duration`

/** The datatypes this widget scores for; xsd:date and xsd:dateTime stay with the built-in editors. */
export const TIME_DATATYPES = new Set([DATE_TIME_STAMP, TIME, G_YEAR, G_YEAR_MONTH, DURATION])

export interface DateTimeParts {
  /** "YYYY-MM-DDTHH:MM[:SS[.fff]]", the local part of the lexical form. */
  local: string
  /** "Z" or "+HH:MM" / "-HH:MM"; empty when the literal has no zone. */
  zone: string
}

export function splitDateTime (text: string): DateTimeParts {
  const m = /^(-?\d{4,}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?)(Z|[+-]\d{2}:\d{2})?$/.exec(text.trim())
  if (!m) return { local: '', zone: '' }
  return { local: m[1], zone: m[2] ?? '' }
}

export function joinDateTime ({ local, zone }: DateTimeParts): string {
  if (!local) return ''
  const withSeconds = local.length === 16 ? `${local}:00` : local
  return `${withSeconds}${zone}`
}

/** The browser's current UTC offset as "+HH:MM", or "Z". */
export function localZone (date = new Date()): string {
  const minutes = -date.getTimezoneOffset()
  if (minutes === 0) return 'Z'
  const sign = minutes < 0 ? '-' : '+'
  const abs = Math.abs(minutes)
  return `${sign}${String(Math.floor(abs / 60)).padStart(2, '0')}:${String(abs % 60).padStart(2, '0')}`
}

/** Offsets offered in the zone picker: every hour from -12 to +14 plus the half- and quarter-hour ones in use. */
export const ZONES: string[] = (() => {
  const out = ['Z']
  for (let h = -12; h <= 14; h++) {
    if (h === 0) continue
    out.push(`${h < 0 ? '-' : '+'}${String(Math.abs(h)).padStart(2, '0')}:00`)
  }
  out.push('+05:30', '+05:45', '+09:30', '+10:30', '-03:30', '+03:30', '+04:30', '+06:30', '+08:45', '+12:45', '-09:30')
  return out.sort((a, b) => offsetMinutes(a) - offsetMinutes(b))
})()

export function offsetMinutes (zone: string): number {
  if (zone === 'Z' || !zone) return 0
  const sign = zone[0] === '-' ? -1 : 1
  const [h, m] = zone.slice(1).split(':').map(Number)
  return sign * (h * 60 + m)
}

export interface Duration { years: string; months: string; days: string; hours: string; minutes: string; seconds: string; negative: boolean }

const EMPTY: Duration = { years: '', months: '', days: '', hours: '', minutes: '', seconds: '', negative: false }

export function parseDuration (text: string): Duration {
  const m = /^(-)?P(?:(\d+)Y)?(?:(\d+)M)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?)?$/.exec(text.trim())
  if (!m || text.trim() === 'P' || text.trim().endsWith('T')) return EMPTY
  return { negative: Boolean(m[1]), years: m[2] ?? '', months: m[3] ?? '', days: m[4] ?? '', hours: m[5] ?? '', minutes: m[6] ?? '', seconds: m[7] ?? '' }
}

export function writeDuration (d: Duration): string {
  const date = `${d.years ? `${d.years}Y` : ''}${d.months ? `${d.months}M` : ''}${d.days ? `${d.days}D` : ''}`
  const time = `${d.hours ? `${d.hours}H` : ''}${d.minutes ? `${d.minutes}M` : ''}${d.seconds ? `${d.seconds}S` : ''}`
  if (!date && !time) return ''
  return `${d.negative ? '-' : ''}P${date}${time ? `T${time}` : ''}`
}
