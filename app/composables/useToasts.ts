export interface Toast {
  id: number
  msg: string
  kind: 'info' | 'error'
}

export function useToasts() {
  const items = useState<Toast[]>('toasts', () => [])
  function push(msg: string, kind: 'info' | 'error' = 'info') {
    const id = Date.now() + Math.random()
    items.value.push({ id, msg, kind })
    if (import.meta.client) {
      setTimeout(() => {
        items.value = items.value.filter(t => t.id !== id)
      }, 6000)
    }
  }
  return { push, items }
}
