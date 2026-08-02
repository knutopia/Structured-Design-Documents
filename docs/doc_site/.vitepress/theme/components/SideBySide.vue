<template>
  <div class="side-by-side">
    <section class="side-by-side__column">
      <slot name="left" />
    </section>
    <section class="side-by-side__column">
      <slot name="right" />
    </section>
  </div>
</template>

<style scoped>
.side-by-side {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 32px;
  margin: 24px 0;
}

.side-by-side__column {
  min-width: 0;
}

.side-by-side__column :deep(> h3:first-child) {
  margin-top: 0;
}

.side-by-side__column :deep(> :last-child) {
  margin-bottom: 0;
}

@media (max-width: 767px) {
  .side-by-side {
    grid-template-columns: minmax(0, 1fr);
    gap: 24px;
  }
}
</style>
