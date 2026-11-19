// Runs before the page draws, so a chosen theme shows with no flash of the device's one.
// A plain file, not inline: the site's Content-Security-Policy allows only scripts from 'self'.
try {
  var theme = localStorage.getItem('theme')
  if (theme === 'light' || theme === 'dark') document.documentElement.dataset.theme = theme
} catch {
  // no storage (private mode): follow the device
}
