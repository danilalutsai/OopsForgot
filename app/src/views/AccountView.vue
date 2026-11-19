<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import AvatarImage from '../components/AvatarImage.vue'
import PageHeader from '../components/PageHeader.vue'
import SheetLine from '../items/SheetLine.vue'
import { INPUT, SECTION_TITLE } from '../items/ui'
import { blockedOffline } from '../online'
import DeleteAccount from '../settings/DeleteAccount.vue'
import LoginSettings from '../settings/LoginSettings.vue'
import { removePhoto, squarePhoto, uploadPhoto } from '../settings/photo'
import { useProfileSave } from '../settings/profileSave'
import { useAuth } from '../stores/auth'

/** The person's account: profile, how they log in, and deleting it. */
const auth = useAuth()
const openLine = ref<string | null>(null)
const { error, busy, save } = useProfileSave(openLine)
const toggle = (line: string) => (openLine.value = openLine.value === line ? null : line)

const profile = computed(() => auth.profile)
const name = ref('')
const surname = ref('')
// Fill the name fields once the profile arrives (opening the page directly loads it after this page).
watch(
  () => [profile.value?.name, profile.value?.surname],
  ([n, s]) => {
    name.value = n ?? ''
    surname.value = s ?? ''
  },
  { immediate: true },
)

function saveName() {
  if (!name.value.trim() || !surname.value.trim()) return (error.value = 'auth.errors.required')
  void save({ name: name.value.trim(), surname: surname.value.trim() })
}

const photoInput = ref<HTMLInputElement>()
async function pickPhoto(e: Event) {
  if (blockedOffline()) return
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file || !auth.session) return
  try {
    busy.value = true
    const oldPath = profile.value?.photo_path ?? null
    const path = await uploadPhoto(auth.session.user.id, await squarePhoto(file))
    // Point the profile at the new photo first; only then is the old one safe to remove.
    if (await save({ photo_path: path })) {
      if (oldPath) await removePhoto(oldPath)
    } else {
      await removePhoto(path)
    }
  } catch {
    error.value = 'settings.photoError'
  } finally {
    busy.value = false
    if (photoInput.value) photoInput.value.value = ''
  }
}
async function dropPhoto() {
  if (blockedOffline()) return
  const path = profile.value?.photo_path
  if (!path) return
  if (await save({ photo_path: null })) await removePhoto(path)
}
</script>

<template>
  <!-- the page wears the Item sheet's surface, so an opened row's darker block stands out the same way -->
  <div class="flex-1 bg-surface">
    <PageHeader :title="$t('nav.account')" />

    <div v-if="profile" class="mx-auto w-full max-w-xl px-1 pb-10">
      <p
        v-if="error"
        role="alert"
        class="mx-3 mt-3 rounded-xl bg-urgent-red/10 p-3 text-sm font-medium text-urgent-red"
      >
        {{ $t(error) }}
      </p>

      <h2 :class="SECTION_TITLE">{{ $t('settings.sections.account') }}</h2>
      <SheetLine
        :label="$t('settings.profile')"
        :value="`${profile.name} ${profile.surname}`"
        :open="openLine === 'profile'"
        @toggle="toggle('profile')"
      >
        <div class="flex items-center gap-3">
          <AvatarImage size="lg" />
          <div class="flex flex-wrap gap-2 text-sm">
            <button
              type="button"
              class="rounded-full border border-line px-3 py-1.5 font-semibold"
              :disabled="busy"
              @click="photoInput?.click()"
            >
              {{ profile.photo_path ? $t('settings.changePhoto') : $t('settings.addPhoto') }}
            </button>
            <button
              v-if="profile.photo_path"
              type="button"
              class="rounded-full border border-line px-3 py-1.5 font-semibold text-urgent-red"
              :disabled="busy"
              @click="dropPhoto"
            >
              {{ $t('settings.removePhoto') }}
            </button>
          </div>
          <input
            ref="photoInput"
            type="file"
            accept="image/*"
            class="sr-only"
            :aria-label="$t('settings.photo')"
            @change="pickPhoto"
          />
        </div>
        <div class="mt-3 grid grid-cols-2 gap-3">
          <label class="flex flex-col gap-1 text-sm">
            <span class="font-medium">{{ $t('auth.name') }}</span>
            <input v-model="name" :class="INPUT" autocomplete="given-name" @change="saveName" />
          </label>
          <label class="flex flex-col gap-1 text-sm">
            <span class="font-medium">{{ $t('auth.surname') }}</span>
            <input v-model="surname" :class="INPUT" autocomplete="family-name" @change="saveName" />
          </label>
        </div>
      </SheetLine>
      <LoginSettings :open-line="openLine" @toggle="toggle" />
      <DeleteAccount />
    </div>
  </div>
</template>
