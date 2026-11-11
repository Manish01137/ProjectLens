# ProjectLens

**Discovering Projects That Truly Fit.** Final-year B.Tech students sign up, describe their skills, get
personalised project ideas, and talk to an assistant that answers what they actually ask: greetings get a
greeting, questions get answers, and project cards only appear when you ask for projects.

```
projectlens/
  web/                 Next.js 16 app (App Router, TypeScript, Tailwind, Prisma, Auth.js)
  ml_service/          FastAPI service: intent classifier, retriever + ranking, idea writer, Drive download
  docker-compose.yml   web + ml_service (+ optional Ollama)
  .env.example         every variable, documented
```

## Prerequisites

- Node.js 20.9+ (22 recommended) and npm
- Python 3.10+ (3.11 recommended)
- Access to the trained model on Google Drive (see [Connect Google Drive](#connect-google-drive))
- [Ollama](https://ollama.com) 0.5+ with `qwen2.5:3b` for new ideas and chat replies
  (`brew install ollama && brew services start ollama && ollama pull qwen2.5:3b`). Without it, everything still
  works with catalogue projects and template replies.

## Run it (6 commands)

```bash
git clone <your-repo-url> projectlens && cd projectlens
npm run setup            # .env with fresh secrets, Node deps, Python venv, database + demo student
# edit .env: Drive access (next section) and, optionally, your LLM provider
npm run dev              # ML service on :8000 + website on :3000
```

`npm run dev` starts both services and prints one line when everything is ready:

```
✓ ProjectLens is ready → http://localhost:3000  (ML service http://localhost:8000, 50,000 projects indexed)
```

Sign in with the demo student **demo@projectlens.dev / Demo@1234**, or create your own account.

On the first start the ML service downloads the model (about 120 MB) from Drive. If it can't, the website
still runs and shows "Recommendations are warming up", and the `ml` log explains what to fix.

| Command | What it does |
| --- | --- |
| `npm run dev` | ML service + website together |
| `npm run lint` / `npm run typecheck` | ESLint / TypeScript (strict) |
| `npm test` | Vitest unit tests + `ml_service` tests (Drive download, ranking, generator, `test_service.py`) |
| `npm run e2e` | Playwright end-to-end flow (production build, mock ML service, throwaway DB) |
| `npm run model:download` | Fetch or refresh the model from Drive by hand (`-- --force` to re-download) |

## Connect Google Drive

The model lives in your Drive as `MyDrive/ProjectLens/projectlens_retriever.zip`. The ML service downloads it
into `ml_service/artifacts/` at start-up, verifies that `projects.csv` and `embeddings.npy` have the same number
of rows, and stores Drive's `modifiedTime` in `artifacts/.drive_version`, so later starts skip the download
until the file changes.

**1. Copy the file ID.** In Drive, right-click the zip → *Share* → *Copy link*. The ID is the part between
`/d/` and `/view`:

```
https://drive.google.com/file/d/1llz0vhcPFQUgrrVRBm2vJl1de5-cT1zt/view
                                └──────── MODEL_DRIVE_FILE_ID ────────┘
```

Put it in `.env` as `MODEL_DRIVE_FILE_ID` (already filled in for the current model).

**2. Choose how the service signs in.**

### Option A: service account (recommended, the file stays private)

1. Open [Google Cloud Console](https://console.cloud.google.com/) and create a project (for example
   `projectlens`).
2. *APIs & Services → Library* → search **Google Drive API** → **Enable**.
3. *IAM & Admin → Service Accounts* → **Create service account** (name it `projectlens-model`). No roles are
   needed. Finish.
4. Open the new account → *Keys* → *Add key → Create new key → JSON*. A key file downloads.
5. Move it to `secrets/drive-sa.json` in this repo. The `secrets/` folder and `*-sa.json` files are git-ignored.
   Never commit keys.
6. Copy the service account's email (like `projectlens-model@projectlens.iam.gserviceaccount.com`). In Drive,
   share **the zip or the whole `ProjectLens` folder** with that email as **Viewer**.
7. In `.env`:
   ```
   MODEL_DRIVE_FILE_ID="1llz0vhcPFQUgrrVRBm2vJl1de5-cT1zt"
   GOOGLE_SERVICE_ACCOUNT_JSON="secrets/drive-sa.json"
   ```

The service uses the read-only scope `drive.readonly`.

### Option B: shared link (simplest)

Share the zip as **Anyone with the link → Viewer**, set only `MODEL_DRIVE_FILE_ID`, and leave
`GOOGLE_SERVICE_ACCOUNT_JSON` empty. The download uses `gdown`. Without credentials Drive doesn't reveal
`modifiedTime`, so to pick up a new upload use `npm run model:download -- --force` or the reload endpoint below.

**3. Check it.** `npm run model:download` prints one of:

| Log line | Meaning |
| --- | --- |
| `model up to date (Drive modifiedTime …)` | Nothing to do |
| `downloading 122 MB from Drive via …` | Fetching, with progress every few seconds |
| `Drive access denied: share the file with <email> (Viewer)` | Share the file with the service account |
| `Drive access denied: the file is not shared as 'Anyone with the link'` | Option B needs the link share |
| `Drive unreachable (…); using the local model` | Offline; the current model keeps serving |

Without any model, `GET /health` returns `{"status":"no_model","message":"…"}` instead of crashing.

**Placing the model by hand instead.** Unzip `projectlens_retriever.zip` into `ml_service/artifacts/`, either
directly or as one folder inside it (`artifacts/projectlens_retriever/model/…` works too). If Drive is then
denied or unreachable, the service logs `using the local model in …` and never downloads over or deletes those
files. Once Drive access works it will fetch the Drive copy, but only after validating it. Set
`SKIP_MODEL_DOWNLOAD=1` to skip the Drive check entirely.

## The three models

| # | Model | Job | Endpoint | Code |
| --- | --- | --- | --- | --- |
| 1 | DistilBERT intent classifier (fine-tuned) | What does the student want? | `POST /intent` | `ml_service/intent.py` |
| 2 | MiniLM retriever (fine-tuned on 50k problem statements) + ranking rules | Find fitting, varied projects; respect the domain, approach, level, weeks and hardware asked for | `POST /recommend` | `recommender.py`, `ranking.py` |
| 3 | Qwen2.5-3B via Ollama (prompted, not trained) | Write new problem statements grounded in model 2's matches | `POST /generate` | `generator.py` |

```
message ─► /intent (model 1; rules on 501) ─► safety overrides ─┬─ greeting / chitchat / general_question ─► LLM reply, no cards
                                                                ├─ ask_project / refine_project ─► /generate (model 3)
                                                                │      └─ timeout or error ─► /recommend (model 2) ─► cards
                                                                ├─ explain_project ─► LLM week-by-week plan for that card
                                                                └─ profile_update ─► LLM-extracted, validated, saved
```

- **Intent.** The website uses `/intent`'s `intent` field. It is already `general_question` below the
  model's 0.60 threshold. On 501 (model not installed) or an error, the rules in `web/lib/chat/intent.ts` decide.
  Then safety overrides in `web/lib/chat/overrides.ts` win, in this order:
  1. a first-person statement about the student is `profile_update`;
  2. a short follow-up right after cards ("make it easier", "show more") is `refine_project`;
  3. a reference to a card plus how/explain/plan/build is `explain_project`;
  4. a bare greeting or thanks is chat.

  Every user message stores `intent`, `confidence` and `intentSource` (`model` or `rules`).
- **Context.** Each chat remembers the filters the ranking last applied (`X-Applied-Filters`, or `applied` from
  `/generate`). A refinement sends them again, merged with the new message: a new domain replaces the old one,
  "any domain" clears it, and "easier" steps down from the current level. Everything already shown in the
  conversation (`inspired_by` and `grounding` ids), plus the student's seen list, goes into `exclude_core_ids`.
- **Ideas.** `/generate` asks for 3 ideas. Each must pass four checks: format; skills (only the student's skills
  plus at most one new one); time and domain; and novelty (cosine similarity to every catalogue row below
  `NOVELTY_MAX`, 0.85). Rejected ideas are sent back with the reasons. If the LLM is down, the closest catalogue
  projects come back instead (`source: "catalogue"`). The website waits `ML_GENERATE_TIMEOUT_MS` (60 s), then
  asks `/recommend` for 5 catalogue projects and shows "Writer offline, showing the closest catalogue projects."
- **Never invented.** Cards only ever come from `/generate` or `/recommend`. The LLM writes prose: chat replies,
  plans, "Rewrite in plain words" and profile extraction. Extracted profile fields are only accepted when the
  message itself mentions them.

### Model settings

| Variable | Where | Meaning |
| --- | --- | --- |
| `MODEL_DRIVE_FILE_ID`, `GOOGLE_SERVICE_ACCOUNT_JSON` | ML service | Model 2 zip on Drive (see above) |
| `INTENT_DRIVE_FILE_ID` | ML service | Model 1 zip `projectlens_intent.zip`, shared "Anyone with the link"; unpacked to `artifacts/projectlens_intent/` |
| `SKIP_MODEL_DOWNLOAD`, `SKIP_INTENT_MODEL` | ML service | `1` to skip Drive / start without model 1 |
| `OLLAMA_URL`, `OLLAMA_MODEL` | both | Model 3 and chat replies (`http://localhost:11434`, `qwen2.5:3b`) |
| `NOVELTY_MAX` | ML service | Novelty threshold for generated ideas (0.85) |
| `ML_GENERATE_TIMEOUT_MS` | website | How long to wait for `/generate` before falling back (60000) |
| `LLM_PROVIDER` and API keys | website | Chat-reply provider (below) |

`ml_service/.env` holds ML-only settings and is read after the root `.env`, which wins on duplicates.

## Retrain a model and reload it

All three follow the same path: a Colab notebook writes a zip to `MyDrive/ProjectLens/`, and one call reloads it
without restarting anything.

| Model | Notebook | Zip in Drive | Installed to |
| --- | --- | --- | --- |
| 1 Intent | `ProjectLens_Train_Intent.ipynb` | `projectlens_intent.zip` | `artifacts/projectlens_intent/` |
| 2 Retriever | `ProjectLens_Train_Retriever.ipynb` (v2: `..._Retriever_v2.ipynb`) | `projectlens_retriever.zip` | `artifacts/` (or one folder inside it) |
| 3 Writer | none: it is prompted, not trained. Change `OLLAMA_MODEL`, or the prompt and checks in `generator.py` | | |

1. Run the notebook in Colab.
2. Save the zip **over the existing file** so its ID stays the same, for example with Drive mounted:
   ```python
   shutil.copy("projectlens_retriever.zip", "/content/drive/MyDrive/ProjectLens/projectlens_retriever.zip")
   ```
   If you upload a new file instead, its ID changes: update `MODEL_DRIVE_FILE_ID` / `INTENT_DRIVE_FILE_ID`.
3. Reload:
   ```bash
   curl -X POST -H "Authorization: Bearer $ML_ADMIN_TOKEN" http://localhost:8000/admin/reload-model
   # add ?force=true to download even if the modifiedTime looks unchanged (shared-link mode)
   ```
   This re-checks Drive, validates the retriever (rows of `projects.csv` = rows of `embeddings.npy`), swaps it in
   memory, and reloads the intent model. If a new retriever fails validation, the old one keeps serving
   (`"status": "kept_previous"`). Note: `intent.py` only downloads its zip when `artifacts/projectlens_intent/`
   is missing, so to update model 1, delete that folder before reloading.

Check the result with `curl localhost:8000/health`, which reports `projects_indexed`, `intent_model` and
`intent_version`.

## Chat replies and the LLM provider

Chat replies, plans, profile extraction and "Rewrite in plain words" use `LLM_PROVIDER` in `.env`. Idea writing
(`/generate`) always uses Ollama.


| Provider | Settings | Notes |
| --- | --- | --- |
| `ollama` (default) | `OLLAMA_URL`, `OLLAMA_MODEL=qwen2.5:3b` | Free and local. `ollama pull qwen2.5:3b` once |
| `anthropic` | `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL` (default `claude-haiku-5-5`) | |
| `openai` | `OPENAI_API_KEY`, `OPENAI_MODEL` | |
| `gemini` | `GEMINI_API_KEY`, `GEMINI_MODEL` | |
| `none` | | Polite template replies only |

If the chosen LLM can't be reached, the chat still works. Project requests return catalogue cards; greetings,
plans and profile updates use built-in templates; and general questions get an honest "can't reach my language
model" reply. The status dot in the sidebar footer shows the database, retriever, intent model and LLM.

## Docker

```bash
docker compose up --build                     # web on :3000, ML service on :8000
docker compose --profile ollama up --build    # plus a local Ollama that pulls qwen2.5:3b on first start
```

Compose reads `.env`. The model, database and Ollama models live in named volumes. Put a service-account key at
`secrets/drive-sa.json` (mounted read-only into the ML container).

## Deploy

**Database (Neon or Supabase).** Create a Postgres database and copy its connection string
(`postgresql://…?sslmode=require`). The same Prisma schema runs on Postgres: `web/scripts/prisma.mjs` swaps the
provider whenever `DATABASE_URL` starts with `postgres`. Create the tables once:
`DATABASE_URL=postgresql://… npm --workspace web run db:push`.

**ML service (Render or Railway).** Deploy `ml_service/` with its `Dockerfile`.
- Environment: `MODEL_DRIVE_FILE_ID`, `GOOGLE_SERVICE_ACCOUNT_JSON`, `ML_ADMIN_TOKEN`,
  `ALLOWED_ORIGINS=https://<your-vercel-domain>`.
- For the key, use Render's *Secret Files* (for example `/etc/secrets/drive-sa.json`) or a Railway volume, and
  point `GOOGLE_SERVICE_ACCOUNT_JSON` at that path.
- Attach a persistent disk at `/app/artifacts` so the model survives restarts. Allow about 2 GB of RAM for
  sentence-transformers.

**Website (Vercel).** Import the repo and set **Root Directory** to `web`. Vercel picks up the npm workspace.
Environment: `DATABASE_URL` (Postgres), `AUTH_SECRET`, `ML_API_URL=https://<your-ml-service>`, `LLM_PROVIDER`
plus its key, and optionally `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` (redirect URI
`https://<domain>/api/auth/callback/google`). The build runs `prisma generate` automatically.

> The rate limiter (30 requests per minute per user) is in memory, which suits a single instance. Swap
> `web/lib/rate-limit.ts` for a Redis-backed limiter if you run several.

## Project map

| Path | What lives there |
| --- | --- |
| `web/lib/ml.ts` | Typed ML client: 15 s timeout, one retry on network errors, Zod-parsed responses, `MlUnavailableError` |
| `web/lib/chat/` | Intent rules, message understanding, router, prompts |
| `web/lib/llm.ts` | Provider switch with streaming for Ollama, Anthropic, OpenAI and Gemini |
| `web/lib/recommend.ts` | Seen list (`ShownProject`), filters, dashboard batches |
| `web/app/api/` | Route handlers: logged-in only, Zod-validated, rate-limited |
| `web/e2e/mock-ml.mjs` | Contract-compatible stand-in for the ML service, used by the e2e tests |
| `ml_service/download_artifacts.py` | Drive download (service account or shared link), validation, atomic swap |
| `ml_service/main.py` | `/health`, `/recommend`, `/intent` (501 stub), `/admin/reload-model` |
| `ml_service/recommender.py`, `ranking.py` | Model 2: retriever and ranking rules (shared with the Colab notebook) |
| `ml_service/intent.py` | Model 1: DistilBERT intent classifier |
| `ml_service/generator.py` | Model 3: grounded idea writer with format, skill, time/domain and novelty checks |
| `web/lib/chat/overrides.ts`, `carry.ts` | Safety overrides after the intent model; filter carry-over |
| `web/lib/cards.ts` | Maps `/generate` ideas to cards |
# ProjectLens
