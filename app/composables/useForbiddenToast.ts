export function useForbiddenToast() {
  const pending = useState('iconic.forbidden-toast', () => false)

  function showForbiddenToast(): void {
    pending.value = true
  }

  return {
    pending,
    showForbiddenToast
  }
}
