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
  version: "1.0.2",
  requiredVersion: "0.0.1",
  description: "支持多个自定义弹幕服务器并发请求与去重合并",
  author: "𝗰𝗼𝗺𝗲𝗿",
  site: "https://github.com/comer07/Forward_widgets",
  globalParams: [
    {
      name: "server",
      title: "自定义服务器",
      type: "input",
      placeholder: "https://{domain}/{token}",
    },
    {
      name: "server2",
      title: "自定义服务器2",
      type: "input",
      placeholder: "https://{domain}/{token}",
    },
    {
      name: "server3",
      title: "自定义服务器3",
      type: "input",
      placeholder: "https://{domain}/{token}",
    },
    {
      name: "server4",
      title: "自定义服务器4",
      type: "input",
      placeholder: "https://{domain}/{token}",
    },
    {
      name: "server5",
      title: "自定义服务器5",
      type: "input",
      placeholder: "https://{domain}/{token}",
    },
    {
      name: "server6",
      title: "自定义服务器6",
      type: "input",
      placeholder: "https://{domain}/{token}",
    },
  ],
  modules: [
    {
      //id需固定为searchDanmu
      id: "searchDanmu",
      title: "搜索弹幕",
      functionName: "searchDanmu",
      type: "danmu",
      params: [],
    },
    {
      //id需固定为getDetail
      id: "getDetail",
      title: "获取详情",
      functionName: "getDetailById",
      type: "danmu",
      params: [],
    },
    {
      //id需固定为getComments
      id: "getComments",
      title: "获取弹幕",
      functionName: "getCommentsById",
      type: "danmu",
      params: [],
    },
  ],
};

const SOURCE_KEY = "forward_danmu_source_map";
const REQUEST_TIMEOUT_MS = 4000;

function normalizeServer(s) {
  if (!s || typeof s !== "string") return "";
  let x = s.trim();
  // 去掉末尾 /
  x = x.replace(/\/+$/, "");
  return x;
}

// 未填写 / 还是示例模板（https://{domain}/{token}）就不请求
function isValidServer(s) {
  const x = normalizeServer(s);
  if (!x) return false;
  // 如果用户把示例模板当作真实值填了，也跳过
  if (x.includes("{domain}") || x.includes("{token}") || (x.includes("{") && x.includes("}"))) return false;
  // 简单限制为 http/https
  if (!/^https?:\/\//i.test(x)) return false;
  return true;
}

function getServersFromParams(params) {
  const servers = [
    params.server,
    params.server2,
    params.server3,
    params.server4,
    params.server5,
    params.server6,
  ]
    .map(normalizeServer)
    .filter(isValidServer);

  // 去重
  return Array.from(new Set(servers));
}

async function saveSource(id, server) {
  if (id === undefined || id === null || !server) return;
  try {
    let map = await Widget.storage.get(SOURCE_KEY);
    map = map ? JSON.parse(map) : {};
    const key = String(id);
    const oldVal = map[key];
    const list = Array.isArray(oldVal) ? oldVal : oldVal ? [oldVal] : [];
    if (!list.includes(server)) list.push(server);
    map[key] = list;
    await Widget.storage.set(SOURCE_KEY, JSON.stringify(map));
  } catch (e) {}
}

async function saveSourcesBatch(items) {
  if (!Array.isArray(items) || items.length === 0) return;
  try {
    let map = await Widget.storage.get(SOURCE_KEY);
    map = map ? JSON.parse(map) : {};
    for (const item of items) {
      if (!item) continue;
      const { id, server } = item;
      if (id === undefined || id === null || !server) continue;
      const key = String(id);
      const oldVal = map[key];
      const list = Array.isArray(oldVal) ? oldVal : oldVal ? [oldVal] : [];
      if (!list.includes(server)) list.push(server);
      map[key] = list;
    }
    await Widget.storage.set(SOURCE_KEY, JSON.stringify(map));
  } catch (e) {}
}

async function getSource(id) {
  if (id === undefined || id === null) return null;
  try {
    const map = await Widget.storage.get(SOURCE_KEY);
    if (!map) return null;
    const parsed = JSON.parse(map);
    const val = parsed[String(id)];
    if (!val) return null;
    return Array.isArray(val) ? val : [val];
  } catch (e) {
    return null;
  }
}

async function safeGet(url, options) {
  try {
    const timeoutPromise = new Promise((resolve) =>
      setTimeout(() => resolve({ __timeout: true }), REQUEST_TIMEOUT_MS)
    );
    const response = await Promise.race([Widget.http.get(url, options), timeoutPromise]);
    if (response && response.__timeout) {
      return { ok: false, error: "timeout" };
    }
    if (!response) return { ok: false, error: "empty_response" };
    const data = typeof response.data === "string" ? JSON.parse(response.data) : response.data;
    return { ok: true, data };
  } catch (e) {
    return { ok: false, error: e && e.message ? e.message : String(e) };
  }
}

function isMovieQuery(params, queryTitle) {
  const t = (params && params.type ? String(params.type) : "").toLowerCase();
  if (t === "movie" || t === "film" || t.includes("movie")) return true;
  const noSeason = !(params && params.season !== undefined && params.season !== null && String(params.season).trim() !== "");
  const noEpisode = !(params && params.episode !== undefined && params.episode !== null && String(params.episode).trim() !== "");
  if (noSeason && noEpisode) return true;
  const q = (queryTitle || "").toLowerCase();
  return q.includes("电影") || q.includes("movie") || q.includes("film");
}

function isSeriesLikeByTitle(title) {
  const t = (title || "").toLowerCase();
  return (
    /第\s*[一二三四五六七八九十\d]+\s*季/.test(title || "") ||
    /第\s*\d+\s*部/.test(title || "") ||
    /\bs\d+\b/.test(t) ||
    /\bseason\s*\d+\b/.test(t) ||
    /\bep(isode)?\s*\d+\b/.test(t) ||
    /第\s*[一二三四五六七八九十\d]+\s*[集话]/.test(title || "")
  );
}

function isMovieLikeAnime(anime) {
  const title = anime && anime.animeTitle ? String(anime.animeTitle) : "";
  const typeText = [
    anime && anime.type !== undefined ? String(anime.type) : "",
    anime && anime.animeType !== undefined ? String(anime.animeType) : "",
    anime && anime.typeDescription !== undefined ? String(anime.typeDescription) : "",
    anime && anime.category !== undefined ? String(anime.category) : "",
  ]
    .join(" ")
    .toLowerCase();

  if (typeText.includes("movie") || typeText.includes("film") || typeText.includes("电影")) return true;
  if (typeText.includes("tv") || typeText.includes("series") || typeText.includes("剧集") || typeText.includes("番剧")) return false;

  if (/剧场版|电影版|電影版|movie|film/i.test(title)) return true;
  if (isSeriesLikeByTitle(title)) return false;
  return false;
}

function isNeutralMovieCandidate(anime) {
  const title = anime && anime.animeTitle ? String(anime.animeTitle) : "";
  if (!title) return false;
  return !isSeriesLikeByTitle(title);
}

async function searchDanmu(params) {
  const { title, season } = params;

  let queryTitle = title;
  const servers = getServersFromParams(params);

  // 没填任何 server，直接返回空
  if (!servers.length) {
    return { animes: [] };
  }

  const headers = {
    "Content-Type": "application/json",
    "User-Agent": "ForwardWidgets/1.0.0",
  };

  // 并发请求：所有填写了的 server 都会请求
  const tasks = servers.map((server) =>
    safeGet(`${server}/api/v2/search/anime?keyword=${encodeURIComponent(queryTitle)}`, { headers }).then((r) => ({
      server,
      result: r,
    }))
  );

  const results = await Promise.all(tasks);

  // 合并所有服务器的 animes（忽略失败的）
  let animes = [];
  const sourceWrites = [];
  for (const item of results) {
    const r = item.result;
    if (!r.ok) continue;
    const data = r.data;
    if (data && data.success && Array.isArray(data.animes) && data.animes.length > 0) {
      for (const anime of data.animes) {
        const animeWithSource = { ...anime, sourceServer: item.server };
        animes.push(animeWithSource);
        sourceWrites.push({ id: anime.animeId, server: item.server });
      }
    }
  }
  await saveSourcesBatch(sourceWrites);

  // 原有排序逻辑尽量保持不变
  if (animes.length > 0) {
    // 电影请求：优先电影候选，避免同名剧集（第1集/第X季）被排前导致识别成 tv_series
    if (isMovieQuery(params, queryTitle)) {
      const movieLike = [];
      const neutral = [];
      const seriesLike = [];
      animes.forEach((anime) => {
        if (isMovieLikeAnime(anime)) {
          movieLike.push(anime);
        } else if (isNeutralMovieCandidate(anime)) {
          neutral.push(anime);
        } else {
          seriesLike.push(anime);
        }
      });
      animes = [...movieLike, ...neutral, ...seriesLike];
    }

    if (season) {
      // order by season
      const matchedAnimes = [];
      const nonMatchedAnimes = [];

      animes.forEach((anime) => {
        if (matchSeason(anime, queryTitle, season) && !(queryTitle.includes("电影") || queryTitle.includes("movie"))) {
          matchedAnimes.push(anime);
        } else {
          nonMatchedAnimes.push(anime);
        }
      });

      // Combine matched and non-matched animes, with matched ones at the front
      animes = [...matchedAnimes, ...nonMatchedAnimes];
    } else {
      // order by type
      const matchedAnimes = [];
      const nonMatchedAnimes = [];

      animes.forEach((anime) => {
        if (queryTitle.includes("电影") || queryTitle.includes("movie")) {
          matchedAnimes.push(anime);
        } else {
          nonMatchedAnimes.push(anime);
        }
      });

      // Combine matched and non-matched animes, with matched ones at the front
      animes = [...matchedAnimes, ...nonMatchedAnimes];
    }
  }

  return {
    animes: animes,
  };
}

function matchSeason(anime, queryTitle, season) {
  console.log("start matchSeason: ", anime.animeTitle, queryTitle, season);
  let res = false;
  if (anime.animeTitle.includes(queryTitle)) {
    const title = anime.animeTitle.split("(")[0].trim();
    if (title.startsWith(queryTitle)) {
      const afterTitle = title.substring(queryTitle.length).trim();
      console.log("start matchSeason afterTitle: ", afterTitle);
      if (afterTitle === "" && season.toString() === "1") {
        res = true;
      }
      // match number from afterTitle
      const seasonIndex = afterTitle.match(/\d+/);
      if (seasonIndex && seasonIndex[0].toString() === season.toString()) {
        res = true;
      }
      // match chinese number
      const chineseNumber = afterTitle.match(/[一二三四五六七八九十壹贰叁肆伍陆柒捌玖拾]+/);
      if (chineseNumber && convertChineseNumber(chineseNumber[0]).toString() === season.toString()) {
        res = true;
      }
    }
  }
  console.log("start matchSeason res: ", res);
  return res;
}

function convertChineseNumber(chineseNumber) {
  // 如果是阿拉伯数字，直接转换
  if (/^\d+$/.test(chineseNumber)) {
    return Number(chineseNumber);
  }

  // 中文数字映射（简体+繁体）
  const digits = {
    // 简体
    零: 0,
    一: 1,
    二: 2,
    三: 3,
    四: 4,
    五: 5,
    六: 6,
    七: 7,
    八: 8,
    九: 9,
    // 繁体
    壹: 1,
    貳: 2,
    參: 3,
    肆: 4,
    伍: 5,
    陸: 6,
    柒: 7,
    捌: 8,
    玖: 9,
  };

  // 单位映射（简体+繁体）
  const units = {
    // 简体
    十: 10,
    百: 100,
    千: 1000,
    // 繁体
    拾: 10,
    佰: 100,
    仟: 1000,
  };

  let result = 0;
  let current = 0;
  let lastUnit = 1;

  for (let i = 0; i < chineseNumber.length; i++) {
    const char = chineseNumber[i];

    if (digits[char] !== undefined) {
      // 数字
      current = digits[char];
    } else if (units[char] !== undefined) {
      // 单位
      const unit = units[char];

      if (current === 0) current = 1;

      if (unit >= lastUnit) {
        // 更大的单位，重置结果
        result = current * unit;
      } else {
        // 更小的单位，累加到结果
        result += current * unit;
      }

      lastUnit = unit;
      current = 0;
    }
  }

  // 处理最后的个位数
  if (current > 0) {
    result += current;
  }

  return result;
}

async function getDetailById(params) {
  const { animeId } = params;
  const routedServers = params.sourceServer
    ? [normalizeServer(params.sourceServer)]
    : ((await getSource(animeId)) || []).map(normalizeServer);
  const fallbackServers = getServersFromParams(params);
  const servers = Array.from(new Set([...routedServers, ...fallbackServers].filter(Boolean)));

  if (!servers.length) return [];

  const headers = {
    "Content-Type": "application/json",
    "User-Agent": "ForwardWidgets/1.0.0",
  };

  // 依次回退：优先命中源，失败再试其它源；命中后直接返回，避免跨源混合导致 movie -> tv_series
  for (const server of servers) {
    const r = await safeGet(`${server}/api/v2/bangumi/${animeId}`, { headers });
    if (!r.ok) continue;
    const data = r.data;
    if (!data || !data.bangumi || !Array.isArray(data.bangumi.episodes) || data.bangumi.episodes.length === 0) {
      continue;
    }
    const episodes = data.bangumi.episodes;
    await saveSourcesBatch(
      episodes.map((ep) => ({
        id: ep.episodeId !== undefined ? ep.episodeId : ep.id,
        server,
      }))
    );
    return episodes;
  }

  return [];
}

async function getCommentsById(params) {
  const { commentId } = params;
  const routedServers = ((await getSource(commentId)) || []).map(normalizeServer);
  const fallbackServers = getServersFromParams(params);
  const servers = Array.from(new Set([...routedServers, ...fallbackServers].filter(Boolean)));

  if (!commentId) return null;
  if (!servers.length) return null;

  const headers = {
    "Content-Type": "application/json",
    "User-Agent": "ForwardWidgets/1.0.0",
  };

  // 全部请求，失败的忽略
  const tasks = servers.map((server) =>
    safeGet(`${server}/api/v2/comment/${commentId}?withRelated=true&chConvert=1`, { headers }).then((r) => ({
      server,
      result: r,
    }))
  );

  const results = await Promise.all(tasks);

  // 合并弹幕：尽量保持原返回结构，取第一个成功的为 base，然后把 danmakus 合并进去
  let base = null;
  const danmakus = [];
  const seen = new Set();

  results.forEach((item) => {
    const r = item.result;
    if (!r.ok) return;
    const data = r.data;
    if (!data) return;

    if (!base) base = data;

    // 兼容不同字段名（有些接口返回 danmakus，有些返回 comments）
    const list = Array.isArray(data.danmakus)
      ? data.danmakus
      : Array.isArray(data.comments)
      ? data.comments
      : null;

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

  if (!base) return null;

  // 把合并后的结果放回 base
  if (Array.isArray(base.danmakus)) {
    base.danmakus = danmakus;
  } else if (Array.isArray(base.comments)) {
    base.comments = danmakus;
  } else {
    // 若原本没有对应字段，也补一个 danmakus
    base.danmakus = danmakus;
  }

  return base;
}
