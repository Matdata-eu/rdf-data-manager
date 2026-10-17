import { firstNode, firstText, newNestedValue, withNode, withText, type NodeState, type PropertyShape, type ShapesModel, type Term } from '@rdf-data-manager/core'
import { useForm, useT, type Widget, type WidgetEditorProps } from '@rdf-data-manager/react'
import { LiteralEditor } from './editors'
import { DATE, DATE_TIME, DATE_TIME_STAMP, TIME_DATATYPES, XSD } from './xsd'
import './time.css'

export * from './xsd'
export { LiteralEditor } from './editors'

export const OWL_TIME = 'http://www.w3.org/2006/time#'
export const INSTANT = `${OWL_TIME}Instant`
export const INTERVAL = `${OWL_TIME}Interval`
export const PROPER_INTERVAL = `${OWL_TIME}ProperInterval`
export const HAS_BEGINNING = `${OWL_TIME}hasBeginning`
export const HAS_END = `${OWL_TIME}hasEnd`
export const HAS_TIME = `${OWL_TIME}hasTime`
export const TIME_EDITOR = 'https://matdata.eu/ns/rdf-data-manager#TimeEditor'

/** The time:inXSD… properties, with the datatype each one carries. */
const IN_XSD: Record<string, string> = {
  [`${OWL_TIME}inXSDDateTimeStamp`]: DATE_TIME_STAMP,
  [`${OWL_TIME}inXSDDateTime`]: DATE_TIME,
  [`${OWL_TIME}inXSDDate`]: DATE,
  [`${OWL_TIME}inXSDgYear`]: `${XSD}gYear`,
  [`${OWL_TIME}inXSDgYearMonth`]: `${XSD}gYearMonth`
}

/** A property whose values are OWL-Time instants or intervals edited in place. */
function isTimeNode (p: PropertyShape): boolean {
  if (!p.node) return false
  return p.classes.some(c => c === INSTANT || c === INTERVAL || c === PROPER_INTERVAL) ||
    [HAS_BEGINNING, HAS_END, HAS_TIME].includes(p.path.value)
}

function score (p: PropertyShape, _value?: Term): number {
  if (p.datatype && TIME_DATATYPES.has(p.datatype)) return 20
  return isTimeNode(p) ? 20 : 0
}

/** The time:inXSD… property a nested instant shape offers, preferring the most precise. */
function instantProperty (node: NodeState): PropertyShape | undefined {
  const order = Object.keys(IN_XSD)
  return [...node.shape.properties].filter(p => p.path.value in IN_XSD).sort((a, b) => order.indexOf(a.path.value) - order.indexOf(b.path.value))[0]
}

function InstantEditor ({ node, onChange, id, invalid }: { node: NodeState; onChange: (n: NodeState) => void; id: string; invalid?: boolean }) {
  const t = useT()
  const p = instantProperty(node)
  if (!p) return <span className='muted'>{t('This instant shape has no time:inXSD… property.')}</span>
  const path = p.path.value
  return (
    <LiteralEditor
      datatype={p.datatype ?? IN_XSD[path]} text={firstText(node, path)} id={id} invalid={invalid}
      onChange={text => onChange(withText(node, path, text))}
    />
  )
}

function IntervalEditor ({ node, onChange, id, invalid, model }: { node: NodeState; onChange: (n: NodeState) => void; id: string; invalid?: boolean; model: ShapesModel }) {
  const t = useT()
  const ends: Array<[string, string, string]> = [[HAS_BEGINNING, t('From'), t('Set from')], [HAS_END, t('To'), t('Set to')]]
  return (
    <div className='rdm-time-interval' role='group' aria-label={t('Interval')}>
      {ends.map(([path, label, setLabel], i) => {
        const has = node.shape.properties.some(p => p.path.value === path)
        if (!has) return null
        const end = firstNode(node, path)
        const endId = i === 0 ? id : `${id}-end`
        return (
          <div key={path} className='rdm-time-end'>
            <label htmlFor={endId}>{label}</label>
            {end
              ? <InstantEditor node={end} id={endId} invalid={invalid} onChange={n => onChange(withNode(node, path, n, model))} />
              : <button type='button' className='button ghost small' aria-label={setLabel} onClick={() => onChange(addEnd(node, path, model))}>{t('+ Set')}</button>}
          </div>
        )
      })}
    </div>
  )
}

/** Adds an empty instant (built from the nested shape's defaults) under hasBeginning / hasEnd. */
function addEnd (node: NodeState, path: string, model: ShapesModel): NodeState {
  const p = node.shape.properties.find(x => x.path.value === path)
  const made = p ? newNestedValue(p, model) : undefined
  if (!made?.node) return node
  return withNode(node, path, made.node, model)
}

function Editor ({ property, value, onChange, id, invalid }: WidgetEditorProps) {
  const { model } = useForm()
  if (value.node) {
    const node = value.node
    const isInterval = node.shape.properties.some(p => p.path.value === HAS_BEGINNING || p.path.value === HAS_END)
    return isInterval
      ? <IntervalEditor node={node} id={id} invalid={invalid} model={model} onChange={n => onChange({ ...value, node: n })} />
      : <InstantEditor node={node} id={id} invalid={invalid} onChange={n => onChange({ ...value, node: n })} />
  }
  return <LiteralEditor datatype={property.datatype ?? ''} text={value.text} id={id} invalid={invalid} onChange={text => onChange({ ...value, text })} />
}

/** Calendar and clock editors for OWL-Time nodes and the XSD date/time datatypes, as dash:editor rdm:TimeEditor or by score. */
export const timeWidget: Widget = { id: TIME_EDITOR, score, Editor }

export default timeWidget
