<script setup lang="ts">
import { linesToList } from '../../utils/linesToList'

const props = defineProps<{
  name: string
  description: string
  bed: string
  amenities: string
  photoUrl: string | null
}>()

const { t } = useI18n()

const amenityList = computed(() => linesToList(props.amenities))
</script>

<template>
  <div class="itc">
    <div
      class="im"
      :style="photoUrl ? { background: `url(${photoUrl}) center / cover` } : undefined"
    >
      <span
        v-if="!photoUrl"
        class="mono noimg"
      >{{ t('roomTypes.noPhoto') }}</span>
    </div>
    <div class="bd">
      <h4>{{ name }}</h4>
      <p>{{ description }}</p>
      <p
        v-if="bed"
        class="mono"
      >
        {{ bed }}
      </p>
      <div class="itmeta">
        <span
          v-for="amenity in amenityList"
          :key="amenity"
        >{{ amenity }}</span>
      </div>
    </div>
  </div>
</template>
