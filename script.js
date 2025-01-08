/* global FormPersistence */

import { html, render } from "https://cdn.jsdelivr.net/npm/lit-html@3/+esm";
import { unsafeHTML } from "https://cdn.jsdelivr.net/npm/lit-html@3/directives/unsafe-html.js";
import { parse } from "https://cdn.jsdelivr.net/npm/partial-json@0.1.7/+esm";
import { Marked } from "https://cdn.jsdelivr.net/npm/marked@13/+esm";
import mermaid from "https://cdn.jsdelivr.net/npm/mermaid@11/+esm";
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
const $screenshot = document.getElementById("screenshot");

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
}

// ------------------------------------------------------------------------------------------------
// Model configuration. These are the models that are available to use.
const models = [
  { source: "openai", model: "gpt-4o-mini", name: "OpenAI: GPT 4o Mini ($0.15)" },
  { source: "gemini", model: "gemini-exp-1206", name: "BioClin LLM ($0)" },
  { source: "openai", model: "gpt-4o-audio-preview", name: "OpenAI: GPT 4o Audio Preview ($2.5)" },
  { source: "openai", model: "gpt-4o", name: "OpenAI: GPT 4o ($2.5)" },
  { source: "openai", model: "chatgpt-4o-latest", name: "OpenAI: ChatGPT 4o ($5)" },
  { source: "anthropic", model: "claude-3-haiku-20240307", name: "Anthropic: Claude 3 Haiku ($0.25)" },
  { source: "anthropic", model: "claude-3-5-haiku-20241022", name: "Anthropic: Claude 3.5 Haiku ($1)" },
  { source: "anthropic", model: "claude-3-5-sonnet-20241022", name: "Anthropic: Claude 3.5 Sonnet v2 ($3)" },
  { source: "gemini", model: "gemini-1.5-flash-8b", name: "Google: Gemini 1.5 Flash 8b ($0.04)" },
  { source: "gemini", model: "gemini-1.5-flash-002", name: "Google: Gemini 1.5 Flash 002 ($0.075)" },
  { source: "gemini", model: "gemini-2.0-flash-exp", name: "Google: Gemini 2.0 Flash ($0)" },
  { source: "gemini", model: "gemini-1.5-pro-002", name: "Google: Gemini 1.5 Pro 002 ($1.25)" },
  { source: "gemini", model: "gemini-2.0-flash-thinking-exp-1219", name: "Google: Gemini 2.0 Flash Thinking Exp ($0)" },
  { source: "gemini", model: "gemini-exp-1206", name: "Google: Gemini Experimental 1206 ($0)" },
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
  "@HealthyLiving98: Anyone else on Metformin? Started it 2 months ago and my stomach's been acting weird lately 😩\n\n@DiabetesFighter: Could be the Met. I had the same issue but it got better after a few weeks. Are you taking it with food?\n\n@HealthyLiving98: Yeah, with breakfast usually. But I also started a new probiotic around the same time, so who knows 🤷‍♀️ Plus I've always had a sensitive stomach\n\n@DiabetesFighter: The first few months were rough for me too. Hang in there! Try taking it in the middle of your meal instead of at the start",
  "Nurse: Hello, how can I help you today?\n\nPatient: Hi, I've been feeling really off since starting that new blood pressure medication last week. Like, super tired and kind of dizzy, but only when I'm gardening or doing stuff outside.\n\nNurse: I see. Are you taking any other medications?\n\nPatient: Just my usual vitamins and something for my allergies since it's spring. But you know, it could just be the pollen - it's been terrible this year. Though I never used to get this wiped out from yard work before...\n\nNurse: And are you taking the medication in the morning or evening?\n\nPatient: Morning usually, but sometimes I forget and take it at lunch if I'm running late.",
  "Subject: Question about new migraine medication\n\nDr. Smith,\n\nI started the new preventive medication you prescribed three weeks ago. The daily headaches have improved a bit, but I'm getting these weird brain zaps and my mind feels so foggy - it's killing me at work! 😣\n\nMy sister takes the same med and says she felt strange at first too but it went away. Should I be worried? It's not as bad as the migraines were, but I'm teaching summer school next month and really need to be sharp.\n\nThanks,\nSarah",
  "Maria: Quick q - been on Duloxetine for about 6 weeks now. Anyone else's appetite gone crazy? Can't tell if it's the meds or just stress from my new job 🤔\n\nTom: Omg yes! But for me it was the opposite - couldn't eat at all first month. Now back to normal tho. You eating more or less?\n\nMaria: Like zero appetite in the morning, then constantly hungry after 4pm! Plus having these weird vivid dreams. Guess my body's still adjusting?\n\nTom: The dreams are wild right?? My doc said that's normal at first. Are you also on the anxiety meds? Those can mess with appetite too\n\nMaria: Yeah, still taking my usual Buspirone. Maybe it's the combo... At least my mood's better, so I'll give it more time 🤷‍♀️",
  "Hi, this is Jenny Smith calling about my mom's arthritis prescription - the new one she started last Tuesday. She's been saying her ankles are really puffy, especially in the evening. I mean, she's always had some swelling, but this seems different. She's also on water pills for her heart, so I'm not sure if it's related to those or the new med. Oh, and she mentioned feeling a bit under the weather, but you know, it's flu season... Could you have the pharmacist call me back? Thanks!",
  "@ChronicWarrior: Started new autoimmune med yesterday and I'm EXHAUSTED 😫 Normal or should I panic? #ChronicIllness\n\n@SpoonieLife: Could be the meds but could also be a flare? I was wiped out first week but now I'm good\n\n@ChronicWarrior: True... having a bad pain day too so might be both 😩 Plus these NYC summers drain whatever energy I have left lol\n\n@SpoonieLife: What time do you take it? Morning dose knocked me out so I switched to night My doc said fatigue hits different for everyone 🤷‍♀️\n\n@ChronicWarrior: Morning... might try night but worried about those crazy dreams everyone mentions in the reviews 😅",
  "Subject: Side effects from new migraine prevention med?\n\nHi Dr. Johnson,\n\nQuick update on the Topiramate - I'm in week 3 now. The tingling in my hands comes and goes (usually in the morning), and diet soda tastes SUPER weird now! Also been having trouble finding the right words sometimes during meetings, which is awkward since I give presentations all day 😕\n\nMy migraines are definitely better (down from 12 to maybe 4 this month), but these other things are throwing me off. My aunt takes this for epilepsy and says the word-finding issues get better, but she's on a higher dose...\n\nShould I stick with it? The brain fog isn't ideal with quarter-end coming up...\n\nBest,\nRachel",
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
    title: "1. Context Analysis",
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
    title: "2. BioClin Analysis",
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
    title: "3. LLM as a Judge Analysis",
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
    title: "4. Judge feedback to Context Analysis",
    card: "judge",
    data: () => ({
      modelNumber: +$form.querySelector("#judge-model").value,
      messages: [
        { role: "system", content: judgeFeedbackPrompt() },
        { role: "user", content: results["1. Context Analysis"] },
      ],
    }),
  },
  {
    title: "5. Judge feedback to BioClin Analysis",
    card: "judge",
    data: () => ({
      modelNumber: +$form.querySelector("#judge-model").value,
      messages: [
        { role: "system", content: judgeFeedbackPrompt() },
        { role: "user", content: results["2. BioClin Analysis"] },
      ],
    }),
  },
  {
    title: "6. Context Analysis - Revised",
    card: "basic",
    data: () => ({
      modelNumber: +$form.querySelector("#basic-model").value,
      messages: [
        { role: "system", content: $form.querySelector("#basic-prompt").value },
        { role: "user", content: $clinicalDescription.value },
        { role: "assistant", content: results["1. Context Analysis"] },
        { role: "user", content: revisionPrompt("5. Judge feedback to Context Analysis") },
      ],
    }),
  },
  {
    title: "7. BioClin Analysis - Revised",
    card: "intermediate",
    data: () => ({
      modelNumber: +$form.querySelector("#intermediate-model").value,
      messages: [
        { role: "system", content: $form.querySelector("#intermediate-prompt").value },
        { role: "user", content: $clinicalDescription.value },
        { role: "assistant", content: results["2. BioClin Analysis"] },
        { role: "user", content: revisionPrompt("5. Judge feedback to BioClin Analysis") },
      ],
    }),
  },
  {
    title: "8. Judge Summary",
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
          content: $form.querySelector("#summary-prompt").value,
        },
        {
          role: "user",
          content: `
# Model 1 Analysis

${results["6. Context Analysis - Revised"]}

# Model 2 Analysis

${results["7. BioClin Analysis - Revised"]}

# Model 3 Analysis

${results["3. LLM as a Judge Analysis"]}
`,
        },
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
  $screenshot.classList.add("d-none");
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

// ------------------------------------------------------------------------------------------------
// Initialize the form
const params = new URLSearchParams(location.search);
const q = params.get("q");
if (q) $clinicalDescription.value = q;
