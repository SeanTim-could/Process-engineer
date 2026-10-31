// The website downloads compressed, content-verified assets in parallel. The
// standalone HTML remains self-contained. Older browsers use the raw assets.
(() => {
  const assets = window.WorkbenchAssets;
  const nativeFetch = window.fetch.bind(window);
  let resolveStyle, rejectStyle, finished = false, failed = false, executed = false, navigating = false, authMessage = '';
  const reloading = performance.getEntriesByType('navigation')[0]?.type === 'reload';
  const issues = [];
  function record(stage, error) {
    issues.push({stage, reason: error?.message || String(error)});
    if (issues.length > 8) issues.shift();
    try { sessionStorage.setItem('workbench-startup-issues', JSON.stringify(issues)); } catch {}
  }
  const styleReady = new Promise((resolve, reject) => { resolveStyle = resolve; rejectStyle = reject; });
  styleReady.catch(() => {});
  const domReady = document.readyState === 'loading'
    ? new Promise(resolve => document.addEventListener('DOMContentLoaded', resolve, {once: true}))
    : Promise.resolve();
  const progress = {script: 0, style: 0};

  function status(message) {
    const el = document.getElementById('web-startup-status');
    if (el) el.textContent = message;
    else domReady.then(() => {
      const target = document.getElementById('web-startup-status');
      if (target && (!finished || failed)) target.textContent = message;
    });
  }
  function retry() {
    const show = () => {
      for (const id of ['web-startup-retry','web-startup-compatible']) {
        const el = document.getElementById(id);
        if (el) el.hidden = false;
      }
    };
    if (document.readyState === 'loading') domReady.then(show);
    else show();
  }
  function render() {
    if (finished || !assets) return;
    const bytes = assets.script.bytes + assets.style.bytes;
    const loaded = progress.script * assets.script.bytes + progress.style * assets.style.bytes;
    const percent = Math.min(100, Math.floor(loaded / bytes * 100));
    status(progress.script < 1 || progress.style < 1
      ? '正在下载工作台界面（' + percent + '%）…'
      : authMessage || '界面下载完成，正在打开工作台…');
  }
  const slow = setTimeout(() => { if (!finished) { render(); retry(); } }, 10000);
  const api = Object.freeze({
    styleReady,
    progress(message) { authMessage = message; render(); },
    styleLoaded() { resolveStyle(); },
    ready() { finished = true; clearTimeout(slow); },
    executed() { executed = true; },
    fail(message) {
      if (failed) return;
      failed = true; finished = true; clearTimeout(slow);
      status(message); retry(); rejectStyle(new Error(message));
    }
  });
  window.WorkbenchStartup = api;

  async function compressed(kind, fresh = reloading) {
    const info = assets[kind], controller = new AbortController();
    let stall;
    const reset = () => {
      clearTimeout(stall);
      stall = setTimeout(() => controller.abort(), 20000);
    };
    reset();
    try {
      const response = await nativeFetch(new URL(info.compressed, location.href), {
        cache: fresh ? 'reload' : 'force-cache', signal: controller.signal
      });
      if (!response.ok) throw Object.assign(new Error('HTTP ' + response.status), {retryFresh: true});
      let chunks = [], count = 0;
      if (response.body?.getReader) {
        const reader = response.body.getReader();
        while (true) {
          const part = await reader.read();
          if (part.done) break;
          reset(); chunks.push(part.value); count += part.value.length;
          progress[kind] = Math.min(.99, count / info.bytes); render();
        }
      } else {
        const bytes = new Uint8Array(await response.arrayBuffer());
        chunks = [bytes]; count = bytes.length;
      }
      const packed = new Uint8Array(count);
      let offset = 0;
      for (const chunk of chunks) { packed.set(chunk, offset); offset += chunk.length; }
      // Some proxies already unpack .gz responses. Verify the final bytes in
      // either case before making them executable or using them as CSS.
      const bytes = packed[0] === 31 && packed[1] === 139
        ? new Uint8Array(await new Response(new Blob([packed]).stream()
          .pipeThrough(new DecompressionStream('gzip'))).arrayBuffer())
        : packed;
      const hash = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
      const digest = Array.from(hash, value => value.toString(16).padStart(2, '0')).join('');
      if (digest !== info.sha256) throw Object.assign(new Error('Resource verification failed'), {retryFresh: true});
      progress[kind] = 1; render();
      return bytes;
    } catch (error) {
      record(kind + (fresh ? '-fresh' : '-cached'), error);
      if (!fresh && error.retryFresh) return compressed(kind, true);
      throw error;
    } finally { clearTimeout(stall); }
  }
  function rawStyle() {
    return new Promise((resolve, reject) => {
      const link = document.createElement('link');
      const timer = setTimeout(() => { link.remove(); reject(new Error('Style timed out')); }, 45000);
      link.rel = 'stylesheet'; link.href = assets.style.url;
      link.integrity = assets.style.integrity; link.crossOrigin = 'anonymous';
      link.onload = () => { clearTimeout(timer); progress.style = 1; render(); resolve(); };
      link.onerror = () => { clearTimeout(timer); reject(new Error('Style unavailable')); };
      document.head.appendChild(link);
    });
  }
  function script(url, integrity) {
    return new Promise((resolve, reject) => {
      const element = document.createElement('script');
      const timer = setTimeout(() => { element.remove(); reject(new Error('Script timed out')); }, 45000);
      element.src = url;
      if (integrity) { element.integrity = integrity; element.crossOrigin = 'anonymous'; }
      element.onload = () => { clearTimeout(timer); resolve(); };
      element.onerror = () => { clearTimeout(timer); element.remove(); reject(new Error('Script unavailable')); };
      document.head.appendChild(element);
    });
  }
  async function style() {
    try {
      if (typeof DecompressionStream !== 'function' || !globalThis.crypto?.subtle) throw new Error('Use compatible resource');
      const bytes = await compressed('style'), node = document.createElement('style');
      node.textContent = new TextDecoder().decode(bytes); document.head.appendChild(node);
    } catch { await rawStyle(); }
    api.styleLoaded();
  }
  async function app() {
    try {
      if (typeof DecompressionStream !== 'function' || !globalThis.crypto?.subtle) throw new Error('Use compatible resource');
      const bytes = await compressed('script');
      await domReady;
      // The verified code has the same trust as our original inline bootstrap.
      // Avoid blob: execution, which some browsers and browser policies reject.
      const inline = document.createElement('script');
      inline.textContent = new TextDecoder().decode(bytes) + '\n;window.WorkbenchStartup.executed();';
      document.head.appendChild(inline);
      if (!executed) throw new Error('Inline program was blocked');
    } catch (error) {
      record('compressed-program', error);
      progress.script = 0; render();
      await domReady;
      try { await script(assets.script.url, assets.script.integrity); }
      catch (error) {
        record('standard-program', error);
        // A cached failed request must not make every reload fail identically.
        if (!error.message.includes('timed out')) {
          const fresh = new URL(assets.script.url, location.href);
          fresh.searchParams.set('wb_retry', Date.now());
          await script(fresh.href, assets.script.integrity);
        } else throw error;
      }
      progress.script = 1; render();
    }
  }
  async function compatible(kind, error) {
    if (navigating) return;
    navigating = true;
    record(kind, error);
    await domReady;
    if (assets.compatible) {
      finished = true; clearTimeout(slow);
      status('常规加载未成功，正在切换兼容模式…');
      location.replace(new URL(assets.compatible, location.href));
    } else api.fail('工作台加载失败，请重新加载。');
  }
  if (assets) {
    render();
    style().catch(error => compatible('styles-unavailable', error));
    app().catch(error => compatible('program-unavailable', error));
  }
})();
