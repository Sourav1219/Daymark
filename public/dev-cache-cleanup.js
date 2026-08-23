;(() => {
  if (!("serviceWorker" in navigator)) return

  Promise.all([
    navigator.serviceWorker.getRegistrations().then(async (registrations) => {
      await Promise.all(
        registrations.map((registration) => registration.unregister()),
      )
      return registrations.length > 0
    }),
    "caches" in window
      ? caches.keys().then(async (keys) => {
          await Promise.all(keys.map((key) => caches.delete(key)))
          return keys.length > 0
        })
      : Promise.resolve(false),
  ])
    .then((changed) => {
      if (changed.some(Boolean)) window.location.reload()
    })
    .catch(() => {})
})()
