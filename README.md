# Engineering Journey System (EJS)

Starter repository for the Engineering Journey System.

Includes:
- `agent.md` — agent behavior and session semantics
- `docs/adr/adr-template.md` — ADR template for structured journey capture
- `docs/adr/0010-engineering-journey-system-adoption.md` — example ADR
- `.github/pull_request_template.md` — PR template with EJS checks

## Purpose

EJS captures:
- human + AI collaboration
- learning and decision evolution
- reusable knowledge for future agents
- cross-platform engineering memory

## How to Use

1. Work with your coding agent as usual
2. At session end, trigger Journey Capture Mode
3. Agent drafts ADR, collaboration summary, and learning capture
4. Review and commit artifacts
5. Include links in PR template

# Using the Engineering Journey System (EJS) in Your Repository

The EJS starter kit allows you to capture **agent-assisted collaboration**, **key learnings**, and **structured ADRs** across sessions.

---

## 1. Copy the Starter Kit

1. Fork or clone the `Engineering-Journey-System` repo.  
2. Copy the following into your repository:

.github/
├─ pull_request_template.md
└─ agents/
└─ ejs-agent.md
docs/
└─ adr/
├─ adr-template.md
└─ <example ADRs>
README.md

---

## 2. Configure the Agent

1. Ensure your coding agent (e.g., GitHub Copilot, Claude, or similar) can read `.github/agents/ejs-agent.md`.
2. The agent will operate in **dual modes**:
   - **Collaboration Mode** – during coding sessions
   - **Journey Capture Mode** – triggered at session end
3. Unique session IDs are automatically generated: ejs-session-YYYY-MM-DD-<seq>
4. At session end, the agent drafts:
   - Collaboration summary
   - Key learnings
   - Journey ADR

---

## 3. Using ADRs

1. Fill out the `adr-template.md` for each session.
2. Example ADRs can be used as reference.
3. Link your ADRs in PRs using the PR template.

---

## 4. Pull Request Integration

- The PR template ensures you always attach an ADR and record agent collaboration.
- Contributors can review the session summaries and learnings before merging.

---

## 5. Optional: Vector Search Integration

You can index ADRs, collaboration summaries, and learning captures using a vector database to allow **AI-assisted Q&A** across your repository’s history.

Suggested workflow:

1. Extract the textual content from ADRs and summaries.
2. Convert content into embeddings (using OpenAI, Azure, or any embedding service).
3. Store embeddings in a vector store (Chroma, Pinecone, Milvus, or Azure AI Search).
4. Query the vector store for similarity search during:
   - New coding sessions
   - Learning reviews
   - Agent priming

> This allows future agents or developers to instantly recall **similar decisions, lessons, or patterns** from prior sessions.

---

## 6. Recommended Folder Structure in Your Repo

- `.github/`
   - `pull_request_template.md`
- `.github/agents/`
   - `ejs-agent.md`
- `docs/adr/`
   - `adr-template.md`
   - `<example ADRs>`
- `journey/summaries` – collaboration summaries
- `journey/learning` – captured key learnings


