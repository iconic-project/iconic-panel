<script setup lang="ts">
import type { Booking } from '../../types/api'
import BookingPanel from '../bookings/BookingPanel.vue'

const open = defineModel<boolean>('open', { required: true })

const props = defineProps<{
  bookingId: number | null
}>()

const { t } = useI18n()
const { request } = useApi()

const booking = ref<Booking | null>(null)
const failed = ref(false)

watch([open, () => props.bookingId], async ([isOpen, id]) => {
  if (!isOpen || id === null) {
    return
  }

  failed.value = false

  try {
    booking.value = await request(`/api/rms/bookings/${id}`) as Booking
  } catch {
    failed.value = true
    booking.value = null
  }
})

function onUpdated(next: Booking): void {
  booking.value = next
}
</script>

<template>
  <p
    v-if="failed"
    class="field-error"
  >
    {{ t('calendar.bookingMissing') }}
  </p>
  <BookingPanel
    v-model:open="open"
    :booking="booking"
    @updated="onUpdated"
  />
</template>
