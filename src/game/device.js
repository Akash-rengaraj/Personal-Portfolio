/**
 * Picks a starting graphics tier from what the browser reveals about the device: the GPU
 * (WebGL's renderer string), CPU threads, memory and whether it's a phone or tablet. It errs
 * low — a fast machine that starts on "medium" still looks good, a slow one that starts on
 * "high" stutters or runs out of memory. Auto mode also steps down at runtime if frames drop.
 */

const SOFTWARE = /swiftshader|llvmpipe|softpipe|software|basic render|gdi generic/i;
const DISCRETE = /nvidia|geforce|quadro|rtx|gtx|radeon\s*(rx|pro|r9|vii)|radeon\s*\d{3,4}m?\b|arc\s*a\d{3}|apple m\d\s*(pro|max|ultra)/i;
const MODERN_INTEGRATED = /iris|xe graphics|arc graphics|\((adl|rpl|mtl|lnl|arl|tgl|jsl)\b|radeon(\(tm\))?\s*(graphics|\d{3}m)|vega|apple m\d|apple gpu/i;
const OLD_INTEGRATED = /intel|uhd|hd graphics|mali|adreno|powervr|videocore/i;
const STRONG_MOBILE = /apple gpu|adreno.*\b(7[3-9]\d|[89]\d\d)\b|mali-g(7[1-9]|[89]\d|\d{3})|xclipse|immortalis/i;

const TIERS = ['low', 'medium', 'high'];
const lower = (a, b) => TIERS[Math.min(TIERS.indexOf(a), TIERS.indexOf(b))];

let probed;

/** The GPU's name as WebGL reports it (unmasked where the browser allows), or ''. */
export function gpuName() {
  if (probed !== undefined) return probed;
  probed = '';
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2', { powerPreference: 'high-performance' }) || canvas.getContext('webgl');
    if (gl) {
      const info = gl.getExtension('WEBGL_debug_renderer_info');
      probed = String(gl.getParameter(info ? info.UNMASKED_RENDERER_WEBGL : gl.RENDERER) || '');
      gl.getExtension('WEBGL_lose_context')?.loseContext();
    }
  } catch {
    probed = '';
  }
  return probed;
}

/** Short readable GPU label for the settings menu ("Intel Iris Xe", "NVIDIA GeForce RTX 3060"…). */
function shortGpu(gpu) {
  const inner = gpu.match(/ANGLE \([^,]+,\s*([^,]+?)(\s+Direct3D.*|\s+\(0x.*|,.*)?\)$/)?.[1] ?? gpu;
  return inner
    .replace(/^Mesa\s+/i, '')
    .replace(/\((R|TM)\)/gi, '')
    .replace(/\s*\/PCIe.*$/i, '')
    .replace(/ANGLE Metal Renderer:\s*/i, '')
    .replace(/,?\s*Unspecified Version/i, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 40);
}

/**
 * Suggested tier for this device. Returns { tier: 'low' | 'medium' | 'high', gpu, reason }.
 * `touch` is true on coarse-pointer devices (phones and tablets).
 */
export function detectQuality({ touch = false } = {}) {
  const gpu = gpuName();
  const cores = navigator.hardwareConcurrency || 4;
  const memory = navigator.deviceMemory; // GB, Chromium only (capped at 8)
  let tier;
  let reason;
  if (SOFTWARE.test(gpu)) {
    tier = 'low';
    reason = 'software rendering — is hardware acceleration off?';
  } else if (touch) {
    tier = STRONG_MOBILE.test(gpu) || (memory >= 6 && cores >= 8) ? 'medium' : 'low';
    reason = 'phone / tablet';
  } else if (DISCRETE.test(gpu)) {
    tier = cores >= 6 ? 'high' : 'medium';
    reason = 'fast graphics';
  } else if (MODERN_INTEGRATED.test(gpu)) {
    tier = 'medium';
    reason = 'integrated graphics';
  } else if (OLD_INTEGRATED.test(gpu)) {
    tier = cores >= 8 && (memory ?? 8) >= 8 ? 'medium' : 'low';
    reason = 'older integrated graphics';
  } else {
    tier = 'medium';
    reason = gpu ? 'unrecognised graphics' : 'graphics not reported';
  }
  const fewCores = cores <= 4;
  const lowMemory = memory !== undefined && memory <= 4;
  if (fewCores || lowMemory) {
    tier = lower(tier, 'low');
    reason = [fewCores && `${cores} CPU threads`, lowMemory && `${memory} GB memory`].filter(Boolean).join(', ');
  }
  return { tier, gpu: shortGpu(gpu), reason };
}
