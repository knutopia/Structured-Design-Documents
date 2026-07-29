<!-- .vitepress/theme/components/DropdownSwitch.vue -->
<script setup lang="ts">
import { computed, ref, useId, watch } from 'vue'

const props = defineProps<{
  options: Array<{ label: string; value: string }>
  label?: string
}>()

const selectedModel = defineModel<string>()
const internalSelected = ref(props.options[0]?.value ?? '')
const selectId = `dropdown-switch-${useId()}`
const menuId = `${selectId}-menu`
const control = ref<HTMLElement>()
const open = ref(false)

const selected = computed({
  get() {
    const candidate = selectedModel.value ?? internalSelected.value
    return props.options.some((option) => option.value === candidate)
      ? candidate
      : (props.options[0]?.value ?? '')
  },
  set(value: string) {
    internalSelected.value = value
    selectedModel.value = value
  }
})

const selectedLabel = computed(
  () =>
    props.options.find((option) => option.value === selected.value)?.label ?? ''
)

function openMenu(): void {
  if (props.options.length > 0) {
    open.value = true
  }
}

function closeMenu(): void {
  open.value = false
}

function toggleMenu(): void {
  open.value = !open.value && props.options.length > 0
}

function selectOption(value: string): void {
  selected.value = value
  closeMenu()
}

function handleFocusout(event: FocusEvent): void {
  if (!control.value?.contains(event.relatedTarget as Node | null)) {
    closeMenu()
  }
}

watch(
  () => props.options,
  (options) => {
    if (!options.some((option) => option.value === selected.value)) {
      internalSelected.value = options[0]?.value ?? ''
    }
  },
  { deep: true }
)
</script>

<template>
  <div class="dropdown-switch">
    <label
      class="dropdown-switch__label"
      :for="selectId"
    >
      {{ label ?? 'Select an option' }}
    </label>
    <div
      ref="control"
      class="dropdown-switch__control"
      @mouseleave="closeMenu"
      @focusout="handleFocusout"
      @keydown.esc="closeMenu"
    >
      <button
        :id="selectId"
        type="button"
        class="dropdown-switch__anchor"
        :disabled="options.length === 0"
        aria-haspopup="listbox"
        :aria-controls="menuId"
        :aria-expanded="open"
        @click="toggleMenu"
        @keydown.down.prevent="openMenu"
      >
        <span>{{ selectedLabel }}</span>
        <span
          class="dropdown-switch__caret"
          aria-hidden="true"
        />
      </button>

      <div
        v-show="open"
        class="dropdown-switch__menu-shell"
      >
        <div
          :id="menuId"
          class="dropdown-switch__menu"
          role="listbox"
          :aria-label="label ?? 'Select an option'"
        >
          <button
            v-for="option in options"
            :key="option.value"
            type="button"
            class="dropdown-switch__option"
            role="option"
            :aria-selected="option.value === selected"
            @click="selectOption(option.value)"
          >
            {{ option.label }}
          </button>
        </div>
      </div>
    </div>

    <div class="dropdown-switch__content">
      <slot :name="selected" />
    </div>
  </div>
</template>

<style scoped>
.dropdown-switch {
  margin: 16px 0;
}

.dropdown-switch__label {
  display: block;
  margin-bottom: 8px;
  color: var(--vp-c-text-1);
  font-size: 14px;
  font-weight: 600;
}

.dropdown-switch__control {
  position: relative;
  width: min(100%, 28rem);
}

.dropdown-switch__anchor {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  width: 100%;
  min-height: 40px;
  padding: 8px 12px;
  border: 1px solid var(--vp-c-divider);
  border-radius: 8px;
  color: var(--vp-c-text-1);
  background-color: var(--vp-c-bg);
  font: inherit;
  text-align: left;
  cursor: pointer;
  transition:
    background-color 0.25s,
    color 0.25s;
}

.dropdown-switch__anchor:hover {
  color: var(--vp-c-brand-1);
  background-color: var(--vp-c-default-soft);
}

.dropdown-switch__caret {
  flex: 0 0 auto;
  width: 7px;
  height: 7px;
  border-right: 1.5px solid currentColor;
  border-bottom: 1.5px solid currentColor;
  pointer-events: none;
  transform: translateY(-2px) rotate(45deg);
}

.dropdown-switch__anchor:focus-visible {
  border-color: var(--vp-c-brand-1);
  outline: 2px solid var(--vp-c-brand-soft);
  outline-offset: 2px;
}

.dropdown-switch__anchor:disabled {
  cursor: not-allowed;
  opacity: 0.6;
}

.dropdown-switch__menu-shell {
  position: absolute;
  z-index: 20;
  top: 100%;
  right: 0;
  left: 0;
  padding-top: 8px;
}

.dropdown-switch__menu {
  overflow-y: auto;
  max-height: min(24rem, calc(100vh - var(--vp-nav-height)));
  padding: 8px;
  border: 1px solid var(--vp-c-divider);
  border-radius: 12px;
  background-color: var(--vp-c-bg-elv);
  box-shadow: var(--vp-shadow-3);
}

.dropdown-switch__option {
  display: block;
  width: 100%;
  padding: 6px 12px;
  border-radius: 6px;
  color: var(--vp-c-text-1);
  background: transparent;
  font-size: 14px;
  font-weight: 500;
  line-height: 24px;
  text-align: left;
  cursor: pointer;
  transition:
    background-color 0.25s,
    color 0.25s;
}

.dropdown-switch__option:hover,
.dropdown-switch__option:focus-visible {
  color: var(--vp-c-brand-1);
  background-color: var(--vp-c-default-soft);
  outline: none;
}

.dropdown-switch__option[aria-selected='true'] {
  color: var(--vp-c-brand-1);
}

.dropdown-switch__content {
  margin-top: 16px;
  padding: 16px;
  border: 1px solid var(--vp-c-divider);
  border-radius: 8px;
  background-color: var(--vp-c-bg-soft);
}

.dropdown-switch__content > :first-child {
  margin-top: 0;
}

.dropdown-switch__content > :last-child {
  margin-bottom: 0;
}
</style>
