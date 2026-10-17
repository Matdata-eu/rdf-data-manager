import { labelOf } from '@rdf-data-manager/core'
import { useAsync } from '@rdf-data-manager/react'
import { useApp } from './context'
import { href } from './router'
import { t } from './i18n'

export function Sidebar ({ active, tool }: { active?: string; tool?: 'validation' | 'import' }) {
  const { model, repo, languages, revision } = useApp()
  const counts = useAsync(() => repo.countInstances(model.classes.map(c => c.iri)), [repo, model, revision])

  return (
    <nav className='sidebar' aria-label={t('Classes')}>
      <ul>
        {model.classes.map(c => (
          <li key={c.iri}>
            <a href={href({ name: 'class', classIri: c.iri })} className={active === c.iri ? 'active' : undefined} title={c.iri}>
              <span>{labelOf(c.label, c.iri, languages)}</span>
              {counts.status === 'ready' && <span className='count'>{counts.value.get(c.iri) ?? 0}</span>}
            </a>
          </li>
        ))}
      </ul>
      {model.classes.length === 0 && <p className='muted small'>{t('The shapes define no classes with an rdfs:label.')}</p>}
      <h2 className='sidebar-heading'>{t('Tools')}</h2>
      <ul>
        <li><a href={href({ name: 'validation' })} className={tool === 'validation' ? 'active' : undefined}>{t('Check all data')}</a></li>
        <li><a href={href({ name: 'import' })} className={tool === 'import' ? 'active' : undefined}>{t('Import')}</a></li>
      </ul>
    </nav>
  )
}
