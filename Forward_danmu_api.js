/**
 * 弹幕示例模块
 * 给 module 指定 type 为 danmu 后，默认会携带以下参数：
 * tmdbId: TMDB ID，Optional
 * type: 类型，tv | movie
 * title: 标题
 * season: 季，电影时为空
 * episode: 集，电影时为空
 * link: 链接，Optional
 * videoUrl: 视频链接，Optional
 * commentId: 弹幕ID，Optional。在搜索到弹幕列表后实际加载时会携带
 * animeId: 动漫ID，Optional。在搜索到动漫列表后实际加载时会携带
 *
 */
WidgetMetadata = {
  id: "Forward_danmu_api",
  title: "多源弹幕聚合",
  version: "1.0.3",
  requiredVersion: "0.0.1",
  description: "支持多个自定义弹幕服务器并发请求与去重合并",
  author: "comer",
  site: "https://github.com/comer07/Forward_widgets",
  globalParams: [
    {
      name: "server",
      title: "自定义服务器",
      type: "input",
      placeholders: [
        {
          title: "示例danmu_api",
          value: "https://{domain}/{token}",
        },
      ],
    },
    {
      name: "server2",
      title: "自定义服务器2",
      type: "input",
      placeholders: [
        {
          title: "示例danmu_api",
          value: "https://{domain}/{token}",
        },
      ],
    },
    {
      name: "server3",
      title: "自定义服务器3",
      type: "input",
      placeholders: [
        {
          title: "示例danmu_api",
          value: "https://{domain}/{token}",
        },
      ],
    },
    {
      name: "server4",
      title: "自定义服务器4",
      type: "input",
      placeholders: [
        {
          title: "示例danmu_api",
          value: "https://{domain}/{token}",
        },
      ],
    },
    {
      name: "server5",
      title: "自定义服务器5",
      type: "input",
      placeholders: [
        {
          title: "示例danmu_api",
          value: "https://{domain}/{token}",
        },
      ],
    },
    {
      name: "server6",
      title: "自定义服务器6",
      type: "input",
      placeholders: [
        {
          title: "示例danmu_api",
          value: "https://{domain}/{token}",
        },
      ],
    },
  ],
  modules: [
    {
      id: "searchDanmu",
      title: "搜索弹幕",
      functionName: "searchDanmu",
      type: "danmu",
      params: [],
    },
    {
      id: "getDetail",
      title: "获取详情",
      functionName: "getDetailById",
      type: "danmu",
      params: [],
    },
    {
      id: "getComments",
      title: "获取弹幕",
      functionName: "getCommentsById",
      type: "danmu",
      params: [],
    },
  ],
};

function normalizeServer(s) {
  if (!s || typeof s !== "string") return "";
  let x = s.trim();
  x = x.replace(/\/+$/, "");
  return x;
}

function isValidServer(s) {
  const x = normalizeServer(s);
  if (!x) return false;
  if (x.includes("{domain}") || x.includes("{token}") || (x.includes("{") && x.includes("}"))) return false;
  if (!/^https?:\/\//i.test(x)) return false;
  return true;
}

function getServersFromParams(params) {
  const servers = [params.server, params.server2, params.server3, params.server4, params.server5, params.server6]
    .map(normalizeServer)
    .filter(isValidServer);
  return Array.from(new Set(servers));
}

async function safeGet(url, options) {
  try {
    const response = await Widget.http.get(url, options);
    if (!response) return { ok: false, error: "empty_response" };
    const data = typeof response.data === "string" ? JSON.parse(response.data) : response.data;
    return { ok: true, data };
  } catch (e) {
    return { ok: false, error: e && e.message ? e.message : String(e) };
  }
}

function isMovieRequest(params, title) {
  const t = (params && params.type ? String(params.type) : "").toLowerCase();
  if (t === "movie" || t.includes("movie")) return true;
  const q = (title || "").toLowerCase();
  return q.includes("电影") || q.includes("movie");
}

function isSeriesLikeTitle(title) {
  const t = title || "";
  const lower = t.toLowerCase();
  return (
    /第\s*[一二三四五六七八九十\d]+\s*季/.test(t) ||
    /第\s*[一二三四五六七八九十\d]+\s*[集话]/.test(t) ||
    /\bseason\s*\d+\b/.test(lower) ||
    /\bs\d+\b/.test(lower) ||
    /\bep(isode)?\s*\d+\b/.test(lower)
  );
}

async function searchDanmu(params) {
  params = params || {};
  const title = typeof params.title === "string" ? params.title : "";
  const season = params.season;
  const queryTitle = title;
  const servers = getServersFromParams(params);

  if (!queryTitle) return { animes: [] };
  if (!servers.length) return { animes: [] };

  const headers = {
    "Content-Type": "application/json",
    "User-Agent": "ForwardWidgets/1.0.0",
  };

  const tasks = servers.map((server) =>
    safeGet(`${server}/api/v2/search/anime?keyword=${encodeURIComponent(queryTitle)}`, { headers })
  );
  const results = await Promise.all(tasks);

  let animes = [];
  results.forEach((r) => {
    if (!r.ok) return;
    const data = r.data;
    if (data && data.success && Array.isArray(data.animes) && data.animes.length > 0) {
      animes = animes.concat(data.animes);
    }
  });

  if (animes.length > 0) {
    if (isMovieRequest(params, queryTitle)) {
      const noSeries = [];
      const seriesLike = [];
      animes.forEach((anime) => {
        const t = anime && anime.animeTitle ? String(anime.animeTitle) : "";
        if (isSeriesLikeTitle(t)) {
          seriesLike.push(anime);
        } else {
          noSeries.push(anime);
        }
      });
      animes = noSeries.concat(seriesLike);
    }

    if (season) {
      const matchedAnimes = [];
      const nonMatchedAnimes = [];

      animes.forEach((anime) => {
        if (matchSeason(anime, queryTitle, season) && !(queryTitle.includes("电影") || queryTitle.includes("movie"))) {
          matchedAnimes.push(anime);
        } else {
          nonMatchedAnimes.push(anime);
        }
      });
      animes = [...matchedAnimes, ...nonMatchedAnimes];
    } else {
      const matchedAnimes = [];
      const nonMatchedAnimes = [];

      animes.forEach((anime) => {
        if (queryTitle.includes("电影") || queryTitle.includes("movie")) {
          matchedAnimes.push(anime);
        } else {
          nonMatchedAnimes.push(anime);
        }
      });
      animes = [...matchedAnimes, ...nonMatchedAnimes];
    }
  }

  return { animes };
}

function matchSeason(anime, queryTitle, season) {
  let res = false;
  if (anime.animeTitle.includes(queryTitle)) {
    const title = anime.animeTitle.split("(")[0].trim();
    if (title.startsWith(queryTitle)) {
      const afterTitle = title.substring(queryTitle.length).trim();
      if (afterTitle === "" && season.toString() === "1") {
        res = true;
      }
      const seasonIndex = afterTitle.match(/\d+/);
      if (seasonIndex && seasonIndex[0].toString() === season.toString()) {
        res = true;
      }
      const chineseNumber = afterTitle.match(/[一二三四五六七八九十壹贰叁肆伍陆柒捌玖拾]+/);
      if (chineseNumber && convertChineseNumber(chineseNumber[0]).toString() === season.toString()) {
        res = true;
      }
    }
  }
  return res;
}

function convertChineseNumber(chineseNumber) {
  if (/^\d+$/.test(chineseNumber)) return Number(chineseNumber);

  const digits = {
    零: 0, 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9,
    壹: 1, 貳: 2, 參: 3, 肆: 4, 伍: 5, 陸: 6, 柒: 7, 捌: 8, 玖: 9,
  };
  const units = { 十: 10, 百: 100, 千: 1000, 拾: 10, 佰: 100, 仟: 1000 };

  let result = 0;
  let current = 0;
  let lastUnit = 1;

  for (let i = 0; i < chineseNumber.length; i++) {
    const char = chineseNumber[i];
    if (digits[char] !== undefined) {
      current = digits[char];
    } else if (units[char] !== undefined) {
      const unit = units[char];
      if (current === 0) current = 1;
      if (unit >= lastUnit) result = current * unit;
      else result += current * unit;
      lastUnit = unit;
      current = 0;
    }
  }
  if (current > 0) result += current;
  return result;
}

async function getDetailById(params) {
  params = params || {};
  const animeId = params.animeId;
  if (animeId === undefined || animeId === null || animeId === "") return [];
  const servers = getServersFromParams(params);
  if (!servers.length) return [];

  const headers = {
    "Content-Type": "application/json",
    "User-Agent": "ForwardWidgets/1.0.0",
  };

  const tasks = servers.map((server) => safeGet(`${server}/api/v2/bangumi/${animeId}`, { headers }));
  const results = await Promise.all(tasks);

  const episodes = [];
  const seen = new Set();

  results.forEach((r) => {
    if (!r.ok) return;
    const data = r.data;
    if (!data || !data.bangumi || !Array.isArray(data.bangumi.episodes)) return;

    data.bangumi.episodes.forEach((ep) => {
      const key =
        (ep.episodeId !== undefined ? `eid:${ep.episodeId}` : "") ||
        (ep.id !== undefined ? `id:${ep.id}` : "") ||
        `mix:${ep.episodeTitle || ""}#${ep.episodeNumber || ""}`;
      if (seen.has(key)) return;
      seen.add(key);
      episodes.push(ep);
    });
  });

  // 电影场景强制单集，避免多源返回多个“第1集”导致被识别为 tv_series
  if (episodes.length > 1 && isMovieRequest(params, params && params.title)) {
    let picked = null;
    for (const ep of episodes) {
      const n = ep && ep.episodeNumber !== undefined && ep.episodeNumber !== null ? String(ep.episodeNumber) : "";
      if (n === "1") {
        picked = ep;
        break;
      }
    }
    if (!picked) picked = episodes[0];
    return picked ? [picked] : [];
  }

  return episodes;
}

async function getCommentsById(params) {
  params = params || {};
  const commentId = params.commentId;
  const servers = getServersFromParams(params);
  if (!commentId || !servers.length) return { comments: [] };

  const headers = {
    "Content-Type": "application/json",
    "User-Agent": "ForwardWidgets/1.0.0",
  };

  const tasks = servers.map((server) =>
    safeGet(`${server}/api/v2/comment/${commentId}?withRelated=true&chConvert=1`, { headers }).then((r) => ({
      server,
      result: r,
    }))
  );
  const results = await Promise.all(tasks);

  let base = null;
  const danmakus = [];
  const seen = new Set();

  results.forEach((item) => {
    const r = item.result;
    if (!r.ok) return;
    const data = r.data;
    if (!data) return;
    if (!base) base = data;

    const list = Array.isArray(data.danmakus) ? data.danmakus : Array.isArray(data.comments) ? data.comments : null;
    if (!list) return;

    list.forEach((d) => {
      const key =
        (d.cid !== undefined ? `s:${item.server}|cid:${d.cid}` : "") ||
        (d.id !== undefined ? `s:${item.server}|id:${d.id}` : "") ||
        `mix:${d.p || d.time || ""}|${d.m || d.text || ""}`;
      if (seen.has(key)) return;
      seen.add(key);
      danmakus.push(d);
    });
  });

  if (!base) return { comments: [] };
  if (Array.isArray(base.danmakus)) base.danmakus = danmakus;
  else if (Array.isArray(base.comments)) base.comments = danmakus;
  else base.danmakus = danmakus;
  return base;
}
