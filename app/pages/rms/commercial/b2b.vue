<script setup lang="ts">
import type { AgenciesKpis, Agency, AgencyListItem, Booking } from '../../../types/api'
import BookingPanel from '../../../components/bookings/BookingPanel.vue'
import ReasonModal from '../../../components/bookings/ReasonModal.vue'
import AgencyDrawer from '../../../components/agencies/AgencyDrawer.vue'
import RegisterAgencyModal from '../../../components/agencies/RegisterAgencyModal.vue'
import {
  agencySlaDisplay,
  agencyStatusPill,
  bookingsCell,
  commissionPillClass,
  countryName
} from '../../../components/agencies/agencyHelpers'
import { firstApiMessage } from '../../../utils/apiForm'

type AgenciesPayload = {
  data: Array<AgencyListItem>
  meta: {
    kpis: AgenciesKpis
  }
}

const emptyKpis: AgenciesKpis = {
  approved_agencies: 0,
  registrations_to_review: 0,
  agency_revenue: 0,
  commission_accrued: 0,
  commission_payable: 0,
  commission_paid: 0,
  agency_approval_business_days: 0,
  commission_payable_days: 0,
  commission_cap_pct: 0,
  commission_default_pct: 0
}

const { can } = useAuth()
const { t } = useI18n()
const { useFetch, request } = useApi()
const { format } = useDates()
const { format: money } = useMoney()
const toast = useToast()
const route = useRoute()
const openedFromQuery = ref(false)

const drawerOpen = ref(false)
const selected = ref<Agency | null>(null)
const bookingOpen = ref(false)
const booking = ref<Booking | null>(null)
const registerOpen = ref(false)
const registerSubmitting = ref(false)
const registerError = ref('')
const rejectOpen = ref(false)
const rejectTarget = ref<AgencyListItem | null>(null)
const rejectSubmitting = ref(false)
const rejectError = ref('')

const listUrl = '/api/rms/agencies'

const { data: listPayload, refresh } = useFetch<AgenciesPayload>(listUrl)

const rows = computed(() => listPayload.value?.data ?? [])
const kpis = computed(() => listPayload.value?.meta.kpis ?? emptyKpis)
const pending = computed(() => rows.value.filter(row => row.status === 'PENDING'))
const partners = computed(() => rows.value.filter(row => row.status !== 'PENDING'))
const canManage = computed(() => can('agencies.manage'))

async function openAgency(row: AgencyListItem): Promise<void> {
  selected.value = await request(`/api/rms/agencies/${String(row.id)}`) as Agency
  drawerOpen.value = true
}

async function openBooking(id: number): Promise<void> {
  booking.value = await request(`/api/rms/bookings/${String(id)}`) as Booking
  bookingOpen.value = true
}

async function approve(row: AgencyListItem): Promise<void> {
  await request(`/api/rms/agencies/${String(row.id)}/decide`, {
    method: 'POST',
    body: { decision: 'APPROVED' }
  })
  toast.add({ title: t('agencies.approvedToast') })
  await refresh()
}

function startReject(row: AgencyListItem): void {
  rejectTarget.value = row
  rejectError.value = ''
  rejectOpen.value = true
}

async function onReject(reason: string): Promise<void> {
  if (rejectTarget.value === null) {
    return
  }

  rejectSubmitting.value = true
  rejectError.value = ''

  try {
    await request(`/api/rms/agencies/${String(rejectTarget.value.id)}/decide`, {
      method: 'POST',
      body: {
        decision: 'REJECTED',
        reason
      }
    })
    toast.add({ title: t('agencies.rejectedToast') })
    rejectOpen.value = false
    await refresh()
  } catch (error: unknown) {
    rejectError.value = firstApiMessage(error) ?? (error instanceof Error ? error.message : '')
  } finally {
    rejectSubmitting.value = false
  }
}

async function onRegister(payload: {
  name: string
  contact: string
  email: string
  country: string
  network: string
  commission_pct: number
}): Promise<void> {
  registerSubmitting.value = true
  registerError.value = ''

  try {
    await request('/api/rms/agencies', {
      method: 'POST',
      body: payload
    })
    toast.add({ title: t('agencies.registeredToast') })
    registerOpen.value = false
    await refresh()
  } catch (error: unknown) {
    registerError.value = firstApiMessage(error) ?? (error instanceof Error ? error.message : '')
  } finally {
    registerSubmitting.value = false
  }
}

async function onSaved(agency: Agency): Promise<void> {
  selected.value = agency
  await refresh()
}

watch(
  [listPayload, () => route.query.open],
  async ([payload, open]) => {
    if (openedFromQuery.value || payload === undefined) {
      return
    }

    const raw = Array.isArray(open) ? open[0] : open
    const id = typeof raw === 'string' ? Number(raw) : Number.NaN

    if (!Number.isFinite(id)) {
      openedFromQuery.value = true
      return
    }

    const fromList = payload.data.find(row => row.id === id)

    if (fromList !== undefined) {
      await openAgency(fromList)
      openedFromQuery.value = true
      return
    }

    try {
      selected.value = await request(`/api/rms/agencies/${String(id)}`) as Agency
      drawerOpen.value = true
    } catch {
      // Unknown id: leave the list as it is.
    }

    openedFromQuery.value = true
  },
  { immediate: true }
)
</script>

<template>
  <div>
    <div class="krow">
      <AnkKpi
        :label="t('agencies.kpiApproved')"
        :sub="t('agencies.kpiApprovedSub')"
      >
        {{ kpis.approved_agencies }}
      </AnkKpi>
      <AnkKpi
        :label="t('agencies.kpiReview')"
        :sub="t('agencies.kpiReviewSub', { days: String(kpis.agency_approval_business_days) })"
      >
        <span :class="{ 'pay-kpi-coral': kpis.registrations_to_review > 0 }">
          {{ kpis.registrations_to_review }}
        </span>
      </AnkKpi>
      <AnkKpi
        :label="t('agencies.kpiRevenue')"
        :sub="t('agencies.kpiRevenueSub', { n: String(kpis.approved_agencies) })"
      >
        {{ money(kpis.agency_revenue) }}
      </AnkKpi>
      <AnkKpi
        :label="t('agencies.kpiCommission')"
        :sub="t('agencies.kpiCommissionSub', { days: String(kpis.commission_payable_days) })"
      >
        {{ money(kpis.commission_accrued) }}
      </AnkKpi>
      <AnkKpi
        :label="t('agencies.kpiPayable')"
        :sub="t('agencies.kpiPayableSub')"
      >
        {{ money(kpis.commission_payable) }}
      </AnkKpi>
      <AnkKpi
        :label="t('agencies.kpiPaid')"
        :sub="t('agencies.kpiPaidSub')"
      >
        {{ money(kpis.commission_paid) }}
      </AnkKpi>
    </div>

    <div
      v-if="pending.length > 0"
      class="panel"
    >
      <h3>{{ t('agencies.regTitle') }}</h3>
      <div class="bk-table-wrap">
        <table class="list">
          <thead>
            <tr>
              <th>{{ t('agencies.colAgency') }}</th>
              <th>{{ t('agencies.colNetworkCountry') }}</th>
              <th>{{ t('agencies.colRequested') }}</th>
              <th>{{ t('agencies.colSla') }}</th>
              <th>{{ t('agencies.colAsked') }}</th>
              <th />
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="row in pending"
              :key="row.id"
            >
              <td>
                {{ row.name }}
                <div class="gmeta">
                  {{ row.contact }} · {{ row.email }}
                </div>
              </td>
              <td>{{ row.network ?? '—' }} · {{ countryName(row.country) }}</td>
              <td>{{ row.requested_at === null ? '—' : format(row.requested_at, 'short') }}</td>
              <td>
                <span
                  class="slat"
                  :class="agencySlaDisplay(row.sla_business_days_elapsed, kpis.agency_approval_business_days, row.sla_breached).tone === 'bad' ? 'bad' : 'ok'"
                >{{ agencySlaDisplay(row.sla_business_days_elapsed, kpis.agency_approval_business_days, row.sla_breached).text }}</span>
              </td>
              <td>
                {{ row.commission_pct }}%
                <span
                  v-if="commissionPillClass(row.commission_pct, kpis.commission_cap_pct)"
                  class="pill p-over"
                >{{ t('agencies.overCap', { cap: String(kpis.commission_cap_pct) }) }}</span>
              </td>
              <td class="list-actions">
                <UButton
                  :disabled="!canManage"
                  @click="approve(row)"
                >
                  {{ t('agencies.approve') }}
                </UButton>
                <UButton
                  variant="outline"
                  :disabled="!canManage"
                  @click="startReject(row)"
                >
                  {{ t('agencies.reject') }}
                </UButton>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <div class="panel">
      <h3>{{ t('agencies.partnersTitle') }}</h3>
      <div class="ebtool">
        <span />
        <div class="acts">
          <UButton
            v-if="canManage"
            variant="outline"
            @click="registerOpen = true"
          >
            {{ t('agencies.register') }}
          </UButton>
        </div>
      </div>
      <div class="bk-table-wrap">
        <table class="list">
          <thead>
            <tr>
              <th>{{ t('agencies.colAgency') }}</th>
              <th>{{ t('agencies.colNetwork') }}</th>
              <th>{{ t('agencies.colCommission') }}</th>
              <th>{{ t('agencies.colTerms') }}</th>
              <th>{{ t('agencies.colBookings') }}</th>
              <th>{{ t('agencies.colRevenue') }}</th>
              <th>{{ t('agencies.colAccrued') }}</th>
              <th>{{ t('agencies.colStatus') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-if="partners.length === 0"
              class="dr-empty"
            >
              <td colspan="8">
                {{ t('agencies.partnersEmpty') }}
              </td>
            </tr>
            <tr
              v-for="row in partners"
              :key="row.id"
              class="bk-row"
              @click="openAgency(row)"
            >
              <td>{{ row.name }} — {{ row.contact }}</td>
              <td>{{ row.network ?? '—' }}</td>
              <td>
                {{ row.commission_pct }}%
                <span
                  v-if="commissionPillClass(row.commission_pct, kpis.commission_cap_pct)"
                  class="pill p-over"
                >{{ t('agencies.overCapBlocked', { cap: String(kpis.commission_cap_pct) }) }}</span>
              </td>
              <td>{{ row.payment_terms }}</td>
              <td>{{ bookingsCell(row.bookings_count, row.held_bookings_count) }}</td>
              <td>{{ money(row.revenue) }}</td>
              <td>
                <template v-if="row.held_bookings_count > 0 && row.commission_pct > kpis.commission_cap_pct">
                  {{ t('agencies.blockedAccrued') }}
                </template>
                <template v-else>
                  {{ money(row.commission_accrued) }}
                </template>
              </td>
              <td>
                <span
                  class="pill"
                  :class="agencyStatusPill(row.status)"
                >{{ row.status }}</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <p class="note">
        {{ t('agencies.partnersNote') }}
      </p>
    </div>

    <AgencyDrawer
      v-model:open="drawerOpen"
      :agency="selected"
      :cap-pct="kpis.commission_cap_pct"
      @saved="onSaved"
      @open-booking="openBooking"
    />

    <BookingPanel
      v-model:open="bookingOpen"
      :booking="booking"
      @updated="() => refresh()"
    />

    <RegisterAgencyModal
      v-model:open="registerOpen"
      :default-pct="kpis.commission_default_pct"
      :cap-pct="kpis.commission_cap_pct"
      :submitting="registerSubmitting"
      :error="registerError"
      @submit="onRegister"
    />

    <ReasonModal
      v-model:open="rejectOpen"
      :title="t('agencies.rejectTitle')"
      hint="required"
      :submitting="rejectSubmitting"
      :error="rejectError"
      @submit="onReject"
    />
  </div>
</template>
