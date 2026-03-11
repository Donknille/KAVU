const PREVIEW_STORAGE_KEY = "kavu.preview.employee";
const PREVIEW_QUERY_KEY = "previewEmployee";
const PREVIEW_HEADER_NAME = "x-kavu-preview-employee";

function getWindowSafe() {
  return typeof window === "undefined" ? null : window;
}

function readTokenFromLocation(currentWindow: Window) {
  const params = new URLSearchParams(currentWindow.location.search);
  const rawToken = params.get(PREVIEW_QUERY_KEY)?.trim();
  return rawToken ? rawToken : null;
}

export function getPreviewEmployeeToken() {
  const currentWindow = getWindowSafe();
  if (!currentWindow) {
    return null;
  }

  const locationToken = readTokenFromLocation(currentWindow);
  if (locationToken) {
    currentWindow.sessionStorage.setItem(PREVIEW_STORAGE_KEY, locationToken);
    return locationToken;
  }

  return currentWindow.sessionStorage.getItem(PREVIEW_STORAGE_KEY);
}

export function applyPreviewIdentityFromUrl() {
  const currentWindow = getWindowSafe();
  if (!currentWindow) {
    return;
  }

  const token = readTokenFromLocation(currentWindow);
  if (!token) {
    return;
  }

  currentWindow.sessionStorage.setItem(PREVIEW_STORAGE_KEY, token);

  const params = new URLSearchParams(currentWindow.location.search);
  params.delete(PREVIEW_QUERY_KEY);
  const nextQuery = params.toString();
  const nextUrl = `${currentWindow.location.pathname}${
    nextQuery ? `?${nextQuery}` : ""
  }${currentWindow.location.hash}`;
  currentWindow.history.replaceState({}, "", nextUrl);
}

export function withPreviewHeaders(headers?: HeadersInit) {
  const nextHeaders = new Headers(headers);
  const token = getPreviewEmployeeToken();
  if (token) {
    nextHeaders.set(PREVIEW_HEADER_NAME, token);
  }
  return nextHeaders;
}
