# Adverse Events

An AI-powered tool to analyze clinical trial descriptions and identify potential adverse events using multiple LLM models.

## Features

- Multi-model analysis using various LLMs (OpenAI, Anthropic, Google, Cerebras, Groq)
- Three-tier evaluation system:
  - Basic analysis for quick adverse event detection
  - Intermediate analysis with step-by-step clinical expert reasoning
  - Advanced LLM judge analysis considering 15 clinical parameters
- Sample clinical trial descriptions for testing
- Dark mode support with auto/light/dark theme options
- Form persistence for saving user preferences
- Real-time streaming responses with progressive rendering
- Mobile-responsive Bootstrap 5.3 interface

## Usage

1. Select a sample clinical trial description or enter your own
2. Customize analysis settings (optional):
   - Modify prompts for each analysis tier
   - Select different LLM models for each evaluation
3. Click "Analyze" to get multi-model evaluation results
4. Review the layered analysis from basic to advanced judge evaluation

## Setup

### Prerequisites

- Modern web browser with JavaScript enabled
- Access to LLM Foundry API endpoints

### Local Setup

1. Clone this repository:

```bash
git clone https://github.com/gramener/adverseevents.git
cd adverseevents
```

2. Serve the files using any static web server. For example, using Python:

```bash
python -m http.server
```

3. Open `http://localhost:8000` in your web browser

## Deployment

On [Cloudflare DNS](https://dash.cloudflare.com/2c483e1dd66869c9554c6949a2d17d96/straive.app/dns/records),
proxy CNAME `adverseevents.straive.app` to `gramener.github.io`.

On this repository's [page settings](https://github.com/gramener/adverseevents/settings/pages), set

- Source: `Deploy from a branch`
- Branch: `main`
- Folder: `/`

## Technical Details

### Architecture

- Frontend: Vanilla JavaScript with lit-html for rendering
- LLM Integration: Multiple model providers through LLM Foundry API
- Styling: Bootstrap 5.3.3 with dark mode support

### Dependencies

- [lit-html](https://www.npmjs.com/package/lit-html) - Template rendering and DOM updates
- [marked](https://www.npmjs.com/package/marked) - Markdown parsing
- [asyncllm](https://www.npmjs.com/package/asyncllm) - Streaming LLM responses
- [Bootstrap](https://www.npmjs.com/package/bootstrap) - UI framework and styling
- [Bootstrap Icons](https://www.npmjs.com/package/bootstrap-icons) - Icon system
- [FormPersistence.js](https://www.npmjs.com/package/form-persistence) - Form state management

### LLM Models

Supports multiple AI models with varying costs:

- OpenAI: GPT-4 variants ($0.15-$5)
- Anthropic: Claude 3 models ($0.25-$3)
- Google: Gemini 1.5 models ($0.04-$1.25)
- Cerebras: Llama 3.1 models (Free)
- Groq: Various models including Llama 3.2, Gemma 2, Mixtral (Free)

## License

[MIT](LICENSE)
