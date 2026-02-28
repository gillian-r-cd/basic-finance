# AI-Native Learning System

An AI-native adaptive learning platform that turns a learner's intent into a structured, personalized learning experience. Domain-agnostic -- works for finance, physics, programming, or any field.

Built on first principles from *AI 时代的学习体系设计*:
- Experience construction over information delivery
- Networked knowledge over linear progression
- Knowledge as mental models, not isolated facts
- Spiral deepening with visible progress
- Transfer as the ultimate goal

## How It Works

```
Learner Intent ("I want to understand compound interest")
    |
    v
Planner ── generates structured plan with:
    |       goal, mental model, knowledge map, learning path, anchors
    v
Plan Review ── learner sees the full knowledge network,
    |           path rationale, and what's intentionally excluded
    v
Diagnosis ── 2-3 turn conversation to assess starting level
    |          (auto-skipped if profile exists)
    v
Teaching ── adaptive dialogue with interactive components,
    |         truth anchors, source annotations, model boundaries
    v
Verification ── 4-layer protocol (explain/predict/anomaly/boundary)
    |             with structured state tracking
    v
Profile Update ── async profile refinement after each unit
    |
    v
Next Unit (or Session Complete)
```

## Architecture

**Single Agent, Multiple Roles.** One LLM runtime layer (`llm_client.py`) serves all roles through role-specific context assembly. No duplicated infrastructure.

```
backend/
  agents/
    llm_client.py        # shared AsyncOpenAI singleton, call_llm()
    context_assembly.py   # role-specific context builders (planner/teacher/verifier/diagnostician/profile_updater)
    output_parser.py      # unified marker extraction + JSON parsing
    orchestrator.py       # session state machine (diagnosis → teaching → verification)
    planner.py            # intent → structured plan
    prompts.py            # default system prompts for all roles
  components/
    catalog.py            # interactive component registry with domain filtering
  models/
    domain.py             # SQLAlchemy models (Plan, Session, Message, Learner, Artifact, Trajectory)
  routers/
    plan.py, session.py, learner.py, artifact.py, admin.py
  database.py             # SQLite via SQLAlchemy
  main.py                 # FastAPI app

frontend/
  src/
    pages/
      Home.tsx            # learning intent input
      PlanReview.tsx       # plan review with knowledge network graph
      LearnSession.tsx     # main learning session (chat + components + sidebar)
      Profile.tsx          # learner profile view/edit
      Trajectory.tsx       # cognitive trajectory timeline
    components/
      KnowledgeMapView.tsx # full knowledge network (React Flow + dagre)
      KnowledgeMapMini.tsx # mini map for session sidebar
      interactive/
        ComponentRegistry.ts            # name → React component mapping
        CompoundInterestChart.tsx       # finance
        EmergencyBufferComparison.tsx   # finance
        RiskReturnScatter.tsx           # finance
        InflationTimeline.tsx           # finance
        AssetAllocationPie.tsx          # finance
        ConceptMap.tsx                  # universal
        MultipleChoice.tsx              # universal
```

## Key Design Decisions

**Information Reliability.** LLMs hallucinate. The system counters this at three levels: (1) prompt-level hallucination inhibition with source annotations, (2) verifiable truth anchors per unit that both Teacher and Verifier reference, (3) model boundary awareness for soft foundations.

**Active State Machine.** Role transitions aren't purely LLM-driven. The orchestrator enforces hard cutoffs (diagnosis: 3 turns), soft reminders (teaching: 8 turns), and session completion marking. The system is not passive.

**Verifier Independence.** The Verifier never sees Teacher's messages -- `Message.phase` field ensures information isolation. Verification state is tracked structurally (`Session.verification_state`), not by LLM memory.

**Domain Generality.** Components have a `domain` field (`finance` / `_universal`). Context assembly filters by `plan.domain`. The Planner prompt contains zero domain-specific content. Database is `learning.db`, not `finance.db`.

## Tech Stack

| Layer | Stack |
|-------|-------|
| Backend | Python, FastAPI, SQLAlchemy, SQLite, OpenAI-compatible API |
| Frontend | React 19, TypeScript, Vite, Tailwind CSS v4 |
| Visualization | React Flow, dagre, Recharts, KaTeX |
| Communication | SSE (Server-Sent Events) for streaming |

## Getting Started

### Prerequisites

- Python 3.10+
- Node.js 18+
- An OpenAI-compatible API endpoint (OpenAI, Azure, Volcengine, etc.)

### Backend

```bash
cd backend
python -m venv venv
venv\Scripts\activate        # Windows
# source venv/bin/activate   # macOS/Linux

pip install fastapi uvicorn sqlalchemy openai python-dotenv

# Configure LLM endpoint
cp env.example.txt .env
# Edit .env with your API key, base URL, and model name

python -m uvicorn main:app --host 0.0.0.0 --port 8001 --reload
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:5173 in your browser.

### Environment Variables

| Variable | Description |
|----------|-------------|
| `OPENAI_API_KEY` | API key for your LLM provider |
| `OPENAI_BASE_URL` | API base URL (e.g. `https://api.openai.com/v1`) |
| `MODEL_NAME` | Model identifier (e.g. `gpt-4o`) |
| `MAX_CONTEXT_TOKENS` | Token budget for context window (default: 6000) |

## Project Status

MVP2 complete. All 7 phases done:

| Phase | What | Status |
|-------|------|--------|
| 0 | LLM call layer unification | Done |
| 1 | Planner rewrite (full methodology) | Done |
| 2 | Information reliability (anchors + hallucination inhibition) | Done |
| 3 | Pre-assessment + profile + state machine hardening | Done |
| 4 | Knowledge network visibility (frontend) | Done |
| 5 | Inner loop + cognitive trajectory | Done |
| 6 | Domain generality validation | Done |

See `MVP2方案.md` for the full design document and `progress.md` for detailed implementation log.
