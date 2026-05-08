(function () {
  const reloadKey = "meisterplaner-asset-recovery";

  async function clearRuntimeCaches() {
    if ("serviceWorker" in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.map((registration) => registration.unregister()));
    }

    if ("caches" in window) {
      const cacheKeys = await caches.keys();
      await Promise.all(cacheKeys.map((cacheKey) => caches.delete(cacheKey)));
    }
  }

  function markHealthyLoad() {
    sessionStorage.removeItem(reloadKey);
  }

  async function recoverFromMissingAsset() {
    if (sessionStorage.getItem(reloadKey) === "1") {
      return;
    }

    sessionStorage.setItem(reloadKey, "1");
    await clearRuntimeCaches();

    const targetUrl = new URL(window.location.href);
    targetUrl.searchParams.set("_asset_refresh", Date.now().toString());
    window.location.replace(targetUrl.toString());
  }

  window.addEventListener("load", markHealthyLoad, { once: true });

  window.addEventListener(
    "error",
    (event) => {
      const target = event.target;
      if (!(target instanceof HTMLScriptElement || target instanceof HTMLLinkElement)) {
        return;
      }

      const source = target.src || target.href || "";
      if (!source.includes("/assets/")) {
        return;
      }

      void recoverFromMissingAsset();
    },
    true,
  );
})();
