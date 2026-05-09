import { parse, toHtml, toMarkdown } from "org-toolkit";
import "./style.css";

type Tab = "ast" | "markdown" | "html";

interface RenderState {
  readonly ast: string;
  readonly markdown: string;
  readonly html: string;
  readonly error: string | null;
}

const SAMPLE_SOURCE = [
  "#+TITLE: Org Toolkit Playground",
  "#+AUTHOR: Copilot",
  "",
  "* TODO Ship the browser demo :web:demo:",
  "  DEADLINE: <2026-05-10 Sun>",
  "",
  "- [ ] Parse org text",
  "- [x] Render Markdown",
  "- [ ] Preview HTML",
  "",
  "| Name  | Role     |",
  "|-------+----------|",
  "| Alice | Engineer |",
  "| Bob   | Designer |",
  "",
  "See [[https://github.com/hexx/org-toolkit][org-toolkit]] for more.",
].join("\n");

const app = document.querySelector<HTMLDivElement>("#app");
if (app === null) {
  throw new Error("Missing #app container");
}

app.innerHTML = `
  <div class="playground">
    <header class="playground__header">
      <div>
        <h1>org-toolkit playground</h1>
        <p>Browser-only demo with live AST, Markdown, and HTML preview.</p>
      </div>
      <div class="playground__status" data-status>Idle</div>
    </header>
    <main class="playground__layout">
      <section class="panel panel--editor" aria-label="Org editor">
        <div class="panel__header">
          <h2>Source</h2>
        </div>
        <textarea
          class="editor"
          spellcheck="false"
          aria-label="Org source"
          data-source
        ></textarea>
      </section>
      <section class="panel panel--output" aria-label="Rendered output">
        <div class="panel__header panel__header--tabs">
          <div class="tabs" role="tablist" aria-label="Output tabs">
            <button type="button" class="tab is-active" data-tab="ast" role="tab" aria-selected="true">AST</button>
            <button type="button" class="tab" data-tab="markdown" role="tab" aria-selected="false">Markdown</button>
            <button type="button" class="tab" data-tab="html" role="tab" aria-selected="false">HTML</button>
          </div>
          <div class="panel__hint">Debounced parse: 300ms</div>
        </div>
        <div class="error" data-error hidden></div>
        <div class="output">
          <pre class="output__ast" data-output="ast"></pre>
          <pre class="output__markdown" data-output="markdown" hidden></pre>
          <div class="output__preview" data-output="html" hidden></div>
        </div>
      </section>
    </main>
  </div>
`;

const source = queryRequired<HTMLTextAreaElement>("[data-source]");
const status = queryRequired<HTMLDivElement>("[data-status]");
const errorPanel = queryRequired<HTMLDivElement>("[data-error]");
const astOutput = queryRequired<HTMLPreElement>('[data-output="ast"]');
const markdownOutput = queryRequired<HTMLPreElement>('[data-output="markdown"]');
const htmlOutput = queryRequired<HTMLDivElement>('[data-output="html"]');
const tabs = app.querySelectorAll<HTMLButtonElement>("[data-tab]");

source.value = SAMPLE_SOURCE;

let activeTab: Tab = "ast";
let debounceHandle: number | undefined;
let renderState: RenderState = {
  ast: "",
  markdown: "",
  html: "",
  error: null,
};

source.addEventListener("input", scheduleRender);
tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    const nextTab = tab.dataset.tab as Tab | undefined;
    if (nextTab === undefined) {
      return;
    }

    activeTab = nextTab;
    updateTabButtons();
    showActiveOutput();
  });
});

renderState = renderSource(source.value);
status.textContent = renderState.error === null ? "Ready" : "Parse error";
updateTabButtons();
render();

function scheduleRender(): void {
  status.textContent = "Parsing...";
  if (debounceHandle !== undefined) {
    window.clearTimeout(debounceHandle);
  }

  debounceHandle = window.setTimeout(() => {
    debounceHandle = undefined;
    renderState = renderSource(source.value);
    status.textContent = renderState.error === null ? "Ready" : "Parse error";
    render();
  }, 300);
}

function renderSource(value: string): RenderState {
  try {
    const ast = parse(value);
    return {
      ast: JSON.stringify(ast, null, 2),
      markdown: toMarkdown(ast),
      html: toHtml(ast),
      error: null,
    };
  } catch (error: unknown) {
    return {
      ast: "",
      markdown: "",
      html: "",
      error: formatError(error),
    };
  }
}

function render(): void {
  if (renderState.error !== null) {
    errorPanel.hidden = false;
    errorPanel.textContent = renderState.error;
    astOutput.hidden = true;
    markdownOutput.hidden = true;
    htmlOutput.hidden = true;
    htmlOutput.innerHTML = "";
    astOutput.textContent = "";
    markdownOutput.textContent = "";
    return;
  }

  errorPanel.hidden = true;
  errorPanel.textContent = "";
  astOutput.hidden = activeTab !== "ast";
  markdownOutput.hidden = activeTab !== "markdown";
  htmlOutput.hidden = activeTab !== "html";

  astOutput.innerHTML = highlightJson(renderState.ast);
  markdownOutput.textContent = renderState.markdown;
  htmlOutput.innerHTML = renderState.html;
}

function showActiveOutput(): void {
  if (renderState.error !== null) {
    render();
    return;
  }

  astOutput.hidden = activeTab !== "ast";
  markdownOutput.hidden = activeTab !== "markdown";
  htmlOutput.hidden = activeTab !== "html";
}

function updateTabButtons(): void {
  tabs.forEach((tab) => {
    const isActive = tab.dataset.tab === activeTab;
    tab.classList.toggle("is-active", isActive);
    tab.setAttribute("aria-selected", String(isActive));
  });
}

function highlightJson(json: string): string {
  return escapeHtml(json).replace(
    /("(?:\\.|[^"\\])*"(?::)?|\b-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?\b|\btrue\b|\bfalse\b|\bnull\b)/g,
    (token) => {
      if (token.startsWith('"')) {
        if (token.endsWith(':')) {
          return `<span class="token token--key">${token.slice(0, -1)}</span><span class="token token--punct">:</span>`;
        }

        return `<span class="token token--string">${token}</span>`;
      }

      if (token === "true" || token === "false") {
        return `<span class="token token--boolean">${token}</span>`;
      }

      if (token === "null") {
        return `<span class="token token--null">${token}</span>`;
      }

      return `<span class="token token--number">${token}</span>`;
    },
  );
}

function formatError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function queryRequired<T extends Element>(selector: string): T {
  const element = app!.querySelector<T>(selector);
  if (element === null) {
    throw new Error(`Missing required element: ${selector}`);
  }

  return element;
}
