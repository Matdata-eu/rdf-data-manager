import {
  DATE, DATE_TIME, DATE_TIME_STAMP, DURATION, G_YEAR, G_YEAR_MONTH, TIME, ZONES,
  joinDateTime, localZone, parseDuration, splitDateTime, writeDuration, type Duration
} from './xsd'

export interface LiteralProps {
  datatype: string
  text: string
  onChange: (text: string) => void
  id: string
  invalid?: boolean
}

/** A calendar or clock input for one XSD date/time datatype, keeping the lexical form valid. */
export function LiteralEditor ({ datatype, text, onChange, id, invalid }: LiteralProps) {
  switch (datatype) {
    case DATE_TIME_STAMP:
    case DATE_TIME:
      return <DateTimeEditor text={text} onChange={onChange} id={id} invalid={invalid} zoneRequired={datatype === DATE_TIME_STAMP} />
    case DATE:
      return <input id={id} aria-invalid={invalid} type='date' value={text} onChange={e => onChange(e.target.value)} />
    case TIME:
      return <input id={id} aria-invalid={invalid} type='time' step='1' value={text.replace(/(Z|[+-]\d{2}:\d{2})$/, '')} onChange={e => onChange(e.target.value.length === 5 ? `${e.target.value}:00` : e.target.value)} />
    case G_YEAR:
      return <input id={id} aria-invalid={invalid} type='number' step='1' placeholder='YYYY' className='rdm-time-year' value={text} onChange={e => onChange(e.target.value)} />
    case G_YEAR_MONTH:
      return <input id={id} aria-invalid={invalid} type='month' value={text} onChange={e => onChange(e.target.value)} />
    case DURATION:
      return <DurationEditor text={text} onChange={onChange} id={id} invalid={invalid} />
    default:
      return <input id={id} aria-invalid={invalid} type='text' value={text} onChange={e => onChange(e.target.value)} />
  }
}

function DateTimeEditor ({ text, onChange, id, invalid, zoneRequired }: Omit<LiteralProps, 'datatype'> & { zoneRequired: boolean }) {
  const parts = splitDateTime(text)
  const zone = parts.zone || (zoneRequired ? localZone() : '')
  const zones = ZONES.includes(zone) || !zone ? ZONES : [...ZONES, zone]
  return (
    <div className='rdm-time-row'>
      <input
        id={id} aria-invalid={invalid} type='datetime-local' step='1' value={parts.local}
        onChange={e => onChange(joinDateTime({ local: e.target.value, zone: e.target.value ? zone : '' }))}
      />
      <select
        aria-label='Time zone' value={zone} className='rdm-time-zone'
        onChange={e => onChange(joinDateTime({ local: parts.local, zone: e.target.value }))}
      >
        {!zoneRequired && <option value=''>no zone</option>}
        {zones.map(z => <option key={z} value={z}>{z === 'Z' ? 'UTC' : `UTC${z}`}</option>)}
      </select>
    </div>
  )
}

const DURATION_FIELDS: Array<[keyof Omit<Duration, 'negative'>, string]> = [
  ['years', 'years'], ['months', 'months'], ['days', 'days'], ['hours', 'hours'], ['minutes', 'minutes'], ['seconds', 'seconds']
]

function DurationEditor ({ text, onChange, id, invalid }: Omit<LiteralProps, 'datatype'>) {
  const d = parseDuration(text)
  const set = (patch: Partial<Duration>) => onChange(writeDuration({ ...d, ...patch }))
  return (
    <div className='rdm-time-duration' role='group' aria-label='Duration'>
      {DURATION_FIELDS.map(([key, label], i) => (
        <label key={key} className='rdm-time-part'>
          <input
            id={i === 0 ? id : undefined} aria-invalid={invalid} type='number' min='0' step={key === 'seconds' ? 'any' : '1'}
            value={d[key]} placeholder='0' onChange={e => set({ [key]: e.target.value })}
          />
          <span>{label}</span>
        </label>
      ))}
      <label className='rdm-time-part'>
        <input type='checkbox' checked={d.negative} onChange={e => set({ negative: e.target.checked })} />
        <span>negative</span>
      </label>
      <code className='rdm-time-lexical'>{text || 'P…'}</code>
    </div>
  )
}
