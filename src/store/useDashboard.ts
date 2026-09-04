import { use } from 'react'
import { DashboardContext, type DashboardContextValue } from './context'

export function useDashboard(): DashboardContextValue {
  const value = use(DashboardContext)
  if (!value) {
    throw new Error('useDashboard must be used inside <DashboardProvider>')
  }
  return value
}
