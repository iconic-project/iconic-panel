/**
 * Same retired-inventory rule as iconic-api tests/Arch/VocabularyTest.php.
 * Legitimate hotel uses are allowlisted per file, with the reason in the set below.
 */

const pattern = /departure(?!s? time)|yacht|cabin|itinerar|voyage|cruise|\bpng\b|ppdo|embark/i

/** @type {Record<string, string>} */
const allow = {
  'app/pages/rms/reservations/front-desk.vue': 'departures are guests leaving today',
  'app/components/bookings/stayBooking.ts': 'front-desk tab for guests leaving',
  'app/pages/rms/inventory/restrictions.vue': 'closed_to_departure is a stay restriction',
  'app/components/restrictions/restrictionEditor.ts': 'closed_to_departure is a stay restriction',
  'app/components/bookings/StayReservationModal.vue': 'closed_to_departure is a stay restriction',
  'app/components/content/RoomTypeDrawer.vue': 'image/png is a file type',
  'app/components/content/PropertyEditor.vue': 'image/png is a file type',
  'app/components/history/describe.ts': 'stored history event names and payload keys',
  'app/components/guests/BookingGuestsTab.vue': 'age_at_departure is still the guest API field',
  'app/components/agencies/AgencyDrawer.vue': 'departure_date is still the booking API field',
  'app/components/crm/JourneyTemplatePanel.vue': 'departure_date is a stored template variable',
  'app/components/extras/extraHelpers.ts': 'png is still the API fee code',
  'app/components/agencies/agencyHelpers.ts': 'ITINERARY_PDF is the stored sales-material value'
}

/** @type {import('eslint').ESLint.Plugin} */
const plugin = {
  meta: { name: 'vocabulary' },
  rules: {
    'no-retired-vocabulary': {
      meta: {
        type: 'problem',
        docs: { description: 'Block retired yacht inventory words in panel source.' },
        schema: []
      },
      create(context) {
        const filename = context.filename.replaceAll('\\', '/')
        const marker = '/app/'
        const at = filename.lastIndexOf(marker)

        if (at === -1) {
          return {}
        }

        const rel = filename.slice(at + 1)

        if (rel in allow) {
          return {}
        }

        /**
         * @param {import('eslint').Rule.Node} node
         * @param {string} text
         */
        function check(node, text) {
          if (text === '' || !pattern.test(text)) {
            return
          }

          context.report({
            node,
            message: `Retired inventory word in "${text.slice(0, 80)}".`
          })
        }

        return {
          Identifier(node) {
            check(node, node.name)
          },
          Literal(node) {
            if (typeof node.value === 'string') {
              check(node, node.value)
            }
          },
          TemplateElement(node) {
            check(node, node.value.raw)
          }
        }
      }
    }
  }
}

export default plugin
