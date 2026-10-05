import type { NavGroup } from './types'

export const rmsNav: Array<NavGroup> = [
  {
    id: 'reservations',
    labelKey: 'nav.rms.reservations',
    items: [
      {
        id: 'booking-requests',
        labelKey: 'nav.rms.bookingRequests',
        glyph: '◍',
        to: '/rms/reservations/booking-requests',
        sprint: 4,
        badge: true,
        permission: ['requests.confirm', 'requests.release']
      },
      {
        id: 'calendar',
        labelKey: 'nav.rms.calendar',
        glyph: '◫',
        to: '/rms/reservations/calendar',
        sprint: 3
      },
      {
        id: 'bookings',
        labelKey: 'nav.rms.bookings',
        glyph: '≣',
        to: '/rms/reservations/bookings',
        sprint: 4
      },
      {
        id: 'front-desk',
        labelKey: 'nav.rms.frontDesk',
        glyph: '⌂',
        to: '/rms/reservations/front-desk',
        sprint: 19
      }
    ]
  },
  {
    id: 'commercial',
    labelKey: 'nav.rms.commercial',
    items: [
      {
        id: 'dashboard',
        labelKey: 'nav.rms.dashboard',
        glyph: '▣',
        to: '/rms/commercial/dashboard',
        sprint: 12,
        permission: 'panel.rms'
      },
      {
        id: 'reports',
        labelKey: 'nav.rms.reports',
        glyph: '▤',
        to: '/rms/commercial/reports',
        sprint: 12,
        permission: 'panel.rms'
      },
      {
        id: 'payments',
        labelKey: 'nav.rms.payments',
        glyph: '◈',
        to: '/rms/commercial/payments',
        sprint: 5,
        permission: 'bookings.view_all'
      },
      {
        id: 'rates',
        labelKey: 'nav.rms.rates',
        glyph: '◆',
        to: '/rms/commercial/rates',
        sprint: 2
      },
      {
        id: 'b2b',
        labelKey: 'nav.rms.b2b',
        glyph: '⬡',
        to: '/rms/commercial/b2b',
        sprint: 5,
        permission: ['agencies.manage', 'bookings.view_all']
      },
      {
        id: 'contacts-in',
        labelKey: 'nav.rms.contactsIn',
        glyph: '◉',
        to: '/rms/commercial/contacts-in',
        sprint: 6,
        permission: 'panel.rms'
      }
    ]
  },
  {
    id: 'inventory',
    labelKey: 'nav.rms.inventory',
    items: [
      {
        id: 'restrictions',
        labelKey: 'nav.rms.restrictions',
        glyph: '▦',
        to: '/rms/inventory/restrictions',
        sprint: 17,
        permission: 'panel.rms'
      }
    ]
  },
  {
    id: 'operations',
    labelKey: 'nav.rms.operations',
    items: [
      {
        id: 'holds',
        labelKey: 'nav.rms.holds',
        glyph: '◔',
        to: '/rms/operations/holds',
        sprint: 4
      },
      {
        id: 'refunds',
        labelKey: 'nav.rms.refunds',
        glyph: '↺',
        to: '/rms/operations/refunds',
        sprint: 5,
        permission: ['refunds.approve', 'refunds.execute']
      },
      {
        id: 'blocks',
        labelKey: 'nav.rms.blocks',
        glyph: '▦',
        to: '/rms/operations/blocks',
        sprint: 3
      },
      {
        id: 'documents',
        labelKey: 'nav.rms.documents',
        glyph: '▤',
        to: '/rms/operations/documents',
        sprint: 7,
        permission: 'panel.rms'
      },
      {
        id: 'alerts',
        labelKey: 'nav.rms.alerts',
        glyph: '▲',
        to: '/rms/operations/alerts',
        sprint: 11,
        permission: 'panel.rms'
      },
      {
        id: 'guest-experience',
        labelKey: 'nav.rms.guestExperience',
        glyph: '✧',
        to: '/rms/operations/guest-experience',
        sprint: 11
      }
    ]
  },
  {
    id: 'booking-engine',
    labelKey: 'nav.rms.bookingEngine',
    items: [
      {
        id: 'itineraries',
        labelKey: 'nav.rms.itineraries',
        glyph: '◇',
        to: '/rms/booking-engine/itineraries',
        sprint: 3
      },
      {
        id: 'departures',
        labelKey: 'nav.rms.departures',
        glyph: '◷',
        to: '/rms/booking-engine/departures',
        sprint: 3
      },
      {
        id: 'offers',
        labelKey: 'nav.rms.offers',
        glyph: '✦',
        to: '/rms/booking-engine/offers',
        sprint: 8
      },
      {
        id: 'settings',
        labelKey: 'nav.rms.engineSettings',
        glyph: '⚙',
        to: '/rms/booking-engine/settings',
        sprint: 2
      },
      {
        id: 'map',
        labelKey: 'nav.rms.engineMap',
        glyph: '⌗',
        to: '/rms/booking-engine/map',
        sprint: 8
      }
    ]
  },
  {
    id: 'admin',
    labelKey: 'nav.rms.admin',
    items: [
      {
        id: 'permissions',
        labelKey: 'nav.rms.permissions',
        glyph: '◈',
        to: '/rms/admin/permissions',
        sprint: 1,
        permission: ['users.manage', 'roles.manage']
      },
      {
        id: 'business-rules',
        labelKey: 'nav.rms.businessRules',
        glyph: '⚖',
        to: '/rms/admin/business-rules',
        sprint: 2,
        permission: 'rules.view'
      }
    ]
  }
]
