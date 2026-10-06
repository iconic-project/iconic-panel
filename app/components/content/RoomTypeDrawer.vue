<script setup lang="ts">
import type { RoomRow, RoomTypeContent } from '../../types/api'
import { firstApiMessage } from '../../utils/apiForm'
import CompletenessMeter from './CompletenessMeter.vue'
import RoomTypePreview from './RoomTypePreview.vue'
import {
  newRoomPayload,
  newRoomTypePayload,
  roomTypeContentPayload,
  roomTypeDraft,
  type NewRoomTypeDraft,
  type RoomTypeDraft
} from './contentPayload'

const open = defineModel<boolean>('open', { required: true })

const props = defineProps<{
  propertyId: number | null
  type: RoomTypeContent | null
  canManage: boolean
  roleName: string
}>()

const emit = defineEmits<{
  saved: [type: RoomTypeContent]
}>()

const { t } = useI18n()
const { request } = useApi()
const toast = useToast()

const blankCreate = (): NewRoomTypeDraft => ({
  code: '',
  name: '',
  base_occupancy: 2,
  max_occupancy: 2,
  max_adults: 2,
  max_children: 0
})

const createDraft = ref<NewRoomTypeDraft>(blankCreate())
const draft = ref<RoomTypeDraft | null>(null)
const rooms = ref<Array<RoomRow>>([])
const roomCode = ref('')
const roomLabel = ref('')
const photoAlt = ref('')
const saving = ref(false)
const error = ref('')
const historyOpen = ref(false)
const roomHistoryId = ref<number | null>(null)

const historyUrl = computed(() => props.type ? `/api/rms/room-types/${props.type.id}/history` : null)
const roomHistoryUrl = computed(() => roomHistoryId.value === null ? null : `/api/rms/rooms/${roomHistoryId.value}/history`)
const photoUrl = computed(() => draft.value?.photos[0]?.url ?? null)

watch(() => [open.value, props.type] as const, ([isOpen, type]) => {
  if (!isOpen) {
    return
  }

  error.value = ''

  if (type) {
    draft.value = roomTypeDraft(type)
    void loadRooms()
    return
  }

  draft.value = null
  createDraft.value = blankCreate()
  rooms.value = []
})

async function loadRooms(): Promise<void> {
  if (props.propertyId === null || props.type === null) {
    rooms.value = []
    return
  }

  const result = await request(`/api/rms/properties/${props.propertyId}/rooms`) as { data: Array<RoomRow> }
  rooms.value = result.data.filter(room => room.room_type.id === props.type?.id)
}

async function createType(): Promise<void> {
  if (props.propertyId === null) {
    return
  }

  saving.value = true
  error.value = ''

  try {
    const created = await request(`/api/rms/properties/${props.propertyId}/room-types`, {
      method: 'POST',
      body: newRoomTypePayload(createDraft.value)
    }) as RoomTypeContent

    toast.add({ title: t('roomTypes.created') })
    emit('saved', created)
  } catch (caught: unknown) {
    error.value = firstApiMessage(caught) ?? (caught instanceof Error ? caught.message : '')
  } finally {
    saving.value = false
  }
}

async function save(): Promise<void> {
  if (props.type === null || draft.value === null) {
    return
  }

  saving.value = true
  error.value = ''

  try {
    const updated = await request(`/api/rms/room-types/${props.type.id}`, {
      method: 'PATCH',
      body: roomTypeContentPayload(draft.value)
    }) as RoomTypeContent

    draft.value = roomTypeDraft(updated)
    toast.add({ title: t('roomTypes.saved') })
    emit('saved', updated)
  } catch (caught: unknown) {
    error.value = firstApiMessage(caught) ?? (caught instanceof Error ? caught.message : '')
  } finally {
    saving.value = false
  }
}

async function onPhoto(event: Event): Promise<void> {
  const target = event.target

  if (!(target instanceof HTMLInputElement) || props.type === null || draft.value === null) {
    return
  }

  const file = target.files?.[0]

  if (!file) {
    return
  }

  if (file.size > 4e6) {
    error.value = t('roomTypes.photoTooLarge')
    target.value = ''
    return
  }

  const alt = photoAlt.value.trim()

  if (alt === '') {
    error.value = t('roomTypes.altRequired')
    target.value = ''
    return
  }

  const body = new FormData()
  body.append('image', file)
  body.append('alt', alt)
  error.value = ''

  try {
    const updated = await request(`/api/rms/room-types/${props.type.id}/photos`, {
      method: 'POST',
      body
    }) as RoomTypeContent

    draft.value = roomTypeDraft(updated)
    photoAlt.value = ''
    emit('saved', updated)
  } catch (caught: unknown) {
    error.value = firstApiMessage(caught) ?? (caught instanceof Error ? caught.message : '')
  } finally {
    target.value = ''
  }
}

function removePhoto(path: string): void {
  if (draft.value === null) {
    return
  }

  draft.value.photos = draft.value.photos.filter(photo => photo.path !== path)
}

async function addRoom(): Promise<void> {
  if (props.propertyId === null || props.type === null) {
    return
  }

  saving.value = true
  error.value = ''

  try {
    await request(`/api/rms/properties/${props.propertyId}/rooms`, {
      method: 'POST',
      body: newRoomPayload(roomCode.value, roomLabel.value, props.type.id)
    })
    roomCode.value = ''
    roomLabel.value = ''
    toast.add({ title: t('roomTypes.roomAdded') })
    await loadRooms()
  } catch (caught: unknown) {
    error.value = firstApiMessage(caught) ?? (caught instanceof Error ? caught.message : '')
  } finally {
    saving.value = false
  }
}

async function deactivate(): Promise<void> {
  if (props.type === null) {
    return
  }

  saving.value = true
  error.value = ''

  try {
    const updated = await request(`/api/rms/room-types/${props.type.id}/deactivate`, {
      method: 'POST'
    }) as RoomTypeContent

    emit('saved', updated)
  } catch (caught: unknown) {
    error.value = firstApiMessage(caught) ?? (caught instanceof Error ? caught.message : '')
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <USlideover
    :open="open"
    class="history-drawer"
    @update:open="open = $event"
  >
    <template #header>
      <div class="itin-header">
        <div>
          <h2>{{ type ? type.name : t('roomTypes.add') }}</h2>
          <div
            v-if="type"
            class="bid"
          >
            <span class="pill">{{ type.code }}</span>
            <span
              class="pill"
              :class="type.engine_visible ? 'p-conf' : 'p-pend'"
            >{{ type.engine_visible ? t('roomTypes.onEngine') : t('roomTypes.hidden') }}</span>
          </div>
        </div>
        <UButton
          v-if="type"
          variant="outline"
          @click="historyOpen = true"
        >
          {{ t('roomTypes.history') }}
        </UButton>
      </div>
    </template>

    <template #body>
      <p
        v-if="!canManage"
        class="notice"
      >
        {{ t('roomTypes.viewOnly', { role: roleName }) }}
      </p>
      <p
        v-if="error"
        class="notice"
      >
        {{ error }}
      </p>

      <form
        v-if="!type"
        @submit.prevent="createType"
      >
        <fieldset
          class="sec"
          :disabled="!canManage || saving"
        >
          <div class="field">
            <label for="room-type-code">{{ t('roomTypes.code') }}</label>
            <input
              id="room-type-code"
              v-model="createDraft.code"
              type="text"
              required
            >
          </div>
          <div class="field">
            <label for="room-type-name">{{ t('roomTypes.name') }}</label>
            <input
              id="room-type-name"
              v-model="createDraft.name"
              type="text"
              required
            >
          </div>
          <div class="field">
            <label for="room-type-base">{{ t('roomTypes.baseOccupancy') }}</label>
            <input
              id="room-type-base"
              v-model.number="createDraft.base_occupancy"
              type="number"
              min="0"
              required
            >
          </div>
          <div class="field">
            <label for="room-type-max">{{ t('roomTypes.maxOccupancy') }}</label>
            <input
              id="room-type-max"
              v-model.number="createDraft.max_occupancy"
              type="number"
              min="1"
              required
            >
          </div>
          <div class="field">
            <label for="room-type-adults">{{ t('roomTypes.maxAdults') }}</label>
            <input
              id="room-type-adults"
              v-model.number="createDraft.max_adults"
              type="number"
              min="1"
              required
            >
          </div>
          <div class="field">
            <label for="room-type-children">{{ t('roomTypes.maxChildren') }}</label>
            <input
              id="room-type-children"
              v-model.number="createDraft.max_children"
              type="number"
              min="0"
              required
            >
          </div>
        </fieldset>
        <div
          v-if="canManage"
          class="acts"
        >
          <UButton
            type="submit"
            :loading="saving"
          >
            {{ t('roomTypes.add') }}
          </UButton>
        </div>
      </form>

      <form
        v-else-if="draft"
        @submit.prevent="save"
      >
        <CompletenessMeter :completeness="type.completeness" />
        <fieldset
          class="sec"
          :disabled="!canManage || saving"
        >
          <h4>{{ t('roomTypes.preview') }}</h4>
          <RoomTypePreview
            :name="draft.name"
            :description="draft.description"
            :bed="draft.bed_setup"
            :amenities="draft.amenities"
            :photo-url="photoUrl"
          />

          <h4>{{ t('roomTypes.occupancy') }}</h4>
          <div class="field">
            <label for="room-type-edit-name">{{ t('roomTypes.name') }}</label>
            <input
              id="room-type-edit-name"
              v-model="draft.name"
              type="text"
              required
            >
          </div>
          <div class="field">
            <label for="room-type-slug">{{ t('roomTypes.slug') }}</label>
            <input
              id="room-type-slug"
              v-model="draft.slug"
              type="text"
            >
          </div>
          <div class="field">
            <label for="room-type-edit-base">{{ t('roomTypes.baseOccupancy') }}</label>
            <input
              id="room-type-edit-base"
              v-model.number="draft.base_occupancy"
              type="number"
              min="0"
            >
          </div>
          <div class="field">
            <label for="room-type-edit-max">{{ t('roomTypes.maxOccupancy') }}</label>
            <input
              id="room-type-edit-max"
              v-model.number="draft.max_occupancy"
              type="number"
              min="1"
            >
          </div>
          <div class="field">
            <label for="room-type-edit-adults">{{ t('roomTypes.maxAdults') }}</label>
            <input
              id="room-type-edit-adults"
              v-model.number="draft.max_adults"
              type="number"
              min="1"
            >
          </div>
          <div class="field">
            <label for="room-type-edit-children">{{ t('roomTypes.maxChildren') }}</label>
            <input
              id="room-type-edit-children"
              v-model.number="draft.max_children"
              type="number"
              min="0"
            >
          </div>
          <div class="field">
            <label for="room-type-sort">{{ t('roomTypes.sort') }}</label>
            <input
              id="room-type-sort"
              v-model.number="draft.sort"
              type="number"
              min="0"
            >
          </div>
          <label class="field">
            <input
              v-model="draft.waitlist_enabled"
              type="checkbox"
            >
            {{ t('roomTypes.waitlist') }}
          </label>

          <h4>{{ t('roomTypes.description') }}</h4>
          <div class="field">
            <label for="room-type-description">{{ t('roomTypes.description') }}</label>
            <textarea
              id="room-type-description"
              v-model="draft.description"
              rows="3"
            />
          </div>
          <div class="field">
            <label for="room-type-size">{{ t('roomTypes.size') }}</label>
            <input
              id="room-type-size"
              v-model="draft.size_sqm"
              type="number"
              min="0"
            >
          </div>
          <div class="field">
            <label for="room-type-bed">{{ t('roomTypes.bed') }}</label>
            <input
              id="room-type-bed"
              v-model="draft.bed_setup"
              type="text"
            >
          </div>
          <div class="field">
            <label for="room-type-amenities">{{ t('roomTypes.amenities') }}</label>
            <textarea
              id="room-type-amenities"
              v-model="draft.amenities"
              rows="3"
            />
            <p class="mono">
              {{ t('roomTypes.amenitiesHint') }}
            </p>
          </div>

          <h4>{{ t('roomTypes.photos') }}</h4>
          <ul>
            <li
              v-for="photo in draft.photos"
              :key="photo.path"
            >
              {{ photo.alt || photo.path }}
              <UButton
                v-if="canManage"
                type="button"
                variant="outline"
                @click="removePhoto(photo.path)"
              >
                {{ t('roomTypes.removePhoto') }}
              </UButton>
            </li>
          </ul>
          <div class="field">
            <label for="room-type-photo-alt">{{ t('roomTypes.alt') }}</label>
            <input
              id="room-type-photo-alt"
              v-model="photoAlt"
              type="text"
            >
          </div>
          <div class="field">
            <label for="room-type-photo">{{ t('roomTypes.upload') }}</label>
            <input
              id="room-type-photo"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              :disabled="!canManage"
              @change="onPhoto"
            >
          </div>

          <h4>{{ t('roomTypes.seo') }}</h4>
          <div class="field">
            <label for="room-type-seo-title">{{ t('roomTypes.seoTitle') }}</label>
            <input
              id="room-type-seo-title"
              v-model="draft.meta_title"
              type="text"
              maxlength="60"
            >
          </div>
          <div class="field">
            <label for="room-type-seo-description">{{ t('roomTypes.seoDescription') }}</label>
            <textarea
              id="room-type-seo-description"
              v-model="draft.meta_description"
              rows="3"
              maxlength="155"
            />
          </div>
        </fieldset>
        <div
          v-if="canManage"
          class="acts"
        >
          <UButton
            type="submit"
            :loading="saving"
          >
            {{ t('roomTypes.save') }}
          </UButton>
          <UButton
            v-if="type.status === 'ACTIVE'"
            type="button"
            variant="outline"
            :loading="saving"
            @click="deactivate"
          >
            {{ t('roomTypes.deactivate') }}
          </UButton>
        </div>

        <div class="sec">
          <h4>{{ t('roomTypes.rooms') }}</h4>
          <ul>
            <li
              v-for="room in rooms"
              :key="room.id"
            >
              {{ room.code }} · {{ room.label }}
              <UButton
                type="button"
                variant="outline"
                @click="roomHistoryId = room.id"
              >
                {{ t('roomTypes.history') }}
              </UButton>
            </li>
          </ul>
          <div
            v-if="canManage"
            class="field"
          >
            <label for="room-code">{{ t('roomTypes.roomCode') }}</label>
            <input
              id="room-code"
              v-model="roomCode"
              type="text"
            >
          </div>
          <div
            v-if="canManage"
            class="field"
          >
            <label for="room-label">{{ t('roomTypes.roomLabel') }}</label>
            <input
              id="room-label"
              v-model="roomLabel"
              type="text"
            >
          </div>
          <UButton
            v-if="canManage"
            type="button"
            :loading="saving"
            @click="addRoom"
          >
            {{ t('roomTypes.addRoom') }}
          </UButton>
        </div>
      </form>
    </template>
  </USlideover>

  <HistoryDrawer
    v-model:open="historyOpen"
    :title="type?.name ?? ''"
    :subject-type="t('roomTypes.subject')"
    :url="historyUrl"
  />
  <HistoryDrawer
    :open="roomHistoryId !== null"
    :title="rooms.find(room => room.id === roomHistoryId)?.code ?? ''"
    :subject-type="t('roomTypes.roomSubject')"
    :url="roomHistoryUrl"
    @update:open="roomHistoryId = $event ? roomHistoryId : null"
  />
</template>
