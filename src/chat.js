export function createFallbackChatResponse({ message, playerProfile, retrieved }) {
  const main = pickMainKnowledge(message, retrieved);
  const evidence = retrieved.slice(0, 4).map((item) => item.title).join("、");
  const levelText = levelName(playerProfile.level);

  if (!main) {
    return {
      reply:
        "我现在还没从知识库里找到足够依据，所以不硬编。你可以换一种方式描述：你用什么忍者、对面什么忍者、你在哪个时间点被打崩、当时替身和技能还在不在。",
      evidence: []
    };
  }

  return {
    reply: [
      `结论：以你现在的${levelText}水平，这个问题先按“${main.title}”处理。`,
      "",
      `1. 先记住核心原则：${main.content}`,
      `2. 下一局不要同时改很多东西，只盯一个动作：${createAction(message, main)}。`,
      "3. 如果你是在实战里突然不知道怎么选，就先选择更稳的重置距离或保资源，不要用高风险操作补情绪。",
      "",
      `下一局作业：打 5 局，只记录这个问题出现了几次，以及每次你有没有按上面的动作处理。`,
      evidence ? `依据：${evidence}` : ""
    ]
      .filter(Boolean)
      .join("\n"),
    evidence: retrieved.slice(0, 4).map((item) => ({
      title: item.title,
      id: item.id,
      sourceType: item.sourceType
    }))
  };
}

function pickMainKnowledge(message, retrieved) {
  const text = `${message}`;
  const priority = [
    ["技能空", "空放", "二技能", "真空期"],
    ["替身", "骗替"],
    ["奥义", "收尾"],
    ["压场", "墙角"],
    ["开局", "起手"],
    ["距离", "走位"],
    ["通灵"],
    ["秘卷"]
  ];

  for (const words of priority) {
    if (words.some((word) => text.includes(word))) {
      const hit =
        retrieved.find(
          (item) =>
            item.sourceType === "mistakes" &&
            words.some((word) => item.title.includes(word) || item.content.includes(word) || (item.tags || []).includes(word))
        ) ||
        retrieved.find(
          (item) =>
            item.sourceType === "mechanics" &&
            words.some((word) => item.title.includes(word) || item.content.includes(word) || (item.tags || []).includes(word))
        ) ||
        retrieved.find((item) => words.some((word) => item.title.includes(word) || item.content.includes(word)));
      if (hit) return hit;
    }
  }

  return retrieved[0];
}

function createAction(message, item) {
  const text = `${message} ${item.title}`;
  if (text.includes("技能空") || text.includes("空放")) return "技能没中立刻后撤，不追加第二个关键技能";
  if (text.includes("替身")) return "替身前先判断能不能换到反打，不能反打就不急着交";
  if (text.includes("奥义")) return "奥义只在命中确认、对手无替身或位置被限制时交";
  if (text.includes("压场")) return "压场前先看自己有没有技能、秘卷、通灵或替身保护";
  if (text.includes("开局") || text.includes("起手")) return "开局前两秒先观察对手路线，不固定套路硬抢";
  return "把这类失误单独记录出来，先减少次数，再追求高收益";
}

function levelName(level) {
  if (level === "beginner") return "入门";
  if (level === "advanced") return "高阶";
  return "中阶";
}
