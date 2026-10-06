<script setup lang="ts">
import type {
  NpsView,
  PreferenceSource,
  PreferenceStatus
} from '../../../types/api'
import DocumentPreviewModal from '../../../components/documents/DocumentPreviewModal.vue'
import PreferenceModal from '../../../components/guest-experience/PreferenceModal.vue'
import {
  npsScoreClass,
  prefStatusClass
} from '../../../components/guest-experience/guestExperienceHelpers'
import { firstApiMessage } from '../../../utils/apiForm'

type ArrivalGuest = {
  guest_id: number
  name: string
  booking_reference: string
  email: string | null
  email_note: string | null
  room: string
  status: PreferenceStatus
  status_label: string
  answered_at: string | null
  source: PreferenceSource | null
  send_date: string
  dietary: string | null
  celebration: string | null
  activity: string | null
  accessibility_provided: boolean
  emergency_contact_provided: boolean
}

type ArrivalGuestListView = {
  send_date: string
  send_state: 'sent' | 'scheduled'
  kpis: {
    guests: number
    bookings: number
    answered: number
    total: number
    celebrations: number
    accessibility_or_medical: number
  }
  guests: Array<ArrivalGuest>
}

const { t } = useI18n()
const { can } = useAuth()
const { request } = useApi()
const { format } = useDates()

const canManage = computed(() => can('guest_experience.manage'))
const canSensitive = computed(() => can('guests.view_sensitive'))

const today = computed(() => format(new Date(), 'iso'))
const from = ref(today.value)
const to = ref(today.value)
const experience = ref<ArrivalGuestListView | null>(null)
const nps = ref<NpsView | null>(null)
const loadError = ref('')
const npsError = ref('')

const preferenceOpen = ref(false)
const preferenceGuest = ref<ArrivalGuest | null>(null)
const briefOpen = ref(false)

const briefHtml = computed(() => (
  from.value === '' ? null : `/api/rms/guest-experience/arrivals?date=${from.value}`
))

const briefPdf = computed(() => (
  briefHtml.value === null ? null : `${briefHtml.value}&format=pdf`
))

watch([from, to], () => {
  void loadExperience()
})

onMounted(() => {
  void loadExperience()

  if (canManage.value) {
    void loadNps()
  }
})

function dash(value: string | null): string {
  return value === null || value === '' ? '—' : value
}

function sourceLabel(source: PreferenceSource | null): string {
  if (source === 'GUEST_LINK') {
    return t('guestExperience.sourceGuest')
  }

  if (source === 'STAFF') {
    return t('guestExperience.sourceStaff')
  }

  return ''
}

function statusDetail(guest: ArrivalGuest): string {
  if (guest.status === 'ANSWERED') {
    const when = guest.answered_at === null ? '' : format(guest.answered_at, 'dateTime')

    return [when, sourceLabel(guest.source)].filter(part => part !== '').join(' · ')
  }

  if (guest.status === 'SCHEDULED') {
    return format(guest.send_date, 'short')
  }

  return ''
}

function openPreferences(guest: ArrivalGuest): void {
  preferenceGuest.value = guest
  preferenceOpen.value = true
}

function surveyHours(view: NpsView): string {
  const facts = view.facts as NpsView['facts'] & { survey_hours_after_check_out?: number }

  return String(facts.survey_hours_after_check_out ?? 0)
}

async function loadExperience(): Promise<void> {
  if (from.value === '' || to.value === '' || to.value < from.value) {
    return
  }

  try {
    const payload = await request(`/api/rms/guest-experience?from=${from.value}&to=${to.value}`) as {
      data: ArrivalGuestListView
    }
    experience.value = payload.data
    loadError.value = ''
  } catch (caught: unknown) {
    experience.value = null
    loadError.value = firstApiMessage(caught) ?? t('guestExperience.loadFailed')
  }
}

async function loadNps(): Promise<void> {
  try {
    nps.value = await request('/api/rms/guest-experience/nps') as NpsView
    npsError.value = ''
  } catch (caught: unknown) {
    nps.value = null
    npsError.value = firstApiMessage(caught) ?? t('guestExperience.loadFailed')
  }
}

function refreshExperience(): void {
  void loadExperience()
}

function questionnaireSub(view: ArrivalGuestListView): string {
  const date = format(view.send_date, 'short')

  return view.send_state === 'sent'
    ? t('guestExperience.sentOn', { date })
    : t('guestExperience.sendsOn', { date })
}
</script>

<template>
  <div>
    <p class="notice">
      {{ t('guestExperience.notice') }}
    </p>

    <div class="field gx-dates">
      <label for="gx-from">{{ t('guestExperience.arrivalFrom') }}</label>
      <UInput
        id="gx-from"
        v-model="from"
        type="date"
      />
      <label for="gx-to">{{ t('guestExperience.arrivalTo') }}</label>
      <UInput
        id="gx-to"
        v-model="to"
        type="date"
      />
    </div>

    <p
      v-if="loadError !== ''"
      class="note"
    >
      {{ loadError }}
    </p>
    <p
      v-else-if="experience !== null && experience.guests.length === 0"
      class="note"
    >
      {{ t('guestExperience.emptyArrivals') }}
    </p>

    <template v-if="experience">
      <div class="krow">
        <AnkKpi
          :label="t('guestExperience.kpiGuests')"
          :sub="t('guestExperience.kpiBookings', { count: String(experience.kpis.bookings) })"
        >
          {{ experience.kpis.guests }}
        </AnkKpi>
        <AnkKpi
          :label="t('guestExperience.kpiAnswered')"
          :sub="questionnaireSub(experience)"
        >
          {{ experience.kpis.answered }}/{{ experience.kpis.total }}
        </AnkKpi>
        <AnkKpi
          :label="t('guestExperience.kpiCelebrations')"
          :sub="t('guestExperience.kpiCelebrationsSub')"
        >
          {{ experience.kpis.celebrations }}
        </AnkKpi>
        <AnkKpi
          :label="t('guestExperience.kpiAccess')"
          :sub="canSensitive ? t('guestExperience.accessOps') : t('guestExperience.accessRestricted')"
        >
          <span class="gx-warn">{{ experience.kpis.accessibility_or_medical }}</span>
        </AnkKpi>
      </div>

      <div class="panel">
        <h3>{{ t('guestExperience.preferencesTitle') }}</h3>
        <div class="bk-table-wrap">
          <table class="list">
            <thead>
              <tr>
                <th>{{ t('guestExperience.colGuest') }}</th>
                <th>{{ t('guestExperience.colRoom') }}</th>
                <th>{{ t('guestExperience.colStatus') }}</th>
                <th>{{ t('guestExperience.colDietary') }}</th>
                <th>{{ t('guestExperience.colCelebration') }}</th>
                <th>{{ t('guestExperience.colActivity') }}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="guest in experience.guests"
                :key="guest.guest_id"
              >
                <td>
                  {{ guest.name }}
                  <div class="gmeta">
                    {{ guest.booking_reference }} · {{ guest.email ?? guest.email_note ?? '—' }}
                  </div>
                </td>
                <td>{{ guest.room }}</td>
                <td>
                  <span
                    class="pill"
                    :class="prefStatusClass(guest.status)"
                  >{{ guest.status_label }}</span>
                  <div
                    v-if="statusDetail(guest) !== ''"
                    class="gmeta"
                  >
                    {{ statusDetail(guest) }}
                  </div>
                </td>
                <td>{{ dash(guest.dietary) }}</td>
                <td>{{ dash(guest.celebration) }}</td>
                <td>{{ dash(guest.activity) }}</td>
                <td>
                  <button
                    type="button"
                    class="mini"
                    @click="openPreferences(guest)"
                  >
                    {{ guest.status === 'ANSWERED' ? t('guestExperience.view') : t('guestExperience.record') }}
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <div class="gx-brief">
          <UButton
            variant="outline"
            :disabled="from === ''"
            @click="briefOpen = true"
          >
            {{ t('guestExperience.brief') }}
          </UButton>
        </div>
      </div>
    </template>

    <div
      v-if="canManage"
      class="panel"
    >
      <h3>{{ t('guestExperience.npsTitle') }}</h3>
      <p
        v-if="npsError !== ''"
        class="note"
      >
        {{ npsError }}
      </p>
      <p
        v-else-if="nps !== null && nps.responses.length === 0"
        class="note gx-empty"
      >
        {{ t('guestExperience.emptyNps', {
          hours: surveyHours(nps),
          date: nps.facts.first_expected_survey_on === null ? '—' : format(nps.facts.first_expected_survey_on, 'short'),
          alert: String(nps.facts.alert_below),
          review: String(nps.facts.review_request_from)
        }) }}
      </p>
      <template v-else-if="nps !== null">
        <div class="krow gx-nps-kpis">
          <AnkKpi
            :label="t('guestExperience.kpiAverage')"
            :sub="t('guestExperience.kpiResponses', { count: String(nps.kpis.responses) })"
          >
            {{ nps.kpis.average_score ?? '—' }}
          </AnkKpi>
          <AnkKpi
            :label="t('guestExperience.kpiAlerts', { threshold: String(nps.facts.alert_below) })"
          >
            <span class="gx-coral">{{ nps.kpis.alerts_below }}</span>
          </AnkKpi>
          <AnkKpi
            :label="t('guestExperience.kpiReviews', { threshold: String(nps.facts.review_request_from) })"
            :sub="t('guestExperience.kpiReviewsSub')"
          >
            {{ nps.kpis.review_requests_sent }}
          </AnkKpi>
        </div>
        <div class="bk-table-wrap">
          <table class="list">
            <thead>
              <tr>
                <th>{{ t('guestExperience.colBooking') }}</th>
                <th>{{ t('guestExperience.colGuest') }}</th>
                <th>{{ t('guestExperience.colScore') }}</th>
                <th>{{ t('guestExperience.colRecommend') }}</th>
                <th>{{ t('guestExperience.colBest') }}</th>
                <th>{{ t('guestExperience.colBetter') }}</th>
                <th>{{ t('guestExperience.colCrew') }}</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="(row, index) in nps.responses"
                :key="`${row.booking_reference}-${String(index)}`"
              >
                <td class="mono">
                  {{ row.booking_reference }}
                </td>
                <td>{{ row.guest }}</td>
                <td>
                  <span
                    class="pill"
                    :class="npsScoreClass(row.score, nps.facts.alert_below, nps.facts.review_request_from)"
                  >{{ row.score }}</span>
                </td>
                <td>{{ row.recommend ?? '—' }}</td>
                <td>{{ dash(row.best) }}</td>
                <td>{{ dash(row.better) }}</td>
                <td>{{ dash(row.crew) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </template>
    </div>

    <PreferenceModal
      v-model:open="preferenceOpen"
      :guest-id="preferenceGuest?.guest_id ?? null"
      :name="preferenceGuest?.name ?? ''"
      :meta="preferenceGuest === null ? '' : `${preferenceGuest.booking_reference} · ${preferenceGuest.room}`"
      @saved="refreshExperience"
    />

    <DocumentPreviewModal
      v-model:open="briefOpen"
      :title="t('guestExperience.briefTitle')"
      :html-path="briefHtml"
      :file-path="briefPdf"
      file-name="arrivals-brief.pdf"
    />
  </div>
</template>

<style scoped>
.gx-dates {
  display: flex;
  gap: 12px;
  align-items: flex-end;
  max-width: 520px;
}

.gx-warn {
  color: var(--warn);
}

.gx-coral {
  color: var(--coral-400);
}

.gx-brief {
  padding: 12px 20px;
}

.gx-empty {
  padding: 16px 20px;
}

.gx-nps-kpis {
  margin: 14px 20px;
}
</style>
