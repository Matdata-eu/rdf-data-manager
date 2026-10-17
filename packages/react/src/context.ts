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
  /** Translates a UI message (keys are the English text, placeholders {name}); English when absent. */
  t?: (key: string, params?: Record<string, string | number>) => string
}

export function formatMessage (message: string, params?: Record<string, string | number>): string {
  if (!params) return message
  return message.replace(/\{(\w+)\}/g, (m, name: string) => name in params ? String(params[name]) : m)
}

/** The host's translator, or English with placeholders filled in. */
export function useT (): (key: string, params?: Record<string, string | number>) => string {
  const { t } = useForm()
  return t ?? formatMessage
}

export const FormContext = createContext<FormServices | null>(null)

export function useForm (): FormServices {
  const ctx = useContext(FormContext)
  if (!ctx) throw new Error('useForm must be used inside a FormContext provider')
  return ctx
}
