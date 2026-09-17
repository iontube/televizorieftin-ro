chrome.runtime.sendMessage({ type: 'getTotal' }, (d) => {
  if (!d) return;
  document.getElementById('total').textContent = d.totalSent || 0;
  document.getElementById('failed').textContent = d.totalFailed || 0;
});
