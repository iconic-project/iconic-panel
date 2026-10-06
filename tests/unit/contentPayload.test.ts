import { describe, expect, it } from 'vitest'
import {
  newRoomPayload,
  newRoomTypePayload,
  pairsFromLines,
  propertyContentPayload,
  propertyDraft,
  roomTypeContentPayload,
  roomTypeDraft
} from '../../app/components/content/contentPayload'
import type { PropertyContent, RoomTypeContent } from '../../app/types/api'

const property: PropertyContent = {
  id: 1,
  code: 'HTL',
  name: 'Hotel Demo',
  slug: 'hotel-demo',
  timezone: null,
  address_line_1: '1 Demo Street',
  address_line_2: null,
  city: 'Demo City',
  postcode: '00000',
  country: null,
  phone: '+1-555-0100',
  email: 'stay@hotel-demo.test',
  description: 'Demo hotel.',
  hero_image_path: 'properties/hotel-demo-hero.jpg',
  hero_alt: 'Hotel Demo exterior',
  hero_image_url: '/storage/properties/hotel-demo-hero.jpg',
  highlights: ['24 rooms'],
  facts: [['Rooms', '24']],
  faqs: [['Live?', 'No.']],
  policies_text: 'Quiet hours.',
  meta_title: 'Hotel Demo',
  meta_description: 'Demo hotel.',
  completeness: { pct: 100, missing: [], blocking: [] },
  status: 'ACTIVE',
  rooms: []
}

describe('propertyContentPayload', () => {
  it('omits the hero path and turns blanks into null', () => {
    const draft = propertyDraft(property)
    draft.description = 'E2E property description'
    draft.slug = '  '
    draft.highlights = '24 rooms\n\n'
    draft.facts = 'Rooms | 24\nnot a pair\n'

    const payload = propertyContentPayload(draft)

    expect(payload).not.toHaveProperty('hero_image_path')
    expect(payload).not.toHaveProperty('code')
    expect(payload.description).toBe('E2E property description')
    expect(payload.slug).toBeNull()
    expect(payload.country).toBeNull()
    expect(payload.highlights).toEqual(['24 rooms'])
    expect(payload.facts).toEqual([['Rooms', '24']])
    expect(pairsFromLines('')).toBeNull()
  })
})

describe('roomTypeContentPayload', () => {
  it('sends occupancy, existing photo paths and no invented url', () => {
    const type: RoomTypeContent = {
      id: 4,
      property_id: 1,
      code: 'STD',
      name: 'Standard Double',
      base_occupancy: 2,
      max_occupancy: 2,
      max_adults: 2,
      max_children: 0,
      waitlist_enabled: true,
      sort: 1,
      status: 'ACTIVE',
      slug: 'standard-double',
      description: 'Demo double room.',
      size_sqm: 22,
      bed_setup: '1 double bed',
      amenities: ['Wifi'],
      photos: [{ path: 'room-types/standard-double.jpg', alt: 'Standard double room', url: '/storage/room-types/standard-double.jpg' }],
      meta_title: 'Standard Double',
      meta_description: 'Demo double room for two guests.',
      completeness: { pct: 100, missing: [], blocking: [] },
      engine_visible: true
    }

    const payload = roomTypeContentPayload(roomTypeDraft(type))

    expect(payload.photos).toEqual([
      { path: 'room-types/standard-double.jpg', alt: 'Standard double room' }
    ])
    expect(payload.base_occupancy).toBe(2)
    expect(payload.size_sqm).toBe(22)
    expect(payload).not.toHaveProperty('code')
    expect(payload).not.toHaveProperty('status')
  })
})

describe('new room payloads', () => {
  it('trims code and name and keeps occupancy numbers', () => {
    expect(newRoomTypePayload({
      code: ' E2E ',
      name: ' E2E Garden ',
      base_occupancy: 2,
      max_occupancy: 2,
      max_adults: 2,
      max_children: 0
    })).toEqual({
      code: 'E2E',
      name: 'E2E Garden',
      base_occupancy: 2,
      max_occupancy: 2,
      max_adults: 2,
      max_children: 0
    })

    expect(newRoomPayload(' E1 ', ' E2E 1 ', 9)).toEqual({
      code: 'E1',
      label: 'E2E 1',
      room_type_id: 9
    })
  })
})
