import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { gateAccentLabels } from "@/features/gates/components/gate-accent-styles"
import {
  gateAccentTokens,
  type GateAccentToken,
} from "@/features/gates/domain/types"

type GateFormFieldsProps = Readonly<{
  defaults?: Readonly<{
    accentToken: GateAccentToken
    description: string
    name: string
  }>
  fieldErrors?: Readonly<Record<string, readonly string[]>> | undefined
  idPrefix: string
}>

function FieldError({
  errors,
  id,
}: Readonly<{ errors?: readonly string[] | undefined; id: string }>) {
  const error = errors?.[0]

  return error ? (
    <p className="text-xs leading-5 text-danger" id={id}>
      {error}
    </p>
  ) : null
}

export function GateFormFields({
  defaults,
  fieldErrors,
  idPrefix,
}: GateFormFieldsProps) {
  const nameErrorId = `${idPrefix}-name-error`
  const descriptionErrorId = `${idPrefix}-description-error`
  const accentErrorId = `${idPrefix}-accent-error`

  return (
    <div className="grid gap-4">
      <div className="grid gap-4">
        <div className="grid gap-2">
          <Label htmlFor={`${idPrefix}-name`}>List name</Label>
          <Input
            aria-describedby={fieldErrors?.name ? nameErrorId : undefined}
            aria-invalid={Boolean(fieldErrors?.name)}
            autoComplete="off"
            defaultValue={defaults?.name}
            id={`${idPrefix}-name`}
            maxLength={120}
            name="name"
            placeholder="Name this list"
            required
          />
          <FieldError errors={fieldErrors?.name} id={nameErrorId} />
        </div>

        <div className="grid gap-2">
          <Label htmlFor={`${idPrefix}-accent`}>Accent</Label>
          <select
            aria-describedby={
              fieldErrors?.accentToken ? accentErrorId : undefined
            }
            aria-invalid={Boolean(fieldErrors?.accentToken)}
            className="h-8 w-full rounded-control border border-input bg-surface-inset px-2.5 text-sm text-ink outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            defaultValue={defaults?.accentToken ?? "system-blue"}
            id={`${idPrefix}-accent`}
            name="accentToken"
          >
            {gateAccentTokens.map((token) => (
              <option key={token} value={token}>
                {gateAccentLabels[token]}
              </option>
            ))}
          </select>
          <FieldError errors={fieldErrors?.accentToken} id={accentErrorId} />
        </div>
      </div>

      <div className="grid gap-2">
        <Label htmlFor={`${idPrefix}-description`}>Description</Label>
        <textarea
          aria-describedby={
            fieldErrors?.description ? descriptionErrorId : undefined
          }
          aria-invalid={Boolean(fieldErrors?.description)}
          className="min-h-20 w-full resize-y rounded-control border border-input bg-surface-inset px-3 py-2 text-sm leading-6 text-ink outline-none placeholder:text-ink-muted focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          defaultValue={defaults?.description}
          id={`${idPrefix}-description`}
          name="description"
          placeholder="What belongs inside this list?"
        />
        <FieldError errors={fieldErrors?.description} id={descriptionErrorId} />
      </div>
    </div>
  )
}
