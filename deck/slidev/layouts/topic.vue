<script setup lang="ts">
import { useSlideContext } from '@slidev/client'
const { $frontmatter } = useSlideContext()
</script>

<template>
  <div class="slidev-layout topic">
    <div class="topic-head">
      <div class="brand"><span class="brand-dot" />REQ2UI</div>
      <div class="section">{{ $frontmatter.section }}</div>
    </div>
    <h1 class="topic-title">{{ $frontmatter.title }}</h1>
    <p v-if="$frontmatter.subtitle" class="topic-sub">{{ $frontmatter.subtitle }}</p>
    <div class="accent" />
    <div class="topic-body">
      <slot />
    </div>
  </div>
</template>
