<template>
  <span class="flex items-center gap-2">
    <svg viewBox="0 0 32 32" width="26" height="26" aria-hidden="true">
      <circle cx="16" cy="16" r="13" fill="none" stroke="currentColor" stroke-width="4" class="text-accent" />
      <path
        d="M10 16.5l4 4 8-9"
        fill="none"
        stroke="currentColor"
        stroke-width="3.5"
        stroke-linecap="round"
        stroke-linejoin="round"
        class="text-accent"
      />
    </svg>
    <span class="text-[19px] font-bold tracking-tight">{{ $t('app.name') }}</span>
  </span>
</template>
