import { firstText, localName, text, withText, type NodeState, type PropertyShape } from '@rdf-data-manager/core'
import { useForm, useT } from '../context'
import type { Widget, WidgetEditorProps, WidgetViewerProps } from './types'

export const SCOPED_TAG_EDITOR = 'https://matdata.eu/ns/rdf-data-manager#ScopedTagEditor'
export const SCOPED_TAG_VIEWER = 'https://matdata.eu/ns/rdf-data-manager#ScopedTagViewer'

/**
 * The scope and the entry of a nested node: the first two visible properties of its shape,
 * in sh:order. A railML designator is "register | entry", a type designator "rulebook | entry".
 */
function parts (node: NodeState): [PropertyShape, PropertyShape] | undefined {
  const [scope, entry] = node.shape.properties.filter(p => !p.hidden)
  return scope && entry ? [scope, entry] : undefined
}

function Editor ({ property, value, onChange, id, invalid }: WidgetEditorProps) {
  const { languages } = useForm()
  const t = useT()
  const node = value.node
  const found = node && parts(node)
  if (!node || !found) return <span className='muted'>{t('A scoped tag needs a nested shape with two properties.')}</span>
  const input = (p: PropertyShape, inputId: string) => {
    const label = text(p.name, languages) || localName(p.path.value)
    return (
      <input
        id={inputId} aria-label={label} placeholder={label} aria-invalid={invalid}
        value={firstText(node, p.path.value)}
        onChange={e => onChange({ ...value, node: withText(node, p.path.value, e.target.value) })}
      />
    )
  }
  return (
    <span className={`scoped-tag editing${invalid ? ' invalid' : ''}`} role='group' aria-label={text(property.name, languages) || localName(property.path.value)}>
      {input(found[0], id)}
      {input(found[1], `${id}-entry`)}
    </span>
  )
}

function Viewer ({ value }: WidgetViewerProps) {
  const { languages } = useForm()
  const node = value.node
  const found = node && parts(node)
  if (!node || !found) return <span className='value'>{value.text}</span>
  const [scope, entry] = found.map(p => firstText(node, p.path.value))
  const [scopeLabel, entryLabel] = found.map(p => text(p.name, languages) || localName(p.path.value))
  return (
    <span className='scoped-tag' title={`${scopeLabel}: ${scope}\n${entryLabel}: ${entry}`}>
      <span className='scoped-tag-scope'>{scope}</span>
      <span className='scoped-tag-entry'>{entry}</span>
    </span>
  )
}

/**
 * A nested node read as one scoped identifier, "register | entry": a quiet two-part tag,
 * scope on a sunken plate, entry beside it. Chosen only by naming it in the shapes
 * (dash:editor rdm:ScopedTagEditor, dash:viewer rdm:ScopedTagViewer).
 */
export const scopedTagWidgets: Widget[] = [
  { id: SCOPED_TAG_EDITOR, score: () => 0, inline: true, Editor, Viewer },
  { id: SCOPED_TAG_VIEWER, score: () => 0, Viewer }
]
