<script setup lang="ts">
import { useSlideContext } from '@slidev/client'
const { $frontmatter } = useSlideContext()
</script>

<template>
  <div class="slidev-layout cover">
    <div class="cover-top">
      <div class="brand"><span class="brand-dot" />REQ2UI</div>
      <img v-if="$frontmatter.logo" :src="$frontmatter.logo" class="cover-logo" alt="AAST logo" />
    </div>
    <div class="cover-body">
      <slot />
    </div>
  </div>
</template>
