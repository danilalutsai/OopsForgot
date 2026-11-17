import type { SupabaseClient } from 'npm:@supabase/supabase-js@2.119.0'

/**
 * Deletes an account for good. The account goes first (Items, Reminders, Expenses, push devices and
 * the Calendar feed cascade with it); only once it is gone does its ID join deleted_accounts (for
 * cleaning a restored backup) and its photo leave storage. Returns false if nothing was deleted.
 */
export async function deleteAccount(admin: SupabaseClient, id: string): Promise<boolean> {
  // listed before anything changes, so a storage problem stops the deletion cleanly
  const { data: photos, error: listing } = await admin.storage.from('avatars').list(id)
  if (listing) return false

  const { error: gone } = await admin.auth.admin.deleteUser(id)
  if (gone) return false

  await admin.from('deleted_accounts').upsert({ user_id: id })
  if (photos?.length) {
    const names = photos.map((p) => `${id}/${p.name}`)
    for (let attempt = 0; attempt < 3; attempt++) {
      const { error } = await admin.storage.from('avatars').remove(names)
      if (!error) break
      if (attempt === 2) console.error(`Photo of deleted account ${id} left in storage`, error)
    }
  }
  return true
}
