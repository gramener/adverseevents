/* global FormPersistence */

import { html, render } from "https://cdn.jsdelivr.net/npm/lit-html@3/+esm";
import { unsafeHTML } from "https://cdn.jsdelivr.net/npm/lit-html@3/directives/unsafe-html.js";
import { parse } from "https://cdn.jsdelivr.net/npm/partial-json@0.1.7/+esm";
import { Marked } from "https://cdn.jsdelivr.net/npm/marked@13/+esm";
import { asyncLLM } from "https://cdn.jsdelivr.net/npm/asyncllm@2";
import { anthropic } from "https://cdn.jsdelivr.net/npm/asyncllm@2/dist/anthropic.js";
import { gemini } from "https://cdn.jsdelivr.net/npm/asyncllm@2/dist/gemini.js";

const $form = document.getElementById("adverse-event-form");
const $samples = document.getElementById("samples");
const $clinicalDescription = document.getElementById("clinical-description");
const $results = document.getElementById("results");

const marked = new Marked();
const results = {};

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

      // Slow down the rendering
      // await new Promise((resolve) => setTimeout(resolve, 5));
    }
    draw(results, { loading: false });
  }
});

// ------------------------------------------------------------------------------------------------
// Render the results
let lastCalledTime;
const draw = (results, { loading } = { loading: false }) => {
  // Throttle to 100ms unless loading is done
  const now = +new Date();
  if (loading && now - lastCalledTime < 100) return;
  lastCalledTime = now;

  const contents = workflow
    .filter(({ title }) => results[title])
    .map(({ title }) =>
      typeof results[title] == "object"
        ? drawSummary(results[title])
        : html`
            <div class="card mb-3 narrative mx-auto my-4">
              <div class="card-body">
                <h5 class="card-title text-secondary mb-3">
                  <span class="rounded-circle text-bg-primary p-2 me-2 d-inline-flex"
                    ><i class="bi bi-chat-text"></i
                  ></span>
                  ${title}
                </h5>
                ${unsafeHTML(marked.parse(results[title]))}
              </div>
            </div>
          `
    );

  if (loading)
    contents.push(
      html`<div class="text-center">
        <div class="spinner-border" role="status"><span class="visually-hidden">Loading...</span></div>
      </div>`
    );
  render(contents, $results);
};

const drawSummary = (summary) => html`
  <div class="container">
    <h2 class="text-center my-4">Pharmacovigilance Assessment Summary</h2>
    <div class="row">
      <div class="col-md-6">
        <h5>Case Assessment</h5>
        <ul class="list-group">
          <li class="list-group-item">Status: <strong>${summary.status}</strong></li>
          <li class="list-group-item">Causality: <strong>${summary.causality}</strong></li>
          <li class="list-group-item">Seriousness: <strong>${summary.seriousness}</strong></li>
          <li class="list-group-item">Expectedness: <strong>${summary.expectedness}</strong></li>
        </ul>
      </div>
      <div class="col-md-6">
        <h5>Case Classification</h5>
        <ul class="list-group">
          <li class="list-group-item">Primary Event: <strong>${summary.primary_event}</strong></li>
          <li class="list-group-item">MedDRA PT: <strong>${summary.meddra_pt}</strong></li>
          <li class="list-group-item">Case Completeness: <strong>${summary.case_completeness}</strong></li>
        </ul>
      </div>
    </div>
    <div class="row mt-3">
      <div class="col-md-6">
        <h5>Regulatory Impact</h5>
        <ul class="list-group">
          <li class="list-group-item">Report Type: <strong>${summary.report_type}</strong></li>
          <li class="list-group-item">PBRER Inclusion: <strong>${summary.pbrer_inclusion}</strong></li>
          <li class="list-group-item">Signal Status: <strong>${summary.signal_status}</strong></li>
        </ul>
      </div>
      <div class="col-md-6">
        <h5>Required Actions</h5>
        <ul class="list-group">
          <li class="list-group-item">Expedited Report: <strong>${summary.expedited_report}</strong></li>
          <li class="list-group-item">
            Include in upcoming PBRER/PSUR: <strong>${summary.include_in_pbrer_psur}</strong>
          </li>
          <li class="list-group-item">Update Safety Database: <strong>${summary.update_safety_database}</strong></li>
          <li class="list-group-item">
            Update Signal Detection Database: <strong>${summary.update_signal_detection_database}</strong>
          </li>
        </ul>
      </div>
    </div>
    <div class="row mt-3">
      <div class="col-md-6">
        <h5>Signal Analysis</h5>
        <ul class="list-group">
          <li class="list-group-item">ROR Score: <strong>${summary.ror_score} (${summary.ror_status})</strong></li>
          <li class="list-group-item">
            Cases in Database: <strong>${summary.cases_in_database} similar reports</strong>
          </li>
          <li class="list-group-item">Labeling Status: <strong>${summary.labeling_status}</strong></li>
        </ul>
      </div>
    </div>
  </div>
`;

// ------------------------------------------------------------------------------------------------
FormPersistence.persist($form);
