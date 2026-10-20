import { useState } from 'react'
import {
  editorFor, isLangEditor, localName, newId, newNestedValue, text, viewerFor,
  type Issue, type Literal, type NodeState, type PropertyShape, type ValueState
} from '@rdf-data-manager/core'
import { useForm, useT } from './context'
import { QueryPreview } from './QueryPreview'

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

/**
 * Issues on the nodes nested inside a node, for a widget that edits that node as a whole
 * and so has no fields to show them on. Each message is prefixed with the field it is about.
 */
function nestedIssues (node: NodeState, issues: Issue[], subjects: Map<string, string>, languages: string[], trail: string[] = []): Issue[] {
  const subject = subjectOf(node, subjects)
  const out: Issue[] = []
  for (const i of issues) {
    if (i.focusNode !== subject) continue
    const p = node.shape.properties.find(p => p.path.value === i.path)
    const where = [...trail, ...(p ? [text(p.name, languages) || localName(p.path.value)] : [])]
    out.push(where.length ? { ...i, message: `${where.join(' › ')}: ${i.message}` } : i)
  }
  for (const p of node.shape.properties) {
    for (const v of node.values[p.path.value] ?? []) {
      if (v.node) out.push(...nestedIssues(v.node, issues, subjects, languages, [...trail, text(p.name, languages) || localName(p.path.value)]))
    }
  }
  return out
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
  const t = useT()
  const path = property.path.value
  const values = node.values[path] ?? []
  const kind = editorFor(property)
  const Editor = kind === 'details' ? undefined : registry.pickEditor(property)?.Editor
  // A widget can claim a nested node too (a map for a geometry); the built-ins never do.
  const nodeWidget = kind === 'details' ? registry.pickEditor(property) : undefined
  const NodeEditor = nodeWidget?.Editor
  const readOnly = node.readOnly || property.readOnly
  const NodeViewer = kind === 'details' && readOnly ? registry.pickViewer(property)?.Viewer : undefined
  // Nested nodes a widget shows on one line, like literal values (a scoped tag).
  const inline = readOnly ? NodeViewer !== undefined : nodeWidget?.inline === true && NodeEditor !== undefined
  const label = text(property.name, languages) || localName(path)
  const description = text(property.description, languages)
  const id = `f-${node.id}-${property.key}`
  const subject = subjectOf(node, subjects)
  const own = [
    ...issues.filter(i => i.focusNode === subject && i.path === path),
    // A widget that edits a nested node as a whole shows no fields of its own for these.
    ...(NodeEditor !== undefined && !readOnly ? values.flatMap(v => v.node ? nestedIssues(v.node, issues, subjects, languages) : []) : [])
  ]
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
        <label htmlFor={expanded && values[0] && (!values[0].node || (inline && !readOnly)) ? `${id}-${values[0].id}` : undefined}>
          {label}{required && !readOnly && <span className='required' title={t('Required')}>*</span>}
        </label>
        {(values.length > COLLAPSE_ABOVE || property.collapsed !== undefined) && values.length > 0 && (
          <button
            type='button' className='collapse-toggle' aria-expanded={expanded}
            onClick={() => setOpen(!expanded)} disabled={own.length > 0}
          >
            {expanded ? '▾' : '▸'} {values.length === 1 ? t('1 value') : t('{n} values', { n: values.length })}
          </button>
        )}
        {description && <span className='hint'>{description}</span>}
      </div>
      <div className='field-values'>
        {!expanded && (
          <button type='button' className='button ghost small collapsed-summary' onClick={() => setOpen(true)}>
            {values.length === 1 ? t('Show') : t('Show {n} {label}', { n: values.length, label: label.toLowerCase() })}
          </button>
        )}
        {visible.map(v => v.node && !inline
          ? (
              <div key={v.id} className='nested'>
                <div className='nested-header'>
                  <span className='mono small'>{(v.node.subject && v.node.subject.termType === 'NamedNode' ? localName(v.node.subject.value) : subjects.get(v.node.id) ? localName(subjects.get(v.node.id)!) : t('new'))}</span>
                  {!readOnly && <button type='button' className='button ghost small' onClick={() => remove(v)}>{t('Remove')}</button>}
                </div>
                {NodeEditor !== undefined && !readOnly
                  ? <NodeEditor property={property} value={v} onChange={replace} id={`${id}-${v.id}`} invalid={own.some(i => i.severity === 'Violation')} />
                  : <NodeForm node={v.node} onChange={n => replace({ ...v, node: n })} issues={issues} subjects={subjects} depth={depth + 1} />}
              </div>
            )
          : (
              <div key={v.id} className='value-row'>
                {readOnly
                  ? v.node && NodeViewer !== undefined ? <NodeViewer property={property} value={v} /> : <ValueView property={property} value={v} />
                  : (
                      <>
                        {v.node && NodeEditor !== undefined
                          ? <NodeEditor property={property} value={v} onChange={replace} id={`${id}-${v.id}`} invalid={own.some(i => i.severity === 'Violation')} />
                          : Editor !== undefined
                            ? <Editor property={property} value={v} onChange={replace} id={`${id}-${v.id}`} invalid={own.some(i => i.severity === 'Violation')} />
                            : <input id={`${id}-${v.id}`} aria-invalid={own.some(i => i.severity === 'Violation')} value={v.text} onChange={e => replace({ ...v, text: e.target.value })} />}
                        <button type='button' className='icon-button' title={t('Remove value')} aria-label={t('Remove {label} value', { label })} onClick={() => remove(v)}>×</button>
                      </>
                    )}
                {property.queryText && <QueryPreview property={property} value={v} />}
              </div>
            ))}
        {expanded && values.length > shown && (
          <button type='button' className='button ghost small show-more' onClick={() => setShown(values.length)}>
            {t('Show all ({n} more)', { n: values.length - shown })}
          </button>
        )}
        {canAdd && (expanded || values.length === 0) && (
          <button type='button' className='button ghost small add' onClick={add}>
            {kind === 'details' ? t('+ Add {label}', { label: label.toLowerCase() }) : t('+ Add value')}
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
