# Tools and platforms used

| Platform or tool | Use in this project |
| --- | --- |
| OpenAI Codex desktop, GPT-6-based development agent and delegated Codex agents | Designed the data contract, authored and reviewed implementation, generated English examples, tests and pitch materials, and coordinated verification. |
| Installed PDF, Presentations and verification-before-completion skills | Extracted and checked the local handbook, prepared offline presentation materials, and verified claims against fresh test output. |
| Bundled Python and pypdf | Extracted the competition rules and rubric from the supplied handbook. |
| Node.js 24, native HTTP, filesystem, crypto and node:test | Local server, atomic persistence, proposal keys, deterministic pricing and automated acceptance tests. |
| HTML, CSS and browser JavaScript | English interface, catalog upload and corrections, mobile layouts and offline presentation. |
| Playwright and headless Google Chrome | Desktop and mobile-width browser walkthroughs, real file upload, consent changes, screenshots and reload checks. |
| PowerShell, ripgrep, Codex workspace runtime and editing tools | Project inspection, development, dependency discovery and test execution on Windows. |
| OpenAI Artifact Tool | Authored the offline PowerPoint presentation and rendered slides for inspection. |

**Runtime language processing.** The demonstrated app used a local deterministic English parser. It sent no requests to a hosted inference provider. The optional Ollama adapter supports a user-selected local model. No model weights or API credentials are included. The fallback path was tested; no particular Ollama model is claimed as evaluated.

**Data and assets.** The team supplied the competition handbook. All merchant terms, names used as student aliases, menu prices and transactions shown in the demo are fictional test inputs. The interface uses local typography, CSS and text. No real purchases, student records or merchant endorsements are reported.

**Skills inventory.** The installed catalog included PDF reading, presentations, verification, browser control, debugging, planning, scientific and academic workflows, office documents and skill installation. The bundled parser, browser automation and slide authoring libraries covered this project. No additional skill installation was needed. The team should add any platforms or models it uses after handoff before final submission.

