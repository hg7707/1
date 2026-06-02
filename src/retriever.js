const STRONG_TERMS = [
  "技能空放",
  "空放",
  "替身",
  "奥义",
  "压场",
  "墙角",
  "起手",
  "冷却",
  "通灵",
  "秘卷",
  "骗替",
  "连招",
  "距离",
  "走位",
  "防守",
  "反打",
  "后摇",
  "资源",
  "开局",
  "收尾",
  "命中确认",
  "确认",
  "硬抢",
  "前压",
  "后撤",
  "拉扯",
  "逃生",
  "低收益",
  "防守资源",
  "控场",
  "中立",
  "落点"
];

const ALIASES = new Map([
  ["鼬", ["宇智波鼬", "鼬"]],
  ["佐助", ["宇智波佐助", "佐助"]],
  ["永恒佐助", ["宇智波佐助（永恒万花筒）", "宇智波佐助「永恒万花筒」", "永恒佐助", "藤虎佐助", "永恒万花筒佐助"]],
  ["藤虎佐助", ["宇智波佐助（永恒万花筒）", "宇智波佐助「永恒万花筒」", "永恒佐助", "藤虎佐助", "永恒万花筒佐助"]],
  ["永恒万花筒佐助", ["宇智波佐助（永恒万花筒）", "宇智波佐助「永恒万花筒」", "永恒佐助", "藤虎佐助", "永恒万花筒佐助"]],
  ["鸣人", ["漩涡鸣人", "鸣人"]],
  ["九喇嘛鸣人", ["漩涡鸣人（九喇嘛连结）", "漩涡鸣人「九喇嘛连结」", "九喇嘛鸣人", "黄猿鸣人", "九喇嘛连结鸣人"]],
  ["黄猿鸣人", ["漩涡鸣人（九喇嘛连结）", "漩涡鸣人「九喇嘛连结」", "九喇嘛鸣人", "黄猿鸣人", "九喇嘛连结鸣人"]],
  ["九喇嘛连结鸣人", ["漩涡鸣人（九喇嘛连结）", "漩涡鸣人「九喇嘛连结」", "九喇嘛鸣人", "黄猿鸣人", "九喇嘛连结鸣人"]],
  ["小樱", ["春野樱", "小樱"]],
  ["忍战樱", ["春野樱（忍界大战）", "春野樱「忍界大战」", "忍战樱", "樱帝"]],
  ["樱帝", ["春野樱（忍界大战）", "春野樱「忍界大战」", "忍战樱", "樱帝"]],
  ["百豪纲手", ["纲手（百豪）", "纲手「百豪」", "百豪纲手", "斗笠纲手"]],
  ["斗笠纲手", ["纲手（百豪）", "纲手「百豪」", "百豪纲手", "斗笠纲手"]],
  ["纲手「百豪」", ["纲手（百豪）", "纲手「百豪」", "百豪纲手", "斗笠纲手"]],
  ["卡卡西", ["旗木卡卡西", "卡卡西"]],
  ["须佐卡卡西", ["旗木卡卡西（须佐能乎）", "旗木卡卡西「须佐能乎」", "须佐卡卡西", "双神威卡卡西"]],
  ["双神威卡卡西", ["旗木卡卡西（须佐能乎）", "旗木卡卡西「须佐能乎」", "须佐卡卡西", "双神威卡卡西"]],
  ["水门", ["波风水门", "水门"]],
  ["老版自来也", ["自来也（老版）", "老版自来也", "普通自来也", "初代高招S自来也"]],
  ["普通自来也", ["自来也（老版）", "老版自来也", "普通自来也", "初代高招S自来也"]],
  ["初代高招S自来也", ["自来也（老版）", "老版自来也", "普通自来也", "初代高招S自来也"]],
  ["传说自来也", ["自来也（传说中的三忍）", "自来也「传说中的三忍」", "传说自来也", "2025高招S自来也"]],
  ["2025自来也", ["自来也（传说中的三忍）", "自来也「传说中的三忍」", "传说自来也", "2025高招S自来也"]],
  ["2025高招S自来也", ["自来也（传说中的三忍）", "自来也「传说中的三忍」", "传说自来也", "2025高招S自来也"]],
  ["青水", ["波风水门（青年）", "青年水门", "青水", "波风水门青年"]],
  ["青年水门", ["波风水门（青年）", "青年水门", "青水", "波风水门青年"]],
  ["新春水门", ["波风水门（新春限定）", "新春水门", "新水", "波风水门新春限定"]],
  ["新水", ["波风水门（新春限定）", "新春水门", "新水", "波风水门新春限定"]],
  ["我爱罗", ["我爱罗"]],
  ["佩恩", ["佩恩"]],
  ["带土", ["宇智波带土", "带土"]],
  ["忍战带土", ["宇智波带土（忍界大战）", "宇智波带土「忍界大战」", "忍战带土", "破面带土", "忍界大战带土"]],
  ["破面带土", ["宇智波带土（忍界大战）", "宇智波带土「忍界大战」", "忍战带土", "破面带土", "忍界大战带土"]],
  ["忍界大战带土", ["宇智波带土（忍界大战）", "宇智波带土「忍界大战」", "忍战带土", "破面带土", "忍界大战带土"]],
  ["斑", ["宇智波斑", "斑"]],
  ["白面具", ["宇智波斑（白面具）", "白面具", "白面具斑", "宇智波带土（白面具）"]],
  ["白面具斑", ["宇智波斑（白面具）", "白面具", "白面具斑"]],
  ["十尾带土", ["宇智波带土（十尾人柱力）", "十尾带土", "十尾人柱力带土", "六道带土"]],
  ["十尾人柱力带土", ["宇智波带土（十尾人柱力）", "十尾带土", "十尾人柱力带土", "六道带土"]],
  ["六道带土", ["宇智波带土（十尾人柱力）", "十尾带土", "十尾人柱力带土", "六道带土"]],
  ["秽土斑", ["宇智波斑（秽土转生）", "秽土斑", "秽土转生斑"]],
  ["秽土转生斑", ["宇智波斑（秽土转生）", "秽土斑", "秽土转生斑"]],
  ["空技能", ["技能空放", "空放", "空技能"]],
  ["空了", ["技能空放", "空放", "空了"]],
  ["大招", ["奥义", "大招", "收尾"]],
  ["怒气", ["奥义点", "奥义", "资源"]],
  ["豆", ["奥义点", "奥义", "资源"]],
  ["受身", ["替身"]],
  ["被压", ["压场", "防守", "墙角"]],
  ["压墙角", ["压场", "墙角"]],
  ["抓后摇", ["后摇", "反打"]],
  ["骗替身", ["骗替", "替身"]],
  ["乱交", ["防守", "替身", "资源"]],
  ["墙角", ["压场", "墙角", "防守"]],
  ["开大", ["奥义", "收尾", "命中确认"]],
  ["被起手", ["起手", "距离", "防守"]],
  ["摸不到", ["距离", "走位", "起手"]],
  ["空大", ["奥义", "命中确认", "资源"]]
]);

export function retrieveKnowledge(match, knowledge) {
  const query = buildQuery(match);
  const allItems = Object.values(knowledge)
    .flat()
    .filter((item) => !item.template);

  const scored = allItems
    .map((item) => ({
      item,
      score: scoreItem(item, query, match)
    }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score || sourcePriority(a.item) - sourcePriority(b.item))
    .slice(0, 24)
    .map(({ item, score }) => toRetrievedItem(item, score));

  if (scored.length > 0) return scored;
  return getGenericGroundingItems(allItems);
}

function buildQuery(match) {
  const raw = [
    match.playerNinja,
    match.enemyNinja,
    match.rank,
    match.result,
    match.playerSubstitution,
    match.enemySubstitution,
    match.playerSecret,
    match.playerSummon,
    match.battleSituation,
    match.selfDiagnosis,
    ...(match.keyMoments || []).flatMap((moment) => [moment.time, moment.description])
  ].join(" ");

  return {
    raw,
    normalized: normalize(raw),
    terms: expandTerms(raw)
  };
}

function scoreItem(item, query, match) {
  const itemText = normalize(
    [
      item.id,
      item.title,
      item.content,
      item.summary,
      item.description,
      item.symptom,
      item.risk,
      item.ninja,
      item.playerNinja,
      item.enemyNinja,
      ...(item.tags || [])
    ].join(" ")
  );

  let score = 0;

  for (const term of query.terms) {
    if (term.length >= 2 && itemText.includes(normalize(term))) {
      score += STRONG_TERMS.includes(term) ? 18 : 10;
    }
  }

  if (item.ninja && sameName(item.ninja, match.playerNinja)) score += 34;
  if (item.playerNinja && sameName(item.playerNinja, match.playerNinja)) score += 30;
  if (item.enemyNinja && sameName(item.enemyNinja, match.enemyNinja)) score += 30;

  if (
    item.playerNinja &&
    item.enemyNinja &&
    sameName(item.playerNinja, match.playerNinja) &&
    sameName(item.enemyNinja, match.enemyNinja)
  ) {
    score += 60;
  }

  if (score > 0 && match.level && (item.level === match.level || item.targetLevel === match.level)) score += 4;
  if (item.category === "mistake" && query.terms.some((term) => ["怎么改", "总是", "经常", "问题", "输"].includes(term))) {
    score += 6;
  }
  if (item.category === "training" && query.terms.some((term) => ["练", "训练", "作业", "怎么改"].includes(term))) {
    score += 8;
  }

  return score;
}

function getGenericGroundingItems(allItems) {
  const preferredIds = new Set([
    "mechanic_cooldown_001",
    "mechanic_substitution_001",
    "mechanic_confirm_001",
    "mistake_no_review_target_001",
    "training_review_one_001"
  ]);

  return allItems
    .filter((item) => preferredIds.has(item.id))
    .map((item) => toRetrievedItem(item, 8));
}

function expandTerms(text) {
  const normalized = normalize(text);
  const terms = new Set();

  for (const term of STRONG_TERMS) {
    if (normalized.includes(normalize(term))) terms.add(term);
  }

  for (const [needle, values] of ALIASES) {
    if (normalized.includes(normalize(needle))) {
      for (const value of values) terms.add(value);
    }
  }

  for (const token of String(text).split(/[\s,，。！？!?、:：；;]+/)) {
    const clean = token.trim();
    if (clean.length >= 2 && clean.length <= 12) terms.add(clean);
  }

  return [...terms];
}

function sourcePriority(item) {
  const order = {
    matchup_decisions: 1,
    ninja_basics: 2,
    ninja_playstyles: 3,
    ninja_tips: 4,
    duel_logic: 5,
    matchmaking: 6,
    rank_recommendations: 7
  };
  return order[item.sourceType] || 9;
}

function toRetrievedItem(item, score) {
  return {
    id: item.id,
    title: item.title,
    sourceType: item.sourceType,
    content: item.content || item.summary || item.description || "",
    tags: item.tags || [],
    level: item.level || item.targetLevel || "",
    category: item.category || "",
    score
  };
}

function sameName(left, right) {
  const a = normalize(left);
  const b = normalize(right);
  return Boolean(a && b && (a.includes(b) || b.includes(a)));
}

function normalize(text) {
  return String(text || "").toLowerCase().replace(/\s+/g, "");
}
