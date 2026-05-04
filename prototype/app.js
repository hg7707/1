const reports = {
  whiff: {
    title: "技能空放后仍然继续前压",
    body: "你在对手可反打距离内释放技能未命中，随后继续向前争夺先手。此时你进入技能真空期，对手更容易抓后摇或反压。",
    recommendation: "技能没有命中时，第一优先级是拉开距离或用安全位移重置局面，不建议立刻追加第二个关键技能。",
    evidence: ["错误类型：无保护技能空放", "机制知识：技能真空期处理", "通用原则：先确认收益，再扩大进攻"]
  },
  sub: {
    title: "低收益命中后过早交替身",
    body: "这次替身没有换来反打或逃生，只是提前交掉了关键资源。后续对手可以更放心地延长进攻回合。",
    recommendation: "低伤害试探命中时先观察对手是否能继续稳定连段，替身应优先用于中高收益连段或能确定反打的位置。",
    evidence: ["机制知识：替身使用原则", "错误类型：资源过早交出", "训练模板：替身延迟判断训练"]
  },
  ult: {
    title: "奥义释放没有建立在确认收益上",
    body: "奥义被用来尝试强行收尾，但对手仍有规避或替身空间，导致收益不稳定。",
    recommendation: "奥义更适合在对手替身不可用、位置被限制、或技能已经确认命中后使用。当前局面应优先控场而不是抢收尾。",
    evidence: ["机制知识：奥义点管理", "通用原则：资源换确定收益", "错误类型：高资源低确认释放"]
  }
};

const title = document.querySelector("#finding-title");
const body = document.querySelector("#finding-body");
const recommendation = document.querySelector("#recommendation-text");
const evidence = document.querySelector("#evidence");
const chips = document.querySelectorAll(".time-chip");

function renderReport(key) {
  const report = reports[key];
  title.textContent = report.title;
  body.textContent = report.body;
  recommendation.textContent = report.recommendation;
  evidence.innerHTML = report.evidence.map((item) => `<li>${item}</li>`).join("");

  chips.forEach((chip) => {
    chip.classList.toggle("active", chip.dataset.report === key);
  });
}

chips.forEach((chip) => {
  chip.addEventListener("click", () => renderReport(chip.dataset.report));
});
