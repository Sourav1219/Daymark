"use client"

import { useTransition } from "react"
import { LogOut } from "lucide-react"

import { Button } from "@/components/ui/button"
import { logoutAction } from "@/features/authentication/application/actions"
import { clearPrivateOfflineData } from "@/features/offline/storage/offline-database"

export function OfflineLogoutButton() {
  const [pending, startTransition] = useTransition()

  return (
    <form
      action={() => {
        startTransition(async () => {
          await clearPrivateOfflineData()
          await logoutAction()
        })
      }}
    >
      <Button
        className="w-full justify-start"
        disabled={pending}
        type="submit"
        variant="ghost"
      >
        <LogOut aria-hidden="true" />
        {pending ? "Clearing local data" : "Log out"}
      </Button>
    </form>
  )
}
