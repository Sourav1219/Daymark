"use client"

import { useActionState, useEffect, useRef } from "react"
import { toast } from "sonner"

import { MutationSubmitButton } from "@/components/system/mutation-submit-button"
import {
  editGateAction,
  type GateActionState,
} from "@/features/gates/application/actions"
import { GateFormFields } from "@/features/gates/components/gate-form-fields"
import type { GateView } from "@/features/gates/domain/types"

const initialState: GateActionState = null

export function GateEditForm({ gate }: Readonly<{ gate: GateView }>) {
  const [state, formAction] = useActionState(editGateAction, initialState)
  const detailsRef = useRef<HTMLDetailsElement>(null)

  useEffect(() => {
    if (state?.ok) {
      if (detailsRef.current) {
        detailsRef.current.open = false
      }
      toast.success("List details updated")
    }
  }, [state])

  return (
    <details className="group/edit" ref={detailsRef}>
      <summary className="motion-interactive w-fit cursor-pointer rounded-control px-2 py-1 text-sm font-medium text-system-blue hover:text-spectral-cyan focus-visible:outline-none">
        Edit List
      </summary>
      <form
        action={formAction}
        className="mt-4 grid gap-5 rounded-panel border border-border-soft bg-surface-inset p-4"
      >
        <input name="gateId" type="hidden" value={gate.id} />
        <input name="expectedVersion" type="hidden" value={gate.version} />
        <GateFormFields
          defaults={gate}
          fieldErrors={state && !state.ok ? state.error.fieldErrors : undefined}
          idPrefix={`edit-gate-${gate.id}`}
        />
        {state && !state.ok ? (
          <p aria-live="polite" className="text-sm text-danger" role="alert">
            {state.error.message}
          </p>
        ) : null}
        <div className="flex justify-end">
          <MutationSubmitButton
            idleLabel="Save changes"
            pendingLabel="Saving changes"
          />
        </div>
      </form>
    </details>
  )
}
