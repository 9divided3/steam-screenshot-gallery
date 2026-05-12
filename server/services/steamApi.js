/**
 * Steam utility helpers — Steam ID resolution, game name lookup, path parsing.
 * The import pipeline phases live separately under services/import/.
 */
const { proxyFetch } = require('./proxyFetch');

/** Look up a game's human-readable name from the Steam Store API. */
async function getGameName(appId) {
  if (!appId) return 'Unknown Game';
  try {
    const url = `https://store.steampowered.com/api/appdetails?appids=${appId}&l=zh-CN`;
    const res = await proxyFetch(url);
    const json = await res.json();
    if (json[appId]?.success) {
      return json[appId].data.name || `App ${appId}`;
    }
    return `App ${appId}`;
  } catch {
    return `App ${appId}`;
  }
}

/** Extract Steam app ID from a folder path matching "remote/<appid>/screenshots". */
function extractAppIdFromPath(folderPath) {
  const m = folderPath.match(/remote[\\/](\d+)[\\/]screenshots/i);
  return m ? parseInt(m[1]) : null;
}

/**
 * Resolve a user-provided Steam identity (URL, custom id, or 64-bit ID)
 * into a 17-digit SteamID64.
 */
async function resolveSteamId(input) {
  const trimmed = input.trim();

  // Already a 17-digit Steam ID
  if (/^\d{17}$/.test(trimmed)) {
    return trimmed;
  }

  // Full profile URL with 64-bit ID
  const profilesMatch = trimmed.match(/profiles\/(\d{17})/);
  if (profilesMatch) {
    return profilesMatch[1];
  }

  // Custom URL (/id/username)
  let customName = trimmed;
  const idMatch = trimmed.match(/steamcommunity\.com\/id\/([^/?]+)/i);
  if (idMatch) {
    customName = idMatch[1];
  }
  customName = customName.replace(/^https?:\/\/steamcommunity\.com\/id\//i, '').replace(/\/$/, '');

  if (!customName || customName.length < 2) {
    throw new Error('无法识别的 Steam 身份格式，请提供 64 位 Steam ID 或完整的个人资料链接');
  }

  const url = `https://steamcommunity.com/id/${encodeURIComponent(customName)}/?xml=1`;
  const response = await proxyFetch(url);
  if (!response.ok) {
    throw new Error(`无法找到该 Steam 用户（${customName}），请确认链接是否正确且个人资料为公开`);
  }
  const xml = await response.text();
  const idMatch2 = xml.match(/<steamID64>(\d{17})<\/steamID64>/);
  if (!idMatch2) {
    throw new Error(`无法获取 Steam ID（${customName}），请确认个人资料为公开状态`);
  }
  return idMatch2[1];
}

module.exports = { getGameName, extractAppIdFromPath, resolveSteamId };
