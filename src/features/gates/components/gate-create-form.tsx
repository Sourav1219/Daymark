"use client"

import { useActionState, useEffect } from "react"
import { PanelsTopLeft } from "lucide-react"
import { toast } from "sonner"

import { MutationSubmitButton } from "@/components/system/mutation-submit-button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  createGateAction,
  type GateActionState,
} from "@/features/gates/application/actions"
import { GateFormFields } from "@/features/gates/components/gate-form-fields"

const initialState: GateActionState = null

export function GateCreateForm() {
  const [state, formAction] = useActionState(createGateAction, initialState)

  useEffect(() => {
    if (state?.ok) {
      toast.success("List created")
    }
  }, [state])

  return (
    <Card className="border-border-soft bg-card/75 shadow-panel">
      <CardHeader>
        <div className="flex items-center gap-3">
          <span className="grid size-9 place-items-center rounded-control bg-system-blue/10 text-spectral-cyan">
            <PanelsTopLeft aria-hidden="true" />
          </span>
          <div>
            <CardTitle>Create List</CardTitle>
            <CardDescription>
              Group related tasks into a named, shareable view.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <form
          action={formAction}
          className="grid gap-5"
          key={state?.ok ? state.data.id : "create-gate"}
        >
          <GateFormFields
            fieldErrors={
              state && !state.ok ? state.error.fieldErrors : undefined
            }
            idPrefix="create-gate"
          />
          {state && !state.ok ? (
            <p aria-live="polite" className="text-sm text-danger" role="alert">
              {state.error.message}
            </p>
          ) : null}
          <div className="flex justify-end">
            <MutationSubmitButton
              idleLabel="Create List"
              pendingLabel="Creating List"
            />
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
