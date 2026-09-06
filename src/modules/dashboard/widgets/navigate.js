// Navigation helper for widgets.
//
// In its own file rather than beside the shared components: a module that
// exports both components and plain functions breaks Vite's fast refresh,
// so editing a widget primitive would full-reload the page instead of
// hot-swapping.
//
// An event rather than useStore, so a widget can be rendered anywhere —
// including inside a popout window — without needing the store's provider
// in scope.
export const goModule = (id) =>
  window.dispatchEvent(new CustomEvent('madden:goto-module', { detail: { moduleId: id } }))
