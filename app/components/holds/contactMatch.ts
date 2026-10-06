export function existingContactSelected(email: string, selectedEmail: string | null): boolean {
  if (selectedEmail === null || selectedEmail === '') {
    return false
  }

  return email.trim().toLowerCase() === selectedEmail.trim().toLowerCase()
}
