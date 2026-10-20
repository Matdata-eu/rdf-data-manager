import { useMemo, useState } from 'react'
import { localName, shapeIdsForClass, shapeSource } from '@rdf-data-manager/core'
import { useApp } from './context'
import { download, fileSlug } from './download'
import { n, t } from './i18n'

/** The SHACL shapes behind this page's form, as Turtle, written out only once opened. */
export function ShapeSource ({ classIri }: { classIri: string }) {
  const { model } = useApp()
  const [open, setOpen] = useState(false)
  const count = useMemo(() => shapeIdsForClass(model, classIri).length, [model, classIri])
  const turtle = useMemo(() => open ? shapeSource(model, classIri) : '', [open, model, classIri])
  if (count === 0) return null
  return (
    <details className='shape-source' open={open} onToggle={e => setOpen((e.target as HTMLDetailsElement).open)}>
      <summary>{n(count, 'SHACL shape (1 shape)', 'SHACL shape ({n} shapes)')}</summary>
      <p className='muted small'>
        {t('The shapes that build this form and check the data: those targeting the class and the shapes they refer to.')}{' '}
        <button type='button' className='button ghost small' onClick={() => download(`${fileSlug(localName(classIri))}-shape.ttl`, turtle, 'text/turtle')}>
          {t('Download')}
        </button>
      </p>
      {open && <pre>{turtle}</pre>}
    </details>
  )
}
