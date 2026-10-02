import { crmNav } from './navigation/crm'
import { rmsNav } from './navigation/rms'
import type { Section, SectionId } from './navigation/types'

export const RMS_HOME = '/rms/reservations/calendar'
export const CRM_HOME = '/crm/sales/pipeline'

export const sections: Record<SectionId, Section> = {
  rms: {
    id: 'rms',
    labelKey: 'shell.rms',
    home: RMS_HOME,
    brandSubtitleKey: 'shell.brandRms',
    nav: rmsNav
  },
  crm: {
    id: 'crm',
    labelKey: 'shell.crm',
    home: CRM_HOME,
    brandSubtitleKey: 'shell.brandCrm',
    nav: crmNav
  }
}

export const LAST_PATH_KEYS: Record<SectionId, string> = {
  rms: 'iconic.section.last.rms',
  crm: 'iconic.section.last.crm'
}
