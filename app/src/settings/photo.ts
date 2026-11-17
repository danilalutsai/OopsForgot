import { supabase } from '../supabase'

/** Crops the middle square of an image and shrinks it to 256 × 256 px, as a JPEG. */
export async function squarePhoto(file: File): Promise<Blob> {
  const image = await createImageBitmap(file)
  const side = Math.min(image.width, image.height)
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = 256
  canvas
    .getContext('2d')!
    .drawImage(image, (image.width - side) / 2, (image.height - side) / 2, side, side, 0, 0, 256, 256)
  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Could not read photo'))), 'image/jpeg', 0.85),
  )
}

/** Uploads a new photo into the person's own folder and returns its path. The old one is kept until the profile points at the new one. */
export async function uploadPhoto(userId: string, photo: Blob): Promise<string> {
  const path = `${userId}/photo-${Date.now()}.jpg`
  const { error } = await supabase.storage.from('avatars').upload(path, photo, { contentType: 'image/jpeg' })
  if (error) throw error
  return path
}

export async function removePhoto(path: string) {
  await supabase.storage.from('avatars').remove([path])
}

/** A short-lived link to show a private photo. */
export async function photoUrl(path: string): Promise<string | null> {
  const { data } = await supabase.storage.from('avatars').createSignedUrl(path, 60 * 60)
  return data?.signedUrl ?? null
}
