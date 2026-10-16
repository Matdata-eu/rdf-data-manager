import { createContext, useContext } from 'react'
import type { AppConfig } from '../config/config'
import type { Repository } from '../data/repository'
import type { ShapesModel } from '../shapes/model'
import type { ShapesValidator } from '../validation/validate'

export interface AppServices {
  config: AppConfig
  repo: Repository
  model: ShapesModel
  validator: ShapesValidator
  /** Languages to try, in order, when picking a label. */
  languages: string[]
  /** Bumped after every write so lists and counts reload. */
  revision: number
  notifyChanged: () => void
}

export const AppContext = createContext<AppServices | null>(null)

export function useApp (): AppServices {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used inside AppContext')
  return ctx
}
