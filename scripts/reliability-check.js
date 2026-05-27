import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadKnowledgeBase } from "../src/knowledge.js";
import { retrieveKnowledge } from "../src/retriever.js";

const __filename = fileURLToPath(import.meta.url);
const root = path.resolve(path.dirname(__filename), "..");

const mojibakePattern = /鎴|璇|纭|鍐|鏇|濂|瀹囨|婕|鐭|浣|杩|楠|绉|閫|銆|锛|�/;
const scannedDirs = ["src", "public", "knowledge"];
const scannedFiles = ["server.js", "README.md", "DEPLOYMENT.md"];

const cases = [
  {
    name: "技能空放前压",
    match: {
      level: "intermediate",
      rank: "影级",
      playerNinja: "宇智波佐助",
      enemyNinja: "漩涡鸣人",
      selfDiagnosis: "我开局技能空放以后总想继续前压，怎么改？",
      keyMoments: [{ time: "开局", description: "技能空放后前压" }]
    },
    requiredIds: ["mistake_skill_whiff_001", "training_skill_reset_001"]
  },
  {
    name: "替身收益判断",
    match: {
      level: "beginner",
      rank: "暗部",
      playerNinja: "漩涡鸣人",
      enemyNinja: "宇智波佐助",
      selfDiagnosis: "我什么时候该交替身？替身后经常没有收益。",
      keyMoments: [{ time: "中盘", description: "低收益命中后立刻替身" }]
    },
    requiredIds: ["mechanic_substitution_001", "mistake_substitution_early_001"]
  },
  {
    name: "奥义收尾",
    match: {
      level: "intermediate",
      rank: "影级",
      playerNinja: "宇智波鼬",
      enemyNinja: "",
      selfDiagnosis: "我有奥义但总是收不掉，对手替身还在怎么办？",
      keyMoments: [{ time: "收尾", description: "对手替身还在时直接放奥义" }]
    },
    requiredIds: ["mechanic_ultimate_001", "mistake_ultimate_low_confirm_001"]
  }
];

await assertNoMojibake();
const knowledge = await loadKnowledgeBase();
assertKnowledgeCounts(knowledge);
assertRetrievalCases(knowledge);

console.log("Reliability checks passed.");

async function assertNoMojibake() {
  const files = [];
  for (const dir of scannedDirs) {
    await collectFiles(path.join(root, dir), files);
  }
  for (const file of scannedFiles) {
    files.push(path.join(root, file));
  }

  const offenders = [];
  for (const file of files) {
    const text = await fs.readFile(file, "utf8");
    if (mojibakePattern.test(text)) {
      offenders.push(path.relative(root, file));
    }
  }

  if (offenders.length > 0) {
    throw new Error(`疑似乱码残留：${offenders.join(", ")}`);
  }
}

async function collectFiles(dir, files) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      await collectFiles(fullPath, files);
    } else if (/\.(js|json|html|css)$/.test(entry.name)) {
      files.push(fullPath);
    }
  }
}

function assertKnowledgeCounts(knowledge) {
  for (const [name, items] of Object.entries(knowledge)) {
    if (!Array.isArray(items) || items.length === 0) {
      throw new Error(`知识库为空：${name}`);
    }
  }
}

function assertRetrievalCases(knowledge) {
  for (const testCase of cases) {
    const hits = retrieveKnowledge(testCase.match, knowledge);
    const ids = new Set(hits.map((item) => item.id));
    const missing = testCase.requiredIds.filter((id) => !ids.has(id));
    if (missing.length > 0) {
      throw new Error(`${testCase.name} 缺少检索证据：${missing.join(", ")}`);
    }
  }
}
