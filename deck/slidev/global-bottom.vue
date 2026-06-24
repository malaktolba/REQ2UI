<script setup lang="ts">
import { useNav } from '@slidev/client'
const { currentPage, total } = useNav()
</script>

<template>
  <footer class="deck-footer">
    <div><span class="brand-dot" />REQ2UI · AASTMT 2025/2026</div>
    <div>{{ String(currentPage).padStart(2, '0') }} / {{ total }}</div>
  </footer>
</template>
