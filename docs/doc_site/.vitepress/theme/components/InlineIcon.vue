<template>
  <i :class="[iconClass, 'inline-icon']" :style="{ color: color }"></i>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  name: { type: String, required: true },
  color: { type: String, default: 'currentColor' }
})

// List of common brand names to auto-apply 'fa-brands' instead of 'fa-solid'
const brandIcons = ['github', 'gitlab', 'npm', 'twitter', 'discord', 'linkedin', 'google', 'facebook']

const iconClass = computed(() => {
  // If it's a known brand, use fa-brands
  if (brandIcons.includes(props.name.toLowerCase())) {
    return `fa-brands fa-${props.name}`
  }
  // Default to solid icons for standard UI elements
  return `fa-solid fa-${props.name}`
})
</script>

<style scoped>
.inline-icon {
  display: inline-block;
  vertical-align: -0.125em; /* Perfectly aligns FontAwesome fonts with text baselines */
  margin: 0 0.2em;
}
</style>
