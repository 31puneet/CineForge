# Agentic Film Studio - Detailed Engineering Milestones

This document is the definitive engineering roadmap for CineForge. It translates the 2000+ line PRD and TDD into granular, heavily detailed execution steps. Each milestone represents a strict engineering boundary that must be fully implemented, tested, and reviewed according to `Agent.md` before proceeding.

---

## Phase 1: Core Infrastructure & Application Shell

### [x] Milestone 0: Project Initialization & Infrastructure
**What it does:** Bootstraps the mono-repo architecture, establishes the local Docker environment, and provisions the foundational services required for development.
* [x] **Frontend Initialization**: Scaffold React + Vite + TypeScript application in `/frontend`. Configure Tailwind CSS v4 layout structure.
* [x] **Backend Initialization**: Scaffold Node.js + Express + TypeScript application in `/backend`. Configure `tsx` for execution.
* [x] **AI Service Initialization**: Scaffold Python + FastAPI environment in `/ai-service`. Configure `uvicorn` and Python dependency management.
* [x] **Containerization**: Write `Dockerfile`s for all three services utilizing multi-stage builds and non-root users where applicable.
* [x] **Orchestration**: Write `docker-compose.yml` defining the local network `cineforge_default`.
* [x] **Databases & Storage**: Integrate MongoDB (durable state), Redis (job queues/pubsub), and MinIO (S3-compatible object storage via `cgr.dev/chainguard/minio`) into Docker Compose.
* [x] **Version Control**: Establish `.gitignore` and initialize Git repository.

### [x] Milestone 1: Backend Architecture Foundation
**What it does:** Establishes the rigid layered architecture in Node.js (Routes -> Controllers -> Services -> Repositories) to prevent spaghetti code. Implements robust error handling and observability.
* [x] **Directory Structure**: Create `/src/api`, `/src/config`, `/src/middleware`, `/src/models`, `/src/services`, `/src/utils`.
* [x] **Environment Validation**: Implement `config.ts` using `zod` to strictly validate `process.env` on boot (requires `MONGO_URI`, `REDIS_URL`, `MINIO_ENDPOINT`, etc.). Crash immediately if invalid.
* [x] **Database Connection Pool**: Implement `database.ts` using `mongoose`. Add event listeners for `connected`, `error`, and `disconnected`. Implement exponential backoff for connection retries.
* [x] **Error Classes**: Define `AppError` base class. Extend into `ValidationError` (400), `UnauthorizedError` (401), `ForbiddenError` (403), `NotFoundError` (404), and `ConflictError` (409).
* [x] **Global Error Middleware**: Implement `errorHandler.ts`. Ensure it intercepts all thrown errors, formats a standard JSON response `{ error: { code, message, details } }`, and prevents stack trace leakage in production.
* [x] **Observability**: Implement `requestLogger.ts` middleware. Generate a unique UUID `x-request-id` for every incoming request. Attach it to `req` and include it in all logs and error responses for traceability.
* [x] **Health Checks**: Expand `/api/health` to actively ping MongoDB and Redis before returning 200 OK.

### [x] Milestone 2: Secure Authentication Boundary
**What it does:** Implements Google OAuth 2.0 to establish user identity, issuing secure, HTTP-only JWTs. Protects backend resources.
* [x] **User Model**: Create `User.ts` Mongoose schema. Fields: `googleId` (String, unique, index), `email` (String, unique), `name` (String), `avatarUrl` (String), `role` (Enum: user/admin), `createdAt`, `updatedAt`.
* [x] **OAuth Flow Setup**: Integrate `google-auth-library`. Create `auth.service.ts` to handle token verification and user upsert logic.
* [x] **Session Management**: Create `jwt.utils.ts`. Implement `generateToken(userId)` and `verifyToken(token)`.
* [x] **Auth Routes**: Implement `/api/auth/google` (receives Google credential), `/api/auth/me` (returns current user profile), `/api/auth/logout` (clears cookie).
* [x] **Security Middleware**: Implement `requireAuth.ts`. It must extract the JWT from signed, HttpOnly, secure cookies, verify it, fetch the user, and attach `req.user`. Throw `UnauthorizedError` if invalid.

### [x] Milestone 3: Project & Workspace Data Layer
**What it does:** Implements the core `Project` entity, which acts as the hierarchical root for all workflows, scripts, characters, and videos.
* [x] **Project Model**: Create `Project.ts` schema. Fields: `userId` (ObjectId, ref: User, index), `title` (String), `status` (Enum: draft, active, completed, archived), `settings` (Mixed/Subdocument for aspect ratio, target duration).
* [x] **Project Repository**: Create `project.repository.ts` abstracting DB calls. Implement `findByUserId`, `findByIdAndUserId`, `create`, `update`, `delete`.
* [x] **Project Controller & Routes**: Implement standard REST endpoints: `GET /api/projects`, `POST /api/projects`, `GET /api/projects/:id`, `PATCH /api/projects/:id`, `DELETE /api/projects/:id`.
* [x] **Authorization Enforcement**: Every endpoint must extract `req.user.id` and pass it to the repository. The system MUST return 404/403 if a user attempts to access a project they do not own.

### [x] Milestone 4: Frontend Application Shell & Routing
**What it does:** Sets up the React architecture, state management, and the 25/50/25 layout mandated by the PRD.
* [x] **Router Setup**: Configure `react-router-dom`. Define routes: `/login`, `/dashboard`, `/project/:id`.
* [x] **Auth Context**: Create `AuthProvider.tsx` using React Context. Fetch `/api/auth/me` on mount. Manage `user`, `isLoading`, and `logout` function.
* [x] **Protected Routes**: Create `ProtectedRoute.tsx` wrapper that redirects unauthenticated users to `/login`.
* [x] **Layout Architecture**: Build `MainLayout.tsx`. Implement the rigid 25% (Sidebar), 50% (Main Workspace/Chat), 25% (Artifact/Properties panel) grid system using Tailwind CSS CSS Grid (`grid-cols-4`).
* [x] **Theming**: Configure Tailwind `theme.extend` with a cohesive, dark-mode focused color palette (glassmorphism accents, deep grays/blues) to hit the "Premium Design" requirement.

---

## Phase 2: Agent Orchestration & Media Pipeline

### [x] Milestone 5: File Storage Abstraction (Node & MinIO)
**What it does:** Provides the backbone for handling large binaries (images, videos, PDFs) securely.
* [x] **MinIO Client**: Initialize `minio` SDK in `storage.service.ts` connecting to the Docker MinIO container using credentials from `.env`.
* [x] **Bucket Initialization**: On startup, ensure buckets exist (e.g., `cineforge-assets`, `cineforge-renders`). Set correct CORS policies on the buckets.
* [x] **Pre-signed URLs**: Implement logic to generate time-limited pre-signed URLs for `PUT` (uploading) and `GET` (viewing) operations. 
* [x] **Asset Model**: Create `Asset.ts` Mongoose schema to track metadata. Fields: `projectId`, `userId`, `type` (image/audio/video), `bucket`, `objectKey`, `mimeType`, `sizeBytes`, `version`.
* [x] **Upload API**: Create `/api/projects/:id/assets/upload-url`. Validate user ownership of project before granting upload access.

### [x] Milestone 6: AI Engine Foundation (FastAPI & LangGraph)
**What it does:** Establishes the Python service that will execute the complex multi-agent film workflow.
* [x] **FastAPI Architecture**: Structure `/api/routes`, `/services`, `/agents`, `/schemas`, `/core`.
* [x] **State Models (Pydantic)**: Define the massive `FilmGraphState` TypedDict. It must track: `messages`, `current_stage`, `script_data`, `characters`, `voiceovers`, `video_shots`, and `approval_states`.
* [x] **Provider Adapters**: Create `BaseLLMProvider` interface. Implement `OpenAIAdapter` (or similar) extending it. This ensures we don't hardcode API calls in agent logic.
* [x] **Graph Definition**: Initialize the LangGraph `StateGraph`. Define dummy nodes for `script_agent`, `character_agent`, `voiceover_agent`, `video_agent`, and `editor_agent`.
* [x] **API Endpoints**: Create `/api/workflow/start` and `/api/workflow/resume` endpoints to accept commands from the Node backend.

### [x] Milestone 7: The Chat System (User Context)
**What it does:** Implements the main communication interface between the Director (User) and the System.
* [x] **Message Model**: Create `Message.ts` schema. Fields: `projectId`, `role` (user/assistant/system), `content`, `metadata` (JSON for function calls or artifact links).
* [x] **Chat UI**: Build the central 50% panel. Implement message bubbles, auto-scrolling, and an input area supporting multi-line text and attachments.
* [x] **Chat API**: Create `/api/projects/:id/messages`. Implement POST (send message) and GET (history).
* [x] **Orchestration Link**: When a user sends a message, Node.js saves it to MongoDB, then makes an HTTP call to the FastAPI `/api/workflow/resume` endpoint, triggering the LangGraph state machine.

---

## Phase 3: The 5-Stage Agent Pipeline (HITL Focused)

### [x] Milestone 8: Stage 1 - Script Agent & Review
**What it does:** Transforms user prompts into a highly structured JSON script, pausing for human approval.
* [x] **Script Prompt Engineering**: Write the system prompt in FastAPI instructing the LLM to output a precise JSON schema containing global narrative, and a list of `shots` (id, description, duration_sec, dialogue, speaker).
* [x] **Script Generation Node**: Implement `generate_script` LangGraph node. It calls the LLM, validates the JSON output using Pydantic, and updates `FilmGraphState.script_data`.
* [x] **State Transition**: LangGraph transitions to an `__end__` or `wait_for_human` pseudo-state after generation, signaling Node.js.
* [x] **Script UI (Right Panel)**: Build the React component for the 25% right panel. It reads the structured script and displays it in a readable format (Shot list, durations, dialogue).
* [x] **Approval API**: Implement `/api/projects/:id/script/approve` and `/api/projects/:id/script/reject` in Node.js. 
* [x] **Regeneration Logic**: If rejected, send feedback back to FastAPI. Graph routes back to `generate_script`, creating Version 2 while preserving Version 1 in Mongo.

### [ ] Milestone 9: Stage 2 - Character Generation & Review
**What it does:** Extracts speakers from the script and generates consistent visual reference images for them.
* [ ] **Character Extraction**: FastAPI analyzes `script_data` and identifies unique speakers.
* [ ] **Image Generation Adapter**: Implement `BaseImageProvider` and a concrete adapter for an image generation API.
* [ ] **Character Node**: Implement `generate_characters` LangGraph node. Loops through characters, generates prompts, calls Image API, uploads images to MinIO, and updates `FilmGraphState.characters`.
* [ ] **Character UI**: Build a grid of "Character Cards" in the React Right Panel. Show the reference image, name, and description.
* [ ] **Targeted Regeneration**: Implement per-character rejection. If Character A is bad, Node.js API `/api/projects/:id/characters/:charId/regenerate` triggers FastAPI to *only* regenerate Character A.

### [ ] Milestone 10: Stage 3 - Voiceover Generation & Review
**What it does:** Generates TTS audio for all dialogue lines, mapping characters to specific voices.
* [ ] **Audio Provider Adapter**: Implement `BaseAudioProvider` for a TTS service (e.g., ElevenLabs API mapping).
* [ ] **Voiceover Node**: Implement `generate_voiceovers` LangGraph node. Maps characters to voice IDs, iterates over script shots containing dialogue, generates audio, uploads to MinIO, updates state.
* [ ] **Audio UI**: Build a playback interface in the React Right Panel. List dialogue lines with an HTML5 `<audio>` player attached to pre-signed MinIO URLs.
* [ ] **Per-Segment Approval**: Implement targeted rejection/regeneration for specific dialogue lines, exactly like the character flow.

### [ ] Milestone 11: Robust Background Job System (Redis/BullMQ)
**What it does:** Video generation is too slow for HTTP requests. We must build a queue system to handle parallel rendering asynchronously.
* [ ] **Queue Infrastructure**: Integrate `bullmq` or `ioredis` queue patterns in the Node backend. Create a `video-generation-queue`.
* [ ] **Job Models**: Create `Job.ts` Mongoose schema for durable tracking (jobId, type, status, progress, errorLogs, payload).
* [ ] **Worker Process**: Create a dedicated Worker service/thread in Node.js that listens to the queue, executes tasks, and updates Job status.
* [ ] **Idempotency & Retries**: Configure exponential backoff for failed jobs. Implement idempotency keys to ensure a double-click on "Generate Video" doesn't queue duplicate 5-minute renders.

### [ ] Milestone 12: Stage 4 - Video Generation Agent (Parallel)
**What it does:** Triggers AI video models to render individual shots based on the script, character images, and audio.
* [ ] **Video Provider Adapter**: Implement `BaseVideoProvider` (e.g., mapping to Runway/Luma APIs). Handles async job submission and polling to the external API.
* [ ] **FastAPI -> Node Handoff**: When LangGraph enters `generate_video` state, it sends a command to Node.js detailing all required shots. Node.js pushes N jobs to the Redis queue (Parallel execution).
* [ ] **Worker Execution**: The Node worker takes a job, calls FastAPI's Video Adapter (or talks to the provider directly via Python workers if Celery is used. *Decision: Keep workers in Python using Celery/RQ, or Node? TDD suggests Redis queues. Let's implement Python RQ/Celery for AI tasks to keep AI code in Python*).
* [ ] **Shot Tracking**: The system must track the state of *each* shot independently (Queued, Rendering, Completed, Failed).

### [ ] Milestone 13: Stage 4 - Video Review UI
**What it does:** Allows the user to review the generated clips in a timeline view.
* [ ] **Video Timeline UI**: Build a horizontal scrolling timeline in React. Each block represents a shot.
* [ ] **Live Status**: Map the individual job statuses to UI indicators (spinners for rendering, red alerts for failed, thumbnails for completed).
* [ ] **Video Playback**: Implement a robust video player. When a user clicks a shot, fetch the pre-signed MinIO URL and play it.
* [ ] **Targeted Shot Regeneration**: Implement API to reject a specific shot, requeueing its job without touching approved shots.

### [ ] Milestone 14: Stage 5 - Editor Agent (FFmpeg Assembly)
**What it does:** Stitches the final approved clips and audio tracks into a cohesive MP4 file.
* [ ] **FFmpeg Infrastructure**: Install `ffmpeg` in the AI-Service Docker container. Implement Python `subprocess` wrappers using strict argument arrays to prevent shell injection.
* [ ] **Editor Node**: Implement `assemble_video` LangGraph node. It downloads all approved video clips and audio clips from MinIO to a temporary local scratch directory.
* [ ] **Timeline Construction**: Construct the complex FFmpeg command (concat demuxer, audio mixing, padding/trimming to exact durations specified in the script).
* [ ] **Final Render**: Execute FFmpeg. Upload the massive resulting `master.mp4` back to MinIO. Update `Project` status to `Completed`.
* [ ] **Cleanup**: Strictly wipe the temporary scratch directory to prevent container disk exhaustion.

---

## Phase 4: Polish, Observability, and Deployment

### [ ] Milestone 15: Real-Time Observability (WebSockets/SSE)
**What it does:** Replaces API polling with Server-Sent Events, making the UI feel instantly responsive.
* [ ] **SSE Endpoint**: Create `GET /api/projects/:id/events` in Node.js. Maintain active client connections.
* [ ] **Event Broadcaster**: Hook into Mongoose lifecycle events or Redis PubSub. When a Job status changes or a Message is created, broadcast an event to the specific Project's SSE channel.
* [ ] **Frontend Integration**: Implement a custom React hook `useProjectEvents(projectId)` that listens to the SSE stream and dispatches Redux/Zustand state updates immediately.

### [ ] Milestone 16: Security Hardening & Edge Cases
**What it does:** Ensures the system cannot be easily exploited or crashed by malformed input.
* [ ] **Rate Limiting**: Implement `express-rate-limit` on authentication and AI generation endpoints to prevent cost-exhaustion attacks.
* [ ] **Strict Zod Validation**: Audit every single `req.body`, `req.query`, and `req.params`. Apply Zod schemas and throw 400 errors for unexpected fields.
* [ ] **Prompt Injection Protection**: Ensure user inputs are wrapped in strict delimiters within the LLM prompts. 
* [ ] **Orphaned Media Cleanup**: Implement a cron job or background task to identify and delete MinIO objects that have no corresponding MongoDB `Asset` document.

### [ ] Milestone 17: Comprehensive Testing Suite
**What it does:** Guarantees regressions don't break the complex state machine.
* [ ] **Backend Unit Tests**: Write Jest tests for Repositories and Services. Mock MongoDB and MinIO.
* [ ] **API Integration Tests**: Write Supertest suites for auth flows and project CRUD. Ensure authorization boundaries strictly reject cross-user access.
* [ ] **LangGraph State Tests**: Write Python `pytest` suites simulating state transitions. Feed it mocked LLM JSON responses to ensure the graph progresses correctly from Script -> Character -> Video.
* [ ] **FFmpeg Tests**: Write tests ensuring the Editor Agent correctly handles mismatched audio/video durations and gracefully fails on corrupt inputs.

### [ ] Milestone 18: Deployment Readiness & CI/CD
**What it does:** Prepares the codebase for production environments like AWS ECS.
* [ ] **Multi-Environment Config**: Support `.env.development`, `.env.test`, `.env.production`.
* [ ] **Docker Optimization**: Audit Dockerfiles. Ensure `node_modules` and Python caches are properly layered. Set `NODE_ENV=production` logic.
* [ ] **Graceful Shutdown**: Implement SIGTERM handlers in Node and Python to cleanly drain background jobs and close DB connections before exiting.
* [ ] **Final UX Polish**: Audit the React app for missing loading states, ensure error boundaries catch component crashes, and verify the glassmorphism design language is consistently applied.
