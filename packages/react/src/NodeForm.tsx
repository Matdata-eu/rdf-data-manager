import { useState } from 'react'
import {
  editorFor, isLangEditor, localName, newId, newNestedValue, text, viewerFor,
  type Issue, type Literal, type NodeState, type PropertyShape, type ValueState
} from '@rdf-data-manager/core'
import { useForm } from './context'

interface FormProps {
  node: NodeState
  onChange: (node: NodeState) => void
  /** Validation issues, matched to fields by focus node and path. */
  issues: Issue[]
  /** Subjects that a save would give to nodes that have none yet, keyed by node id. */
  subjects: Map<string, string>
  depth?: number
}

export function subjectOf (node: NodeState, subjects: Map<string, string>): string | undefined {
  return node.subject?.value ?? subjects.get(node.id)
}

function groupsOf (node: NodeState, groups: Map<string, { label: Record<string, string>; order: number }>) {
  const out: { id: string; label?: Record<string, string>; order: number; properties: PropertyShape[] }[] = []
  for (const p of node.shape.properties) {
    if (p.hidden) continue
    if ((node.readOnly || p.readOnly) && !(node.values[p.path.value]?.length)) continue
    const id = p.group ?? ''
    let group = out.find(g => g.id === id)
    if (!group) {
      const g = p.group ? groups.get(p.group) : undefined
      group = { id, label: g?.label, order: p.group ? g?.order ?? 999 : -1, properties: [] }
      out.push(group)
    }
    group.properties.push(p)
  }
  return out.sort((a, b) => a.order - b.order)
}

function IssueList ({ issues }: { issues: Issue[] }) {
  if (!issues.length) return null
  return (
    <ul className='issues'>
      {issues.map((i, n) => <li key={n} className={i.severity.toLowerCase()}>{i.message}</li>)}
    </ul>
  )
}

/** Read-only rendering of a value; a widget's Viewer, when one fits, takes over. */
export function ValueView ({ property, value }: { property: PropertyShape; value: ValueState }) {
  const { model, registry, resourceHref } = useForm()
  const Viewer = registry.pickViewer(property, value.term)?.Viewer
  if (Viewer) return <Viewer property={property} value={value} />
  const term = value.term
  if (!term) return <span>{value.text}</span>
  if (term.termType === 'Literal') {
    const lang = (term as Literal).language
    return <span className='value'>{term.value}{lang && <span className='lang-tag'>{lang}</span>}</span>
  }
  const linkClass = viewerFor(property) === 'label'
    ? property.classes.find(c => model.shapeForClass(c))
    : undefined
  if (term.termType === 'NamedNode' && linkClass && resourceHref) {
    return <a href={resourceHref(linkClass, term.value)} title={term.value}>{localName(term.value)}</a>
  }
  if (term.termType === 'NamedNode' && /^https?:/.test(term.value)) {
    return <a href={term.value} target='_blank' rel='noreferrer'>{term.value}</a>
  }
  return <span className='value mono'>{term.value}</span>
}

/** Fields with more values than this start collapsed unless the shape says otherwise. */
const COLLAPSE_ABOVE = 5
const DEFAULT_PAGE_SIZE = 10

function Field ({ property, node, onChange, issues, subjects, depth }: {
  property: PropertyShape
  node: NodeState
  onChange: (node: NodeState) => void
  issues: Issue[]
  subjects: Map<string, string>
  depth: number
}) {
  const { model, languages, registry } = useForm()
  const path = property.path.value
  const values = node.values[path] ?? []
  const kind = editorFor(property)
  const Editor = kind === 'details' ? undefined : registry.pickEditor(property)?.Editor
  const readOnly = node.readOnly || property.readOnly
  const label = text(property.name, languages) || localName(path)
  const description = text(property.description, languages)
  const id = `f-${node.id}-${property.key}`
  const subject = subjectOf(node, subjects)
  const own = issues.filter(i => i.focusNode === subject && i.path === path)
  const required = (property.minCount ?? 0) > 0
  const canAdd = !readOnly && (property.maxCount === undefined || values.length < property.maxCount)
  const pageSize = property.pageSize ?? DEFAULT_PAGE_SIZE
  const [open, setOpen] = useState(() => !(property.collapsed ?? values.length > COLLAPSE_ABOVE))
  const [shown, setShown] = useState(pageSize)
  // Problems on a field must never hide behind a collapsed header.
  const expanded = open || own.length > 0
  const visible = expanded ? values.slice(0, shown) : []

  const setValues = (next: ValueState[]) => onChange({ ...node, values: { ...node.values, [path]: next } })
  const replace = (v: ValueState) => setValues(values.map(x => x.id === v.id ? v : x))
  const remove = (v: ValueState) => setValues(values.filter(x => x.id !== v.id))
  const add = () => {
    setOpen(true)
    setShown(n => Math.max(n, values.length + 1))
    if (kind === 'details') {
      const nested = newNestedValue(property, model)
      if (nested) setValues([...values, nested])
      return
    }
    const used = new Set(values.map(v => v.lang))
    const lang = isLangEditor(kind) ? (property.languages ?? property.languageIn ?? []).find(l => !used.has(l)) : undefined
    setValues([...values, { id: newId(), text: '', lang }])
  }

  if (readOnly && values.length === 0) return null

  return (
    <div className={`field${own.some(i => i.severity === 'Violation') ? ' has-error' : ''}`}>
      <div className='field-label'>
        <label htmlFor={expanded && values[0] && !values[0].node ? `${id}-${values[0].id}` : undefined}>
          {label}{required && !readOnly && <span className='required' title='Required'>*</span>}
        </label>
        {(values.length > COLLAPSE_ABOVE || property.collapsed !== undefined) && values.length > 0 && (
          <button
            type='button' className='collapse-toggle' aria-expanded={expanded}
            onClick={() => setOpen(!expanded)} disabled={own.length > 0}
          >
            {expanded ? '▾' : '▸'} {values.length} {values.length === 1 ? 'value' : 'values'}
          </button>
        )}
        {description && <span className='hint'>{description}</span>}
      </div>
      <div className='field-values'>
        {!expanded && (
          <button type='button' className='button ghost small collapsed-summary' onClick={() => setOpen(true)}>
            {values.length === 1 ? 'Show' : `Show ${values.length} ${label.toLowerCase()}`}
          </button>
        )}
        {visible.map(v => v.node
          ? (
              <div key={v.id} className='nested'>
                <div className='nested-header'>
                  <span className='mono small'>{(v.node.subject && v.node.subject.termType === 'NamedNode' ? localName(v.node.subject.value) : subjects.get(v.node.id) ? localName(subjects.get(v.node.id)!) : 'new')}</span>
                  {!readOnly && <button type='button' className='button ghost small' onClick={() => remove(v)}>Remove</button>}
                </div>
                <NodeForm node={v.node} onChange={n => replace({ ...v, node: n })} issues={issues} subjects={subjects} depth={depth + 1} />
              </div>
            )
          : (
              <div key={v.id} className='value-row'>
                {readOnly
                  ? <ValueView property={property} value={v} />
                  : (
                      <>
                        {Editor !== undefined
                          ? <Editor property={property} value={v} onChange={replace} id={`${id}-${v.id}`} invalid={own.some(i => i.severity === 'Violation')} />
                          : <input id={`${id}-${v.id}`} aria-invalid={own.some(i => i.severity === 'Violation')} value={v.text} onChange={e => replace({ ...v, text: e.target.value })} />}
                        <button type='button' className='icon-button' title='Remove value' aria-label={`Remove ${label} value`} onClick={() => remove(v)}>×</button>
                      </>
                    )}
              </div>
            ))}
        {expanded && values.length > shown && (
          <button type='button' className='button ghost small show-more' onClick={() => setShown(values.length)}>
            Show all ({values.length - shown} more)
          </button>
        )}
        {canAdd && (expanded || values.length === 0) && (
          <button type='button' className='button ghost small add' onClick={add}>
            + Add {kind === 'details' ? label.toLowerCase() : 'value'}
          </button>
        )}
        <IssueList issues={own} />
      </div>
    </div>
  )
}

export function NodeForm ({ node, onChange, issues, subjects, depth = 1 }: FormProps) {
  const { model, languages } = useForm()
  const subject = subjectOf(node, subjects)
  const paths = new Set(node.shape.properties.map(p => p.path.value))
  const nodeIssues = issues.filter(i => i.focusNode === subject && (!i.path || !paths.has(i.path)))
  const groups = groupsOf(node, model.groups)
  return (
    <div className={`node-form depth-${depth}`}>
      <IssueList issues={nodeIssues} />
      {groups.map(g => {
        const fields = g.properties.map(p => (
          <Field key={p.key} property={p} node={node} onChange={onChange} issues={issues} subjects={subjects} depth={depth} />
        ))
        if (!g.id || depth > 1) return <div key={g.id || 'default'} className='group'>{fields}</div>
        return (
          <fieldset key={g.id} className='group'>
            <legend>{text(g.label ?? {}, languages) || localName(g.id)}</legend>
            {fields}
          </fieldset>
        )
      })}
    </div>
  )
}
