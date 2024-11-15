/* global FormPersistence */

import { html, render } from "https://cdn.jsdelivr.net/npm/lit-html@3/+esm";
import { unsafeHTML } from "https://cdn.jsdelivr.net/npm/lit-html@3/directives/unsafe-html.js";
import { parse } from "https://cdn.jsdelivr.net/npm/partial-json@0.1.7/+esm";
import { Marked } from "https://cdn.jsdelivr.net/npm/marked@13/+esm";
import mermaid from "https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.esm.min.mjs";
import { asyncLLM } from "https://cdn.jsdelivr.net/npm/asyncllm@2";
import { anthropic } from "https://cdn.jsdelivr.net/npm/asyncllm@2/dist/anthropic.js";
import { gemini } from "https://cdn.jsdelivr.net/npm/asyncllm@2/dist/gemini.js";

const $form = document.getElementById("adverse-event-form");
const $analyze = document.getElementById("analyze");
const $samples = document.getElementById("samples");
const $clinicalDescription = document.getElementById("clinical-description");
const $advancedSettings = document.getElementById("advanced-settings");
const $slowRendering = document.getElementById("slow-rendering");
const $results = document.getElementById("results");

const marked = new Marked();
const results = {};

// ------------------------------------------------------------------------------------------------
// Initialize external libraries
mermaid.initialize({ startOnLoad: true });
FormPersistence.persist($form);

// ------------------------------------------------------------------------------------------------
// Log into LLM Foundry
const { token } = await fetch("https://llmfoundry.straive.com/token", { credentials: "include" }).then((res) =>
  res.json()
);
$analyze.classList.remove("d-none");
if (!token) {
  const url = "https://llmfoundry.straive.com/login?" + new URLSearchParams({ next: location.href });
  $analyze.innerHTML = /* html */ `<a class="btn btn-primary" href="${url}">Log into LLM Foundry</a>`;
} else {
  $advancedSettings.classList.remove("d-none");
}

// ------------------------------------------------------------------------------------------------
// Model configuration. These are the models that are available to use.
const models = [
  { source: "openai", model: "gpt-4o-mini", name: "OpenAI: GPT 4o Mini ($0.15)" },
  { source: "openai", model: "gpt-4o-audio-preview", name: "OpenAI: GPT 4o Audio Preview ($2.5)" },
  { source: "openai", model: "gpt-4o", name: "OpenAI: GPT 4o ($2.5)" },
  { source: "openai", model: "chatgpt-4o-latest", name: "OpenAI: ChatGPT 4o ($5)" },
  { source: "anthropic", model: "claude-3-haiku-20240307", name: "Anthropic: Claude 3 Haiku ($0.25)" },
  { source: "anthropic", model: "claude-3-5-haiku-20241022", name: "Anthropic: Claude 3.5 Haiku ($1)" },
  { source: "anthropic", model: "claude-3-5-sonnet-20241022", name: "Anthropic: Claude 3.5 Sonnet v2 ($3)" },
  { source: "gemini", model: "gemini-1.5-flash-8b", name: "Google: Gemini 1.5 Flash 8b ($0.04)" },
  { source: "gemini", model: "gemini-1.5-flash-002", name: "Google: Gemini 1.5 Flash 002 ($0.075)" },
  { source: "gemini", model: "gemini-1.5-pro-002", name: "Google: Gemini 1.5 Pro 002 ($1.25)" },
  { source: "cerebras", model: "llama3.1-70b", name: "Cerebras: Llama 3.1 70b ($0)" },
  { source: "cerebras", model: "llama3.1-8b", name: "Cerebras: Llama 3.1 8b ($0)" },
  { source: "groq", model: "llama-3.2-90b-vision-preview", name: "Groq: Llama 3.2 90b ($0)" },
  { source: "groq", model: "llama-3.2-11b-vision-preview", name: "Groq: Llama 3.2 11b ($0)" },
  { source: "groq", model: "gemma2-9b-it", name: "Groq: Gemma 2 9b ($0)" },
  { source: "groq", model: "mixtral-8x7b-32768", name: "Groq: Mixtral 8x7b ($0)" },
];

// Apply the models to the form
$form.querySelectorAll("select.models").forEach((el) => {
  el.innerHTML = models.map((m, index) => `<option value="${index}">${m.name}</option>`).join("");
});

// ------------------------------------------------------------------------------------------------
// Source configurations. This is how we connect to the LLM provider.
const openai = (d) => d;
const sources = {
  openai: {
    adapter: openai,
    url: () => "https://llmfoundry.straive.com/openai/v1/chat/completions",
  },
  anthropic: {
    adapter: anthropic,
    url: () => "https://llmfoundry.straive.com/anthropic/v1/messages",
  },
  gemini: {
    adapter: gemini,
    url: (model) => `https://llmfoundry.straive.com/gemini/v1beta/models/${model}:streamGenerateContent?alt=sse`,
  },
  cerebras: {
    adapter: openai,
    url: () => "https://llmfoundry.straive.com/cerebras/v1/chat/completions",
  },
  groq: {
    adapter: openai,
    url: () => "https://llmfoundry.straive.com/groq/v1/chat/completions",
  },
};

// ------------------------------------------------------------------------------------------------
// Clinical trial description samples
const samples = [
  "",
  "I've been taking the study medication for three weeks now. About ten days ago, I started experiencing severe joint pain, particularly in my knees and elbows. It's gotten to the point where climbing stairs is challenging. I've never had arthritis or similar issues before, so I'm concerned this might be a side effect of the medication.",
  "Since I began the trial, my symptoms have improved dramatically. My chronic migraines have reduced in frequency from daily occurrences to just once a week. I haven't noticed any side effects, and I feel more productive and energetic throughout the day.",
  "Over the past few days, I've felt unusually fatigued and have been struggling to focus at work. However, I also started intermittent fasting last week, which might be affecting my energy levels. It's hard to tell if the medication is contributing to this fatigue.",
  "I want to report that I've developed a rash on my arms and neck. It appeared two days after my dosage was increased as per the trial protocol. The rash is itchy and red, and it's causing quite a bit of discomfort. I believe this may be an adverse reaction to the medication.",
  "My appetite has decreased since starting the trial medication, but I think it might be due to the stress from my recent job change. I've been skipping meals to meet tight deadlines. Other than that, I haven't experienced any side effects, and the medication seems to be helping with my condition.",
  "Yesterday, I experienced a sudden episode of dizziness and had to sit down for a while. This hasn't happened to me before. I realized I took the medication on an empty stomach that morning, which I usually avoid. Perhaps that's why I felt lightheaded?",
  "I'm pleased to report that the treatment is working well. My blood sugar levels have stabilized, and I haven't had any hypoglycemic episodes since the trial began. I've experienced no side effects whatsoever.",
  "For the past week, I've been dealing with frequent headaches and occasional nausea. These symptoms started shortly after I began the medication. I haven't made any other changes to my diet or lifestyle, so I suspect the medication might be the cause.",
  "The medication doesn't seem to be causing any problems. My asthma symptoms remain the same, but I haven't noticed any new issues arising. I'm hopeful that with continued use, I'll start to see some improvement in my breathing.",
  "I've developed some gastrointestinal discomfort, including stomach cramps and diarrhea. However, I tried a new spicy cuisine at a restaurant the other night, and I think that might be the culprit. I'll monitor my symptoms over the next few days to see if they persist.",
];

// Apply the samples to the form
$form.querySelector("#samples").innerHTML = samples
  .map((s, index) => `<option value="${index}">${s}</option>`)
  .join("");

// If the user selects a sample clinical trial description, use it
$form.addEventListener("change", (event) => {
  if (event.target.matches("#samples") && $samples.value) $clinicalDescription.value = samples[$samples.value];
});

// ------------------------------------------------------------------------------------------------
// Workflow. These are the sequence of LLM calls that we make.

const workflow = [
  {
    title: "Context Analysis",
    card: "basic",
    data: () => ({
      modelNumber: +$form.querySelector("#basic-model").value,
      messages: [
        { role: "system", content: $form.querySelector("#basic-prompt").value },
        { role: "user", content: $clinicalDescription.value },
      ],
    }),
  },
  {
    title: "BioClin Analysis",
    card: "intermediate",
    data: () => ({
      modelNumber: +$form.querySelector("#intermediate-model").value,
      messages: [
        { role: "system", content: $form.querySelector("#intermediate-prompt").value },
        { role: "user", content: $clinicalDescription.value },
      ],
    }),
  },
  {
    title: "LLM as a Judge Analysis",
    card: "judge",
    data: () => ({
      modelNumber: +$form.querySelector("#judge-model").value,
      messages: [
        { role: "system", content: $form.querySelector("#judge-prompt").value },
        { role: "user", content: $clinicalDescription.value },
      ],
    }),
  },
  {
    title: "Judge feedback to Context Analysis",
    card: "judge",
    data: () => ({
      modelNumber: +$form.querySelector("#judge-model").value,
      messages: [
        { role: "system", content: judgeFeedbackPrompt() },
        { role: "user", content: results["Context Analysis"] },
      ],
    }),
  },
  {
    title: "Judge feedback to BioClin Analysis",
    card: "judge",
    data: () => ({
      modelNumber: +$form.querySelector("#judge-model").value,
      messages: [
        { role: "system", content: judgeFeedbackPrompt() },
        { role: "user", content: results["BioClin Analysis"] },
      ],
    }),
  },
  {
    title: "Context Analysis - Revised",
    card: "basic",
    data: () => ({
      modelNumber: +$form.querySelector("#basic-model").value,
      messages: [
        { role: "system", content: $form.querySelector("#basic-prompt").value },
        { role: "user", content: $clinicalDescription.value },
        { role: "assistant", content: results["Context Analysis"] },
        { role: "user", content: revisionPrompt("Judge feedback to Context Analysis") },
      ],
    }),
  },
  {
    title: "BioClin Analysis - Revised",
    card: "intermediate",
    data: () => ({
      modelNumber: +$form.querySelector("#intermediate-model").value,
      messages: [
        { role: "system", content: $form.querySelector("#intermediate-prompt").value },
        { role: "user", content: $clinicalDescription.value },
        { role: "assistant", content: results["BioClin Analysis"] },
        { role: "user", content: revisionPrompt("Judge feedback to BioClin Analysis") },
      ],
    }),
  },
  {
    title: "Judge Summary",
    card: "summary",
    data: () => ({
      modelNumber: +$form.querySelector("#judge-model").value,
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "summary",
          schema: JSON.parse($form.querySelector("#summary-schema").value),
        },
      },
      messages: [
        {
          role: "system",
          content: `${$form.querySelector("#summary-prompt").value}

# Model 1 Analysis

${results["Context Analysis - Revised"]}

# Model 2 Analysis

${results["BioClin Analysis - Revised"]}

# Model 3 Analysis

${results["LLM as a Judge Analysis"]}
`,
        },
        { role: "user", content: results["LLM as a Judge Analysis"] },
      ],
    }),
  },
];

const judgeFeedbackPrompt = () => `${$form.querySelector("#judge-feedback-prompt").value}

# ORIGINAL TEXT

${$clinicalDescription.value}

# YOUR ANALYSIS

${results["LLM as a Judge Analysis"]}

# OTHER MODEL'S ANALYSIS`;

const revisionPrompt = (key) => `${$form.querySelector("#revision-prompt").value}

# Feedback

${results[key]}`;

// ------------------------------------------------------------------------------------------------
// Loop through the workflow, execute it and render it.
$form.addEventListener("submit", async (event) => {
  event.preventDefault();
  // Clear results
  for (const key in results) delete results[key];
  // Run the workflow
  for (const { title, data } of workflow) {
    const { modelNumber, ...args } = data();
    const { model, source } = models[modelNumber];
    const { adapter, url } = sources[source];
    const headers = { "Content-Type": "application/json" };
    const body = adapter({ model, ...args, stream: true });
    const params = { method: "POST", credentials: "include", headers, body: JSON.stringify(body) };
    draw(results, { loading: true });
    for await (const { error, content } of asyncLLM(url(model), params)) {
      if (error) results[title] = `ERROR: ${error}`;
      // If the response format is JSON, parse it
      else results[title] = args.response_format ? parse(content || "{}") : content;
      draw(results, { loading: true });
      // Slow down the rendering if required.
      if ($slowRendering.checked) await new Promise((resolve) => setTimeout(resolve, 5));
    }
  }
  draw(results, { loading: false });
});

// ------------------------------------------------------------------------------------------------
// Render the results
let lastCalledTime;
const draw = (results, { loading } = { loading: false }) => {
  // Throttle to 100ms unless loading is done
  const now = +new Date();
  if (loading && now - lastCalledTime < 100) return;
  lastCalledTime = now;

  const buckets = { basic: [], intermediate: [], judge: [], summary: [] };
  for (const { title, card } of workflow) {
    if (!results[title]) continue;
    if (typeof results[title] == "object") buckets.summary.push(drawSummary(results[title]));
    else
      buckets[card].push(html`
        <div class="list-group-item text-bg-secondary">${title}</div>
        <div class="list-group-item">${unsafeHTML(marked.parse(results[title]))}</div>
      `);
  }
  const contents = html`
    <div class="container-fluid">
      <div class="row row-cols-1 row-cols-md-3 g-4 mb-4">
        <div class="col">
          <div class="card">
            <h5 class="card-header text-bg-primary"><i class="bi bi-chat-text"></i> Contextual LLM</h5>
            <div class="list-group list-group-flush overflow-auto custom-scrollbar" style="max-height: 50vh">
              ${buckets.basic}
            </div>
          </div>
        </div>
        <div class="col">
          <div class="card">
            <h5 class="card-header text-bg-primary"><i class="bi bi-shield-check"></i> Judge LLM</h5>
            <div class="list-group list-group-flush overflow-auto custom-scrollbar" style="max-height: 50vh">
              ${buckets.judge}
            </div>
          </div>
        </div>
        <div class="col">
          <div class="card">
            <h5 class="card-header text-bg-primary"><i class="bi bi-clipboard2-pulse"></i> BioClin LLM</h5>
            <div class="list-group list-group-flush overflow-auto custom-scrollbar" style="max-height: 50vh">
              ${buckets.intermediate}
            </div>
          </div>
        </div>
      </div>
      ${buckets.summary}
      ${loading
        ? html`<div class="text-center">
            <div class="spinner-border" role="status"><span class="visually-hidden">Loading...</span></div>
          </div>`
        : null}
    </div>
  `;
  render(contents, $results);
  // Ensure that all 3 columns have scrolled to the bottom
  for (const $col of $results.querySelectorAll(".col .overflow-auto")) $col.scrollTop = $col.scrollHeight;
  $results.scrollIntoView({ behavior: "smooth", block: "end" });
};

const drawSummary = (summary) => html`
  <hr class="my-5" />
  <div class="container">
    <h2 class="text-center mb-4">Pharmacovigilance Assessment Summary</h2>
    <div class="row g-3">
      <!-- Case Assessment -->
      <div class="col-md-4">
        <div class="card h-100">
          <div class="card-header text-bg-primary">Case Assessment</div>
          <div class="card-body">
            <div class="d-flex flex-column gap-2">
              <div>Status: <span class="float-end">${summary.status}</span></div>
              <div>Causality: <span class="float-end">${summary.causality}</span></div>
              <div>Seriousness: <span class="float-end">${summary.seriousness}</span></div>
              <div>Expectedness: <span class="float-end">${summary.expectedness}</span></div>
            </div>
          </div>
        </div>
      </div>

      <!-- Case Classification -->
      <div class="col-md-4">
        <div class="card h-100">
          <div class="card-header text-bg-primary">Case Classification</div>
          <div class="card-body">
            <div class="d-flex flex-column gap-2">
              <div>Primary Event: <span class="float-end">${summary.primary_event}</span></div>
              <div>MedDRA PT: <span class="float-end">${summary.meddra_pt}</span></div>
              <div>Case Completeness: <span class="float-end">${summary.case_completeness}</span></div>
            </div>
          </div>
        </div>
      </div>

      <!-- Regulatory Impact -->
      <div class="col-md-4">
        <div class="card h-100">
          <div class="card-header text-bg-primary">Regulatory Impact</div>
          <div class="card-body">
            <div class="d-flex flex-column gap-2">
              <div>Report Type: <span class="float-end">${summary.report_type}</span></div>
              <div>PBRER Inclusion: <span class="float-end">${summary.pbrer_inclusion}</span></div>
              <div>Signal Status: <span class="float-end">${summary.signal_status}</span></div>
            </div>
          </div>
        </div>
      </div>

      <!-- Required Actions -->
      <div class="col-md-6">
        <div class="card h-100">
          <div class="card-header text-bg-primary">Required Actions</div>
          <div class="card-body">
            <div class="d-flex flex-column gap-2">
              <div>Expedited Report: <span class="float-end">${summary.expedited_report}</span></div>
              <div>Include in upcoming PBRER/PSUR: <span class="float-end">${summary.include_in_pbrer_psur}</span></div>
              <div>Update Safety Database: <span class="float-end">${summary.update_safety_database}</span></div>
              <div>
                Update Signal Detection Database:
                <span class="float-end">${summary.update_signal_detection_database}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Signal Analysis -->
      <div class="col-md-6">
        <div class="card h-100">
          <div class="card-header text-bg-primary">Signal Analysis</div>
          <div class="card-body">
            <div class="d-flex flex-column gap-2">
              <div>ROR Score: <span class="float-end">${summary.ror_score} (${summary.ror_status})</span></div>
              <div>Cases in Database: <span class="float-end">${summary.cases_in_database} similar reports</span></div>
              <div>Labeling Status: <span class="float-end">${summary.labeling_status}</span></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
`;
