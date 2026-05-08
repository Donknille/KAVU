(function () {
  const storageKey = "meisterplaner-theme";
  const storedTheme = localStorage.getItem(storageKey);
  const resolvedTheme =
    storedTheme === "light" || storedTheme === "dark"
      ? storedTheme
      : window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light";

  if (resolvedTheme === "dark") {
    document.documentElement.classList.add("dark");
  } else {
    document.documentElement.classList.remove("dark");
  }

  document.documentElement.style.colorScheme = resolvedTheme;
})();
