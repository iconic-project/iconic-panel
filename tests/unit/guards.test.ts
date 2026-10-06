import { describe, expect, it } from 'vitest'
import {
  firstAllowedHome,
  loginTarget,
  pageDecision,
  sanitizeRedirect,
  sectionDecision,
  visibleNav
} from '../../app/navigation/guards'
import type { Permission } from '../../app/types/api'
import type { Section } from '../../app/navigation/types'
import { CRM_HOME, RMS_HOME, sections } from '../../app/sections'

const fixture: Section = {
  id: 'rms',
  labelKey: 'shell.rms',
  home: RMS_HOME,
  brandSubtitleKey: 'shell.brandRms',
  nav: [
    {
      id: 'reservations',
      labelKey: 'nav.rms.reservations',
      items: [
        {
          id: 'bookings',
          labelKey: 'nav.rms.bookings',
          glyph: '≣',
          to: '/rms/reservations/bookings',
          sprint: 4
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
}

function allow(...held: Array<Permission>) {
  const set = new Set<string>(held)
  return (permission: Permission) => set.has(permission)
}

function sectionsOf(...ids: Array<'rms' | 'crm'>) {
  const set = new Set(ids)
  return (id: 'rms' | 'crm') => set.has(id)
}

describe('sanitizeRedirect', () => {
  it('rejects /\\evil.com', () => {
    expect(sanitizeRedirect('/\\evil.com')).toBeNull()
  })

  it('rejects //evil.com', () => {
    expect(sanitizeRedirect('//evil.com')).toBeNull()
  })

  it('rejects /login', () => {
    expect(sanitizeRedirect('/login')).toBeNull()
  })

  it('rejects https://x', () => {
    expect(sanitizeRedirect('https://x')).toBeNull()
  })

  it('accepts /rms/reservations/bookings', () => {
    expect(sanitizeRedirect('/rms/reservations/bookings')).toBe('/rms/reservations/bookings')
  })

  it('rejects auth paths, /no-access, and non-strings', () => {
    expect(sanitizeRedirect('/forgot-password')).toBeNull()
    expect(sanitizeRedirect('/reset-password?token=a')).toBeNull()
    expect(sanitizeRedirect('/accept-invitation?email=a')).toBeNull()
    expect(sanitizeRedirect('/no-access')).toBeNull()
    expect(sanitizeRedirect(null)).toBeNull()
    expect(sanitizeRedirect(['/rms/reservations/bookings'])).toBeNull()
  })
})

describe('loginTarget', () => {
  it('returns plain /login when sanitizeRedirect is null', () => {
    expect(loginTarget(null)).toBe('/login')
    expect(loginTarget('/login')).toBe('/login')
    expect(loginTarget('//evil.com')).toBe('/login')
  })

  it('passes through a safe path as the redirect query', () => {
    expect(loginTarget('/rms/reservations/bookings')).toEqual({
      path: '/login',
      query: { redirect: '/rms/reservations/bookings' }
    })
  })
})

describe('visibleNav', () => {
  it('hides gated items and empty groups', () => {
    const nav = visibleNav(fixture, allow('bookings.create'))

    expect(nav).toHaveLength(1)
    expect(nav[0]?.id).toBe('reservations')
    expect(nav[0]?.items.map(item => item.id)).toEqual(['bookings'])
  })

  it('shows Permissions when the user has any listed permission', () => {
    const nav = visibleNav(fixture, allow('users.manage'))
    const admin = nav.find(group => group.id === 'admin')

    expect(admin?.items.map(item => item.id)).toEqual(['permissions'])
  })

  it('shows Business Rules only with rules.view', () => {
    const withRules = visibleNav(fixture, allow('rules.view'))
    const without = visibleNav(fixture, allow('bookings.create'))

    expect(withRules.find(group => group.id === 'admin')?.items.map(item => item.id)).toEqual(['business-rules'])
    expect(without.find(group => group.id === 'admin')).toBeUndefined()
  })
})

describe('sectionDecision', () => {
  it('sends / to the first allowed section home', () => {
    expect(sectionDecision('/', sectionsOf('rms', 'crm'))).toBe(RMS_HOME)
    expect(sectionDecision('/', sectionsOf('crm'))).toBe(CRM_HOME)
    expect(sectionDecision('/', sectionsOf())).toBe('/no-access')
  })

  it('sends a signed-in user with a section away from /no-access', () => {
    expect(sectionDecision('/no-access', sectionsOf('rms'))).toBe(RMS_HOME)
    expect(sectionDecision('/no-access', sectionsOf('crm'))).toBe(CRM_HOME)
  })

  it('leaves /no-access when the user has neither section', () => {
    expect(sectionDecision('/no-access', sectionsOf())).toBeNull()
  })

  it('redirects a missing section to the other home or /no-access', () => {
    expect(sectionDecision('/crm/sales/pipeline', sectionsOf('rms'))).toBe(RMS_HOME)
    expect(sectionDecision('/rms/reservations/bookings', sectionsOf('crm'))).toBe(CRM_HOME)
    expect(sectionDecision('/rms/reservations/bookings', sectionsOf())).toBe('/no-access')
  })
})

describe('pageDecision', () => {
  it('sends a forbidden nav URL to the section home', () => {
    expect(pageDecision('/rms/admin/permissions', allow('bookings.create'))).toEqual({
      to: RMS_HOME,
      toast: true
    })
    expect(pageDecision('/rms/admin/business-rules', allow('bookings.create'))).toEqual({
      to: RMS_HOME,
      toast: true
    })
  })

  it('allows a permitted or ungated page', () => {
    expect(pageDecision('/rms/admin/permissions', allow('roles.manage'))).toBeNull()
    expect(pageDecision('/rms/reservations/bookings', allow())).toBeNull()
  })
})

describe('firstAllowedHome', () => {
  it('prefers RMS, then CRM, then /no-access', () => {
    expect(firstAllowedHome(sectionsOf('rms', 'crm'))).toBe(RMS_HOME)
    expect(firstAllowedHome(sectionsOf('crm'))).toBe(CRM_HOME)
    expect(firstAllowedHome(sectionsOf())).toBe('/no-access')
  })
})

describe('seeded admin nav', () => {
  it('hides Booking Requests without confirm or release, and still shows Holds', () => {
    const finance = visibleNav(sections.rms, allow('panel.rms', 'bookings.view_all'))
    const reservations = finance.find(group => group.id === 'reservations')
    const operations = finance.find(group => group.id === 'operations')

    expect(reservations?.items.map(item => item.id)).not.toContain('booking-requests')
    expect(operations?.items.map(item => item.id)).toContain('holds')
    expect(pageDecision('/rms/reservations/booking-requests', allow('panel.rms', 'bookings.view_all'))).toEqual({
      to: RMS_HOME,
      toast: true
    })
  })

  it('hides Refund Approvals without approve or execute', () => {
    const hidden = visibleNav(sections.rms, allow('panel.rms', 'bookings.view_all'))
    const shownApprove = visibleNav(sections.rms, allow('panel.rms', 'refunds.approve'))
    const shownExecute = visibleNav(sections.rms, allow('panel.rms', 'refunds.execute'))

    expect(hidden.find(group => group.id === 'operations')?.items.map(item => item.id)).not.toContain('refunds')
    expect(shownApprove.find(group => group.id === 'operations')?.items.map(item => item.id)).toContain('refunds')
    expect(shownExecute.find(group => group.id === 'operations')?.items.map(item => item.id)).toContain('refunds')
    expect(pageDecision('/rms/operations/refunds', allow('panel.rms', 'bookings.view_all'))).toEqual({
      to: RMS_HOME,
      toast: true
    })
  })

  it('hides B2B without agencies.manage or bookings.view_all', () => {
    const hidden = visibleNav(sections.rms, allow('panel.rms', 'bookings.create'))
    const shownManage = visibleNav(sections.rms, allow('panel.rms', 'agencies.manage'))
    const shownView = visibleNav(sections.rms, allow('panel.rms', 'bookings.view_all'))

    expect(hidden.find(group => group.id === 'commercial')?.items.map(item => item.id)).not.toContain('b2b')
    expect(shownManage.find(group => group.id === 'commercial')?.items.map(item => item.id)).toContain('b2b')
    expect(shownView.find(group => group.id === 'commercial')?.items.map(item => item.id)).toContain('b2b')
    expect(pageDecision('/rms/commercial/b2b', allow('panel.rms', 'bookings.create'))).toEqual({
      to: RMS_HOME,
      toast: true
    })
  })

  it('shows Alerts with panel.rms and hides it without', () => {
    const shown = visibleNav(sections.rms, allow('panel.rms'))
    const hidden = visibleNav(sections.rms, allow('bookings.create'))

    expect(shown.find(group => group.id === 'operations')?.items.map(item => item.id)).toContain('alerts')
    expect(hidden.find(group => group.id === 'operations')?.items.map(item => item.id)).not.toContain('alerts')
    expect(pageDecision('/rms/operations/alerts', allow('bookings.create'))).toEqual({
      to: RMS_HOME,
      toast: true
    })
  })

  it('shows Documents with panel.rms and hides it without', () => {
    const shown = visibleNav(sections.rms, allow('panel.rms'))
    const hidden = visibleNav(sections.rms, allow('bookings.create'))

    expect(shown.find(group => group.id === 'operations')?.items.map(item => item.id)).toContain('documents')
    expect(hidden.find(group => group.id === 'operations')?.items.map(item => item.id)).not.toContain('documents')
    expect(pageDecision('/rms/operations/documents', allow('bookings.create'))).toEqual({
      to: RMS_HOME,
      toast: true
    })
  })

  it('shows Commercial Dashboard first for panel.rms and hides it without', () => {
    const shown = visibleNav(sections.rms, allow('panel.rms'))
    const hidden = visibleNav(sections.rms, allow('bookings.create'))
    const commercial = shown.find(group => group.id === 'commercial')

    expect(commercial?.items[0]?.id).toBe('dashboard')
    expect(commercial?.items[1]?.id).toBe('reports')
    expect(commercial?.items.map(item => item.id)).toContain('dashboard')
    expect(commercial?.items.map(item => item.id)).toContain('reports')
    expect(hidden.find(group => group.id === 'commercial')?.items.map(item => item.id)).not.toContain('dashboard')
    expect(hidden.find(group => group.id === 'commercial')?.items.map(item => item.id)).not.toContain('reports')
    expect(pageDecision('/rms/commercial/reports', allow('bookings.create'))).toEqual({
      to: RMS_HOME,
      toast: true
    })
    expect(pageDecision('/rms/commercial/dashboard', allow('bookings.create'))).toEqual({
      to: RMS_HOME,
      toast: true
    })
  })

  it('shows Contacts In with panel.rms and hides it without', () => {
    const shown = visibleNav(sections.rms, allow('panel.rms'))
    const hidden = visibleNav(sections.rms, allow('bookings.create'))

    expect(shown.find(group => group.id === 'commercial')?.items.map(item => item.id)).toContain('contacts-in')
    expect(hidden.find(group => group.id === 'commercial')?.items.map(item => item.id)).not.toContain('contacts-in')
    expect(pageDecision('/rms/commercial/contacts-in', allow('bookings.create'))).toEqual({
      to: RMS_HOME,
      toast: true
    })
  })

  it('hides Payments & Revenue without bookings.view_all', () => {
    const hidden = visibleNav(sections.rms, allow('panel.rms', 'bookings.create'))
    const shown = visibleNav(sections.rms, allow('panel.rms', 'bookings.view_all'))
    const commercialHidden = hidden.find(group => group.id === 'commercial')
    const commercialShown = shown.find(group => group.id === 'commercial')

    expect(commercialHidden?.items.map(item => item.id)).not.toContain('payments')
    expect(commercialShown?.items.map(item => item.id)).toContain('payments')
    expect(pageDecision('/rms/commercial/payments', allow('panel.rms', 'bookings.create'))).toEqual({
      to: RMS_HOME,
      toast: true
    })
  })

  it('shows Journeys, Segments and Automations at sprint 14', () => {
    const shown = visibleNav(sections.crm, allow('panel.crm'))
    const marketing = shown.find(group => group.id === 'marketing')
    const journeys = marketing?.items.find(item => item.id === 'journeys')
    const segments = marketing?.items.find(item => item.id === 'segments')
    const engine = shown.find(group => group.id === 'engine')
    const automations = engine?.items.find(item => item.id === 'automations')

    expect(journeys?.sprint).toBe(14)
    expect(journeys?.to).toBe('/crm/marketing/journeys')
    expect(segments?.sprint).toBe(14)
    expect(segments?.to).toBe('/crm/marketing/segments')
    expect(automations?.sprint).toBe(14)
    expect(automations?.to).toBe('/crm/engine/automations')
    expect(pageDecision('/crm/marketing/journeys', allow('panel.crm'))).toBeNull()
    expect(pageDecision('/crm/marketing/segments', allow('panel.crm'))).toBeNull()
    expect(pageDecision('/crm/engine/automations', allow('panel.crm'))).toBeNull()
  })

  it('shows Inbox and B2B Partners at sprint 15', () => {
    const shown = visibleNav(sections.crm, allow('panel.crm'))
    const sales = shown.find(group => group.id === 'sales')
    const inbox = sales?.items.find(item => item.id === 'inbox')
    const partners = sales?.items.find(item => item.id === 'b2b-partners')

    expect(inbox?.sprint).toBe(15)
    expect(inbox?.to).toBe('/crm/sales/inbox')
    expect(partners?.sprint).toBe(15)
    expect(partners?.to).toBe('/crm/sales/b2b-partners')
    expect(pageDecision('/crm/sales/inbox', allow('panel.crm'))).toBeNull()
    expect(pageDecision('/crm/sales/b2b-partners', allow('panel.crm'))).toBeNull()
  })

  it('gates the real RMS Permissions and Business Rules items', () => {
    const admin = visibleNav(sections.rms, allow(
      'users.manage',
      'roles.manage',
      'rules.view'
    ))
    const sales = visibleNav(sections.rms, allow('bookings.create'))

    expect(admin.find(group => group.id === 'admin')?.items.map(item => item.id)).toEqual([
      'permissions',
      'business-rules'
    ])
    expect(sales.find(group => group.id === 'admin')).toBeUndefined()
  })
})
