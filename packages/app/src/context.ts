import { createContext, useContext } from 'react'
import type { Repository, ShapesModel, ShapesValidator } from '@rdf-data-manager/core'
import type { FormServices } from '@rdf-data-manager/react'
import type { AppConfig } from './config'

/** The form services plus what only the app shell needs. */
export interface AppServices extends FormServices {
  config: AppConfig
  repo: Repository
  model: ShapesModel
  validator: ShapesValidator
  notifyChanged: () => void
}

export const AppContext = createContext<AppServices | null>(null)

export function useApp (): AppServices {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used inside AppContext')
  return ctx
}
