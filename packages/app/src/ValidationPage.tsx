import { useState } from 'react'
import { countBySeverity, labelOf, localName, validateClass, type ClassReport, type InstanceIssue } from '@rdf-data-manager/core'
import { useApp } from './context'
import { href } from './router'

type Run =
  | { status: 'idle' }
  | { status: 'running'; done: number; total: number }
  | { status: 'done'; reports: ClassReport[]; labels: Map<string, string> }
  | { status: 'error'; message: string }

/** Validates every instance of one class, or of all classes, against the shapes. */
export function ValidationPage ({ classIri }: { classIri?: string }) {
  const { model, repo, validator, languages } = useApp()
  const [run, setRun] = useState<Run>({ status: 'idle' })
  const [severity, setSeverity] = useState<'all' | 'Violation'>('all')
  const classes = classIri ? model.classes.filter(c => c.iri === classIri) : model.classes
  const className = (iri: string) => {
    const c = model.classes.find(x => x.iri === iri)
    return c ? labelOf(c.label, iri, languages) : localName(iri)
  }

  const start = async () => {
    setRun({ status: 'running', done: 0, total: classes.length })
    try {
      const reports: ClassReport[] = []
      for (const c of classes) {
        reports.push(await validateClass(repo, validator, model, c.iri))
        setRun({ status: 'running', done: reports.length, total: classes.length })
      }
      const instances = [...new Set(reports.flatMap(r => r.issues.map(i => i.instance)))]
      const found = await repo.labels(instances)
      const labels = new Map<string, string>()
      for (const iri of instances) {
        const terms = found.get(iri) ?? []
        const preferred = terms.find(t => (t as { language?: string }).language === languages[0]) ?? terms[0]
        labels.set(iri, preferred?.value ?? localName(iri))
      }
      setRun({ status: 'done', reports, labels })
    } catch (e) {
      setRun({ status: 'error', message: e instanceof Error ? e.message : String(e) })
    }
  }

  const title = classIri ? `Check ${className(classIri)}` : 'Check all data'
  return (
    <section>
      {classIri && <nav className='crumbs'><a href={href({ name: 'class', classIri })}>{className(classIri)}</a></nav>}
      <div className='page-header'>
        <div>
          <h1>{title}</h1>
          <p className='muted'>Validates what is stored against the shapes, as a save would, and lists every problem with a link to fix it.</p>
        </div>
        <div className='actions'>
          <button type='button' className='button primary' disabled={run.status === 'running'} onClick={() => void start()}>
            {run.status === 'running' ? `Checking ${run.done}/${run.total}…` : run.status === 'done' ? 'Check again' : 'Check'}
          </button>
        </div>
      </div>
      {run.status === 'error' && <div className='alert error' role='alert'>{run.message}</div>}
      {run.status === 'done' && <Results reports={run.reports} labels={run.labels} severity={severity} setSeverity={setSeverity} className={className} />}
    </section>
  )
}

function Results ({ reports, labels, severity, setSeverity, className }: {
  reports: ClassReport[]
  labels: Map<string, string>
  severity: 'all' | 'Violation'
  setSeverity: (s: 'all' | 'Violation') => void
  className: (iri: string) => string
}) {
  const all = reports.flatMap(r => r.issues.map(i => ({ ...i, classIri: r.classIri })))
  const counts = countBySeverity(all)
  const shown = severity === 'all' ? all : all.filter(i => i.severity === 'Violation')
  const instances = reports.reduce((n, r) => n + r.instances, 0)
  const byInstance = new Map<string, Array<InstanceIssue & { classIri: string }>>()
  for (const i of shown) byInstance.set(i.instance, [...(byInstance.get(i.instance) ?? []), i])
  return (
    <>
      <div className={`alert ${counts.Violation ? 'error' : 'success'}`} role='status'>
        <p>
          <strong>{instances} resource{instances === 1 ? '' : 's'} checked.</strong>{' '}
          {counts.Violation === 0 && counts.Warning === 0 && counts.Info === 0
            ? 'Everything conforms to the shapes.'
            : `${counts.Violation} problem${counts.Violation === 1 ? '' : 's'}, ${counts.Warning} warning${counts.Warning === 1 ? '' : 's'}, ${counts.Info} note${counts.Info === 1 ? '' : 's'}.`}
        </p>
        <table className='data-table summary'>
          <tbody>
            {reports.map(r => {
              const c = countBySeverity(r.issues)
              return (
                <tr key={r.classIri}>
                  <td><a href={href({ name: 'class', classIri: r.classIri })}>{className(r.classIri)}</a></td>
                  <td className='count'>{r.instances} checked</td>
                  <td className={c.Violation ? 'violation' : ''}>{c.Violation} problems</td>
                  <td className={c.Warning ? 'warning' : ''}>{c.Warning} warnings</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      {all.length > 0 && (
        <label className='row small'>
          <input type='checkbox' checked={severity === 'Violation'} onChange={e => setSeverity(e.target.checked ? 'Violation' : 'all')} />
          Problems only
        </label>
      )}
      {[...byInstance].map(([instance, issues]) => (
        <div key={instance} className='card issue-card'>
          <h2>
            <a href={href({ name: 'resource', classIri: issues[0].classIri, iri: instance })}>{labels.get(instance) ?? localName(instance)}</a>
            <span className='muted small'> {className(issues[0].classIri)}</span>
          </h2>
          <ul className='issues'>
            {issues.map((i, n) => (
              <li key={n} className={i.severity.toLowerCase()}>
                {i.path && <span className='muted'>{localName(i.path)}: </span>}{i.message}
                {i.focusNode !== instance && <span className='muted small'> (nested node)</span>}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </>
  )
}
