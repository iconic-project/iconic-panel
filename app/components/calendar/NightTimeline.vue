<script setup lang="ts">
import type { NightCalendar, NightCell, NightRoom } from '../../types/api'
import { addDays } from '../lists/dateRange'
import { freeNightsBetween, nightOccupancyPct, placeBars, spansFromCells, type NightBar } from './nightCalendar'

const props = defineProps<{
  grid: NightCalendar
  canBlock: boolean
}>()

const emit = defineEmits<{
  openBooking: [id: number]
  openBlock: [id: number]
  blockNights: [stay: { roomId: number, checkIn: string, checkOut: string }]
}>()

const { t } = useI18n()
const { format } = useDates()

const collapsed = ref<Record<number, boolean>>({})

type TypeGroup = {
  id: number
  code: string
  name: string
  rooms: Array<NightRoom>
}

const groups = computed(() => {
  const grouped = new Map<number, TypeGroup>()

  for (const room of [...props.grid.rooms].sort((left, right) => left.sort - right.sort)) {
    const type = room.room_type
    const existing = grouped.get(type.id)

    if (existing === undefined) {
      grouped.set(type.id, { id: type.id, code: type.code, name: type.name, rooms: [room] })
    } else {
      existing.rooms.push(room)
    }
  }

  return [...grouped.values()]
})

const drag = ref<{ roomId: number, anchor: string, current: string } | null>(null)

function barsFor(room: NightRoom): Array<NightBar> {
  return placeBars(spansFromCells(room.cells), props.grid.nights)
}

function countsFor(night: string): Array<{ free: number, held: number, sold: number }> {
  return Object.values(props.grid.counts[night] ?? {})
}

function freeFor(night: string, code: string): number {
  return props.grid.counts[night]?.[code]?.free ?? 0
}

function toggleType(id: number): void {
  collapsed.value = { ...collapsed.value, [id]: !collapsed.value[id] }
}

function ordered(left: string, right: string): [string, string] {
  return left <= right ? [left, right] : [right, left]
}

function dragging(roomId: number, night: string): boolean {
  if (drag.value === null || drag.value.roomId !== roomId) {
    return false
  }

  const [from, to] = ordered(drag.value.anchor, drag.value.current)

  return night >= from && night <= to
}

function onPointerDown(room: NightRoom, cell: NightCell, event: PointerEvent): void {
  if (!props.canBlock || cell.state !== 'FREE') {
    return
  }

  const target = event.currentTarget

  if (target instanceof HTMLElement) {
    target.setPointerCapture(event.pointerId)
  }

  drag.value = { roomId: room.id, anchor: cell.night, current: cell.night }
}

function onPointerEnter(room: NightRoom, cell: NightCell): void {
  if (drag.value === null || drag.value.roomId !== room.id) {
    return
  }

  const [from, to] = ordered(drag.value.anchor, cell.night)

  if (!freeNightsBetween(room.cells, from, to)) {
    return
  }

  drag.value = { ...drag.value, current: cell.night }
}

function onPointerUp(): void {
  if (drag.value === null) {
    return
  }

  const [from, to] = ordered(drag.value.anchor, drag.value.current)
  const roomId = drag.value.roomId
  drag.value = null
  emit('blockNights', { roomId, checkIn: from, checkOut: addDays(to, 1) })
}

function onBar(bar: NightBar): void {
  if (bar.holderType === 'booking') {
    emit('openBooking', bar.holderId)
    return
  }

  if (bar.holderType === 'internal_block') {
    emit('openBlock', bar.holderId)
  }
}
</script>

<template>
  <div
    class="night-scroll"
    :style="{ '--cols': grid.nights.length }"
  >
    <div class="night-row night-head">
      <div class="night-label">
        {{ t('calendar.occupancy') }}
      </div>
      <div
        v-for="night in grid.nights"
        :key="`occ-${night}`"
        class="night-cell night-meta"
      >
        <span>{{ format(night, 'short') }}</span>
        <strong>{{ nightOccupancyPct(countsFor(night)) }}%</strong>
      </div>
    </div>

    <div
      v-for="group in groups"
      :key="`free-${group.id}`"
      class="night-row night-head"
    >
      <div class="night-label">
        {{ t('calendar.freeOf', { name: group.name }) }}
      </div>
      <div
        v-for="night in grid.nights"
        :key="`free-${group.code}-${night}`"
        class="night-cell night-meta"
      >
        {{ freeFor(night, group.code) }}
      </div>
    </div>

    <template
      v-for="group in groups"
      :key="group.id"
    >
      <button
        type="button"
        class="night-type"
        @click="toggleType(group.id)"
      >
        {{ collapsed[group.id] ? t('calendar.typeCollapsed', { name: group.name }) : t('calendar.typeOpen', { name: group.name }) }}
      </button>
      <template v-if="!collapsed[group.id]">
        <div
          v-for="room in group.rooms"
          :key="room.id"
          class="night-row"
        >
          <div class="night-label">
            <span>{{ room.label }}</span>
            <small>{{ room.code }}</small>
          </div>
          <button
            v-for="(cell, index) in room.cells"
            :key="cell.night"
            type="button"
            class="night-cell"
            :class="[cell.state, { drag: dragging(room.id, cell.night) }]"
            :style="{ gridColumn: index + 2 }"
            :aria-label="`${room.label} ${cell.night}`"
            @pointerdown="onPointerDown(room, cell, $event)"
            @pointerenter="onPointerEnter(room, cell)"
            @pointerup="onPointerUp"
          />
          <button
            v-for="bar in barsFor(room)"
            :key="bar.claimGroup"
            type="button"
            class="night-bar"
            :class="[bar.state, { clipStart: bar.clippedStart, clipEnd: bar.clippedEnd }]"
            :style="{ gridColumn: `${bar.startIndex + 2} / span ${bar.span}` }"
            @click="onBar(bar)"
          >
            {{ bar.label || t('calendar.unnamed') }}
          </button>
        </div>
      </template>
    </template>
  </div>
</template>
