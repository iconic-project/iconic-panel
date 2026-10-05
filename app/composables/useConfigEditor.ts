import type {
  BusinessRulesDocument,
  BusinessRulesVersion,
  ConfigValidation,
  ConfigVersion,
  ConfigVersionDetail,
  ConfigVersionSummary,
  EngineSettingsDocument,
  EngineSettingsValidation,
  EngineSettingsVersion,
  ExtrasDocument,
  ExtrasVersion,
  Paginated,
  RatesDocument,
  RatesVersion
} from '../types/api'
import { ApiError } from '#imports'
import { cloneDocument } from '../utils/documentsEqual'
import { hasValidationErrors, isConfigDirty } from '../utils/isConfigDirty'
import { applyPublishOutcome, normaliseErrors, stripDocumentPrefix } from '../utils/publishOutcome'
import { createValidationQueue } from '../utils/validationQueue'

export type ConfigKindSlug = 'rates' | 'engine-settings' | 'business-rules' | 'extras'

export type ConfigEditorApi<
  TDoc,
  TValidation extends ConfigValidation = ConfigValidation,
  TCurrent extends ConfigVersion<TDoc> = ConfigVersion<TDoc>
> = {
  kind: ConfigKindSlug
  current: TCurrent | null
  draft: TDoc | null
  validation: TValidation
  validating: boolean
  dirty: boolean
  hasErrors: boolean
  loading: boolean
  conflict: string | null
  publishMessage: string | null
  versions: Array<ConfigVersionSummary>
  hasMore: boolean
  historyLoading: boolean
  discard: () => void
  publish: (approvalReference: string | null) => Promise<void>
  reload: () => Promise<void>
  reloadHistory: () => Promise<void>
  loadOlder: () => Promise<void>
  errorsFor: (path: string) => Array<string>
  warningsFor: (path: string) => Array<string>
}

function emptyValidation(kind: ConfigKindSlug): ConfigValidation | EngineSettingsValidation {
  const base: ConfigValidation = {
    errors: {},
    warnings: [],
    changes: []
  }

  if (kind === 'engine-settings') {
    return { ...base, rule_fields_changed: false }
  }

  return base
}

function cloneDoc<T>(value: T): T {
  return cloneDocument(toRaw(value as object) as T)
}

function asValidation<TValidation extends ConfigValidation>(
  kind: ConfigKindSlug,
  body: ConfigValidation | EngineSettingsValidation
): TValidation {
  const next: ConfigValidation = {
    errors: normaliseErrors(body.errors),
    warnings: body.warnings ?? [],
    changes: body.changes ?? []
  }

  if (kind === 'engine-settings') {
    return {
      ...next,
      rule_fields_changed: Boolean((body as EngineSettingsValidation).rule_fields_changed)
    } as unknown as TValidation
  }

  return next as unknown as TValidation
}

export function useConfigEditor(kind: 'rates'): ConfigEditorApi<RatesDocument, ConfigValidation, RatesVersion>
export function useConfigEditor(kind: 'engine-settings'): ConfigEditorApi<EngineSettingsDocument, EngineSettingsValidation, EngineSettingsVersion>
export function useConfigEditor(kind: 'business-rules'): ConfigEditorApi<BusinessRulesDocument, ConfigValidation, BusinessRulesVersion>
export function useConfigEditor(kind: 'extras'): ConfigEditorApi<ExtrasDocument, ConfigValidation, ExtrasVersion>
export function useConfigEditor<
  TDoc,
  TValidation extends ConfigValidation = ConfigValidation,
  TCurrent extends ConfigVersion<TDoc> = ConfigVersion<TDoc>
>(kind: ConfigKindSlug): ConfigEditorApi<TDoc, TValidation, TCurrent>
export function useConfigEditor<
  TDoc,
  TValidation extends ConfigValidation = ConfigValidation,
  TCurrent extends ConfigVersion<TDoc> = ConfigVersion<TDoc>
>(kind: ConfigKindSlug): ConfigEditorApi<TDoc, TValidation, TCurrent> {
  const { request } = useApi()
  const { t } = useI18n()
  const toast = useToast()
  const basePath = `/api/rms/${kind}`

  const current = ref<TCurrent | null>(null) as Ref<TCurrent | null>
  const draft = ref<TDoc | null>(null) as Ref<TDoc | null>
  const validation = ref(emptyValidation(kind)) as Ref<TValidation>
  const validating = ref(false)
  const loading = ref(true)
  const conflict = ref<string | null>(null)
  const publishMessage = ref<string | null>(null)
  const versions = ref<Array<ConfigVersionSummary>>([])
  const historyPage = ref(1)
  const historyLastPage = ref(1)
  const historyLoading = ref(false)

  const queue = createValidationQueue<TDoc, TValidation>(
    async (payload) => {
      const body = await request(`${basePath}/validate`, {
        method: 'POST',
        body: { document: payload }
      }) as TValidation

      return asValidation<TValidation>(kind, body)
    },
    (result) => {
      validation.value = result
    },
    {
      delayMs: 400,
      onPending: (pending) => {
        validating.value = pending
      }
    }
  )

  const hasErrors = computed(() => hasValidationErrors(validation.value.errors))

  const dirty = computed(() => {
    if (!current.value || draft.value === null) {
      return false
    }

    return isConfigDirty({
      inFlight: validating.value,
      errors: validation.value.errors,
      changes: validation.value.changes,
      draft: toRaw(draft.value as object),
      published: current.value.document
    })
  })

  const hasMore = computed(() => historyPage.value < historyLastPage.value)

  function resetEditorState(): void {
    queue.invalidate()
    validation.value = emptyValidation(kind) as TValidation
    conflict.value = null
    publishMessage.value = null
  }

  function applyCurrent(next: TCurrent): void {
    current.value = next
    draft.value = cloneDoc(next.document)
  }

  async function reload(): Promise<void> {
    resetEditorState()
    const next = await request(basePath) as TCurrent
    applyCurrent(next)
  }

  async function loadHistory(reset: boolean): Promise<void> {
    historyLoading.value = true

    try {
      const result = await request(`${basePath}/versions?page=${historyPage.value}`) as Paginated<ConfigVersionSummary>
      versions.value = reset ? result.data : [...versions.value, ...result.data]
      historyLastPage.value = result.meta.last_page
    } finally {
      historyLoading.value = false
    }
  }

  async function reloadHistory(): Promise<void> {
    historyPage.value = 1
    await loadHistory(true)
  }

  async function loadOlder(): Promise<void> {
    if (!hasMore.value) {
      return
    }

    historyPage.value += 1
    await loadHistory(false)
  }

  function discard(): void {
    if (!current.value) {
      return
    }

    resetEditorState()
    draft.value = cloneDoc(current.value.document)
  }

  async function publish(approvalReference: string | null): Promise<void> {
    if (!current.value || draft.value === null) {
      return
    }

    const trimmed = approvalReference?.trim() ?? ''

    try {
      const result = await request(`${basePath}/versions`, {
        method: 'POST',
        body: {
          document: cloneDoc(draft.value),
          base_version: current.value.version,
          approval_reference: trimmed === '' ? null : trimmed
        }
      }) as ConfigVersionDetail<TDoc>

      const outcome = applyPublishOutcome(201, result)

      if (outcome.kind !== 'published') {
        return
      }

      resetEditorState()
      applyCurrent(result as unknown as TCurrent)
      current.value = await request(basePath) as TCurrent
      await reloadHistory()
      toast.add({ title: t('config.publishedToast', { version: String(outcome.version) }) })
    } catch (error: unknown) {
      if (!(error instanceof ApiError)) {
        throw error
      }

      const outcome = applyPublishOutcome(error.status, {
        message: error.message,
        errors: error.errors
      })

      if (outcome.kind === 'conflict') {
        conflict.value = outcome.message
        return
      }

      if (outcome.kind === 'invalid') {
        validation.value = {
          ...validation.value,
          errors: {
            ...normaliseErrors(validation.value.errors),
            ...outcome.errors
          }
        }
        publishMessage.value = outcome.message
        return
      }

      throw error
    }
  }

  function errorsFor(path: string): Array<string> {
    const key = stripDocumentPrefix(path)
    const errors = validation.value.errors

    return errors[key] ?? errors[path] ?? []
  }

  function warningsFor(path: string): Array<string> {
    const key = stripDocumentPrefix(path)

    return validation.value.warnings
      .filter(warning => warning.path === key
        || warning.path === path
        || warning.path.startsWith(`${key}.`))
      .map(warning => warning.message)
  }

  watch(draft, (value) => {
    if (value === null) {
      return
    }

    queue.schedule(cloneDoc(value))
  }, { deep: true })

  async function boot(): Promise<void> {
    loading.value = true

    try {
      await reload()
      await reloadHistory()
    } finally {
      loading.value = false
    }
  }

  void boot()

  onUnmounted(() => {
    queue.invalidate()
  })

  return reactive({
    kind,
    current,
    draft,
    validation,
    validating,
    dirty,
    hasErrors,
    loading,
    conflict,
    publishMessage,
    versions,
    hasMore,
    historyLoading,
    discard,
    publish,
    reload,
    reloadHistory,
    loadOlder,
    errorsFor,
    warningsFor
  }) as ConfigEditorApi<TDoc, TValidation, TCurrent>
}
