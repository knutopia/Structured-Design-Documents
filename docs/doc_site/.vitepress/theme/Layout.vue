<script setup>
// for https://github.com/BadgerHobbs/vitepress-plugin-lightbox

import DefaultTheme from "vitepress/theme";
import { onMounted, onUnmounted, nextTick } from "vue";
import { useRouter } from "vitepress";
import mediumZoom from "medium-zoom";
import { useOutlineNavigationTransition } from "./components/useOutlineNavigationTransition";

const { Layout } = DefaultTheme;
const router = useRouter();
const { animatePendingOutlineNavigation } = useOutlineNavigationTransition();

let zoom;
let observer;

// Setup medium zoom and reset instances
const setupMediumZoom = () => {
  if (zoom) {
    zoom.detach();
  }
  
  zoom = mediumZoom("[data-zoomable]", {
    background: "transparent",
  });
};

onMounted(() => {
  setupMediumZoom();

  // Set up a MutationObserver to watch for tab switching
  observer = new MutationObserver((mutations) => {
    // Check if new HTML elements were added to the page
    const hasAddedNodes = mutations.some(
      (mutation) => mutation.type === "childList" && mutation.addedNodes.length > 0
    );
    
    if (hasAddedNodes && zoom) {
      // Instruct medium-zoom to scan the DOM and bind to the new image
      zoom.attach("[data-zoomable]");
    }
  });

  // Watch the entire body for element additions
  observer.observe(document.body, { childList: true, subtree: true });
});

// Clean up the observer if the layout is ever unmounted
onUnmounted(() => {
  if (observer) {
    observer.disconnect();
  }
});

// Subscribe to route changes to fully wipe and re-apply medium zoom 
router.onAfterRouteChange = () => {
  nextTick(setupMediumZoom);
  animatePendingOutlineNavigation();
};
</script>

<template>
  <Layout />
</template>

<style>
.medium-zoom-overlay {
  backdrop-filter: blur(5rem);
}

.medium-zoom-overlay,
.medium-zoom-image--opened {
  z-index: 999;
}
</style>
