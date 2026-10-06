import { describe, expect, it } from 'vitest'
import type { Permission } from '../../app/types/api'
import { canEditPath, isCopyPath } from '../../app/utils/canEditPath'

const copyPaths: Array<string> = [
  'fees.footnote',
  'copy.book_now_pay_later',
  'copy.traveling_with_children',
  'copy.solo_and_triple',
  'copy.pay_today',
  'copy.details_note',
  'copy.confirmation_steps'
]

function allow(...granted: Array<Permission>): (permission: Permission) => boolean {
  return permission => granted.includes(permission)
}

describe('isCopyPath', () => {
  it('matches an exact copy path and a prefix of a list path', () => {
    expect(isCopyPath('copy.confirmation_steps', copyPaths)).toBe(true)
    expect(isCopyPath('copy.confirmation_steps.0', copyPaths)).toBe(true)
    expect(isCopyPath('guests.max_per_property', copyPaths)).toBe(false)
  })
})

describe('canEditPath', () => {
  it('lets engine_settings.manage edit any path', () => {
    const can = allow('engine_settings.manage')

    expect(canEditPath('guests.max_per_property', copyPaths, can)).toBe(true)
    expect(canEditPath('copy.book_now_pay_later', copyPaths, can)).toBe(true)
    expect(canEditPath('locale.default', copyPaths, can)).toBe(true)
  })

  it('lets engine_copy.manage edit only copy paths', () => {
    const can = allow('engine_copy.manage')

    expect(canEditPath('copy.book_now_pay_later', copyPaths, can)).toBe(true)
    expect(canEditPath('copy.confirmation_steps', copyPaths, can)).toBe(true)
    expect(canEditPath('fees.footnote', copyPaths, can)).toBe(true)
    expect(canEditPath('guests.max_per_property', copyPaths, can)).toBe(false)
    expect(canEditPath('fees.tct_pp', copyPaths, can)).toBe(false)
  })

  it('locks every path when the user has neither permission', () => {
    const can = allow('panel.rms')

    expect(canEditPath('copy.book_now_pay_later', copyPaths, can)).toBe(false)
    expect(canEditPath('guests.max_per_property', copyPaths, can)).toBe(false)
  })
})
