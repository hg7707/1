export function createFallbackChatResponse({ message, playerProfile, retrieved }) {
  const main = pickMainKnowledge(message, retrieved);
  const levelText = levelName(playerProfile.level);

  if (!main) {
    return {
      reply:
        "我现在还没有足够依据，所以不硬编。请补充：你用什么忍者、对面什么忍者、你在哪个时间点被打崩、当时替身和关键技能是否可用。",
      evidence: []
    };
  }

  return {
    reply: [
      `【结论】`,
      `以你现在的${levelText}水平，这个问题先按“${main.title}”处理。`,
      "",
      "【依据】",
      `知识库命中：${main.title}`,
      "",
      "【下一局怎么打】",
      `1. 先记住核心原则：${main.content}`,
      `2. 下一局只盯一个动作：${createAction(message, main)}。`,
      "3. 实战里突然不知道怎么选时，优先重置距离或保资源，不用高风险操作补情绪。",
      "",
      "【不确定/需要补充】",
      "如果要判断具体忍者打法，请补充双方忍者和你被起手的具体回合。",
      "",
      "【训练作业】",
      "打 5 局，只记录这个问题出现了几次，以及每次有没有按上面的动作处理。"
    ].join("\n"),
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
    ["奥义", "收尾", "大招"],
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
            item.category === "mistake" &&
            words.some((word) => item.title.includes(word) || item.content.includes(word) || (item.tags || []).includes(word))
        ) ||
        retrieved.find(
          (item) =>
            item.category === "mechanic" &&
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
  if (text.includes("替身")) return "替身前先判断能不能换到反打，不能反打就优先逃生和重置距离";
  if (text.includes("奥义") || text.includes("大招")) return "奥义只在命中确认、对手无替身或位置被限制时交";
  if (text.includes("压场") || text.includes("墙角")) return "压场前先看自己有没有技能、秘卷、通灵或替身保护";
  if (text.includes("开局") || text.includes("起手")) return "开局前两秒先观察对手路线，不固定套路硬抢";
  return "把这类失误单独记录出来，先减少次数，再追求高收益";
}

function levelName(level) {
  if (level === "beginner") return "入门";
  if (level === "advanced") return "高阶";
  return "中阶";
}
