<script setup lang="ts">
import type {
  ChangeHistoryEntry,
  Offer,
  Paginated
} from '../../types/api'
import type { StayRange } from '#iconic-ui/app/components/AnkStayInput.vue'
import { applyApiFormError, firstApiMessage, type FormFieldErrors } from '../../utils/apiForm'
import { confirmUnsaved } from '../../composables/useUnsavedGuard'
import HistoryTimeline from '../history/HistoryTimeline.vue'
import ReasonModal from '../bookings/ReasonModal.vue'
import {
  addIsoDay,
  emptyOfferForm,
  formFromOffer,
  OFFER_CHANNELS,
  OFFER_STAY_PICKER_MAX_NIGHTS,
  OFFER_TYPES,
  offerFormToPayload,
  offerStatusPillClass,
  type OfferCodeOption,
  type OfferForm
} from './offerHelpers'

const isOpen = defineModel<boolean>('open', { required: true })

const props = defineProps<{
  source: Offer | null
  roomTypes: Array<OfferCodeOption>
  ratePlans: Array<OfferCodeOption>
  canManage: boolean
  canApprove: boolean
}>()

const emit = defineEmits<{
  saved: [offer: Offer]
}>()

type DrawerTab = 'offer' | 'history'
type ReasonKind = 'approve' | 'reject'

const { t } = useI18n()
const { request } = useApi()
const toast = useToast()

const form = ref<OfferForm>(emptyOfferForm())
const snapshot = ref('')
const current = ref<Offer | null>(null)
const tab = ref<DrawerTab>('offer')
const warn = ref('')
const fieldErrors = ref<FormFieldErrors>({})
const saving = ref(false)
const history = ref<Array<ChangeHistoryEntry>>([])
const historyPage = ref(1)
const historyLast = ref(1)
const historyLoading = ref(false)
const reasonOpen = ref(false)
const reasonKind = ref<ReasonKind>('approve')
const reasonError = ref('')
const reasonSubmitting = ref(false)

const isNew = computed(() => current.value === null)
const canEdit = computed(() => props.canManage)
const dirty = computed(() => JSON.stringify(form.value) !== snapshot.value)
const isValue = computed(() => form.value.type === 'VALUE')
const priceAffecting = computed(() => form.value.type !== 'VALUE')
const storedStatus = computed(() => current.value?.stored_status ?? 'DRAFT')
const derivedStatus = computed(() => current.value?.status ?? 'DRAFT')

const title = computed(() => {
  if (isNew.value) {
    return t('offers.newTitle')
  }

  return current.value?.code ?? t('offers.newTitle')
})

const typeItems = computed(() => OFFER_TYPES.map(item => ({
  label: t(`offers.types.${item}`),
  value: item
})))

const channelItems = computed(() => OFFER_CHANNELS.map(item => ({
  label: t(`offers.channels.${item}`),
  value: item
})))

const stayRange = computed<StayRange | null>({
  get() {
    if (form.value.stay_from === '' || form.value.stay_to === '') {
      return null
    }

    return {
      check_in: form.value.stay_from,
      check_out: addIsoDay(form.value.stay_to, 1)
    }
  },
  set(value) {
    if (value === null) {
      form.value.stay_from = ''
      form.value.stay_to = ''

      return
    }

    form.value.stay_from = value.check_in
    form.value.stay_to = addIsoDay(value.check_out, -1)
  }
})

function onTypeUpdate(value: string | number | null | undefined): void {
  if (typeof value === 'string') {
    form.value.type = value as (typeof OFFER_TYPES)[number]
  }
}

function onChannelUpdate(value: string | number | null | undefined): void {
  if (typeof value === 'string') {
    form.value.channel = value as (typeof OFFER_CHANNELS)[number]
  }
}

function onBookingFromUpdate(value: string | null): void {
  form.value.booking_from = value ?? ''
}

function onBookingToUpdate(value: string | null): void {
  form.value.booking_to = value ?? ''
}

function snapshotOf(next: OfferForm): string {
  return JSON.stringify(next)
}

function resetFrom(source: Offer | null): void {
  const next = source === null
    ? emptyOfferForm()
    : formFromOffer(source)

  form.value = next
  snapshot.value = snapshotOf(next)
  current.value = source
  tab.value = 'offer'
  warn.value = ''
  fieldErrors.value = {}
  history.value = []
  historyPage.value = 1
  historyLast.value = 1
}

watch(
  () => [isOpen.value, props.source] as const,
  ([open]) => {
    if (open) {
      resetFrom(props.source)
    }
  }
)

useUnsavedGuard(dirty, () => t('config.leaveUnsaved'))

function onUpdateOpen(next: boolean): void {
  if (!next && dirty.value && !confirmUnsaved(t('config.leaveUnsaved'))) {
    return
  }

  isOpen.value = next
}

function toggleCode(list: 'room_types' | 'rate_plans', code: string, checked: boolean): void {
  const current = form.value[list]

  if (checked) {
    if (!current.includes(code)) {
      form.value[list] = [...current, code]
    }

    return
  }

  form.value[list] = current.filter(item => item !== code)
}

function onMinNights(event: Event): void {
  const raw = (event.target as HTMLInputElement).value
  form.value.min_nights = raw === '' ? null : Number(raw)
}

function applySaved(offer: Offer): void {
  current.value = offer
  form.value = formFromOffer(offer)
  snapshot.value = snapshotOf(form.value)
  fieldErrors.value = {}
  warn.value = ''
  emit('saved', offer)
}

async function save(asDraft: boolean): Promise<void> {
  if (!canEdit.value) {
    return
  }

  saving.value = true
  fieldErrors.value = {}
  warn.value = ''

  try {
    const body = offerFormToPayload(form.value, asDraft)
    const offer = current.value === null
      ? await request('/api/rms/offers', { method: 'POST', body }) as Offer
      : await request(`/api/rms/offers/${current.value.id}`, { method: 'PATCH', body }) as Offer

    applySaved(offer)

    if (asDraft) {
      toast.add({ title: t('offers.draftToast') })
    } else if (offer.status === 'PENDING') {
      toast.add({ title: t('offers.pendingToast') })
    } else {
      toast.add({ title: t('offers.liveToast') })
    }
  } catch (error: unknown) {
    if (!applyApiFormError(error, (fields, conflict) => {
      fieldErrors.value = fields
      warn.value = conflict
    })) {
      warn.value = firstApiMessage(error) ?? (error instanceof Error ? error.message : '')
    }
  } finally {
    saving.value = false
  }
}

async function pauseOrResume(action: 'pause' | 'resume'): Promise<void> {
  if (current.value === null || !canEdit.value) {
    return
  }

  saving.value = true
  warn.value = ''

  try {
    const offer = await request(`/api/rms/offers/${current.value.id}/${action}`, {
      method: 'POST'
    }) as Offer

    applySaved(offer)

    if (action === 'pause') {
      toast.add({ title: t('offers.pausedToast') })
    } else if (offer.status === 'PENDING') {
      toast.add({ title: t('offers.resumedPendingToast') })
    } else {
      toast.add({ title: t('offers.resumedToast') })
    }
  } catch (error: unknown) {
    warn.value = firstApiMessage(error) ?? (error instanceof Error ? error.message : '')
  } finally {
    saving.value = false
  }
}

function startReason(kind: ReasonKind): void {
  reasonKind.value = kind
  reasonError.value = ''
  reasonOpen.value = true
}

async function submitReason(reason: string): Promise<void> {
  if (current.value === null) {
    return
  }

  reasonSubmitting.value = true
  reasonError.value = ''

  try {
    const path = reasonKind.value === 'approve' ? 'approve' : 'reject'
    const offer = await request(`/api/rms/offers/${current.value.id}/${path}`, {
      method: 'POST',
      body: { reason }
    }) as Offer

    applySaved(offer)
    reasonOpen.value = false
    toast.add({
      title: reasonKind.value === 'approve' ? t('offers.approvedToast') : t('offers.rejectedToast')
    })
    await loadHistory(true)
  } catch (error: unknown) {
    reasonError.value = firstApiMessage(error) ?? (error instanceof Error ? error.message : '')
  } finally {
    reasonSubmitting.value = false
  }
}

async function loadHistory(reset: boolean): Promise<void> {
  if (current.value === null) {
    return
  }

  if (reset) {
    historyPage.value = 1
    history.value = []
  }

  historyLoading.value = true

  try {
    const result = await request(
      `/api/rms/offers/${current.value.id}/history?page=${historyPage.value}`
    ) as Paginated<ChangeHistoryEntry>
    history.value = reset ? result.data : [...history.value, ...result.data]
    historyLast.value = result.meta.last_page
  } finally {
    historyLoading.value = false
  }
}

watch(tab, (next) => {
  if (next === 'history' && current.value !== null && history.value.length === 0) {
    void loadHistory(true)
  }
})

function fieldError(name: string): string {
  return fieldErrors.value[name] ?? ''
}
</script>

<template>
  <USlideover
    :open="isOpen"
    class="history-drawer"
    @update:open="onUpdateOpen"
  >
    <template #header>
      <div>
        <h2>{{ title }}</h2>
        <div class="bid">
          <template v-if="isNew">
            {{ t('offers.newBid') }}
          </template>
          <template v-else-if="current">
            {{ current.reference }} ·
            <span
              class="pill"
              :class="offerStatusPillClass(derivedStatus)"
            >{{ t(`offers.status.${derivedStatus}`) }}</span>
          </template>
        </div>
      </div>
    </template>

    <template #body>
      <div
        v-if="!isNew"
        class="dtabs"
      >
        <button
          type="button"
          class="dtab"
          :class="{ on: tab === 'offer' }"
          @click="tab = 'offer'"
        >
          {{ t('offers.tabOffer') }}
        </button>
        <button
          type="button"
          class="dtab"
          :class="{ on: tab === 'history' }"
          @click="tab = 'history'"
        >
          {{ t('offers.tabHistory') }}
        </button>
      </div>

      <template v-if="tab === 'offer'">
        <p
          v-if="!canEdit"
          class="notice"
        >
          {{ t('offers.viewOnly') }}
        </p>

        <fieldset
          class="edfs"
          :disabled="!canEdit"
        >
          <div class="sec">
            <h4>{{ t('offers.sectionOffer') }}</h4>
            <div class="cols2">
              <div class="field">
                <label for="of-code">{{ t('offers.code') }}</label>
                <input
                  id="of-code"
                  v-model="form.code"
                  class="of-code"
                  maxlength="20"
                  :placeholder="t('offers.codePlaceholder')"
                >
                <p
                  v-if="fieldError('code')"
                  class="pline-err"
                >
                  {{ fieldError('code') }}
                </p>
              </div>
              <div class="field">
                <label for="of-name">{{ t('offers.name') }}</label>
                <input
                  id="of-name"
                  v-model="form.name"
                >
                <p
                  v-if="fieldError('name')"
                  class="pline-err"
                >
                  {{ fieldError('name') }}
                </p>
              </div>
            </div>
            <div class="cols2">
              <div class="field">
                <label for="of-type">{{ t('offers.type') }}</label>
                <USelect
                  id="of-type"
                  :model-value="form.type"
                  class="w-full"
                  :items="typeItems"
                  @update:model-value="onTypeUpdate"
                />
                <p
                  v-if="fieldError('type')"
                  class="pline-err"
                >
                  {{ fieldError('type') }}
                </p>
              </div>
              <div
                v-if="!isValue"
                class="field"
              >
                <label for="of-val">{{ t('offers.value') }}</label>
                <input
                  id="of-val"
                  v-model.number="form.value"
                  type="number"
                  min="0"
                  step="1"
                >
                <p
                  v-if="fieldError('value')"
                  class="pline-err"
                >
                  {{ fieldError('value') }}
                </p>
              </div>
            </div>
            <div
              v-if="isValue"
              class="field"
            >
              <label for="of-vt">{{ t('offers.valueText') }}</label>
              <input
                id="of-vt"
                v-model="form.value_text"
                :placeholder="t('offers.valueTextPlaceholder')"
              >
              <p
                v-if="fieldError('value_text')"
                class="pline-err"
              >
                {{ fieldError('value_text') }}
              </p>
            </div>
          </div>

          <div class="sec">
            <h4>{{ t('offers.sectionApplies') }}</h4>
            <div class="cols2">
              <div class="field">
                <label for="of-chan">{{ t('offers.channel') }}</label>
                <USelect
                  id="of-chan"
                  :model-value="form.channel"
                  class="w-full"
                  :items="channelItems"
                  @update:model-value="onChannelUpdate"
                />
                <p
                  v-if="fieldError('channel')"
                  class="pline-err"
                >
                  {{ fieldError('channel') }}
                </p>
              </div>
              <div class="field">
                <label for="of-partner">{{ t('offers.partner') }}</label>
                <input
                  id="of-partner"
                  v-model="form.partner"
                  :placeholder="t('offers.partnerPlaceholder')"
                >
                <p
                  v-if="fieldError('partner')"
                  class="pline-err"
                >
                  {{ fieldError('partner') }}
                </p>
              </div>
            </div>
            <div class="field">
              <span class="field-label">{{ t('offers.stayWindow') }}</span>
              <AnkStayInput
                v-model="stayRange"
                :min-nights="1"
                :max-nights="OFFER_STAY_PICKER_MAX_NIGHTS"
              />
              <p
                v-if="fieldError('stay_from') || fieldError('stay_to')"
                class="pline-err"
              >
                {{ fieldError('stay_from') || fieldError('stay_to') }}
              </p>
            </div>
            <div class="field">
              <label for="of-min">{{ t('offers.minNights') }}</label>
              <input
                id="of-min"
                :value="form.min_nights ?? ''"
                type="number"
                min="1"
                @input="onMinNights"
              >
              <p
                v-if="fieldError('min_nights')"
                class="pline-err"
              >
                {{ fieldError('min_nights') }}
              </p>
            </div>
            <div class="field">
              <span class="field-label">{{ t('offers.roomTypes') }}</span>
              <p
                v-if="roomTypes.length === 0"
                class="notice"
              >
                {{ t('offers.allRooms') }}
              </p>
              <div
                v-else
                class="chkgrid"
              >
                <label
                  v-for="item in roomTypes"
                  :key="item.code"
                  class="chkline"
                >
                  <input
                    type="checkbox"
                    :checked="form.room_types.includes(item.code)"
                    :disabled="!canEdit"
                    @change="toggleCode('room_types', item.code, ($event.target as HTMLInputElement).checked)"
                  >
                  {{ item.name }}
                </label>
              </div>
              <p
                v-if="fieldError('applies_to_room_types')"
                class="pline-err"
              >
                {{ fieldError('applies_to_room_types') }}
              </p>
            </div>
            <div class="field">
              <span class="field-label">{{ t('offers.ratePlans') }}</span>
              <p
                v-if="ratePlans.length === 0"
                class="notice"
              >
                {{ t('offers.allPlans') }}
              </p>
              <div
                v-else
                class="chkgrid"
              >
                <label
                  v-for="item in ratePlans"
                  :key="item.code"
                  class="chkline"
                >
                  <input
                    type="checkbox"
                    :checked="form.rate_plans.includes(item.code)"
                    :disabled="!canEdit"
                    @change="toggleCode('rate_plans', item.code, ($event.target as HTMLInputElement).checked)"
                  >
                  {{ item.name }}
                </label>
              </div>
              <p
                v-if="fieldError('applies_to_rate_plans')"
                class="pline-err"
              >
                {{ fieldError('applies_to_rate_plans') }}
              </p>
            </div>
            <div class="cols2">
              <div class="field">
                <label for="of-bf">{{ t('offers.bookingFrom') }}</label>
                <AnkDateInput
                  id="of-bf"
                  :model-value="form.booking_from === '' ? null : form.booking_from"
                  @update:model-value="onBookingFromUpdate"
                />
                <p
                  v-if="fieldError('booking_from')"
                  class="pline-err"
                >
                  {{ fieldError('booking_from') }}
                </p>
              </div>
              <div class="field">
                <label for="of-bt">{{ t('offers.bookingTo') }}</label>
                <AnkDateInput
                  id="of-bt"
                  :model-value="form.booking_to === '' ? null : form.booking_to"
                  @update:model-value="onBookingToUpdate"
                />
                <p
                  v-if="fieldError('booking_to')"
                  class="pline-err"
                >
                  {{ fieldError('booking_to') }}
                </p>
              </div>
            </div>
            <label class="chkline">
              <input
                v-model="form.combinable"
                type="checkbox"
              >
              {{ t('offers.combinable') }}
            </label>
            <label class="chkline">
              <input
                v-model="form.is_promo_code"
                type="checkbox"
              >
              {{ t('offers.promoCode') }}
            </label>
            <p class="notice">
              {{ t('offers.appliesNotice') }}
            </p>
          </div>

          <div class="sec">
            <h4>{{ t('offers.sectionEngine') }}</h4>
            <div class="cols2">
              <div class="field">
                <label for="of-badge">{{ t('offers.badge') }}</label>
                <input
                  id="of-badge"
                  v-model="form.badge"
                  maxlength="18"
                  :placeholder="t('offers.badgePlaceholder')"
                >
                <p
                  v-if="fieldError('badge')"
                  class="pline-err"
                >
                  {{ fieldError('badge') }}
                </p>
              </div>
              <div class="field">
                <label for="of-pl">{{ t('offers.priceLine') }}</label>
                <input
                  id="of-pl"
                  v-model="form.price_line"
                  :placeholder="t('offers.priceLinePlaceholder')"
                >
                <p
                  v-if="fieldError('price_line')"
                  class="pline-err"
                >
                  {{ fieldError('price_line') }}
                </p>
              </div>
            </div>
            <div class="chkgrid">
              <label class="chkline">
                <input
                  v-model="form.show_on_card"
                  type="checkbox"
                >
                {{ t('offers.showOnCard') }}
              </label>
              <label class="chkline">
                <input
                  v-model="form.show_on_calendar"
                  type="checkbox"
                >
                {{ t('offers.showOnCalendar') }}
              </label>
            </div>
            <div class="field">
              <label for="of-terms">{{ t('offers.terms') }}</label>
              <textarea
                id="of-terms"
                v-model="form.terms"
                rows="3"
              />
              <p
                v-if="fieldError('terms')"
                class="pline-err"
              >
                {{ fieldError('terms') }}
              </p>
            </div>
            <div class="prevbox">
              <div class="mono prevl">
                {{ t('offers.previewLabel') }}
              </div>
              <p
                v-if="form.channel === 'B2B'"
                class="note"
              >
                {{ t('offers.previewB2b') }}
              </p>
              <p
                v-else-if="form.is_promo_code"
                class="note"
              >
                {{ t('offers.previewPromo') }}
              </p>
              <template v-else>
                <div
                  v-if="form.show_on_calendar && form.badge !== ''"
                  class="pdrow"
                >
                  <span class="badge-offer">{{ form.badge }}</span>
                </div>
                <div
                  v-if="form.price_line !== ''"
                  class="pline off"
                >
                  {{ form.price_line }}
                </div>
                <p
                  v-if="form.terms !== ''"
                  class="note"
                >
                  {{ form.terms }}
                </p>
              </template>
            </div>
            <p
              v-if="priceAffecting"
              class="notice"
            >
              {{ t('offers.priceAffectingNotice') }}
            </p>
          </div>
        </fieldset>

        <div
          v-if="warn"
          class="warnbox"
        >
          {{ warn }}
        </div>
      </template>

      <template v-else>
        <HistoryTimeline :entries="history" />
        <UButton
          v-if="historyPage < historyLast"
          variant="outline"
          :loading="historyLoading"
          @click="historyPage += 1; loadHistory(false)"
        >
          {{ t('history.loadOlder') }}
        </UButton>
      </template>
    </template>

    <template #footer>
      <div class="transbtns">
        <template v-if="canEdit && tab === 'offer'">
          <UButton
            :loading="saving"
            @click="save(false)"
          >
            {{ priceAffecting ? t('offers.submit') : t('offers.save') }}
          </UButton>
          <UButton
            v-if="isNew || storedStatus === 'DRAFT' || storedStatus === 'PENDING'"
            variant="outline"
            :loading="saving"
            @click="save(true)"
          >
            {{ t('offers.saveDraft') }}
          </UButton>
          <UButton
            v-if="storedStatus === 'LIVE'"
            variant="outline"
            :loading="saving"
            @click="pauseOrResume('pause')"
          >
            {{ t('offers.pause') }}
          </UButton>
          <UButton
            v-if="storedStatus === 'PAUSED'"
            variant="outline"
            :loading="saving"
            @click="pauseOrResume('resume')"
          >
            {{ t('offers.resume') }}
          </UButton>
        </template>
        <template v-if="canApprove && storedStatus === 'PENDING' && tab === 'offer'">
          <UButton
            :loading="saving"
            @click="startReason('approve')"
          >
            {{ t('offers.approve') }}
          </UButton>
          <UButton
            variant="outline"
            :loading="saving"
            @click="startReason('reject')"
          >
            {{ t('offers.reject') }}
          </UButton>
        </template>
        <UButton
          variant="outline"
          @click="onUpdateOpen(false)"
        >
          {{ t('offers.close') }}
        </UButton>
      </div>
    </template>
  </USlideover>

  <ReasonModal
    v-model:open="reasonOpen"
    :title="reasonKind === 'approve' ? t('offers.approveTitle') : t('offers.rejectTitle')"
    hint="required"
    :submitting="reasonSubmitting"
    :error="reasonError"
    @submit="submitReason"
  />
</template>
