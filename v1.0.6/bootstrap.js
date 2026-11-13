/* Browser adapter for the verified native web build. No save or inventory writes. */
(async function D2SurvivorsWebBootstrap() {
  'use strict';
  if (location.origin !== 'https://d2survivors.lol' || !['/play/', '/play/index.html'].includes(location.pathname)) {
    throw new Error('此功能只支援 https://d2survivors.lol/play/ 的原生遊戲頁面。');
  }
  if (!document.getElementById('d2-files')) throw new Error('找不到原生遊戲頁面，請等遊戲載入完成。');
  if (document.body?.classList.contains('frontend-open')) throw new Error('請先按「遊玩」並選擇角色，進入營地或關卡後再載入自動控制；中文化已載入。');
  if (window.__D2AUTO) throw new Error('已有自動控制版本，請先儲存遊戲並重新開啟，再載入新版。');
  if (!crypto?.subtle?.digest) throw new Error('目前的瀏覽器環境無法驗證遊戲版本，請更新其執行環境。');

  // Hashes bind the export names to their actual producers, not just a version label.
  const files = {
    art: ['itemArt-BPHOVK4V.js', '46a3e0d6065875f49dff3dc9907f546eee3a1477d0a2c888847517031714c5fc'],
    save: ['saveTransfer-BTsCILil.js', 'aae94e09516606d98d65b26164379e8d521610aa2c3a0924f254c68162b279ef'],
    unique: ['uniquesTab-C3Wez90c.js', '4e176b9b95d0b45648847f29913d647f6f2d35a5c50149ce84797104b57eeacf'],
    game: ['Game-DPAk-Rvc.js', 'b765bef5963d2fe18812da574b6e674fc811af9f4c3a5166d4b66ed519a2ef7d']
  };
  const resources = performance.getEntriesByType('resource').map(entry => entry.name);
  const urls = {};
  for (const [key, [name]] of Object.entries(files)) {
    const expected = new URL(`/assets/${name}`, location.origin).href;
    if (!resources.includes(expected)) throw new Error('這個遊戲版本尚未支援，或角色尚未載入。請先進入營地，再載入自動控制。');
    urls[key] = expected;
  }
  await Promise.all(Object.entries(files).map(async ([key, [, expectedHash]]) => {
    const response = await fetch(urls[key], { cache: 'force-cache', credentials: 'same-origin' });
    if (!response.ok || response.url !== urls[key]) throw new Error('無法讀取原生遊戲模組，已停止載入自動控制。');
    const bytes = await response.arrayBuffer();
    const actualHash = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), value => value.toString(16).padStart(2, '0')).join('');
    if (actualHash !== expectedHash) throw new Error('遊戲程式與已驗證版本不同，已停止載入自動控制，請更新整合包。');
  }));
  const [art, save, unique] = await Promise.all([import(urls.art), import(urls.save), import(urls.unique)]);
  for (const [module, keys] of [[art, ['F', 'pa', 'X', 'Ut', 'Yt', 'Jt', 'J']], [save, ['ns', 'V', 'yn', 'Fr', 'li']], [unique, ['D', 'P']]]) {
    if (keys.some(key => typeof module[key] !== 'function')) throw new Error('原生物品介面不相容，已停止載入自動控制。');
  }
  if (!Array.isArray(unique.u) || unique.u.some(group => !Array.isArray(group?.uniques)) ||
      save.Jo?.columns !== 10 || save.Jo?.rows !== 4 || save.Xo?.columns !== 10 || save.Xo?.rows !== 12 ||
      JSON.stringify(save.Zo) !== JSON.stringify(['personal', 'shared1', 'shared2', 'shared3']) ||
      !['battleCommand', 'battleOrders'].every(key => typeof art.Cn?.[key]?.cast === 'function' && typeof art.Cn[key].gearDescribe === 'function')) {
    throw new Error('原生倉庫、收藏或戰爭招喚介面不相容，已停止載入自動控制。');
  }

  function effectiveMods(gear) {
    // Same composition as native s9: native forge projection, native upgrade
    // projection, then socketed jewels' non-implicit mods. Keep native identity
    // when no projection is needed; never mutate the original gear or item.
    if (!Object.values(gear).some(item => item?.socketed?.length || item && (art.Jt(item) || item.forge?.up))) return gear;
    const result = { ...gear };
    for (const [slot, item] of Object.entries(gear)) {
      if (!item) continue;
      const projected = art.Ut(art.Yt(item));
      if (item.socketed?.length) {
        const sockets = item.socketed.filter(art.J).flatMap(jewel => jewel.mods.filter(mod => !mod.implicit));
        result[slot] = { ...projected, mods: [...projected.mods, ...sockets] };
      } else if (projected !== item) result[slot] = projected;
    }
    return result;
  }
  const native = Object.freeze({
    _c: art.F, Hs: save.ns, of: art.pa, Qa: unique.D, no: unique.P, Y: save.V,
    Ua: typeof unique.p === 'function' ? unique.p : null,
    Ec: art.X, Dn: save.yn, Qc: art.Ut, Ur: save.Fr, _i: save.li,
    __d2autoEffectiveMods: effectiveMods, __d2zh8: unique.u,
    // Optional catalog descriptions reuse the desktop D2ZH read-only exports.
    // Missing skill/base metadata does not hide names or change inventory policy.
    __d2zh0: typeof art.in === 'function' ? art.in : null,
    __d2zh12: typeof art.tn === 'function' ? art.tn : null,
    __d2zh4: Array.isArray(art.Qt) ? art.Qt : null,
    __d2zh6: typeof art.q === 'function' ? art.q : null,
    __d2zh9: typeof art.Q === 'function' ? art.Q : null,
    Ps: save.Jo, Is: save.Xo, Ls: save.Zo, fl: art.Cn
  });
  // Publish only a complete, verified bridge. The renderer still validates its
  // normal contract and captures the page's existing Game instance.
  window.__D2AUTO_WEB = Object.freeze({ api: 1, gameModuleURL: urls.game, native });
})();
