import { shouldSearchWeb } from "../src/webSearch.js";

const strongHit = [{ title: "百豪纲手基础机制", score: 24 }];
const weakHit = [{ title: "通用决斗场原则", score: 8 }];

assertEqual(
  shouldSearchWeb({
    latestQuestion: "百豪纲手机制介绍",
    retrieved: strongHit
  }),
  false,
  "strong local evidence should skip web search"
);

assertEqual(
  shouldSearchWeb({
    latestQuestion: "某个知识库没有的新忍者技能介绍",
    retrieved: weakHit
  }),
  true,
  "specific mechanic question without strong evidence should search web"
);

assertEqual(
  shouldSearchWeb({
    latestQuestion: "你好",
    retrieved: weakHit
  }),
  false,
  "small talk should skip web search"
);

console.log("Web search checks passed.");

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(`${message}: expected ${expected}, got ${actual}`);
  }
}
