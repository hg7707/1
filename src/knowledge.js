import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, "..");
const knowledgeDir = path.join(root, "knowledge");

const files = {
  ninja_basics: "ninja_basics.json",
  ninja_playstyles: "ninja_playstyles.json",
  ninja_tips: "ninja_tips.json",
  duel_logic: "duel_logic.json",
  matchup_decisions: "matchup_decisions.json",
  matchmaking: "matchmaking.json",
  rank_recommendations: "rank_recommendations.json"
};

export async function loadKnowledgeBase() {
  const entries = await Promise.all(
    Object.entries(files).map(async ([key, filename]) => {
      const filePath = path.join(knowledgeDir, filename);
      const raw = await fs.readFile(filePath, "utf8");
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) {
        throw new Error(`${filename} 必须是 JSON 数组`);
      }
      return [key, parsed.map((item) => ({ ...item, sourceType: key }))];
    })
  );

  return Object.fromEntries(entries);
}
