<script setup lang="ts">
import type { Booking } from '../../types/api'
import { statusLabel } from '../bookings/bookingHelpers'

const open = defineModel<boolean>('open', { required: true })

const props = defineProps<{
  bookingId: number | null
}>()

const { t } = useI18n()
const { request } = useApi()
const { format } = useDates()

const booking = ref<Booking | null>(null)
const failed = ref(false)

watch([open, () => props.bookingId], async ([isOpen, id]) => {
  if (!isOpen || id === null) {
    return
  }

  failed.value = false
  booking.value = null

  try {
    booking.value = await request(`/api/rms/bookings/${id}`) as Booking
  } catch {
    failed.value = true
  }
})
</script>

<template>
  <USlideover v-model:open="open">
    <template #header>
      <h2>{{ booking?.reference ?? t('calendar.booking') }}</h2>
    </template>
    <template #body>
      <p
        v-if="failed"
        class="field-error"
      >
        {{ t('calendar.bookingMissing') }}
      </p>
      <div
        v-else-if="booking"
        class="stack"
      >
        <p>
          <span class="pill">{{ statusLabel(booking.status) }}</span>
        </p>
        <p>{{ booking.contact.name }}</p>
        <p>{{ booking.party_label }}</p>
        <p>{{ booking.cabin_label }}</p>
        <p>{{ format(booking.departure.date, 'short') }}</p>
        <p>
          <AnkMoney :amount="booking.total" />
        </p>
        <p class="notice">
          {{ t('calendar.bookingReadOnly') }}
        </p>
      </div>
    </template>
  </USlideover>
</template>
