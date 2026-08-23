"use client"

import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from "react"
import { useRouter } from "next/navigation"

import {
  TaskCompletedPopup,
  type CompletedTaskNotice,
} from "@/features/quests/components/task-completed-popup"
import {
  StreakCelebrationPopup,
  type StreakCelebrationNotice,
} from "@/features/progression/components/streak-celebration-popup"

type ShowTaskCompletion = (task: CompletedTaskNotice) => void
type ShowStreakCelebration = (count: number) => void

const TaskCompletionCelebrationContext = createContext<ShowTaskCompletion>(
  () => undefined,
)
const StreakCelebrationContext = createContext<ShowStreakCelebration>(
  () => undefined,
)

export function TaskCompletionCelebrationProvider({
  children,
}: Readonly<{ children: ReactNode }>) {
  const router = useRouter()
  const [completedTask, setCompletedTask] =
    useState<CompletedTaskNotice | null>(null)
  const [streakNotice, setStreakNotice] =
    useState<StreakCelebrationNotice | null>(null)
  const showCompletion = useCallback<ShowTaskCompletion>((task) => {
    if (task.streakIncreased && task.currentStreak !== undefined) {
      setCompletedTask(null)
      setStreakNotice({ count: task.currentStreak, task })
      return
    }

    setStreakNotice(null)
    setCompletedTask(task)
  }, [])
  const showStreak = useCallback<ShowStreakCelebration>((count) => {
    setCompletedTask(null)
    setStreakNotice({ count })
  }, [])
  const dismissCompletion = useCallback(() => {
    setCompletedTask(null)
    setStreakNotice(null)
    router.refresh()
  }, [router])

  return (
    <TaskCompletionCelebrationContext.Provider value={showCompletion}>
      <StreakCelebrationContext.Provider value={showStreak}>
        {children}
        {streakNotice ? (
          <StreakCelebrationPopup
            key={`${streakNotice.count}:${streakNotice.task?.id ?? "manual"}`}
            notice={streakNotice}
            onDismiss={dismissCompletion}
          />
        ) : completedTask ? (
          <TaskCompletedPopup
            key={`${completedTask.id}:${completedTask.version}`}
            onDismiss={dismissCompletion}
            task={completedTask}
          />
        ) : null}
      </StreakCelebrationContext.Provider>
    </TaskCompletionCelebrationContext.Provider>
  )
}

export function useTaskCompletionCelebration() {
  return useContext(TaskCompletionCelebrationContext)
}

export function useStreakCelebration() {
  return useContext(StreakCelebrationContext)
}
