// 浏览器代理启动参数：保证环境内的流量只经代理出站。
// 配置有误时一律抛错，由调用方拒绝启动浏览器（fail-closed），绝不退化为直连。

/** 与代理配合使用的防泄漏参数 */
export const LEAK_PROTECTION_ARGS: readonly string[] = [
  // WebRTC 只允许经代理的连接，禁止 UDP 直连 STUN 服务器暴露真实公网 IP
  '--force-webrtc-ip-handling-policy=disable_non_proxied_udp',
  // QUIC 基于 UDP，无法经 SOCKS/HTTP 代理转发
  '--disable-quic',
];

export type BrowserProxy =
  | { kind: 'mihomo'; socksPort: number }
  | { kind: 'simple'; raw: string };

export interface ProxyEndpoint {
  /** 传给 --proxy-server 的规范化地址 */
  server: string;
  host: string;
}

const SIMPLE_PROXY_RE = /^(?:([a-z0-9]+):\/\/)?(?:([^@/\s]*)@)?(\[[0-9a-f:.]+\]|[a-z0-9.-]+):(\d{1,5})\/?$/i;
/** Chrome 的 socks5 本身就在代理端解析域名，socks5h 等价 */
const SCHEME_MAP: Record<string, string> = { http: 'http', https: 'https', socks5: 'socks5', socks5h: 'socks5' };
/** Chrome 中 socks:// 即 SOCKS4，只能传 IP，域名会在本机解析 */
const SOCKS4_SCHEMES = new Set(['socks', 'socks4', 'socks4a']);

/** host-resolver-rules 按不带方括号的主机名匹配，IPv6 需去掉方括号 */
function resolverPattern(host: string): string {
  return host.replace(/^\[(.*)\]$/, '$1');
}

/** 解析「简单代理」地址，只接受 [协议://]主机:端口 */
export function parseSimpleProxy(raw: string): ProxyEndpoint {
  const input = raw.trim();
  if (!input) throw new Error('简单代理地址为空，已阻止启动以免使用真实 IP');
  const m = SIMPLE_PROXY_RE.exec(input);
  if (!m) throw new Error(`简单代理格式无效：「${input}」，应为 [协议://]主机:端口，例如 socks5://127.0.0.1:1080`);

  const [, rawScheme = 'http', userinfo, host, portStr] = m;
  const scheme = rawScheme.toLowerCase();
  if (userinfo !== undefined) {
    throw new Error('Chrome 不支持带账号密码的代理地址，请改用 mihomo 订阅节点或无认证的代理');
  }
  if (SOCKS4_SCHEMES.has(scheme)) {
    throw new Error('SOCKS4 无法远程解析域名，会经本机 DNS 泄漏访问记录，请改用 socks5 或 http 代理');
  }
  const mapped = SCHEME_MAP[scheme];
  if (!mapped) throw new Error(`不支持的代理协议：${scheme}（支持 http、https、socks5）`);
  const port = Number(portStr);
  if (port < 1 || port > 65535) throw new Error(`简单代理端口无效：${portStr}`);
  return { server: `${mapped}://${host}:${port}`, host };
}

function endpointOf(proxy: BrowserProxy): ProxyEndpoint {
  if (proxy.kind === 'simple') return parseSimpleProxy(proxy.raw);
  const port = proxy.socksPort;
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error(`mihomo 端口无效：${port}`);
  return { server: `socks5://127.0.0.1:${port}`, host: '127.0.0.1' };
}

/** 生成代理相关的 Chrome 启动参数 */
export function buildProxyArgs(proxy: BrowserProxy): string[] {
  const { server, host } = endpointOf(proxy);
  const excluded = ['localhost', resolverPattern(host)];
  return [
    `--proxy-server=${server}`,
    // 禁止本机 DNS 解析：域名一律交给代理远程解析，只放行代理服务器自身。
    // MAP * 对 IP 字面量同样生效，因此代理地址无论是 IP 还是域名都必须放行，否则浏览器连不上代理
    `--host-resolver-rules=${['MAP * ~NOTFOUND', ...excluded.map(h => `EXCLUDE ${h}`)].join(' , ')}`,
    // host-resolver-rules 属于 Chrome 的「不受支持的命令行参数」，会弹出稳定性警告栏；
    // --test-type 只抑制该警告栏（与 chromedriver 做法一致），不影响上面的 DNS 防泄漏规则
    '--test-type',
    ...LEAK_PROTECTION_ARGS,
  ];
}
