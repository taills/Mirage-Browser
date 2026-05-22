export interface GpuPreset {
  label: string;
  vendor: string;
  renderer: string;
}

export const GPU_PRESET_MAP: Record<string, GpuPreset> = {
  nvidia_gtx1060: {
    label: 'NVIDIA GeForce GTX 1060 (Win)',
    vendor: 'Google Inc. (NVIDIA Corporation)',
    renderer: 'ANGLE (NVIDIA, NVIDIA GeForce GTX 1060 (D3D11-27.21.14.{HASH}), D3D11)',
  },
  nvidia_gtx1080ti: {
    label: 'NVIDIA GeForce GTX 1080 Ti (Win)',
    vendor: 'Google Inc. (NVIDIA Corporation)',
    renderer: 'ANGLE (NVIDIA, NVIDIA GeForce GTX 1080 Ti (D3D11-27.21.14.{HASH}), D3D11)',
  },
  nvidia_rtx2080: {
    label: 'NVIDIA GeForce RTX 2080 (Win)',
    vendor: 'Google Inc. (NVIDIA Corporation)',
    renderer: 'ANGLE (NVIDIA, NVIDIA GeForce RTX 2080 (D3D11-27.21.14.{HASH}), D3D11)',
  },
  nvidia_rtx3060: {
    label: 'NVIDIA GeForce RTX 3060 (Win)',
    vendor: 'Google Inc. (NVIDIA Corporation)',
    renderer: 'ANGLE (NVIDIA, NVIDIA GeForce RTX 3060 (D3D11-30.0.14.{HASH}), D3D11)',
  },
  nvidia_rtx3080: {
    label: 'NVIDIA GeForce RTX 3080 (Win)',
    vendor: 'Google Inc. (NVIDIA Corporation)',
    renderer: 'ANGLE (NVIDIA, NVIDIA GeForce RTX 3080 (D3D11-30.0.14.{HASH}), D3D11)',
  },
  nvidia_rtx4070: {
    label: 'NVIDIA GeForce RTX 4070 (Win)',
    vendor: 'Google Inc. (NVIDIA Corporation)',
    renderer: 'ANGLE (NVIDIA, NVIDIA GeForce RTX 4070 (D3D11-31.0.15.{HASH}), D3D11)',
  },
  nvidia_rtx4090: {
    label: 'NVIDIA GeForce RTX 4090 (Win)',
    vendor: 'Google Inc. (NVIDIA Corporation)',
    renderer: 'ANGLE (NVIDIA, NVIDIA GeForce RTX 4090 (D3D11-31.0.15.{HASH}), D3D11)',
  },
  amd_rx580: {
    label: 'AMD Radeon RX 580 (Win)',
    vendor: 'Google Inc. (AMD)',
    renderer: 'ANGLE (AMD, AMD Radeon RX 580 Series (D3D11-27.20.12028.{HASH}), D3D11)',
  },
  amd_rx6700xt: {
    label: 'AMD Radeon RX 6700 XT (Win)',
    vendor: 'Google Inc. (AMD)',
    renderer: 'ANGLE (AMD, AMD Radeon RX 6700 XT (D3D11-30.0.13023.{HASH}), D3D11)',
  },
  amd_rx7900xtx: {
    label: 'AMD Radeon RX 7900 XTX (Win)',
    vendor: 'Google Inc. (AMD)',
    renderer: 'ANGLE (AMD, AMD Radeon RX 7900 XTX (D3D11-31.0.14051.{HASH}), D3D11)',
  },
  intel_uhd620: {
    label: 'Intel UHD Graphics 620 (Win)',
    vendor: 'Google Inc. (Intel)',
    renderer: 'ANGLE (Intel, Intel UHD Graphics 620 (D3D11-27.20.100.{HASH}), D3D11)',
  },
  intel_uhd770: {
    label: 'Intel UHD Graphics 770 (Win)',
    vendor: 'Google Inc. (Intel)',
    renderer: 'ANGLE (Intel, Intel UHD Graphics 770 (D3D11-31.0.101.{HASH}), D3D11)',
  },
  intel_iris_xe: {
    label: 'Intel Iris Xe Graphics (Win)',
    vendor: 'Google Inc. (Intel)',
    renderer: 'ANGLE (Intel, Intel Iris Xe Graphics (D3D11-31.0.101.{HASH}), D3D11)',
  },
  apple_m1: {
    label: 'Apple M1',
    vendor: 'Apple Inc.',
    renderer: 'ANGLE (Apple, Apple M1 (Metal), Metal)',
  },
  apple_m5: {
    label: 'Apple M5',
    vendor: 'Apple Inc.',
    renderer: 'ANGLE (Apple, Apple M5 (Metal), Metal)',
  },
  apple_m3: {
    label: 'Apple M3',
    vendor: 'Apple Inc.',
    renderer: 'ANGLE (Apple, Apple M3 (Metal), Metal)',
  },
  apple_a14: {
    label: 'Apple A14 GPU (iPhone 12/13)',
    vendor: 'Apple Inc.',
    renderer: 'ANGLE (Apple, Apple A14 GPU (Metal), Metal)',
  },
  apple_a15: {
    label: 'Apple A15 GPU (iPhone 13 Pro/14)',
    vendor: 'Apple Inc.',
    renderer: 'ANGLE (Apple, Apple A15 GPU (Metal), Metal)',
  },
  apple_a16: {
    label: 'Apple A16 GPU (iPhone 14 Pro)',
    vendor: 'Apple Inc.',
    renderer: 'ANGLE (Apple, Apple A16 GPU (Metal), Metal)',
  },
  apple_a17: {
    label: 'Apple A17 GPU (iPhone 15 Pro/16 Pro)',
    vendor: 'Apple Inc.',
    renderer: 'ANGLE (Apple, Apple A17 GPU (Metal), Metal)',
  },
  adreno_650: {
    label: 'Qualcomm Adreno 650 (Android)',
    vendor: 'Qualcomm',
    renderer: 'ANGLE (Qualcomm, Qualcomm Adreno 650 (OpenGL ES 3.2), OpenGL ES)',
  },
};

export function getGpuPoolForPlatform(platform: string): string[] {
  if (platform === 'Win32') {
    return [
      'nvidia_gtx1060', 'nvidia_gtx1080ti', 'nvidia_rtx2080', 'nvidia_rtx3060',
      'nvidia_rtx3080', 'nvidia_rtx4070', 'nvidia_rtx4090', 'amd_rx580',
      'amd_rx6700xt', 'amd_rx7900xtx', 'intel_uhd620', 'intel_uhd770', 'intel_iris_xe',
    ];
  }
  if (platform === 'MacIntel') return ['apple_m1','apple_m3','apple_m5'];
  if (platform === 'iPhone') return ['apple_a14', 'apple_a15', 'apple_a16', 'apple_a17'];
  if (platform === 'Linux armv8l') return ['adreno_650'];
  if (platform === 'Linux x86_64') return ['nvidia_rtx3060', 'nvidia_rtx3080', 'amd_rx6700xt', 'intel_iris_xe'];
  return Object.keys(GPU_PRESET_MAP);
}
