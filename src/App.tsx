import { Tabs } from '@/components/ui/Tabs'
import { SplitPane } from '@/components/layout/SplitPane'
import { Dock } from '@/components/layout/Dock'
import { TopBar } from '@/components/layout/TopBar'
import { PeriodBar } from '@/components/layout/PeriodBar'
import { TasksPanel } from '@/components/panels/tasks/TasksPanel'
import { DailyView } from '@/components/views/DailyView'
import { WeeklyView } from '@/components/views/WeeklyView'
import { MonthlyView } from '@/components/views/MonthlyView'
import { DashboardProvider } from '@/store/DashboardProvider'
import { useDashboard } from '@/store/useDashboard'
import { useNow } from '@/hooks/useNow'
import { useTaskBadge } from '@/hooks/useTaskBadge'
import { overdueCount } from '@/lib/tasks'
import type { Period } from '@/data/types'

function Dashboard() {
  const { state, actions } = useDashboard()
  const now = useNow()

  useTaskBadge(overdueCount(state.data.tasks, now))

  return (
    <div className="mx-auto flex max-w-[1700px] flex-col gap-5 px-4 pt-[calc(1.5rem+env(safe-area-inset-top))] pb-[calc(7rem+env(safe-area-inset-bottom))] lg:px-8">
      <TopBar />

      <Tabs.Root
        value={state.period}
        onValueChange={(period) => actions.setPeriod(period as Period)}
        className="flex flex-col gap-4"
      >
        <PeriodBar />

        <SplitPane
          primary={
            <>
              <Tabs.Panel value="daily">
                <DailyView />
              </Tabs.Panel>
              <Tabs.Panel value="weekly">
                <WeeklyView />
              </Tabs.Panel>
              <Tabs.Panel value="monthly">
                <MonthlyView />
              </Tabs.Panel>
            </>
          }
          secondary={<TasksPanel />}
          defaultRatio={0.68}
        />
      </Tabs.Root>

      <Dock />
    </div>
  )
}

export default function App() {
  return (
    <DashboardProvider>
      <Dashboard />
    </DashboardProvider>
  )
}
