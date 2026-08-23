import "server-only"

export type ReminderDeliveryInput = Readonly<{
  idempotencyKey: string
  recipientEmail: string
}>

export type ReminderDeliveryReceipt = Readonly<{
  providerMessageId: string
}>

export interface ReminderDeliveryProvider {
  send(input: ReminderDeliveryInput): Promise<ReminderDeliveryReceipt>
}

export class ReminderProviderError extends Error {
  constructor(readonly code: string) {
    super("Reminder delivery provider rejected the request.")
    this.name = "ReminderProviderError"
  }
}
