function compareVersions(a: string, b: string): number {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const diff = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

export function init(): void {
  window.api.appVersion().then((version) => {
    const el = document.getElementById('about-version');
    if (el) el.textContent = version;

    const checking = document.getElementById('about-update-checking');
    const link     = document.getElementById('about-update-link') as HTMLAnchorElement | null;

    window.api.appCheckUpdate()
      .then(({ latestVersion, downloadUrl }) => {
        if (checking) checking.style.display = 'none';
        if (link && compareVersions(latestVersion, version) > 0) {
          link.href = downloadUrl;
          link.textContent = `🆕 下载新版 v${latestVersion}`;
          link.style.display = 'inline';
        }
      })
      .catch(() => {
        if (checking) checking.style.display = 'none';
      });
  });
}
