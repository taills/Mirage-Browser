import { describe, it, expect } from 'vitest';
import { parseSimpleProxy, buildProxyArgs, LEAK_PROTECTION_ARGS } from './browser-proxy';

describe('parseSimpleProxy', () => {
  it.each([
    ['127.0.0.1:7890', 'http://127.0.0.1:7890', '127.0.0.1'],
    ['  http://10.0.0.2:8080/ ', 'http://10.0.0.2:8080', '10.0.0.2'],
    ['HTTPS://proxy.example.com:443', 'https://proxy.example.com:443', 'proxy.example.com'],
    ['socks5://1.2.3.4:1080', 'socks5://1.2.3.4:1080', '1.2.3.4'],
    ['socks5h://gw.example.com:1080', 'socks5://gw.example.com:1080', 'gw.example.com'],
    ['http://[::1]:8080', 'http://[::1]:8080', '[::1]'],
  ])('接受 %s', (raw, server, host) => {
    expect(parseSimpleProxy(raw)).toEqual({ server, host });
  });

  it.each([
    ['socks4://1.2.3.4:1080', /SOCKS4/],
    ['socks://1.2.3.4:1080', /SOCKS4/],
    ['socks5://user:pass@1.2.3.4:1080', /账号密码/],
    ['', /为空/],
    ['   ', /为空/],
    ['1.2.3.4', /格式/],
    ['1.2.3.4:0', /端口/],
    ['1.2.3.4:70000', /端口/],
    ['ftp://1.2.3.4:21', /协议/],
    ['a:1;b:2', /格式/],
    ['http=a:1', /格式/],
    ['bad host:1', /格式/],
  ])('拒绝 %s', (raw, msg) => {
    expect(() => parseSimpleProxy(raw)).toThrow(msg);
  });
});

describe('buildProxyArgs', () => {
  it('mihomo：指向本机 socks5 端口，禁止本地 DNS 并启用泄漏防护', () => {
    const args = buildProxyArgs({ kind: 'mihomo', socksPort: 41234 });
    expect(args).toEqual([
      '--proxy-server=socks5://127.0.0.1:41234',
      '--host-resolver-rules=MAP * ~NOTFOUND , EXCLUDE localhost , EXCLUDE 127.0.0.1',
      '--test-type',
      ...LEAK_PROTECTION_ARGS,
    ]);
  });

  // MAP * 同样作用于 IP 字面量，不放行代理 IP 会导致浏览器连不上代理
  it.each([
    ['http://10.0.0.2:8080', 'EXCLUDE 10.0.0.2'],
    ['http://[::1]:8080', 'EXCLUDE ::1'],
  ])('简单代理 %s 使用 IP 时也放行代理地址', (raw, rule) => {
    expect(buildProxyArgs({ kind: 'simple', raw })[1]).toBe(`--host-resolver-rules=MAP * ~NOTFOUND , EXCLUDE localhost , ${rule}`);
  });

  it('简单代理使用域名时放行代理服务器自身的解析', () => {
    const args = buildProxyArgs({ kind: 'simple', raw: 'socks5://gw.example.com:1080' });
    expect(args[0]).toBe('--proxy-server=socks5://gw.example.com:1080');
    expect(args[1]).toBe('--host-resolver-rules=MAP * ~NOTFOUND , EXCLUDE localhost , EXCLUDE gw.example.com');
  });

  it('泄漏防护包含 WebRTC 策略与禁用 QUIC', () => {
    expect(LEAK_PROTECTION_ARGS).toContain('--force-webrtc-ip-handling-policy=disable_non_proxied_udp');
    expect(LEAK_PROTECTION_ARGS).toContain('--disable-quic');
  });

  it.each([0, 65536, 1.5, NaN])('拒绝非法的 mihomo 端口 %s', port => {
    expect(() => buildProxyArgs({ kind: 'mihomo', socksPort: port })).toThrow();
  });

  it('简单代理非法时抛错而不是返回空参数', () => {
    expect(() => buildProxyArgs({ kind: 'simple', raw: 'socks4://1.2.3.4:1' })).toThrow();
  });
});
