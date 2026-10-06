<script setup lang="ts">
import type {
  Booking,
  BookingExtra,
  DocumentPlanRow,
  ExtrasCatalogueItem,
  ExtrasListSummary,
  ExtrasVersion
} from '../../types/api'
import { applyApiFormError, firstApiMessage, type FormFieldErrors } from '../../utils/apiForm'
import { extraAddDefaults, extrasWritable, feeLabel } from './extraHelpers'
import { invoiceHasBeenIssued } from '../documents/documentHelpers'

const props = defineProps<{
  booking: Booking
}>()

const emit = defineEmits<{
  updated: [booking?: Booking]
}>()

type ExtrasIndex = ExtrasListSummary & { data: Array<BookingExtra> }

const { t } = useI18n()
const { request } = useApi()
const { format: money } = useMoney()
const toast = useToast()

const extras = ref<Array<BookingExtra>>([])
const summary = ref<ExtrasListSummary>(emptySummary())
const catalogue = ref<Array<ExtrasCatalogueItem>>([])
const loading = ref(false)
const loadError = ref('')
const formError = ref('')
const fieldErrors = ref<FormFieldErrors>({})
const submitting = ref(false)
const feeBusy = ref(false)

const addCode = ref('')
const addQty = ref(1)
const addRate = ref('')
const addNote = ref('')

const removeOpen = ref(false)
const removing = ref<BookingExtra | null>(null)
const removeError = ref('')
const removeSubmitting = ref(false)

const invoiceIssued = ref(false)

const canWrite = computed(() => extrasWritable(props.booking.status, props.booking.can_act))

const activeItems = computed(() => catalogue.value.filter(item => item.active))

const codeItems = computed(() => activeItems.value.map(item => ({
  label: item.name,
  value: item.code
})))

const selectedItem = computed(() => {
  return activeItems.value.find(item => item.code === addCode.value) ?? null
})

const feeAmounts = computed(() => {
  return {
    pngKnownTotal: summary.value.png_known_total,
    pngPendingCount: summary.value.png_pending_count,
    tctPp: summary.value.tct_pp,
    tctCount: summary.value.tct_count
  }
})

function emptySummary(): ExtrasListSummary {
  return {
    extras_total: 0,
    tct_collected: false,
    png_known_total: 0,
    png_pending_count: 0,
    tct_pp: 0,
    tct_count: 0,
    extras_due_hours: 0,
    extras_due_at: ''
  }
}

function applyDefaults(item: ExtrasCatalogueItem): void {
  const defaults = extraAddDefaults(item, props.booking.guests_summary.total)
  addQty.value = defaults.qty
  addRate.value = defaults.rateUsd === null ? '' : String(defaults.rateUsd)
}

function onPick(): void {
  if (selectedItem.value !== null) {
    applyDefaults(selectedItem.value)
  }
}

function onCodeUpdate(value: string | number | null | undefined): void {
  addCode.value = typeof value === 'string' ? value : ''
  onPick()
}

async function loadExtras(): Promise<void> {
  const result = await request(`/api/rms/bookings/${props.booking.id}/extras`) as ExtrasIndex
  const { data, ...rest } = result
  extras.value = data
  summary.value = rest
}

async function loadCatalogue(): Promise<void> {
  if (catalogue.value.length > 0) {
    return
  }

  const current = await request('/api/rms/extras') as ExtrasVersion
  catalogue.value = current.document.items

  const first = current.document.items.find(item => item.active)

  if (first !== undefined && addCode.value === '') {
    addCode.value = first.code
    applyDefaults(first)
  }
}

async function loadInvoiceFlag(): Promise<void> {
  const result = await request(`/api/rms/bookings/${props.booking.id}/documents/plan`) as { data: Array<DocumentPlanRow> }
  invoiceIssued.value = invoiceHasBeenIssued(result.data)
}

async function loadAll(): Promise<void> {
  loading.value = true
  loadError.value = ''

  try {
    await Promise.all([loadExtras(), loadCatalogue(), loadInvoiceFlag()])
  } catch (error: unknown) {
    loadError.value = firstApiMessage(error) ?? (error instanceof Error ? error.message : t('bookings.extrasFailed'))
  } finally {
    loading.value = false
  }
}

async function afterWrite(booking?: Booking): Promise<void> {
  await loadExtras()
  await loadInvoiceFlag()

  if (booking !== undefined) {
    emit('updated', booking)
    return
  }

  emit('updated')
}

onMounted(() => {
  void loadAll()
})

watch(() => props.booking.id, () => {
  extras.value = []
  addNote.value = ''
  invoiceIssued.value = false
  void loadAll()
})

async function addExtra(): Promise<void> {
  if (!canWrite.value) {
    return
  }

  submitting.value = true
  formError.value = ''
  fieldErrors.value = {}

  const rate = addRate.value.trim()

  try {
    await request(`/api/rms/bookings/${props.booking.id}/extras`, {
      method: 'POST',
      body: {
        code: addCode.value,
        qty: addQty.value,
        rate_usd: rate === '' ? null : Number(rate),
        note: addNote.value.trim() === '' ? null : addNote.value.trim()
      }
    })

    addNote.value = ''
    if (selectedItem.value !== null) {
      applyDefaults(selectedItem.value)
    }

    toast.add({ title: t('bookings.extraAddedToast') })
    await afterWrite()
  } catch (error: unknown) {
    if (!applyApiFormError(error, (fields, conflict) => {
      fieldErrors.value = fields
      formError.value = conflict
    })) {
      throw error
    }
  } finally {
    submitting.value = false
  }
}

function askRemove(extra: BookingExtra): void {
  removing.value = extra
  removeError.value = ''
  removeOpen.value = true
}

async function confirmRemove(): Promise<void> {
  if (removing.value === null) {
    return
  }

  removeSubmitting.value = true
  removeError.value = ''

  try {
    await request(`/api/rms/booking-extras/${removing.value.id}`, {
      method: 'DELETE'
    })

    toast.add({ title: t('bookings.extraRemovedToast') })
    removeOpen.value = false
    removing.value = null
    await afterWrite()
  } catch (error: unknown) {
    removeError.value = firstApiMessage(error) ?? (error instanceof Error ? error.message : t('bookings.extrasFailed'))
  } finally {
    removeSubmitting.value = false
  }
}

function onFeeChange(event: Event): void {
  const target = event.target

  if (!(target instanceof HTMLInputElement)) {
    return
  }

  void onFee(target.checked)
}

async function onFee(value: boolean): Promise<void> {
  if (!canWrite.value) {
    return
  }

  feeBusy.value = true

  try {
    const booking = await request(`/api/rms/bookings/${props.booking.id}/fees`, {
      method: 'PATCH',
      body: { tct_collected: value }
    }) as Booking

    toast.add({ title: t('bookings.feesUpdatedToast') })
    await afterWrite(booking)
  } catch (error: unknown) {
    formError.value = firstApiMessage(error) ?? (error instanceof Error ? error.message : t('bookings.extrasFailed'))
  } finally {
    feeBusy.value = false
  }
}
</script>

<template>
  <div>
    <p class="note extras-intro">
      {{ t('bookings.extrasIntro') }}
    </p>
    <p
      v-if="invoiceIssued"
      class="notice"
    >
      {{ t('bookings.extrasInvoiceNotice') }}
    </p>

    <p
      v-if="loading && extras.length === 0"
      class="note"
    >
      {{ t('bookings.extrasLoading') }}
    </p>
    <div
      v-else-if="loadError"
      class="warnbox"
    >
      {{ loadError }}
    </div>

    <div
      v-if="formError"
      class="warnbox"
    >
      {{ formError }}
    </div>

    <table class="list mini-t">
      <thead>
        <tr>
          <th>{{ t('bookings.extraService') }}</th>
          <th>{{ t('bookings.extraQty') }}</th>
          <th>{{ t('bookings.extraRate') }}</th>
          <th>{{ t('bookings.extraAmount') }}</th>
          <th />
        </tr>
      </thead>
      <tbody>
        <tr
          v-if="extras.length === 0"
          class="dr-empty"
        >
          <td colspan="5">
            {{ t('bookings.extrasEmpty') }}
          </td>
        </tr>
        <tr
          v-for="extra in extras"
          :key="extra.id"
        >
          <td>
            {{ extra.name }}
            <div
              v-if="extra.note"
              class="gmeta"
            >
              {{ extra.note }}
            </div>
          </td>
          <td>{{ extra.qty }}</td>
          <td>{{ money(extra.rate_usd) }}</td>
          <td>{{ money(extra.amount) }}</td>
          <td>
            <button
              v-if="canWrite"
              type="button"
              class="mini"
              @click="askRemove(extra)"
            >
              ✕
            </button>
          </td>
        </tr>
        <tr>
          <td
            colspan="3"
            class="extras-sub"
          >
            {{ t('bookings.ancillarySubtotal') }}
          </td>
          <td>
            <b>{{ money(summary.extras_total) }}</b>
          </td>
          <td />
        </tr>
      </tbody>
    </table>

    <div
      v-if="canWrite && activeItems.length > 0"
      class="sec"
    >
      <h4>{{ t('bookings.addService') }}</h4>
      <div class="cols2">
        <div class="field">
          <label for="an-code">{{ t('bookings.extraService') }}</label>
          <USelect
            id="an-code"
            :model-value="addCode"
            class="w-full"
            :items="codeItems"
            @update:model-value="onCodeUpdate"
          />
          <p
            v-if="fieldErrors.code"
            class="pline-err"
          >
            {{ fieldErrors.code }}
          </p>
        </div>
        <div class="field">
          <label for="an-qty">
            {{ t('bookings.extraQty') }}
            <span
              v-if="selectedItem"
              class="cnt"
            >· {{ selectedItem.unit }}</span>
          </label>
          <input
            id="an-qty"
            v-model.number="addQty"
            type="number"
            min="1"
          >
          <p
            v-if="fieldErrors.qty"
            class="pline-err"
          >
            {{ fieldErrors.qty }}
          </p>
        </div>
      </div>
      <div class="cols2">
        <div class="field">
          <label for="an-rate">{{ t('bookings.extraRateUsd') }}</label>
          <input
            id="an-rate"
            v-model="addRate"
            type="number"
            min="0"
          >
          <p
            v-if="fieldErrors.rate_usd"
            class="pline-err"
          >
            {{ fieldErrors.rate_usd }}
          </p>
        </div>
        <div class="field">
          <label for="an-note">{{ t('bookings.extraNote') }}</label>
          <input
            id="an-note"
            v-model="addNote"
            :placeholder="t('bookings.extraNoteHint')"
          >
        </div>
      </div>
      <UButton
        :disabled="submitting"
        :loading="submitting"
        @click="addExtra"
      >
        {{ t('bookings.addToBooking') }}
      </UButton>
    </div>

    <div class="sec">
      <h4>{{ t('bookings.feesHeading') }}</h4>
      <label class="chkline">
        <input
          type="checkbox"
          :checked="summary.tct_collected"
          :disabled="!canWrite || feeBusy"
          @change="onFeeChange($event)"
        >
        {{ feeLabel('tct', feeAmounts) }}
      </label>
      <p class="note extras-fees">
        {{ t('bookings.feesFootnote', { hours: String(summary.extras_due_hours) }) }}
      </p>
    </div>

    <UModal
      :open="removeOpen"
      :title="removing === null ? t('bookings.removeExtra') : t('bookings.removeExtraTitle', { name: removing.name, qty: String(removing.qty) })"
      @update:open="removeOpen = $event"
    >
      <template #body>
        <div
          v-if="removeError"
          class="warnbox"
        >
          {{ removeError }}
        </div>
        <div class="modal-actions">
          <UButton
            variant="outline"
            :disabled="removeSubmitting"
            @click="removeOpen = false"
          >
            {{ t('bookings.cancel') }}
          </UButton>
          <UButton
            :loading="removeSubmitting"
            :disabled="removeSubmitting"
            @click="confirmRemove"
          >
            {{ t('bookings.removeExtra') }}
          </UButton>
        </div>
      </template>
    </UModal>
  </div>
</template>
