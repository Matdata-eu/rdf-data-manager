import { createContext, useContext } from 'react'
import type { Repository, ShapesModel } from '@rdf-data-manager/core'
import type { WidgetRegistry } from './widgets/registry'

/** What forms and widgets need from the application that hosts them. */
export interface FormServices {
  repo: Repository
  model: ShapesModel
  /** Languages to try, in order, when picking a label. */
  languages: string[]
  /** Bumped after every write, so option lists reload. */
  revision: number
  registry: WidgetRegistry
  /** Link to a resource's own page, when the host app has one. */
  resourceHref?: (classIri: string, iri: string) => string
}

export const FormContext = createContext<FormServices | null>(null)

export function useForm (): FormServices {
  const ctx = useContext(FormContext)
  if (!ctx) throw new Error('useForm must be used inside a FormContext provider')
  return ctx
}
