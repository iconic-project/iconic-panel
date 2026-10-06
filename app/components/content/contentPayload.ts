import type { PropertyContent, RoomTypeContent, RoomTypePhoto } from '../../types/api'
import { linesToList } from '../../utils/linesToList'

export type PropertyDraft = {
  name: string
  slug: string
  address_line_1: string
  address_line_2: string
  city: string
  postcode: string
  country: string
  phone: string
  email: string
  description: string
  hero_alt: string
  highlights: string
  facts: string
  faqs: string
  policies_text: string
  meta_title: string
  meta_description: string
}

export type PropertyContentPayload = {
  name: string
  slug: string | null
  address_line_1: string | null
  address_line_2: string | null
  city: string | null
  postcode: string | null
  country: string | null
  phone: string | null
  email: string | null
  description: string | null
  hero_alt: string | null
  highlights: Array<string> | null
  facts: Array<[string, string]> | null
  faqs: Array<[string, string]> | null
  policies_text: string | null
  meta_title: string | null
  meta_description: string | null
}

export type RoomTypeDraft = {
  name: string
  slug: string
  base_occupancy: number
  max_occupancy: number
  max_adults: number
  max_children: number
  waitlist_enabled: boolean
  sort: number
  description: string
  size_sqm: string
  bed_setup: string
  amenities: string
  photos: Array<RoomTypePhoto>
  meta_title: string
  meta_description: string
}

export type RoomTypeContentPayload = {
  name: string
  slug: string | null
  base_occupancy: number
  max_occupancy: number
  max_adults: number
  max_children: number
  waitlist_enabled: boolean
  sort: number
  description: string | null
  size_sqm: number | null
  bed_setup: string | null
  amenities: Array<string> | null
  photos: Array<{ path: string, alt: string | null }>
  meta_title: string | null
  meta_description: string | null
}

export type NewRoomTypeDraft = {
  code: string
  name: string
  base_occupancy: number
  max_occupancy: number
  max_adults: number
  max_children: number
}

export type NewRoomTypePayload = {
  code: string
  name: string
  base_occupancy: number
  max_occupancy: number
  max_adults: number
  max_children: number
}

export type NewRoomPayload = {
  code: string
  label: string
  room_type_id: number
}

function emptyToNull(value: string): string | null {
  const trimmed = value.trim()

  return trimmed === '' ? null : trimmed
}

function listOrNull(text: string): Array<string> | null {
  const list = linesToList(text)

  return list.length === 0 ? null : list
}

export function pairsToLines(pairs: Array<[string, string]> | null): string {
  return (pairs ?? []).map(([left, right]) => `${left} | ${right}`).join('\n')
}

export function pairsFromLines(text: string): Array<[string, string]> | null {
  const pairs: Array<[string, string]> = []

  for (const line of linesToList(text)) {
    const splitAt = line.indexOf('|')

    if (splitAt === -1) {
      continue
    }

    const left = line.slice(0, splitAt).trim()
    const right = line.slice(splitAt + 1).trim()

    if (left === '' || right === '') {
      continue
    }

    pairs.push([left, right])
  }

  return pairs.length === 0 ? null : pairs
}

export function propertyDraft(property: PropertyContent): PropertyDraft {
  return {
    name: property.name,
    slug: property.slug ?? '',
    address_line_1: property.address_line_1 ?? '',
    address_line_2: property.address_line_2 ?? '',
    city: property.city ?? '',
    postcode: property.postcode ?? '',
    country: property.country ?? '',
    phone: property.phone ?? '',
    email: property.email ?? '',
    description: property.description ?? '',
    hero_alt: property.hero_alt ?? '',
    highlights: (property.highlights ?? []).join('\n'),
    facts: pairsToLines(property.facts),
    faqs: pairsToLines(property.faqs),
    policies_text: property.policies_text ?? '',
    meta_title: property.meta_title ?? '',
    meta_description: property.meta_description ?? ''
  }
}

export function propertyContentPayload(draft: PropertyDraft): PropertyContentPayload {
  return {
    name: draft.name.trim(),
    slug: emptyToNull(draft.slug),
    address_line_1: emptyToNull(draft.address_line_1),
    address_line_2: emptyToNull(draft.address_line_2),
    city: emptyToNull(draft.city),
    postcode: emptyToNull(draft.postcode),
    country: emptyToNull(draft.country),
    phone: emptyToNull(draft.phone),
    email: emptyToNull(draft.email),
    description: emptyToNull(draft.description),
    hero_alt: emptyToNull(draft.hero_alt),
    highlights: listOrNull(draft.highlights),
    facts: pairsFromLines(draft.facts),
    faqs: pairsFromLines(draft.faqs),
    policies_text: emptyToNull(draft.policies_text),
    meta_title: emptyToNull(draft.meta_title),
    meta_description: emptyToNull(draft.meta_description)
  }
}

function whole(value: number | string): number {
  const parsed = Number(value)

  return Number.isFinite(parsed) ? Math.trunc(parsed) : 0
}

export function roomTypeDraft(type: RoomTypeContent): RoomTypeDraft {
  return {
    name: type.name,
    slug: type.slug ?? '',
    base_occupancy: type.base_occupancy,
    max_occupancy: type.max_occupancy,
    max_adults: type.max_adults,
    max_children: type.max_children,
    waitlist_enabled: type.waitlist_enabled,
    sort: type.sort,
    description: type.description ?? '',
    size_sqm: type.size_sqm === null ? '' : String(type.size_sqm),
    bed_setup: type.bed_setup ?? '',
    amenities: (type.amenities ?? []).join('\n'),
    photos: type.photos ?? [],
    meta_title: type.meta_title ?? '',
    meta_description: type.meta_description ?? ''
  }
}

export function roomTypeContentPayload(draft: RoomTypeDraft): RoomTypeContentPayload {
  const size = draft.size_sqm.trim()

  return {
    name: draft.name.trim(),
    slug: emptyToNull(draft.slug),
    base_occupancy: whole(draft.base_occupancy),
    max_occupancy: whole(draft.max_occupancy),
    max_adults: whole(draft.max_adults),
    max_children: whole(draft.max_children),
    waitlist_enabled: draft.waitlist_enabled,
    sort: whole(draft.sort),
    description: emptyToNull(draft.description),
    size_sqm: size === '' ? null : whole(size),
    bed_setup: emptyToNull(draft.bed_setup),
    amenities: listOrNull(draft.amenities),
    photos: draft.photos.map(photo => ({
      path: photo.path,
      alt: photo.alt
    })),
    meta_title: emptyToNull(draft.meta_title),
    meta_description: emptyToNull(draft.meta_description)
  }
}

export function newRoomTypePayload(draft: NewRoomTypeDraft): NewRoomTypePayload {
  return {
    code: draft.code.trim(),
    name: draft.name.trim(),
    base_occupancy: whole(draft.base_occupancy),
    max_occupancy: whole(draft.max_occupancy),
    max_adults: whole(draft.max_adults),
    max_children: whole(draft.max_children)
  }
}

export function newRoomPayload(code: string, label: string, roomTypeId: number): NewRoomPayload {
  return {
    code: code.trim(),
    label: label.trim(),
    room_type_id: roomTypeId
  }
}
