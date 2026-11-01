import { toast } from '../toast';
import { parseGoogleMapsUrl } from '../../shared/google-maps';

const api = window.api;

async function loadMihomoStatus(): Promise<void> {
  const statusText = document.getElementById('mihomo-status-text')!;
  const versionRow = document.getElementById('mihomo-version-row') as HTMLElement;
  const versionEl = document.getElementById('mihomo-version')!;
  const dirEl = document.getElementById('mihomo-dir')!;
  const btnDownload = document.getElementById('btn-mihomo-download') as HTMLButtonElement;
  const btnUninstall = document.getElementById('btn-mihomo-uninstall') as HTMLButtonElement;

  try {
    const { installed, version, dir } = await api.mihomoStatus();
    dirEl.textContent = dir;
    if (installed && version) {
      statusText.textContent = '已安装';
      statusText.style.color = '#008000';
      versionRow.style.display = '';
      versionEl.textContent = version;
      btnDownload.style.display = '';
      btnUninstall.style.display = '';
    } else {
      statusText.textContent = '未安装';
      statusText.style.color = '#cc0000';
      versionRow.style.display = 'none';
      btnDownload.style.display = '';
      btnUninstall.style.display = 'none';
    }
  } catch (e) {
    statusText.textContent = '检测失败';
    statusText.style.color = '#cc0000';
    console.error('[Settings] mihomoStatus error:', e);
  }
}

export async function init(): Promise<void> {
  const DEFAULT_SUBSCRIPTION_USER_AGENT = 'clash-verge/v2.5.1';
  const CUSTOM_USER_AGENT_PRESET = '__custom__';

  const config = await api.settingsGet();
  let geoRules = config.geoRules ?? [];
  let timezoneRules = config.timezoneRules ?? [];
  const escapeRuleHtml = (value: string) => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const renderRules = (): void => {
    document.getElementById('geo-rules-tbody')!.innerHTML = geoRules.map(rule => `<tr><td>${escapeRuleHtml(rule.name)}</td><td>${rule.latitude}</td><td>${rule.longitude}</td><td>${rule.builtin ? '内置' : `<button data-geo-edit="${escapeRuleHtml(rule.id)}">编辑</button> <button data-geo-delete="${escapeRuleHtml(rule.id)}">删除</button>`}</td></tr>`).join('');
    document.getElementById('timezone-rules-tbody')!.innerHTML = timezoneRules.map(rule => `<tr><td>${escapeRuleHtml(rule.name)}</td><td>${escapeRuleHtml(rule.timezoneId)}</td><td>${rule.builtin ? '内置' : `<button data-tz-edit="${escapeRuleHtml(rule.id)}">编辑</button> <button data-tz-delete="${escapeRuleHtml(rule.id)}">删除</button>`}</td></tr>`).join('');
    document.querySelectorAll<HTMLButtonElement>('[data-geo-edit]').forEach(button => button.addEventListener('click', async () => {
      const rule = geoRules.find(item => item.id === button.dataset['geoEdit']); if (!rule) return;
      const name = prompt('地区名称', rule.name); if (!name?.trim()) return;
      const latitude = Number(prompt('纬度 (-90 到 90)', String(rule.latitude)));
      const longitude = Number(prompt('经度 (-180 到 180)', String(rule.longitude)));
      if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90 || !Number.isFinite(longitude) || longitude < -180 || longitude > 180) { toast('经纬度范围无效', 'error'); return; }
      geoRules = geoRules.map(item => item.id === rule.id ? { ...item, name: name.trim(), latitude, longitude } : item); await saveRules();
    }));
    document.querySelectorAll<HTMLButtonElement>('[data-geo-delete]').forEach(button => button.addEventListener('click', async () => { geoRules = geoRules.filter(item => item.id !== button.dataset['geoDelete']); await saveRules(); }));
    document.querySelectorAll<HTMLButtonElement>('[data-tz-edit]').forEach(button => button.addEventListener('click', async () => {
      const rule = timezoneRules.find(item => item.id === button.dataset['tzEdit']); if (!rule) return;
      const name = prompt('显示名称', rule.name); if (!name?.trim()) return;
      const timezoneId = prompt('IANA 时区 ID', rule.timezoneId); if (!timezoneId?.trim()) return;
      try { new Intl.DateTimeFormat('en', { timeZone: timezoneId.trim() }); } catch { toast('无效的 IANA 时区 ID', 'error'); return; }
      timezoneRules = timezoneRules.map(item => item.id === rule.id ? { ...item, name: name.trim(), timezoneId: timezoneId.trim() } : item); await saveRules();
    }));
    document.querySelectorAll<HTMLButtonElement>('[data-tz-delete]').forEach(button => button.addEventListener('click', async () => { timezoneRules = timezoneRules.filter(item => item.id !== button.dataset['tzDelete']); await saveRules(); }));
  };
  const saveRules = async (): Promise<void> => {
    const saved = await api.rulesSave({ geoRules, timezoneRules });
    geoRules = saved.geoRules ?? geoRules;
    timezoneRules = saved.timezoneRules ?? timezoneRules;
    config.geoRules = geoRules;
    config.timezoneRules = timezoneRules;
    renderRules();
    toast('规则已保存', 'success');
  };
  document.getElementById('btn-geo-map-import')!.addEventListener('click', () => {
    const url = (document.getElementById('geo-rule-map-url') as HTMLInputElement).value;
    const coordinates = parseGoogleMapsUrl(url);
    if (!coordinates) { toast('无法从该链接识别有效的 Google Maps 经纬度', 'error'); return; }
    (document.getElementById('geo-rule-lat') as HTMLInputElement).value = String(coordinates.latitude);
    (document.getElementById('geo-rule-lon') as HTMLInputElement).value = String(coordinates.longitude);
    if (coordinates.name) (document.getElementById('geo-rule-name') as HTMLInputElement).value = coordinates.name;
    toast(`已导入坐标：${coordinates.latitude}, ${coordinates.longitude}`, 'success');
  });
  document.getElementById('btn-geo-rule-add')!.addEventListener('click', async () => {
    const name = (document.getElementById('geo-rule-name') as HTMLInputElement).value.trim();
    const latitude = Number((document.getElementById('geo-rule-lat') as HTMLInputElement).value);
    const longitude = Number((document.getElementById('geo-rule-lon') as HTMLInputElement).value);
    if (!name || !Number.isFinite(latitude) || latitude < -90 || latitude > 90 || !Number.isFinite(longitude) || longitude < -180 || longitude > 180) { toast('请填写名称及有效的经纬度', 'error'); return; }
    geoRules.push({ id: `custom-geo-${crypto.randomUUID()}`, name, latitude, longitude }); await saveRules();
  });
  document.getElementById('btn-timezone-rule-add')!.addEventListener('click', async () => {
    const name = (document.getElementById('timezone-rule-name') as HTMLInputElement).value.trim();
    const timezoneId = (document.getElementById('timezone-rule-id') as HTMLInputElement).value.trim();
    if (!name || !timezoneId) { toast('请填写显示名称和 IANA 时区 ID', 'error'); return; }
    try { new Intl.DateTimeFormat('en', { timeZone: timezoneId }); } catch { toast('无效的 IANA 时区 ID', 'error'); return; }
    timezoneRules.push({ id: `custom-tz-${crypto.randomUUID()}`, name, timezoneId }); await saveRules();
  });
  renderRules();

  const chromePath = document.getElementById('chrome-path') as HTMLInputElement;
  const logLevel = document.getElementById('log-level') as HTMLSelectElement;
  const homePage = document.getElementById('home-page') as HTMLInputElement;
  const subscriptionUserAgentPreset = document.getElementById('subscription-user-agent-preset') as HTMLSelectElement;
  const subscriptionUserAgent = document.getElementById('subscription-user-agent') as HTMLInputElement;

  chromePath.value = config.chromePath || '';
  logLevel.value = config.logLevel || 'info';
  homePage.value = config.homePage || '';
  const currentSubscriptionUserAgent = config.subscriptionUserAgent?.trim() || DEFAULT_SUBSCRIPTION_USER_AGENT;
  subscriptionUserAgent.value = currentSubscriptionUserAgent;

  const presetValues = Array.from(subscriptionUserAgentPreset.options)
    .map((option) => option.value)
    .filter((value) => value !== CUSTOM_USER_AGENT_PRESET);
  subscriptionUserAgentPreset.value = presetValues.includes(currentSubscriptionUserAgent)
    ? currentSubscriptionUserAgent
    : CUSTOM_USER_AGENT_PRESET;

  subscriptionUserAgentPreset.addEventListener('change', () => {
    const selected = subscriptionUserAgentPreset.value;
    if (selected !== CUSTOM_USER_AGENT_PRESET) {
      subscriptionUserAgent.value = selected;
    } else {
      subscriptionUserAgent.focus();
      subscriptionUserAgent.select();
    }
  });

  subscriptionUserAgent.addEventListener('input', () => {
    const inputValue = subscriptionUserAgent.value.trim();
    subscriptionUserAgentPreset.value = presetValues.includes(inputValue)
      ? inputValue
      : CUSTOM_USER_AGENT_PRESET;
  });

  document.getElementById('btn-save-settings')!.addEventListener('click', async () => {
    await api.settingsSave({
      ...config,
      chromePath: chromePath.value.trim(),
      logLevel: logLevel.value as 'debug' | 'info' | 'warn' | 'error',
      homePage: homePage.value.trim(),
      subscriptionUserAgent: subscriptionUserAgent.value.trim() || DEFAULT_SUBSCRIPTION_USER_AGENT,
      geoRules,
      timezoneRules,
    });
    toast('设置已保存', 'success');
  });

  // Mihomo
  await loadMihomoStatus();

  let pendingDownloadUrl: string | null = null;

  document.getElementById('btn-mihomo-check')!.addEventListener('click', async () => {
    const btn = document.getElementById('btn-mihomo-check') as HTMLButtonElement;
    const latestLabel = document.getElementById('mihomo-latest-label')!;
    const btnDownload = document.getElementById('btn-mihomo-download') as HTMLButtonElement;
    btn.disabled = true;
    btn.textContent = '检查中...';
    try {
      const { version, downloadUrl } = await api.mihomoCheckUpdate();
      latestLabel.textContent = `最新: ${version}`;
      pendingDownloadUrl = downloadUrl;
      btnDownload.style.display = '';
      btnDownload.dataset.url = downloadUrl;
      toast(`最新版本: ${version}`, 'info');
    } catch (e) {
      toast(`检查更新失败: ${(e as Error).message}`, 'error');
    } finally {
      btn.disabled = false;
      btn.textContent = '检查更新';
    }
  });

  api.onMihomoProgress((pct) => {
    const row = document.getElementById('mihomo-progress-row') as HTMLElement;
    const bar = document.getElementById('mihomo-progress') as HTMLProgressElement;
    const pctEl = document.getElementById('mihomo-progress-pct')!;
    row.style.display = '';
    bar.value = pct;
    pctEl.textContent = `${pct}%`;
    if (pct >= 100) {
      setTimeout(() => { row.style.display = 'none'; }, 2000);
    }
  });

  document.getElementById('btn-mihomo-download')!.addEventListener('click', async () => {
    const btn = document.getElementById('btn-mihomo-download') as HTMLButtonElement;
    const url = pendingDownloadUrl || btn.dataset.url;
    if (!url) { toast('请先点击"检查更新"', 'error'); return; }
    btn.disabled = true;
    btn.textContent = '下载中...';
    try {
      await api.mihomoDownload(url);
      toast('Mihomo 下载安装完成', 'success');
      await loadMihomoStatus();
    } catch (e) {
      toast(`下载失败: ${(e as Error).message}`, 'error');
    } finally {
      btn.disabled = false;
      btn.textContent = '下载/更新';
    }
  });

  document.getElementById('btn-mihomo-uninstall')!.addEventListener('click', async () => {
    if (!confirm('确认卸载 Mihomo？')) return;
    try {
      await api.mihomoUninstall();
      toast('Mihomo 已卸载', 'success');
      await loadMihomoStatus();
    } catch (e) {
      toast(`卸载失败: ${(e as Error).message}`, 'error');
    }
  });

  // ── Certificate Management ────────────────────────────────
  function escHtml(str: string): string {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  async function loadCerts(): Promise<void> {
    const tbody = document.getElementById('certs-tbody')!;
    const certs = await api.certList();
    if (certs.length === 0) {
      tbody.innerHTML = '<tr class="empty-row"><td colspan="4" style="text-align:center;padding:8px">暂无自定义根证书</td></tr>';
      return;
    }
    tbody.innerHTML = certs.map(cert => `
      <tr>
        <td>${escHtml(cert.name)}</td>
        <td style="font-size:10px;word-break:break-all">${escHtml(cert.sha256Fingerprint)}</td>
        <td>${new Date(cert.addedAt).toLocaleDateString()}</td>
        <td><button class="btn-cert-delete" data-id="${escHtml(cert.id)}">删除</button></td>
      </tr>
    `).join('');
    tbody.querySelectorAll<HTMLButtonElement>('.btn-cert-delete').forEach(btn => {
      btn.addEventListener('click', async () => {
        const certId = btn.dataset['id']!;
        const certName = certs.find(c => c.id === certId)?.name ?? certId;
        if (!confirm(`确认删除证书 "${certName}"？此操作将同时从系统信任列表中移除。`)) return;
        try {
          await api.certDelete(certId);
          toast('证书已删除', 'success');
          await loadCerts();
        } catch (e) {
          toast(`删除失败：${(e as Error).message}`, 'error');
        }
      });
    });
  }

  document.getElementById('btn-import-cert')!.addEventListener('click', async () => {
    const importBtn = document.getElementById('btn-import-cert') as HTMLButtonElement;
    importBtn.disabled = true;
    importBtn.textContent = '导入中...';
    try {
      const result = await api.certImport();
      if (!result) return;
      const { cert, trustResult } = result;
      if (trustResult.success) {
        toast(`证书 "${cert.name}" 已导入并添加到系统信任`, 'success');
      } else {
        toast(`证书已保存，但添加到系统信任失败：${trustResult.error ?? '未知错误'}`, 'error');
      }
      await loadCerts();
    } catch (e) {
      toast(`导入失败：${(e as Error).message}`, 'error');
    } finally {
      importBtn.disabled = false;
      importBtn.textContent = '导入证书...';
    }
  });

  await loadCerts();
}
