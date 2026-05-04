export function createFallbackReport(match, retrieved) {
  const keyMistakes = buildMistakes(match, retrieved);
  const main = keyMistakes[0] || {
    title: "缺少可判断依据",
    why: "知识库暂时没有匹配内容。"
  };
  const recommendations = buildRecommendations(retrieved, keyMistakes);
  const training = buildTraining(retrieved, main);
  const evidence = buildEvidence(retrieved, keyMistakes, training);

  return {
    summary: `本局优先处理的问题是：${main.title}。这是本地预览模式生成的复盘，接入 API key 后会由大模型组织成更自然的完整报告。`,
    mainProblem: {
      title: main.title,
      explanation: main.why
    },
    keyMistakes,
    recommendations,
    training,
    nextGameReminder: createReminder(main),
    evidence
  };
}

function buildMistakes(match, retrieved) {
  const moments = match.keyMoments.length
    ? match.keyMoments
    : [{ time: "未标记", description: match.selfDiagnosis || "玩家尚未填写关键回合" }];

  const used = new Set();
  return moments.slice(0, 4).map((moment, index) => {
    const item = bestItemForMoment(moment, retrieved, used) || retrieved[index];
    if (item) used.add(item.id);

    return {
      time: moment.time || `关键点 ${index + 1}`,
      title: item?.title || "需要补充知识库依据",
      why: item?.content || "当前知识不足以给出可靠判断。",
      betterMove: createBetterMove(moment, item)
    };
  });
}

function bestItemForMoment(moment, retrieved, used) {
  const text = normalize(`${moment.description || ""} ${moment.time || ""}`);
  const candidates = retrieved
    .filter((item) => item.sourceType === "mistakes" && !used.has(item.id))
    .map((item) => ({ item, score: overlapScore(text, item) }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score);

  return candidates[0]?.item || null;
}

function overlapScore(text, item) {
  let score = 0;
  for (const tag of item.tags || []) {
    const key = normalize(tag);
    if (key && text.includes(key)) score += 10;
  }
  const title = normalize(item.title);
  if (title && text.includes(title)) score += 20;
  return score;
}

function createBetterMove(moment, item) {
  const text = `${moment.description || ""} ${item?.title || ""}`;
  if (text.includes("技能空") || text.includes("空放")) {
    return "技能没有命中时，立刻后撤或横向走位重置距离，先等冷却和对手动作，不要急着补第二个关键技能。";
  }
  if (text.includes("替身")) {
    return "替身前先判断这波伤害是否值得交资源；替身后优先确认能否反打，不能反打就先拉开距离。";
  }
  if (text.includes("奥义")) {
    return "奥义尽量放在命中确认、对手无替身、或墙角位置受限时使用，避免把奥义当普通起手技能。";
  }
  if (text.includes("压场") || text.includes("墙角")) {
    return "压场前先检查自己是否还有技能、秘卷、通灵或替身保护。资源不足时退半步保持威胁更稳。";
  }
  if (text.includes("开局") || text.includes("起手")) {
    return "开局先观察对手路线和起手习惯，不要每局都用同一个固定技能硬抢。";
  }
  return item?.content || "下一局把这个局面当作重点观察点，先减少同类失误，再追求更高收益。";
}

function buildRecommendations(retrieved, mistakes) {
  const mistakeTitles = new Set(mistakes.map((item) => item.title));
  const preferred = retrieved.filter((item) => mistakeTitles.has(item.title));
  const supporting = retrieved.filter((item) => item.sourceType !== "trainings" && !mistakeTitles.has(item.title));
  return [...preferred, ...supporting].slice(0, 4).map((item) => ({
    title: item.title,
    action: item.content || "根据该知识点重新检查本局操作。",
    confidence: item.score > 0 ? "知识库命中" : "默认展示"
  }));
}

function buildTraining(retrieved, main) {
  const mainText = normalize(`${main.title} ${main.why}`);
  const training = retrieved
    .filter((item) => item.sourceType === "trainings")
    .map((item) => ({ item, score: overlapScore(mainText, item) }))
    .sort((a, b) => b.score - a.score)[0]?.item;

  return {
    title: training?.title || "单点问题记录",
    task: training?.content || "接下来 5 局只记录同一类失误，不同时练多个问题。",
    successMetric: "同类失误出现次数下降，且能说清楚每次操作目的。"
  };
}

function buildEvidence(retrieved, mistakes, training) {
  const ids = new Set();
  const picked = [];
  const titles = new Set([...mistakes.map((item) => item.title), training.title]);

  for (const item of retrieved) {
    if (!ids.has(item.id) && (titles.has(item.title) || picked.length < 4)) {
      ids.add(item.id);
      picked.push({
        title: item.title,
        sourceType: item.sourceType,
        id: item.id
      });
    }
    if (picked.length >= 6) break;
  }

  return picked;
}

function createReminder(main) {
  const text = `${main.title} ${main.why}`;
  if (text.includes("技能空") || text.includes("空放")) return "技能空了先退，不用第二个技能补情绪。";
  if (text.includes("替身")) return "替身前问一句：这次能换到逃生、反打，还是只是紧张？";
  if (text.includes("奥义")) return "奥义只在确认收益时交，不拿高资源赌运气。";
  if (text.includes("压场")) return "压场前先看资源，没资源就退半步保威胁。";
  return "下一局只盯一个目标：先确认命中或资源优势，再扩大进攻。";
}

function normalize(text) {
  return String(text || "").toLowerCase().replace(/\s+/g, "");
}
