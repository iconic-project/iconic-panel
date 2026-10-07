import type { RequestQueueItem, RequestQueueRules } from '../types/api'

const POLL_MS = 5 * 60 * 1000

type QueuePayload = {
  data: Array<RequestQueueItem>
  meta: {
    total: number
    rules: RequestQueueRules
  }
}

export function useOpenRequests() {
  const { can } = useAuth()
  const { request } = useApi()

  const allowed = computed(() => can('requests.confirm') || can('requests.release'))
  const count = useState('open-request-count', () => 0)
  const rules = useState<RequestQueueRules | null>('open-request-rules', () => null)
  const polling = useState('open-request-polling', () => false)

  async function refresh(): Promise<void> {
    if (!allowed.value) {
      count.value = 0
      rules.value = null
      return
    }

    const body = await request('/api/rms/requests') as QueuePayload
    count.value = body.meta.total
    rules.value = body.meta.rules
  }

  watch(allowed, () => {
    void refresh()
  })

  function startPolling(): void {
    if (!import.meta.client || polling.value) {
      return
    }

    polling.value = true
    void refresh()
    const timer = window.setInterval(() => {
      void refresh()
    }, POLL_MS)

    onUnmounted(() => {
      window.clearInterval(timer)
      polling.value = false
    })
  }

  return {
    allowed,
    count,
    rules,
    refresh,
    startPolling
  }
}
