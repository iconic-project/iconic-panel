<script setup lang="ts">
import type { Booking, Group, Paginated } from '../../types/api'
import { statusLabel, statusPillClass } from './bookingHelpers'

const open = defineModel<boolean>('open', { required: true })

const props = defineProps<{
  group: Group | null
}>()

const emit = defineEmits<{
  openBooking: [booking: Booking]
}>()

const { t } = useI18n()
const { request } = useApi()
const { format: money } = useMoney()

const bookings = ref<Array<Booking>>([])
const loading = ref(false)

watch(
  () => [open.value, props.group?.id] as const,
  async ([isOpen, groupId]) => {
    if (!isOpen || groupId === undefined) {
      return
    }

    loading.value = true

    try {
      const result = await request(`/api/rms/bookings?group_id=${groupId}&per_page=100`) as Paginated<Booking>
      bookings.value = result.data
    } finally {
      loading.value = false
    }
  }
)

function openBooking(booking: Booking): void {
  emit('openBooking', booking)
  open.value = false
}
</script>

<template>
  <USlideover
    :open="open"
    class="history-drawer"
    @update:open="open = $event"
  >
    <template #header>
      <div>
        <h2>{{ group?.name }}</h2>
        <div
          v-if="group"
          class="bid"
        >
          {{ group.reference }} · {{ group.property?.name ?? '' }}
        </div>
      </div>
    </template>

    <template #body>
      <template v-if="group">
        <div class="kv">
          <span>{{ t('bookings.colCoordinator') }}</span>
          <span>{{ group.coordinator.name }}</span>
        </div>
        <div class="kv">
          <span>{{ t('blocks.property') }}</span>
          <span>{{ group.property?.name ?? '' }}</span>
        </div>
        <div class="kv">
          <span>{{ t('blocks.rooms') }}</span>
          <span>{{ group.rooms.join(', ') }}</span>
        </div>

        <div class="sec">
          <h4>{{ t('blocks.rooms') }}</h4>
          <table class="list mini-t">
            <thead>
              <tr>
                <th>{{ t('bookings.colBooking') }}</th>
                <th>{{ t('bookings.colRoom') }}</th>
                <th>{{ t('bookings.colClient') }}</th>
                <th>{{ t('bookings.colTotal') }}</th>
                <th>{{ t('bookings.colBalance') }}</th>
                <th>{{ t('bookings.colStatus') }}</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-if="!loading && bookings.length === 0"
                class="dr-empty"
              >
                <td colspan="6">
                  {{ t('bookings.empty') }}
                </td>
              </tr>
              <tr
                v-for="row in bookings"
                :key="row.id"
                class="bk-row"
                @click="openBooking(row)"
              >
                <td class="bk-ref">
                  {{ row.display_reference }}
                </td>
                <td>{{ row.room?.label ?? '' }}</td>
                <td>{{ row.contact.name }}</td>
                <td>{{ money(row.total) }}</td>
                <td>{{ money(row.balance) }}</td>
                <td>
                  <span
                    class="pill"
                    :class="statusPillClass(row.status)"
                  >{{ statusLabel(row.status) }}</span>
                </td>
              </tr>
              <tr v-if="bookings.length > 0">
                <td
                  colspan="3"
                  class="bk-sub"
                >
                  {{ t('bookings.groupTotal') }}
                </td>
                <td><b>{{ money(group.total) }}</b></td>
                <td><b>{{ money(group.balance) }}</b></td>
                <td />
              </tr>
            </tbody>
          </table>
          <p class="note">
            {{ t('bookings.groupNote') }}
          </p>
        </div>
      </template>
    </template>
  </USlideover>
</template>
