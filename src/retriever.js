export function retrieveKnowledge(match, knowledge) {
  const query = buildQuery(match);
  const allItems = Object.values(knowledge)
    .flat()
    .filter((item) => !item.template);

  const scored = allItems
    .map((item) => ({
      item,
      score: scoreItem(item, query, match),
      matched: hasKnowledgeMatch(item, query, match)
    }))
    .filter(({ score, matched }) => matched && score > 0)
    .sort((a, b) => b.score - a.score || sourcePriority(a.item) - sourcePriority(b.item))
    .slice(0, 16)
    .map(({ item, score }) => toRetrievedItem(item, score));

  return scored.length > 0 ? scored : [];
}

function buildQuery(match) {
  return normalize(
    [
      match.playerNinja,
      match.enemyNinja,
      match.selfDiagnosis,
      ...match.keyMoments.flatMap((moment) => [moment.time, moment.description])
    ].join(" ")
  );
}

function scoreItem(item, query, match) {
  const title = normalize(item.title);
  const content = normalize(item.content || item.summary || item.description || item.symptom || "");
  const tags = (item.tags || []).map(normalize).filter(Boolean);

  let score = 0;

  if (title && query.includes(title)) score += 34;

  for (const tag of tags) {
    if (tag.length >= 2 && query.includes(tag)) score += 22;
  }

  if (item.ninja && sameName(item.ninja, match.playerNinja)) score += 34;
  if (item.playerNinja && sameName(item.playerNinja, match.playerNinja)) score += 30;
  if (item.enemyNinja && sameName(item.enemyNinja, match.enemyNinja)) score += 30;

  if (item.playerNinja && item.enemyNinja && sameName(item.playerNinja, match.playerNinja) && sameName(item.enemyNinja, match.enemyNinja)) {
    score += 50;
  }

  if (item.level === match.level || item.targetLevel === match.level) score += 4;

  const strongWords = ["技能空放", "替身", "奥义", "压场", "墙角", "起手", "冷却", "通灵", "秘卷", "骗替", "连招", "距离"];
  for (const word of strongWords) {
    const key = normalize(word);
    if (query.includes(key) && (title.includes(key) || content.includes(key) || tags.includes(key))) {
      score += 8;
    }
  }

  return score;
}

function hasKnowledgeMatch(item, query, match) {
  const title = normalize(item.title);
  const content = normalize(item.content || item.summary || item.description || item.symptom || "");
  const tags = (item.tags || []).map(normalize).filter(Boolean);

  if (title && query.includes(title)) return true;
  if (tags.some((tag) => tag.length >= 2 && query.includes(tag))) return true;
  if (item.ninja && sameName(item.ninja, match.playerNinja)) return true;
  if (item.playerNinja && sameName(item.playerNinja, match.playerNinja)) return true;
  if (item.enemyNinja && sameName(item.enemyNinja, match.enemyNinja)) return true;

  const strongWords = ["技能空放", "替身", "奥义", "压场", "墙角", "起手", "冷却", "通灵", "秘卷", "骗替", "连招", "距离"];
  return strongWords.some((word) => {
    const key = normalize(word);
    return query.includes(key) && (title.includes(key) || content.includes(key) || tags.includes(key));
  });
}

function sourcePriority(item) {
  const order = {
    mistakes: 1,
    matchups: 2,
    ninjas: 3,
    trainings: 4,
    mechanics: 5
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
