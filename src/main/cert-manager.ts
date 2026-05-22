import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const execFileAsync = promisify(execFile);

export interface ParsedCert {
  pem: string;
  spkiFingerprint: string;   // base64(sha256(SPKI DER))
  sha256Fingerprint: string; // "AA:BB:..." for display
  sha1Hex: string;           // lowercase hex, for macOS/Windows deletion
  subject: string;
  suggestedName: string;
}

function extractCN(subject: string): string {
  const m = subject.match(/CN\s*=\s*([^,\n/]+)/);
  return m ? m[1].trim() : '';
}

export function parseCertFile(filePath: string): ParsedCert {
  const certBuffer = fs.readFileSync(filePath);
  const x509 = new crypto.X509Certificate(certBuffer);
  const pem = x509.toString(); // normalise to PEM

  // SPKI fingerprint (KeyObject at runtime, even if TS types say CryptoKey)
  const pubKeyObj = x509.publicKey as unknown as crypto.KeyObject;
  const spkiDer = pubKeyObj.export({ type: 'spki', format: 'der' }) as Buffer;
  const spkiFingerprint = crypto.createHash('sha256').update(spkiDer).digest('base64');

  // SHA-1 hex of the DER cert (for macOS keychain deletion)
  const b64 = pem
    .replace(/-----BEGIN CERTIFICATE-----\s*/g, '')
    .replace(/-----END CERTIFICATE-----\s*/g, '')
    .replace(/\s+/g, '');
  const sha1Hex = crypto.createHash('sha1').update(Buffer.from(b64, 'base64')).digest('hex');

  const cn = extractCN(x509.subject);
  const fileBase = path.basename(filePath).replace(/\.(pem|crt|der|cer|cert)$/i, '');
  const suggestedName = cn || fileBase || 'Certificate';

  return {
    pem,
    spkiFingerprint,
    sha256Fingerprint: x509.fingerprint256,
    sha1Hex,
    subject: x509.subject,
    suggestedName,
  };
}

/**
 * Add a certificate file to the OS-level user trust store.
 * macOS  → login keychain (shows system password dialog)
 * Linux  → ~/.pki/nssdb via certutil (needs libnss3-tools / nss-tools)
 * Win32  → current-user Root store via certutil.exe
 */
export async function addCertToOsTrust(
  certPath: string,
  certName: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    if (process.platform === 'darwin') {
      const kchain = path.join(os.homedir(), 'Library', 'Keychains', 'login.keychain-db');
      await execFileAsync('security', [
        'add-trusted-cert', '-r', 'trustRoot', '-p', 'ssl', '-k', kchain, certPath,
      ]);
    } else if (process.platform === 'linux') {
      const nssDb = path.join(os.homedir(), '.pki', 'nssdb');
      if (!fs.existsSync(nssDb)) {
        return { success: false, error: '未找到 NSS 数据库 (~/.pki/nssdb)，请安装 libnss3-tools 并执行 mkdir -p ~/.pki/nssdb && certutil -d sql:~/.pki/nssdb -N' };
      }
      await execFileAsync('certutil', [
        '-A', '-n', certName, '-t', 'CT,c,c', '-i', certPath, '-d', `sql:${nssDb}`,
      ]);
    } else if (process.platform === 'win32') {
      await execFileAsync('certutil.exe', ['-addstore', '-user', 'Root', certPath]);
    }
    return { success: true };
  } catch (e) {
    return { success: false, error: (e as Error).message };
  }
}

/**
 * Remove a certificate from the OS-level user trust store (best-effort).
 */
export async function removeCertFromOsTrust(sha1Hex: string, certName: string): Promise<void> {
  try {
    if (process.platform === 'darwin') {
      const kchain = path.join(os.homedir(), 'Library', 'Keychains', 'login.keychain-db');
      try {
        await execFileAsync('security', ['delete-certificate', '-Z', sha1Hex, kchain]);
      } catch {
        // fallback: delete by common name
        await execFileAsync('security', ['delete-certificate', '-c', certName, kchain])
          .catch(() => { /* ignore */ });
      }
    } else if (process.platform === 'linux') {
      const nssDb = path.join(os.homedir(), '.pki', 'nssdb');
      if (fs.existsSync(nssDb)) {
        await execFileAsync('certutil', ['-D', '-n', certName, '-d', `sql:${nssDb}`])
          .catch(() => { /* ignore */ });
      }
    } else if (process.platform === 'win32') {
      await execFileAsync('certutil.exe', ['-delstore', '-user', 'Root', sha1Hex])
        .catch(() => { /* ignore */ });
    }
  } catch { /* best-effort */ }
}
