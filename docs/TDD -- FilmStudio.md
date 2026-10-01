**TECHNICAL DESIGN DOCUMENT**

Agentic Film Studio

Detailed Technical Architecture, Data Design, Agent Workflow, Security and Deployment Plan

| **Document Field**         | **Value**                                    |
| -------------------------- | -------------------------------------------- |
| Project Name               | Agentic Film Studio                          |
| Document Name              | Technical Design Document (TDD)              |
| Version                    | 0.1                                          |
| Status                     | Draft                                        |
| Primary Author             | Puneet Seervi                                |
| Based On                   | Agentic Film Studio PRD                      |
| Architecture Decision Date | 1 October 2026                               |
| Primary Deployment Target  | AWS                                          |
| Local Infrastructure       | Docker Compose with MongoDB, Redis and MinIO |
| AI Strategy                | External AI APIs with provider abstraction   |

**How to read this TDD**

The document is organized around a simple question: what happens to a user request, which service handles it, where state is stored, how failures are recovered, and how the result gets back to the user. Product behavior comes from the PRD; the TDD explains the technical design that implements that behavior.

# TABLE OF CONTENTS

1\. Document Control

2\. Technical Overview

3\. Requirements Traceability

4\. Technology Stack

5\. Technology Selection Rationale

6\. System Architecture

7\. Application Architecture

8\. Frontend Architecture

9\. UI Workspace Architecture

10\. Authentication and Authorization Architecture

11\. REST API Architecture

12\. REST API Specification

13\. Database Architecture

14\. Detailed Database Schema

15\. File and Object Storage Architecture

16\. Chat Architecture

17\. Agentic Architecture

18\. LangGraph Architecture

19\. Complete Agent Specifications

20\. Agent Prompt and Context Architecture

21\. Human-in-the-Loop Architecture

22\. Workflow State Machine

23\. Background Job and Queue Architecture

24\. Parallel Video Generation Architecture

25\. AI Provider Integration

26\. Video and Media Pipeline

27\. Error Handling Architecture

28\. Security Architecture

29\. Privacy and Data Protection

30\. API and Data Security

31\. Caching and Performance

32\. Observability and Monitoring

33\. Testing Architecture

34\. AI Evaluation and Quality

35\. Versioning Architecture

36\. Project Lifecycle Architecture

37\. Frontend-Backend Communication Flow

38\. Real-Time Communication Architecture

39\. Deployment Architecture

40\. Docker Architecture

41\. CI/CD Architecture

42\. Infrastructure Configuration

43\. Disaster Recovery and Reliability

44\. Scalability Architecture

45\. Admin Architecture

46\. Technical Edge Cases

47\. Concurrency and Race-Condition Handling

48\. API Cost and Resource Management

49\. Technical Decisions and Architecture Decision Records

50\. Implementation Structure

51\. Coding and Engineering Standards

52\. Technical Implementation Plan

53\. Technical Risks and Mitigations

54\. Technical Acceptance Criteria

55\. TDD Traceability Matrix

56\. Appendix

# 1\. DOCUMENT CONTROL

This section defines the ownership, status and maintenance rules for the TDD. The goal is to make it clear which version of the technical architecture is being used when the team makes implementation decisions.

| **Field**      | **Value**                       |
| -------------- | ------------------------------- |
| Project Name   | Agentic Film Studio             |
| Document Name  | Technical Design Document (TDD) |
| Version        | 0.1                             |
| Status         | Draft                           |
| Primary Author | Puneet Seervi                   |
| Contributors   | Project Team                    |
| Reviewers      |                                 |
| Document Owner | Puneet Seervi                   |
| Created        | 1 October 2026                  |
| Last Updated   | 1 October 2026                  |

## 1.1 Change Log

| **Revision** | **Date**       | **Author**    | **Change**                                                                 |
| ------------ | -------------- | ------------- | -------------------------------------------------------------------------- |
| 0.1          | 1 October 2026 | Puneet Seervi | Initial detailed technical design based on the approved product direction. |

## 1.2 Document Maintenance Rule

The TDD should be updated whenever a technical decision changes the behavior, data flow, API contract, security model, deployment topology, or agent orchestration. A code change that does not change the design does not need a TDD rewrite, but architectural changes should be recorded so the document never becomes misleading.

# 2\. TECHNICAL OVERVIEW

Agentic Film Studio is designed as a web application with a React client, a Node.js application backend, a Python AI service, a MongoDB persistence layer, Redis-backed background work, and object storage. The architecture deliberately separates normal application work from long-running AI work. This keeps the browser responsive and allows the agent workflow to continue even when video generation takes much longer than an ordinary HTTP request.

The most important technical idea is the separation between permanent state, temporary job state, and large binary files. MongoDB stores application state and relationships. Redis manages background jobs and short-lived operational state. MinIO is used locally for object storage and is replaced by S3 in production. The application talks to a storage abstraction rather than directly depending on MinIO or S3, which minimizes migration work.

```
User Browser
   |
   v
React + TypeScript
   | REST / Realtime
   v
Node.js + Express -------------------- MongoDB
   |                                      |
   | internal service call                | permanent metadata
   v                                      |
FastAPI + LangGraph                       |
   |                                      |
   +---- Script Agent                     |
   +---- Character Agent                  |
   +---- Voiceover Agent                  |
   +---- Video Agent                      |
   +---- Editor Agent                     |
            |                             |
            v                             |
       Redis Queue <---- Workers          |
            |                             |
            v                             |
       External AI APIs                   |
            |                             |
            +--------> MinIO / S3 <-------+
```

| **Technical Layer** | **Primary Responsibility**                                                                                | **Why It Exists**                                                                                   |
| ------------------- | --------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| React client        | Renders the studio, chat, tabs, folder manager, review screens, uploads and progress.                     | The product has a complex interactive workspace that needs local UI state and fast updates.         |
| Node/Express        | Owns user-facing REST APIs, authorization, project CRUD, chat persistence and orchestration entry points. | Keeps application/business concerns separate from Python AI orchestration.                          |
| FastAPI             | Owns AI-related service endpoints, LangGraph execution and provider adapters.                             | Python provides a natural home for agent orchestration and AI tooling.                              |
| MongoDB             | Stores users, projects, conversations, artifacts, workflow metadata and version relationships.            | The product has evolving project structures and nested metadata that fit document-oriented storage. |
| Redis               | Stores queues, job status, locks, retry metadata and selected short-lived state.                          | Long-running AI tasks should not block HTTP requests; Redis also supports distributed workers.      |
| MinIO / S3          | Stores PDFs, images, audio, video clips, music and final videos.                                          | Binary media is much larger than normal application metadata and needs object storage semantics.    |
| Docker              | Packages services and local infrastructure consistently.                                                  | Developers can run the same service boundaries locally before production deployment.                |
| AWS                 | Runs the production application and managed infrastructure.                                               | Provides container hosting, object storage, networking, monitoring and managed services.            |

**Core design principle**

No service should own information outside its responsibility just because it is convenient. For example, Express should not become the permanent owner of LangGraph state, and Redis should not become the permanent store for final videos. Clear boundaries reduce future rework.

# 3\. REQUIREMENTS TRACEABILITY

Every important product requirement should map to a technical component. This prevents a common failure mode where the PRD says a feature exists but the technical design never explains where the feature lives. The matrix below is the starting structure; specific requirement IDs can be expanded during implementation.

| **PRD Area**              | **Technical Design**                     | **Primary Component**       | **Supporting Components**  |
| ------------------------- | ---------------------------------------- | --------------------------- | -------------------------- |
| Authentication            | OAuth flow, session handling, RBAC       | Node/Express + auth module  | React, MongoDB             |
| 25/50/25 workspace        | Shell layout, workspace state, tab state | React                       | Node API, realtime channel |
| Project/folder manager    | Project and asset model                  | Node + MongoDB              | MinIO/S3                   |
| Chat                      | Conversation/message model and streaming | React + Node                | FastAPI/LangGraph          |
| Script approval           | Workflow checkpoint and resume           | LangGraph                   | MongoDB, Redis, React      |
| Character references      | Per-character asset mapping              | MongoDB + object storage    | FastAPI                    |
| Voiceover generation      | Shot/dialogue mapping                    | Voiceover Agent             | Redis, object storage      |
| Parallel video generation | Per-shot jobs and concurrency control    | Redis workers + Video Agent | Provider adapter           |
| Clip review               | Per-shot status and versioning           | MongoDB + React             | FastAPI                    |
| Final editing             | Approved clip aggregation                | Editor Agent                | FFmpeg, object storage     |
| Admin analytics           | Role-aware analytics queries             | Node + MongoDB              | React                      |
| Reports                   | Report generation and asset export       | Node/worker                 | MongoDB + object storage   |
| Performance               | Caching, async jobs, CDN strategy        | Frontend + infra            | Redis, CloudFront          |

# 4\. TECHNOLOGY STACK

The stack is intentionally split into a user-facing application layer and an AI/agent layer. This lets the project use the MERN requirements while still using Python where it provides the best fit for agent orchestration and AI integration.

| **Area**                  | **Technology**                       | **Purpose**                                                | **Primary Responsibility**                                              |
| ------------------------- | ------------------------------------ | ---------------------------------------------------------- | ----------------------------------------------------------------------- |
| Frontend                  | React                                | Build the interactive application interface.               | Landing page, dashboard, chat, tabs, folder manager, profiles, reviews. |
| Frontend language         | TypeScript                           | Add compile-time type checking.                            | Shared UI models, request/response types, safer refactoring.            |
| Build tool                | Vite                                 | Run and bundle the frontend.                               | Fast local development and production build.                            |
| Styling                   | Tailwind CSS                         | Provide consistent utility-based styling.                  | Layout, responsive design, theme and reusable UI patterns.              |
| Routing                   | React Router                         | Manage client-side navigation.                             | Landing, login callback, workspace, profile, admin screens.             |
| Data fetching             | TanStack Query                       | Manage server-state fetching, caching and invalidation.    | Projects, chats, assets, jobs and workflow status.                      |
| Local UI state            | Zustand                              | Manage client-only workspace state.                        | Open tabs, active panel, local UI preferences, temporary selections.    |
| HTTP                      | Axios                                | Call Node and FastAPI HTTP endpoints where appropriate.    | REST communication and consistent interceptors.                         |
| Application backend       | Node.js + Express + TypeScript       | Serve REST APIs and application logic.                     | Auth, CRUD, authorization, chat persistence, workflow commands.         |
| AI service                | Python + FastAPI                     | Expose AI-specific service endpoints.                      | LangGraph execution, provider integration, media analysis utilities.    |
| Agent orchestration       | LangGraph                            | Coordinate stateful multi-agent workflow.                  | Node transitions, approval pauses, resume, retries and shared state.    |
| Database                  | MongoDB                              | Persist structured application data.                       | Users, projects, scripts, characters, jobs, approvals and metadata.     |
| Queue / job state         | Redis                                | Handle asynchronous jobs and operational state.            | Queues, workers, retries, locks and progress state.                     |
| Local object storage      | MinIO                                | Store large files during development.                      | References, generated media and final outputs.                          |
| Production object storage | Amazon S3                            | Store media in AWS.                                        | Durable project assets and outputs.                                     |
| Media processing          | FFmpeg                               | Perform media validation and final assembly tasks.         | Clip concatenation, format normalization and final export.              |
| Containers                | Docker + Docker Compose              | Standardize local services and packaging.                  | Local development and production image creation.                        |
| Production runtime        | AWS ECS                              | Run containerized services in AWS.                         | Web/backend/AI/worker containers.                                       |
| CDN / frontend delivery   | CloudFront + S3                      | Deliver frontend assets and cache public static resources. | Fast client delivery.                                                   |
| Production cache/queue    | AWS managed Redis-compatible service | Provide managed Redis/Valkey infrastructure.               | Queues, locks and transient state in production.                        |
| Monitoring                | CloudWatch                           | Collect logs and operational metrics in AWS.               | Application/service/worker monitoring.                                  |
| Secrets                   | AWS Secrets Manager                  | Store production secrets.                                  | OAuth credentials, AI provider keys, storage credentials.               |

# 5\. TECHNOLOGY SELECTION RATIONALE

Technology choices are based on four practical goals: the stack must satisfy the course expectations, it must be understandable to the project team, it must support the interactive film-studio workflow, and it must be possible to run locally before moving to AWS.

| **Choice**         | **Why It Fits This Product**                                                                                                                                                                                                                                                                                                             | **Main Trade-off**                                                                                                                                                   |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| React + TypeScript | The interface is not a normal CRUD page. The center workspace needs tabs, chat streaming, approval states, video previews, progress updates and a project tree. React handles this component-driven UI well, while TypeScript makes the many UI states and API responses safer to refactor.                                              | Plain JavaScript would be faster at first but increases runtime mistakes as the number of components and data states grows.                                          |
| Node + Express     | Node is used as the application backend because it works naturally with the MERN direction and is well suited to many short-lived HTTP operations. It should own authentication, authorization, CRUD and user-facing API contracts rather than becoming the AI engine.                                                                   | Putting everything in Python would work, but it would weaken the intended MERN learning path and make one service responsible for too many unrelated concerns.       |
| FastAPI            | FastAPI provides a clean Python HTTP boundary for AI operations and generates OpenAPI documentation from typed request/response models. This makes the AI service easier to test and inspect.                                                                                                                                            | A second full Node-only AI layer would be possible, but the project already needs Python for its AI work and LangGraph ecosystem.                                    |
| LangGraph          | The workflow has explicit checkpoints: generate script, wait for approval, continue to characters, wait again, then generate voice and video. LangGraph is a good fit for a stateful graph where execution can pause and later resume.                                                                                                   | A simple chain would become difficult to manage once approvals, retries, parallel shot jobs and recovery are introduced.                                             |
| MongoDB            | Project structures vary as artifacts evolve, and many entities naturally contain nested arrays such as shots and dialogue segments. MongoDB lets related metadata stay close while still permitting references for large or high-cardinality entities. MongoDB also supports transactions when atomic multi-document changes are needed. | A relational database could model this well, but MongoDB fits the document-shaped project and asset metadata and satisfies the requested MERN stack.                 |
| Redis              | AI generation is asynchronous and may take seconds or minutes. A queue removes that work from the user-facing request path and lets independent video jobs run concurrently. Redis also supports locks, delayed work patterns and worker coordination.                                                                                   | Doing long-running work directly inside HTTP requests risks timeouts and makes recovery much harder.                                                                 |
| MinIO -> S3        | MinIO is S3-compatible, so development can use local object storage without rewriting application storage code when AWS credits become available. The application will call an abstraction such as FileStorageService, which hides the provider-specific endpoint and credentials.                                                       | Using S3 locally would add unnecessary cloud cost before deployment. A custom local filesystem would create a larger migration gap.                                  |
| Docker             | The project depends on multiple infrastructure services. Docker Compose gives the team a repeatable local environment for MongoDB, Redis and MinIO and later packages the app services for ECS.                                                                                                                                          | Manual installation would make onboarding less consistent and increase environment-specific bugs.                                                                    |
| External AI APIs   | The project is about agentic application design, not training large generative models. APIs let the team focus on orchestration, product UX, evaluation and error handling instead of GPU provisioning and model serving.                                                                                                                | Self-hosting open-weight models can be useful later, but it would add GPU, model, licensing and operations work that is not necessary for the first working version. |

# 6\. SYSTEM ARCHITECTURE

The system is organized into six major zones: browser, application backend, AI service, asynchronous workers, persistence/storage, and external AI providers. The design intentionally avoids a single giant backend because the workload is mixed: authentication and CRUD should stay fast, while media generation is long-running and failure-prone.

```
                         INTERNET
                            |
                 +----------+-----------+
                 |                      |
              React App             API clients
                 |                      |
                 +----------v-----------+
                            |
                    Node + Express
                 /          |            \
                /           |             \
           MongoDB        Redis         FastAPI
             |              |              |
             |              |          LangGraph
             |              |              |
             |         Workers <------ Jobs |
             |              |              |
             +--------------+--------------+
                            |
                       MinIO / S3
                            |
                    External AI APIs
```

## 6.1 Logical Architecture

The logical architecture separates responsibilities rather than physical machines. On a developer laptop, multiple services can share one machine through Docker. In AWS, the same logical services can run as separate ECS tasks or services. This means the architecture does not depend on a specific deployment size.

| **Layer**          | **Owns**                                            | **Must Not Own**                                            |
| ------------------ | --------------------------------------------------- | ----------------------------------------------------------- |
| Frontend           | Presentation state and user interactions.           | API secrets, AI provider keys, authoritative project state. |
| Node API           | User-facing business rules, authorization and CRUD. | Long-running AI generation loops.                           |
| FastAPI AI service | AI execution, provider adapters and agent workflow. | Browser sessions and general user CRUD.                     |
| Workers            | Long-running jobs and retries.                      | Direct authority over user permissions.                     |
| MongoDB            | Permanent metadata and relationships.               | Large video/audio binary data.                              |
| Redis              | Short-lived queue/job coordination.                 | Final business records or irreplaceable media.              |
| Object storage     | Binary files and immutable-ish asset objects.       | Complex relational application state.                       |

# 7\. APPLICATION ARCHITECTURE

The application is designed as a modular monorepo or coordinated multi-service repository. The key point is not the exact folder names; it is that each service has a clear boundary and its own configuration, tests and ownership. The Node service is the public application API. The FastAPI service is an internal AI API. Workers execute queued tasks rather than blocking request threads.

| **Module**  | **Inputs**                                        | **Outputs**                                     | **Notes**                                   |
| ----------- | ------------------------------------------------- | ----------------------------------------------- | ------------------------------------------- |
| Web client  | User interactions, API responses, realtime events | UI state and user commands                      | Never contains provider secrets.            |
| API server  | HTTP requests, auth context                       | HTTP responses, commands to AI service/queue    | Authoritative permission checks.            |
| AI service  | Workflow commands, project context                | Agent events, artifact references, job commands | Internal-facing; may call provider APIs.    |
| Worker      | Queued job                                        | Job result, artifact reference, status update   | Designed to retry safely.                   |
| Persistence | Database operations                               | Documents                                       | Schemas and indexes are versioned.          |
| Storage     | Object operations                                 | Object keys/URLs                                | Provider hidden behind storage abstraction. |

The public API should be versioned from the start. The first version can use /api/v1. Internal FastAPI endpoints should also be versioned where changes could affect worker compatibility. This avoids forcing all clients to update at the same time when the workflow evolves.

# 8\. FRONTEND ARCHITECTURE

The frontend needs to behave like a workspace rather than a sequence of unrelated pages. The main challenge is keeping three types of state separate: server state, workspace state, and transient UI state. Server state is fetched from the backend and may change outside the current component. Workspace state contains things like open artifact tabs. Transient UI state includes whether a modal is open or which field is currently focused.

| **State Type**  | **Examples**                                           | **Recommended Owner**                                | **Persistence**                                                    |
| --------------- | ------------------------------------------------------ | ---------------------------------------------------- | ------------------------------------------------------------------ |
| Server state    | Projects, chats, asset metadata, job status            | TanStack Query / API cache                           | Backend authoritative                                              |
| Workspace state | Open tabs, active tab, collapsed sidebar               | Zustand                                              | Session-local; optional localStorage for non-sensitive preferences |
| Form state      | Prompt text, character description, duration selection | React component/form state                           | Not persisted until submitted                                      |
| Auth state      | Current user, auth bootstrap result                    | Dedicated auth provider + server session/token state | Backend/session controlled                                         |
| Upload state    | Progress percentage, pending upload ID                 | React Query + local component state                  | Temporary; permanent metadata saved after upload commit            |

## 8.1 Recommended Frontend Module Structure

```
frontend/
  src/
    app/            # routing, providers, global setup
    components/     # reusable UI components
    features/       # project, chat, agents, assets, auth, admin
    pages/          # route-level screens
    services/       # HTTP and realtime clients
    store/          # workspace-only client state
    hooks/          # reusable UI/data hooks
    types/          # shared frontend models
    utils/          # formatting and pure helpers
    styles/         # global styles and theme tokens
```

The features directory should mirror product concepts rather than backend endpoint names. For example, the chat feature owns chat rendering and message composition even if chat data arrives through several API endpoints. This makes the UI easier to change without creating a direct coupling to backend folder names.

# 9\. UI WORKSPACE ARCHITECTURE

The main workspace follows the agreed 25% / 50% / 25% structure. The percentages describe the desktop information architecture, not a hard-coded CSS calculation that must remain identical at every width. The layout should be flexible enough to collapse side panels when space becomes limited.

| **Area**              | **Approx. Width** | **Main Content**                            | **Primary State**                          |
| --------------------- | ----------------- | ------------------------------------------- | ------------------------------------------ |
| Left sidebar          | 25%               | Recent chats, current chats, tools, profile | Expanded/collapsed, selected chat          |
| Center workspace      | 50%               | Chat and artifact tabs                      | Active tab, workflow stage, composer state |
| Right project manager | 25%               | Projects, folders and project assets        | Active project, expanded tree nodes        |

## 9.1 Tab Model

Chat is the permanent primary tab. Artifact tabs are opened when the user clicks a project artifact or when the workflow needs the user to review an output. A tab is a view, not the artifact itself. Closing a tab must never delete the underlying file or database record. Re-opening an artifact should fetch the current approved version or the version selected by the user.

| **Tab Type** | **Closable** | **Opened From**                  | **Content**                                     | **Data Impact When Closed** |
| ------------ | ------------ | -------------------------------- | ----------------------------------------------- | --------------------------- |
| Chat         | No           | Main workspace                   | Conversation and agent messages                 | None                        |
| Script       | Yes          | Folder manager or review message | Script viewer/editor and approval controls      | None                        |
| Characters   | Yes          | Folder manager or agent output   | Character list, references and generated images | None                        |
| Voiceover    | Yes          | Folder manager or agent output   | Shot/dialogue audio review                      | None                        |
| Clip         | Yes          | Folder manager or review message | Single shot video preview and status            | None                        |
| Final Video  | Yes          | Folder manager or editor output  | Final video player and metadata                 | None                        |

## 9.2 Review Mode

During approval, the application should optimize for comparing the generated artifact with the agent conversation. The left history area can visually collapse so the agent chat and artifact preview receive more room. The collapse is only a layout change; the conversation remains in state and can be reopened. This prevents users from losing context while reviewing a large script or video.

# 10\. AUTHENTICATION AND AUTHORIZATION ARCHITECTURE

Authentication answers who the user is. Authorization answers what that authenticated user can access. Agentic Film Studio needs both because projects contain private prompts, reference files and generated media. A user should never be able to guess another project ID and gain access simply because the ID exists.

## 10.1 Google OAuth Flow

```
Browser -> Node auth start -> Google authorization -> callback -> validate identity
      -> find/create user -> establish application session -> redirect to workspace
```

Google OAuth should be handled through a mature library rather than manually implementing the OAuth protocol. The application should request only the identity information it actually needs. The backend should create or update the local user record and then establish the the application session. Google credentials must never be exposed to the React client beyond the normal browser-side OAuth interaction that the chosen library requires.

| **Control**   | **Design**                                                                               | **Why**                                                             |
| ------------- | ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| Identity      | Google account identity is mapped to one local user record.                              | Application data needs a stable local owner ID.                     |
| Session       | Use an application-managed secure session or equivalent server-validated token strategy. | The app needs a consistent authorization context across Node APIs.  |
| Authorization | Check both role and resource ownership.                                                  | Role alone does not tell us whether a user owns a specific project. |
| Admin         | Admin role is stored server-side and cannot be granted by frontend state.                | Client-controlled roles would be a privilege-escalation risk.       |
| Logout        | Invalidate local application session and clear client auth state.                        | Prevents stale access after logout.                                 |

**Security rule**

Never use a user ID from the request body as proof that the caller owns the resource. Ownership must come from the authenticated identity plus a server-side database lookup.

# 11\. REST API ARCHITECTURE

The Node API is the main contract used by the React application. It should use predictable resource-oriented URLs, JSON responses, consistent error bodies and explicit validation. AI jobs should usually be created with a short API call that returns a job or workflow identifier; the browser then observes progress through a separate status or realtime channel.

| **Rule**       | **Design Decision**                                                         | **Reason**                                              |
| -------------- | --------------------------------------------------------------------------- | ------------------------------------------------------- |
| Versioning     | Prefix public APIs with /api/v1.                                            | Lets the product evolve without breaking older clients. |
| Authentication | Every protected route resolves an authenticated user before business logic. | Creates one consistent security boundary.               |
| Authorization  | Resource ownership or role is checked after authentication.                 | Prevents horizontal and vertical privilege escalation.  |
| Validation     | Validate request body, params, query values and uploaded metadata.          | Reject malformed input before expensive work starts.    |
| Errors         | Use a consistent JSON envelope with code, message, details and requestId.   | Frontend can handle errors predictably.                 |
| Long work      | Return a job/workflow reference instead of holding an HTTP connection.      | Avoids request timeouts.                                |
| Idempotency    | Support an idempotency key for commands that may be retried.                | Prevents accidental duplicate generation jobs.          |

# 12\. REST API SPECIFICATION

The following is the proposed first API surface. Exact field names can be refined during implementation, but the endpoint responsibilities should remain stable. The API is deliberately split between CRUD operations and commands that change workflow state.

## 12.1 Authentication APIs

| **Method** | **Endpoint**                 | **Purpose**                      | **Access**               |
| ---------- | ---------------------------- | -------------------------------- | ------------------------ |
| GET        | /api/v1/auth/google/start    | Start Google authentication flow | Public                   |
| GET        | /api/v1/auth/google/callback | Handle Google OAuth callback     | Public/provider callback |
| GET        | /api/v1/auth/me              | Return current application user  | Authenticated            |
| POST       | /api/v1/auth/logout          | End application session          | Authenticated            |

## 12.2 User APIs

| **Method** | **Endpoint**     | **Purpose**                         | **Access**    |
| ---------- | ---------------- | ----------------------------------- | ------------- |
| GET        | /api/v1/users/me | Return current profile              | Authenticated |
| PATCH      | /api/v1/users/me | Update editable profile preferences | Authenticated |

## 12.3 Project APIs

| **Method** | **Endpoint**                 | **Purpose**                                            | **Access**    |
| ---------- | ---------------------------- | ------------------------------------------------------ | ------------- |
| GET        | /api/v1/projects             | List projects for current user                         | Authenticated |
| POST       | /api/v1/projects             | Create a project                                       | Authenticated |
| GET        | /api/v1/projects/{projectId} | Get project metadata                                   | Owner         |
| PATCH      | /api/v1/projects/{projectId} | Rename/update project metadata                         | Owner         |
| DELETE     | /api/v1/projects/{projectId} | Delete or archive project according to lifecycle rules | Owner         |

## 12.4 Chat APIs

| **Method** | **Endpoint**                                    | **Purpose**                 | **Access** |
| ---------- | ----------------------------------------------- | --------------------------- | ---------- |
| GET        | /api/v1/projects/{projectId}/conversations      | List project chats          | Owner      |
| POST       | /api/v1/projects/{projectId}/conversations      | Create chat                 | Owner      |
| GET        | /api/v1/conversations/{conversationId}/messages | Load messages               | Owner      |
| POST       | /api/v1/conversations/{conversationId}/messages | Send user message / command | Owner      |

## 12.5 Asset APIs

| **Method** | **Endpoint**                                         | **Purpose**                    | **Access** |
| ---------- | ---------------------------------------------------- | ------------------------------ | ---------- |
| GET        | /api/v1/projects/{projectId}/assets                  | List assets                    | Owner      |
| POST       | /api/v1/projects/{projectId}/assets/upload-intent    | Create upload intent           | Owner      |
| POST       | /api/v1/projects/{projectId}/assets/{assetId}/commit | Commit uploaded asset metadata | Owner      |
| DELETE     | /api/v1/projects/{projectId}/assets/{assetId}        | Remove asset                   | Owner      |

## 12.6 Workflow APIs

| **Method** | **Endpoint**                           | **Purpose**                 | **Access** |
| ---------- | -------------------------------------- | --------------------------- | ---------- |
| POST       | /api/v1/projects/{projectId}/workflows | Start film workflow         | Owner      |
| GET        | /api/v1/workflows/{workflowId}         | Get workflow status         | Owner      |
| POST       | /api/v1/workflows/{workflowId}/approve | Approve current checkpoint  | Owner      |
| POST       | /api/v1/workflows/{workflowId}/reject  | Reject and provide feedback | Owner      |
| POST       | /api/v1/workflows/{workflowId}/cancel  | Cancel workflow             | Owner      |

## 12.7 Script APIs

| **Method** | **Endpoint**                         | **Purpose**                       | **Access** |
| ---------- | ------------------------------------ | --------------------------------- | ---------- |
| GET        | /api/v1/projects/{projectId}/scripts | List script versions              | Owner      |
| GET        | /api/v1/scripts/{scriptId}           | Get script                        | Owner      |
| PATCH      | /api/v1/scripts/{scriptId}           | Edit draft script where permitted | Owner      |

## 12.8 Character APIs

| **Method** | **Endpoint**                                | **Purpose**                | **Access** |
| ---------- | ------------------------------------------- | -------------------------- | ---------- |
| GET        | /api/v1/projects/{projectId}/characters     | List characters            | Owner      |
| POST       | /api/v1/projects/{projectId}/characters     | Create character           | Owner      |
| PATCH      | /api/v1/characters/{characterId}            | Update character           | Owner      |
| POST       | /api/v1/characters/{characterId}/regenerate | Regenerate character image | Owner      |

## 12.9 Voiceover APIs

| **Method** | **Endpoint**                                     | **Purpose**                       | **Access** |
| ---------- | ------------------------------------------------ | --------------------------------- | ---------- |
| GET        | /api/v1/projects/{projectId}/voiceovers          | List voiceovers                   | Owner      |
| POST       | /api/v1/projects/{projectId}/voiceovers/generate | Start voice generation            | Owner      |
| POST       | /api/v1/voiceovers/{voiceoverId}/regenerate      | Regenerate selected voice segment | Owner      |

## 12.10 Video APIs

| **Method** | **Endpoint**                                | **Purpose**                  | **Access** |
| ---------- | ------------------------------------------- | ---------------------------- | ---------- |
| GET        | /api/v1/projects/{projectId}/shots          | List shots                   | Owner      |
| POST       | /api/v1/projects/{projectId}/video/generate | Start shot generation        | Owner      |
| GET        | /api/v1/shots/{shotId}                      | Get shot status and metadata | Owner      |
| POST       | /api/v1/shots/{shotId}/regenerate           | Regenerate one shot          | Owner      |

## 12.11 Admin APIs

| **Method** | **Endpoint**           | **Purpose**                | **Access** |
| ---------- | ---------------------- | -------------------------- | ---------- |
| GET        | /api/v1/admin/overview | Platform overview          | Admin      |
| GET        | /api/v1/admin/users    | Authorized user listing    | Admin      |
| GET        | /api/v1/admin/projects | Authorized project listing | Admin      |
| GET        | /api/v1/admin/metrics  | Platform metrics           | Admin      |

## 12.12 Standard Error Envelope

```
{
  "error": {
    "code": "WORKFLOW_CHECKPOINT_REQUIRED",
    "message": "The workflow is waiting for user approval.",
    "details": {},
    "requestId": "..."
  }
}
```

The exact error codes should be a stable, documented enum. Human-readable messages can change more easily, but the frontend should use error codes for logic. This prevents a UI condition from breaking because the wording of a message changed.

# 13\. DATABASE ARCHITECTURE

MongoDB stores the authoritative application data. The main design decision is to keep user/project relationships explicit and keep large media files out of the database. Some entities are best stored as separate collections because they need independent versioning, querying or job tracking.

| **Collection**    | **Purpose**                                 | **Relationship Strategy**         | **High-Level Retention**                         |
| ----------------- | ------------------------------------------- | --------------------------------- | ------------------------------------------------ |
| users             | Identity, role and profile metadata         | Referenced by projects and chats  | Long-lived until account deletion policy applies |
| projects          | Top-level film project                      | Owned by user                     | Long-lived; lifecycle-controlled                 |
| conversations     | Project chat container                      | Belongs to project/user           | Long-lived with project                          |
| messages          | Chat messages and agent events              | Belongs to conversation/project   | Long-lived; may be archived                      |
| assets            | Metadata for object-storage files           | References project and object key | Long-lived until asset lifecycle removes it      |
| scripts           | Current/versioned script documents          | Belongs to project                | Long-lived, versioned                            |
| characters        | Character definitions                       | Belongs to project                | Long-lived, versioned assets                     |
| voiceovers        | Voice segments and generated audio metadata | Links character and shot          | Long-lived, versioned                            |
| shots             | Shot definitions and status                 | Belongs to project/script         | Long-lived                                       |
| video_generations | Each attempt to generate a shot             | Belongs to shot                   | Long-lived enough for audit/versioning           |
| workflow_runs     | Workflow state references                   | Belongs to project                | Long-lived until cleanup policy                  |
| approvals         | Human approval decisions                    | Belongs to workflow/artifact      | Long-lived for audit/history                     |
| reports           | Generated report metadata                   | Belongs to project/user           | Long-lived                                       |
| notifications     | User-facing workflow notifications          | Belongs to user/project           | Short/medium-lived                               |
| audit_logs        | Security/admin actions                      | Belongs to actor and resource     | Long-lived according to policy                   |

MongoDB should use indexes based on actual query patterns rather than adding indexes to every field. Likely critical access patterns include listing a user projects, loading one project assets, finding the latest workflow run for a project, listing shots in sequence order, and checking ownership for authorization. MongoDB supports atomic multi-document transactions when a change truly requires several documents to be committed together; however, transactions should not be used as a substitute for good data modeling.

# 14\. DETAILED DATABASE SCHEMA

The schemas below are logical schemas rather than language-specific model classes. Field names can be implemented with Mongoose or another MongoDB library in Node and Pydantic models on the Python side. The important part is that the ownership, identifiers, versions and state transitions are explicit.

### 14.1 users

| **Field**       | **Type** | **Required** | **Purpose**                      | **Validation / Notes**                                    |
| --------------- | -------- | ------------ | -------------------------------- | --------------------------------------------------------- |
| \_id            | ObjectId | Yes          | Local stable user identifier     | Generated by MongoDB                                      |
| googleSubjectId | String   | Yes          | Stable Google identity reference | Unique; never expose as a permission decision from client |
| email           | String   | Yes          | User contact/identity            | Normalized                                                |
| displayName     | String   | Yes          | Display name                     | Length-limited                                            |
| photoUrl        | String   | No           | Profile image reference          | Validated URL or provider value                           |
| role            | Enum     | Yes          | Authorization role               | USER or ADMIN                                             |
| createdAt       | Date     | Yes          | Creation time                    | Server generated                                          |
| updatedAt       | Date     | Yes          | Last update time                 | Server generated                                          |

### 14.2 projects

| **Field**        | **Type** | **Required** | **Purpose**          | **Validation / Notes**                             |
| ---------------- | -------- | ------------ | -------------------- | -------------------------------------------------- |
| projectId        | ObjectId | Yes          | Project identifier   | Referenced by all project-owned records            |
| ownerId          | ObjectId | Yes          | Owning user          | Indexed                                            |
| name             | String   | Yes          | Project display name | Trimmed and length-limited                         |
| status           | Enum     | Yes          | Lifecycle state      | DRAFT, ACTIVE, COMPLETED, ARCHIVED, DELETING       |
| activeWorkflowId | ObjectId | No           | Current workflow run | At most one active run unless explicitly supported |
| createdAt        | Date     | Yes          | Creation time        |                                                    |
| updatedAt        | Date     | Yes          | Last update time     |                                                    |

### 14.3 assets

| **Field** | **Type** | **Required** | **Purpose**                 | **Validation / Notes**                                                          |
| --------- | -------- | ------------ | --------------------------- | ------------------------------------------------------------------------------- |
| assetId   | ObjectId | Yes          | Asset metadata ID           |                                                                                 |
| projectId | ObjectId | Yes          | Owning project              | Indexed                                                                         |
| assetType | Enum     | Yes          | Category of file            | REFERENCE, SCRIPT, CHARACTER_IMAGE, VOICEOVER, CLIP, MUSIC, FINAL_VIDEO, REPORT |
| objectKey | String   | Yes          | Provider-neutral object key | Never trust client-provided path without normalization                          |
| mimeType  | String   | Yes          | Media type                  | Whitelist checked                                                               |
| sizeBytes | Number   | Yes          | File size                   | Positive integer                                                                |
| checksum  | String   | No           | Integrity marker            | Used where available                                                            |
| version   | Number   | Yes          | Asset version               | Positive integer                                                                |
| status    | Enum     | Yes          | Lifecycle                   | UPLOADING, READY, FAILED, DELETED                                               |
| createdAt | Date     | Yes          | Upload time                 |                                                                                 |

### 14.4 conversations and messages

| **Field**      | **Type**      | **Required** | **Purpose**            | **Validation / Notes**                          |
| -------------- | ------------- | ------------ | ---------------------- | ----------------------------------------------- |
| conversationId | ObjectId      | Yes          | Conversation container | Belongs to project/user                         |
| projectId      | ObjectId      | Yes          | Project association    |                                                 |
| type           | Enum          | Yes          | Conversation type      | PRIMARY_CHAT or SYSTEM_REVIEW                   |
| messageId      | ObjectId      | Yes          | Message identifier     |                                                 |
| senderType     | Enum          | Yes          | Author class           | USER, AGENT, SYSTEM                             |
| content        | String/Object | Yes          | Message content        | Structured blocks allowed                       |
| attachments    | Array         | No           | Referenced asset IDs   | Character-specific associations retained        |
| createdAt      | Date          | Yes          | Creation time          | Immutable after creation except redaction rules |

### 14.5 scripts

| **Field**       | **Type** | **Required** | **Purpose**                    | **Validation / Notes**      |
| --------------- | -------- | ------------ | ------------------------------ | --------------------------- |
| scriptId        | ObjectId | Yes          | Script version identifier      |                             |
| projectId       | ObjectId | Yes          | Project association            |                             |
| version         | Number   | Yes          | Version number                 | Monotonic within project    |
| status          | Enum     | Yes          | Draft/review/approved/rejected | State machine validated     |
| shots           | Array    | Yes          | Structured shot definitions    | Each shot has stable shotId |
| sourceMessageId | ObjectId | No           | Prompt/message source          | Traceability                |
| approvedAt      | Date     | No           | Approval time                  |                             |
| createdAt       | Date     | Yes          | Creation time                  |                             |

### 14.6 characters

| **Field**         | **Type**              | **Required** | **Purpose**                    | **Validation / Notes**               |
| ----------------- | --------------------- | ------------ | ------------------------------ | ------------------------------------ |
| characterId       | ObjectId              | Yes          | Stable character identity      |                                      |
| projectId         | ObjectId              | Yes          | Project association            |                                      |
| name              | String                | Yes          | Character name                 | Unique within project where required |
| description       | String                | No           | Visual description             |                                      |
| referenceAssetIds | Array&lt;ObjectId&gt; | No           | Character-specific references  | Must not cross projects              |
| generatedAssetIds | Array&lt;ObjectId&gt; | No           | Generated images               | Versioned                            |
| approvedVersion   | Number                | No           | Current approved image version |                                      |

### 14.7 shots and video_generations

| **Field**           | **Type**      | **Required** | **Purpose**                | **Validation / Notes**                                  |
| ------------------- | ------------- | ------------ | -------------------------- | ------------------------------------------------------- |
| shotId              | ObjectId      | Yes          | Stable shot identity       |                                                         |
| projectId           | ObjectId      | Yes          | Project association        |                                                         |
| scriptVersion       | Number        | Yes          | Script version used        | Traceability                                            |
| sequenceNumber      | Number        | Yes          | Order within project       | Unique within film version                              |
| durationSeconds     | Number        | Yes          | Target shot duration       | Provider-aware                                          |
| status              | Enum          | Yes          | Shot state                 | PENDING, GENERATING, REVIEW, APPROVED, REJECTED, FAILED |
| currentGenerationId | ObjectId      | No           | Current output attempt     |                                                         |
| generationId        | ObjectId      | Yes          | Generation attempt         |                                                         |
| provider            | String        | Yes          | Provider adapter name      | Not raw secret                                          |
| externalJobId       | String        | No           | Provider job reference     | Stored for status lookup                                |
| promptSnapshot      | String/Object | Yes          | Exact inputs used          | Versioned snapshot                                      |
| outputAssetId       | ObjectId      | No           | Generated clip             |                                                         |
| attempt             | Number        | Yes          | Retry/regeneration attempt |                                                         |

### 14.8 workflow_runs and approvals

| **Field**     | **Type**      | **Required** | **Purpose**                                    | **Validation / Notes**                        |
| ------------- | ------------- | ------------ | ---------------------------------------------- | --------------------------------------------- |
| workflowId    | ObjectId      | Yes          | Workflow execution identity                    |                                               |
| projectId     | ObjectId      | Yes          | Project association                            |                                               |
| graphVersion  | String        | Yes          | Workflow schema version                        | Prevents old runs using new assumptions       |
| state         | String/Object | Yes          | Serialized workflow state reference            | Do not store secrets                          |
| currentStage  | Enum          | Yes          | Current checkpoint                             | Script, Character, Voice, Video, Editor, etc. |
| status        | Enum          | Yes          | RUNNING, WAITING, COMPLETED, FAILED, CANCELLED |                                               |
| checkpointRef | String        | No           | LangGraph/checkpoint reference                 | Provider-specific internal reference          |
| approvalId    | ObjectId      | No           | Pending approval                               |                                               |
| decision      | Enum          | Yes          | For approval records                           | APPROVED, REJECTED                            |
| feedback      | String        | No           | User feedback                                  | Sanitized and length-limited                  |
| actorId       | ObjectId      | Yes          | User who decided                               |                                               |

# 15\. FILE AND OBJECT STORAGE ARCHITECTURE

The project has many large binary objects. The application should therefore treat a file as two things: a metadata record in MongoDB and an object in MinIO/S3. The database knows what the object is and who owns it. Object storage holds the bytes. The link between them is the asset record and provider-neutral object key.

```
projects/{projectId}/
  references/{assetId}/{filename}
  scripts/{scriptId}/script.json
  characters/{characterId}/v{version}/image.ext
  voiceovers/{shotId}/{voiceId}/audio.ext
  clips/{shotId}/v{version}/video.ext
  music/{assetId}/track.ext
  final/{finalVideoId}/video.ext
  reports/{reportId}/report.pdf
```

Local development uses MinIO because it exposes an S3-compatible API. Production uses Amazon S3. The application should use a FileStorageService interface with operations such as upload, download, delete, head, createUploadUrl and createDownloadUrl. This makes MinIO-to-S3 migration primarily a configuration and infrastructure task instead of an application rewrite.

| **Operation** | **Browser**                                                  | **Node API**                   | **Storage Service**                               | **Why**                                                           |
| ------------- | ------------------------------------------------------------ | ------------------------------ | ------------------------------------------------- | ----------------------------------------------------------------- |
| Upload        | Requests upload intent, then uploads through short-lived URL | Authorizes and creates intent  | Creates presigned upload / validates final object | Avoids sending large media through the Node process when possible |
| Commit        | Sends upload completion                                      | Validates owner + metadata     | Checks object metadata                            | Prevents DB pointing to a missing object                          |
| Download      | Requests access                                              | Checks ownership               | Creates short-lived read URL                      | Keeps bucket private                                              |
| Delete        | Requests deletion                                            | Checks ownership and lifecycle | Deletes object                                    | Prevents arbitrary object paths from client                       |

# 16\. CHAT ARCHITECTURE

Chat is the primary control surface for the product, but it is still a normal persisted feature. Every user message and agent response should have a durable record so a user can leave the project and return later. Rich messages should be represented as structured blocks when needed, allowing the UI to render text, progress, approval controls, artifact links and errors without turning everything into raw HTML.

| **Message Block** | **Purpose**                              | **Example UI Behavior**                    |
| ----------------- | ---------------------------------------- | ------------------------------------------ |
| text              | Normal conversation content              | Shows plain text assistant/user message    |
| artifact          | Links to a generated artifact            | Opens Script/Characters/Clip tab           |
| approval          | Requests human decision                  | Shows Approve / Request Changes controls   |
| progress          | Shows long-running operation             | Shows agent/job progress                   |
| error             | Explains recoverable failure             | Shows retry or support action              |
| system            | Internal workflow notice exposed to user | Shows stage transition or important notice |

Streaming responses should be treated as presentation rather than permanent state. The backend may send partial text or events, but the final persisted message is saved only after the stream is complete or after a failure is recorded. This avoids storing dozens of tiny partial documents for a single sentence.

# 17\. AGENTIC ARCHITECTURE

The five agents form a production pipeline, but they should not be implemented as five unrelated chatbots. Each agent should receive a structured project context and produce structured outputs that become inputs to the next stage. The project itself is the shared context, while LangGraph state tracks where the workflow currently is.

| **Agent**       | **Main Responsibility**                                                 | **Consumes**                                                                   | **Produces**                                 | **Human Checkpoint**                             |
| --------------- | ----------------------------------------------------------------------- | ------------------------------------------------------------------------------ | -------------------------------------------- | ------------------------------------------------ |
| Script Agent    | Turn prompt/reference material into a duration-aware structured script. | Prompt, files, images, target duration.                                        | Script versions and shot definitions.        | Yes                                              |
| Character Agent | Define characters and generate visual references.                       | Approved script, user character inputs and character images.                   | Character records and approved image assets. | Yes                                              |
| Voiceover Agent | Prepare and generate dialogue voiceovers.                               | Approved script and characters.                                                | Voice segments mapped to character and shot. | Yes, batch/segment level                         |
| Video Agent     | Generate visual/audio video shots using approved project context.       | Script, characters, voice/audio where provider supports it, user video prompt. | Per-shot video generations.                  | Yes, individual shot level                       |
| Editor Agent    | Join approved clips into the final film output.                         | Approved clip list and approved supporting audio.                              | Final video asset.                           | Optional final review depending on product stage |

The agents should share a common vocabulary: projectId, workflowId, shotId, characterId, assetId, version and status. Stable identifiers are what allow the application to keep a script dialogue tied to the correct voice segment and the correct video shot.

# 18\. LANGGRAPH ARCHITECTURE

LangGraph is used as the orchestration layer because the workflow is not a straight line. It has pauses for approval, branches for rejection, retries for individual artifacts and concurrency for video shots. The graph should be stateful and resumable rather than recreated from scratch from chat history every time the user clicks a button.

```
START
  |
  v
Script Agent
  |
  v
WAIT: SCRIPT REVIEW
  | approve
  v
Character Agent
  |
  v
WAIT: CHARACTER REVIEW
  | approve
  v
Voiceover Agent
  |
  v
WAIT: VOICE REVIEW
  | approve
  v
Video Agent
  |----> shot jobs (parallel)
  v
WAIT: VIDEO REVIEW
  | approve all
  v
Editor Agent
  |
  v
COMPLETED
```

| **State Group**   | **Example Data**                               | **Why Persist It**                                   |
| ----------------- | ---------------------------------------------- | ---------------------------------------------------- |
| Workflow identity | workflowId, projectId, graphVersion            | Resume correct execution version                     |
| Creative context  | approved script ID, character IDs, voice IDs   | Avoids reconstructing context from raw chat          |
| Review state      | pendingApproval, rejectedArtifactIds, feedback | Required to pause and resume safely                  |
| Generation state  | shot job IDs, statuses, retry counts           | Allows partial completion and targeted retry         |
| Output references | asset IDs for current outputs                  | Lets downstream agents consume the approved versions |

The graph should not directly store secret API keys or raw OAuth credentials. Secrets belong in environment/secret storage. The graph state should contain identifiers, structured content and references that are safe for the workflow to use.

# 19\. COMPLETE AGENT SPECIFICATIONS

## 19.1 Script Agent

Trigger: User starts a film project with a prompt/reference set and duration.

| **Aspect**          | **Detailed Design**                                                                                                                                                                                                                                                                                   |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Inputs              | Prompt text, selected duration, uploaded files/images, project settings.                                                                                                                                                                                                                              |
| Processing          | Extract usable information from references; understand the user goal; identify story beats and characters; determine the provider-aware number of shots; allocate time; create dialogue and speaker mapping; produce a structured script object; validate that every shot has a duration and content. |
| Outputs             | A versioned script with shot IDs, timing, scene content, dialogue and character references.                                                                                                                                                                                                           |
| Human review        | User sees the script in an artifact tab. Approve advances the workflow. Request Changes requires feedback, creates a new generation request and keeps the prior version intact.                                                                                                                       |
| Errors and recovery | Unreadable reference -> report and request replacement. LLM timeout -> retry. Invalid structured output -> repair/regen. Inconsistent duration -> validator rejects before approval.                                                                                                                  |
| Checkpoint          | Script approval checkpoint.                                                                                                                                                                                                                                                                           |

## 19.2 Character Generation Agent

Trigger: The script is approved and the workflow enters character definition.

| **Aspect**          | **Detailed Design**                                                                                                                                                                                                                     |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Inputs              | Approved script, detected character list, user character count/name/description, character-specific reference images.                                                                                                                   |
| Processing          | Confirm character list; collect missing descriptions; preserve a distinct attachment list per character; build generation prompts; generate images; store each result against a characterId and version; present the result for review. |
| Outputs             | Character records and image assets, each explicitly associated with one character.                                                                                                                                                      |
| Human review        | Each character is reviewed independently or as a group. A rejected character creates a targeted regeneration rather than invalidating unrelated characters.                                                                             |
| Errors and recovery | Missing character data -> ask user. Invalid image -> reject asset. Generation failure -> retry selected character only. Reference mismatch -> request clearer input or regenerate.                                                      |
| Checkpoint          | Character image approval checkpoint.                                                                                                                                                                                                    |

## 19.3 Voiceover Agent

Trigger: Script and approved character definitions exist.

| **Aspect**          | **Detailed Design**                                                                                                                                                                                                        |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Inputs              | Dialogue by shot, speaker mapping, character voice selections, optional user edits.                                                                                                                                        |
| Processing          | Group dialogue by shot; validate duration fit; allow dialogue edits before synthesis; map each voice setting to a character; generate audio segments; save each audio asset with shotId and characterId; prepare previews. |
| Outputs             | Voiceover assets and a shot-level dialogue/audio manifest.                                                                                                                                                                 |
| Human review        | User reviews at a batch/segment level. Individual dialogue lines can be edited/regenerated without redoing every approved voice segment.                                                                                   |
| Errors and recovery | Unsupported voice -> request another option. TTS error -> retry. Dialogue too long for shot -> flag and ask for edit or automatic re-timing based on defined rule.                                                         |
| Checkpoint          | Voice review checkpoint.                                                                                                                                                                                                   |

## 19.4 Video Generation Agent

Trigger: Voiceover stage is approved and required assets are ready.

| **Aspect**          | **Detailed Design**                                                                                                                                                                                                                                                                                                                                |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Inputs              | Approved script, character assets, voice/audio outputs where supported, user video prompt, shot definitions and duration constraints.                                                                                                                                                                                                              |
| Processing          | Create one generation task per shot; construct a shot-specific prompt containing all relevant approved context; submit parallel API jobs subject to provider limits; monitor each job; download outputs; validate duration and basic media integrity; attach music/sound capabilities when the provider supports them; record generation metadata. |
| Outputs             | One or more video clip assets per shot, with version and generation metadata.                                                                                                                                                                                                                                                                      |
| Human review        | User reviews each shot separately. Approved shots remain untouched when another shot is regenerated.                                                                                                                                                                                                                                               |
| Errors and recovery | Rate limit -> backoff and requeue. Provider timeout -> retry. One-shot failure -> mark only that shot failed. Provider output invalid -> reject attempt and retry or request user intervention.                                                                                                                                                    |
| Checkpoint          | Per-shot video approval checkpoint.                                                                                                                                                                                                                                                                                                                |

## 19.5 Editor Agent

Trigger: All required video shots are approved.

| **Aspect**          | **Detailed Design**                                                                                                                                                                                                                                       |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Inputs              | Approved clips in sequence order, approved audio/music outputs and final project settings.                                                                                                                                                                |
| Processing          | Validate that all required shot numbers exist; verify media compatibility; normalize where necessary; assemble clips; preserve intended sequence; attach approved background audio/music as defined; create final output; store final asset and manifest. |
| Outputs             | Final video asset plus assembly metadata and source list.                                                                                                                                                                                                 |
| Human review        | The final result is shown in a Final Video tab. Additional review can be supported, but the core editor responsibility is assembly after required inputs are approved.                                                                                    |
| Errors and recovery | Missing shot -> refuse assembly and identify gap. Media mismatch -> normalize or fail clearly. FFmpeg failure -> retry with detailed logs; keep source clips intact.                                                                                      |
| Checkpoint          | Final output review if enabled.                                                                                                                                                                                                                           |

# 20\. AGENT PROMPT AND CONTEXT ARCHITECTURE

Prompt construction should be treated as a software component, not as strings scattered throughout agent code. Each agent should receive a system instruction, a structured project context, and a task-specific request. The context should use approved versions whenever the workflow is past a checkpoint.

| **Context Layer**  | **Contents**                                                      | **Rule**                                                      |
| ------------------ | ----------------------------------------------------------------- | ------------------------------------------------------------- |
| System instruction | Stable role, output contract, safety and formatting rules         | Version-controlled and tested                                 |
| Project context    | Project ID, title, target duration and relevant creative settings | Only include fields needed for the task                       |
| Approved artifacts | Script version, character versions, approved voice segments       | Never silently replace approved versions with drafts          |
| User request       | Current prompt, feedback or requested modification                | Clearly mark as the new instruction                           |
| Reference files    | Extracted text/image descriptions and asset references            | Respect size limits; summarize rather than dumping huge files |
| Tool results       | API/provider responses or validators                              | Treat as untrusted data and validate before state changes     |

Structured output schemas are important because the agents do not only generate prose; they generate data that other agents depend on. A script shot should therefore be represented as a structured object, not just text copied from a model response. The same applies to character records, voice segments and video-generation tasks.

# 21\. HUMAN-IN-THE-LOOP ARCHITECTURE

Human approval is a first-class workflow state. The backend must record the decision, the actor, the artifact version and any feedback. The approval action should be idempotent so a double-click does not start the next stage twice.

| **Checkpoint** | **User Sees**                             | **Approve Effect**                                             | **Reject Effect**                                                            |
| -------------- | ----------------------------------------- | -------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| Script         | Full script, shot breakdown, dialogues    | Mark version approved; resume next stage                       | Store feedback; generate new script version                                  |
| Characters     | Character list and generated references   | Mark selected/current versions approved                        | Regenerate rejected character only                                           |
| Voiceover      | Shot-grouped dialogues and playable audio | Mark approved segments and continue                            | Regenerate changed segments                                                  |
| Video          | Grid/list of individual shots with status | Mark approved shots; continue when all required shots approved | Regenerate selected shot(s) only                                             |
| Final          | Final assembled video                     | Complete project                                               | Return to editor or request a new assembly according to defined product rule |

A rejected artifact should never destroy the approved version that preceded it. The workflow should create a new attempt/version and leave the old version as historical data. This is critical because users often change their mind or want to compare an earlier result.

# 22\. WORKFLOW STATE MACHINE

The workflow state machine is the contract between the product experience and the orchestration engine. State names should be stable, explicit and mutually understandable. A transition is valid only when the required inputs exist and the user has the right to perform the action.

| **State**            | **Meaning**                                       | **Allowed Next States**            | **Who/What Triggers It**     |
| -------------------- | ------------------------------------------------- | ---------------------------------- | ---------------------------- |
| DRAFT                | Project exists but workflow has not started       | SCRIPT_GENERATING                  | User starts workflow         |
| SCRIPT_GENERATING    | Script generation in progress                     | SCRIPT_REVIEW, FAILED              | Script Agent completes/fails |
| SCRIPT_REVIEW        | Script is waiting for user decision               | SCRIPT_GENERATING, CHARACTER_INPUT | User rejects/approves        |
| CHARACTER_INPUT      | System is collecting character details            | CHARACTER_GENERATING               | Required inputs complete     |
| CHARACTER_GENERATING | Character assets are being generated              | CHARACTER_REVIEW, FAILED           | Character Agent              |
| CHARACTER_REVIEW     | Waiting for character approval                    | CHARACTER_GENERATING, VOICE_INPUT  | User decision                |
| VOICE_INPUT          | Voice settings/dialogue edits are being collected | VOICE_GENERATING                   | User proceeds                |
| VOICE_GENERATING     | Voice jobs are processing                         | VOICE_REVIEW, FAILED               | Voice Agent                  |
| VOICE_REVIEW         | Waiting for voice approval                        | VOICE_GENERATING, VIDEO_GENERATING | User decision                |
| VIDEO_GENERATING     | Shot jobs are processing                          | VIDEO_REVIEW, FAILED               | Video Agent                  |
| VIDEO_REVIEW         | Waiting for individual shot approvals             | VIDEO_GENERATING, EDITOR_READY     | User decisions               |
| EDITOR_READY         | All required clips approved                       | EDITING                            | Editor command               |
| EDITING              | Final media assembly is running                   | COMPLETED, FAILED                  | Editor Agent                 |
| COMPLETED            | Final asset exists and project is complete        | ARCHIVED / REOPENED                | User/project lifecycle       |
| FAILED               | Workflow or job failure requires recovery         | RETRY / CANCEL / SUPPORT           | System or user               |

The graph version should be recorded with each workflow run. If the team changes graph structure later, an old in-progress workflow should either continue on its original graph version or undergo a controlled migration. It should never silently switch logic halfway through a film.

# 23\. BACKGROUND JOB AND QUEUE ARCHITECTURE

Background jobs are required because script, image, voice and especially video generation may exceed normal HTTP request times. Redis will be used as the job system in local development and the production environment can use a managed Redis/Valkey-compatible service. Job records in MongoDB remain the durable business audit; Redis is the operational queue.

```
Node API
   |
   | enqueue command
   v
Redis Queue
   |
   +---- Worker A ----> AI Provider
   +---- Worker B ----> AI Provider
   +---- Worker C ----> AI Provider
   |
   v
Job status update -> Redis + MongoDB -> Realtime -> React
```

| **Job Property**               | **Design**                                                        |
| ------------------------------ | ----------------------------------------------------------------- |
| jobId                          | Unique UUID/ID generated server-side                              |
| projectId                      | Links job to owning project                                       |
| jobType                        | SCRIPT, CHARACTER, VOICE, VIDEO, EDIT                             |
| idempotencyKey                 | Prevents duplicate command execution                              |
| status                         | QUEUED, RUNNING, SUCCEEDED, RETRYING, FAILED, CANCELLED           |
| attempts                       | Number of attempts already consumed                               |
| maxAttempts                    | Configured cap for automatic retry                                |
| notBefore                      | Supports delayed retry/backoff                                    |
| payloadRef                     | Reference to MongoDB/object storage data, not huge binary content |
| createdAt/startedAt/finishedAt | Operational timing                                                |
| errorCode                      | Stable failure classification                                     |

The queue should store references rather than huge media payloads. A video job should contain a shot ID and provider request metadata. The worker can then load the required script/character/audio information when it starts.

# 24\. PARALLEL VIDEO GENERATION ARCHITECTURE

The video stage is intentionally decomposed into one job per shot. If a project requires six shots, the system creates six independent jobs rather than one giant task. This means a successful shot does not have to be generated again when another shot fails.

```
Approved script
     |
     +--> shot_01 job ----> worker ----> provider
     +--> shot_02 job ----> worker ----> provider
     +--> shot_03 job ----> worker ----> provider
     +--> shot_04 job ----> worker ----> provider
     +--> shot_05 job ----> worker ----> provider
     +--> shot_06 job ----> worker ----> provider
             |
             v
       aggregate statuses
             |
             v
       VIDEO_REVIEW
```

| **Concern**                 | **Design Response**                                                  | **Reason**                                                            |
| --------------------------- | -------------------------------------------------------------------- | --------------------------------------------------------------------- |
| Provider concurrency limits | Workers use a configurable concurrency cap per provider.             | Prevents the app from creating avoidable rate-limit failures.         |
| Partial failure             | Each shot owns its own job and generation record.                    | A failed shot can be retried independently.                           |
| Duplicate jobs              | Idempotency key built from workflow + shot + requested version.      | Prevents double-clicks or retried API calls from creating duplicates. |
| Ordering                    | Shot sequence number is stored separately from job completion order. | Parallel completion must never change final film order.               |
| Approval                    | Only approved versions are eligible for editor input.                | Prevents accidental use of an earlier failed or rejected generation.  |

# 25\. AI PROVIDER INTEGRATION

The product will use external AI APIs rather than self-hosting large generative models for the initial implementation. The main technical risk is provider churn: APIs change, limits differ and pricing differs. To isolate the rest of the application from that churn, every generation capability should sit behind a provider adapter.

```
ScriptAgent -> LLMProvider
CharacterAgent -> ImageProvider
VoiceAgent -> VoiceProvider
VideoAgent -> VideoProvider
EditorAgent -> MediaProcessor
```

| **Interface**  | **Required Methods**                        | **Provider-Specific Details Hidden Behind Interface**                   |
| -------------- | ------------------------------------------- | ----------------------------------------------------------------------- |
| LLMProvider    | generateStructured(), generateText()        | SDK syntax, model name, auth headers, retry quirks                      |
| ImageProvider  | generateCharacterImage()                    | Model parameters, image response format                                 |
| VoiceProvider  | synthesizeDialogue()                        | Voice ID format, audio encoding, provider request schema                |
| VideoProvider  | generateShot(), getJobStatus(), cancelJob() | Video model, duration limits, provider job IDs, polling/webhook details |
| MediaProcessor | probe(), normalize(), concat(), mux()       | FFmpeg commands and codec settings                                      |

The provider adapter should return a normalized internal result. This means the Video Agent should receive an internal result such as generationId, status, duration and output location instead of understanding a provider-specific JSON response. This is what allows a provider to be replaced later with minimal changes.

# 26\. VIDEO AND MEDIA PIPELINE

The media pipeline has four concerns: ingest, generation, validation and assembly. The system should validate media before making it available as an approved artifact. Basic checks should include file existence, MIME type, duration, dimensions where relevant, and whether the file is readable by FFmpeg or the chosen media tool.

| **Stage** | **Input**                   | **Processing**                                        | **Output**                               |
| --------- | --------------------------- | ----------------------------------------------------- | ---------------------------------------- |
| Ingest    | Reference file/image/audio  | Upload, metadata extraction, validation               | READY asset                              |
| Generate  | Approved structured context | Call external provider                                | Generation result + output object        |
| Validate  | Generated media             | Check existence, type, duration and basic readability | VALID / INVALID                          |
| Review    | Validated clip/audio        | User preview and decision                             | Approved version or regeneration request |
| Assemble  | Approved clips and audio    | Normalize and join with FFmpeg                        | Final video asset                        |

The Video Agent should use Method A where the selected provider supports text/reference images plus audio or speech context as part of video generation. The architecture should not assume that every future provider supports the same input combination. The provider adapter is responsible for translating our internal shot package into whatever the provider accepts.

Background music is treated as a video-stage output capability in the product design. The Video Agent can request or attach background music when supported by the selected provider. The Editor Agent receives the approved media and produces the final assembled file. Keeping these responsibilities separate lets us replace the generation provider without replacing the final assembly logic.

# 27\. ERROR HANDLING ARCHITECTURE

Errors are grouped by whether they are caused by the client, application validation, infrastructure, provider behavior or product workflow. The response to an error depends on whether it is safe to retry. A timeout calling an AI provider is usually retryable; an invalid user file is not.

| **Error Class** | **Example**                  | **Automatic Retry?**   | **User Action**                  |
| --------------- | ---------------------------- | ---------------------- | -------------------------------- |
| Validation      | Unsupported file type        | No                     | Fix input                        |
| Authentication  | Expired session              | Usually no             | Sign in again                    |
| Authorization   | User does not own project    | No                     | Return access denied             |
| AI provider     | Temporary timeout            | Yes, bounded           | Wait/retry if needed             |
| Rate limit      | Provider 429                 | Yes, delayed           | Show progress or retry state     |
| Queue           | Worker unavailable           | Yes via queue recovery | Usually none                     |
| Storage         | Object missing               | Usually no             | Restore/recreate asset           |
| Database        | Transient connection failure | Bounded                | Usually none; log incident       |
| Media           | FFmpeg cannot parse clip     | No or limited          | Regenerate offending clip        |
| Workflow        | Invalid state transition     | No                     | Show clear state; prevent action |

Every server error should receive a requestId. Logs should include the requestId, userId, projectId and workflowId where available, but never raw credentials or secrets. User-visible messages should remain simple and actionable. Internal logs can contain deeper diagnostics.

# 28\. SECURITY ARCHITECTURE

Security is layered. The outer layer authenticates the user; the API layer authorizes resource access; the storage layer prevents public file exposure; the AI layer protects API keys; and the database layer prevents unauthorized cross-project reads. No single mechanism is expected to carry the entire security model.

| **Security Control** | **Implementation Direction**                                 | **Why It Matters**                                                                 |
| -------------------- | ------------------------------------------------------------ | ---------------------------------------------------------------------------------- |
| Authentication       | Google OAuth with backend-controlled application session     | Users should not create local passwords or submit credentials directly to our app. |
| Authorization        | RBAC + project ownership checks                              | Admin and normal-user privileges differ, and projects must remain private.         |
| Secrets              | Environment locally, AWS Secrets Manager in production       | Provider keys must never ship to the browser.                                      |
| File privacy         | Private MinIO/S3 buckets + short-lived signed URLs           | Users should access only the files they are authorized to view.                    |
| Input validation     | Schema and business validation before work                   | Prevents malformed requests and reduces attack surface.                            |
| Rate limiting        | Per-user/IP/API category limits                              | Protects public endpoints and expensive AI calls.                                  |
| Audit logging        | Sensitive/admin actions recorded                             | Provides traceability for security events and support.                             |
| Transport security   | HTTPS in production                                          | Protects data in transit.                                                          |
| Prompt security      | Treat uploaded documents and model outputs as untrusted data | Reduces prompt injection and tool misuse risks.                                    |

## 28.1 Threat Model Areas

- Account takeover or stolen session.
- Horizontal access to another user's project.
- Vertical privilege escalation to Admin.
- Malicious file upload or oversized file abuse.
- Prompt injection inside user-provided files.
- AI provider key exposure.
- SSRF or unsafe URL handling if future features accept remote references.
- Denial of service through repeated expensive generation requests.
- Race conditions that accidentally overwrite approved versions.

# 29\. PRIVACY AND DATA PROTECTION

The application should collect only the data needed to operate the product and should clearly distinguish identity data, creative content and operational logs. User-generated prompts and media can be sensitive even when they are not formally classified as personal data, so access control and retention rules must cover them.

| **Data Category** | **Examples**                    | **Storage**                       | **Access Principle**                     | **Retention Direction**         |
| ----------------- | ------------------------------- | --------------------------------- | ---------------------------------------- | ------------------------------- |
| Identity          | Name, email, Google subject     | MongoDB                           | User and authorized admin functions only | Until account deletion policy   |
| Creative content  | Prompts, scripts, dialogue      | MongoDB                           | Project owner                            | Project lifecycle               |
| Reference media   | PDFs, images, audio             | MinIO/S3                          | Project owner via signed access          | Project lifecycle               |
| Generated media   | Characters, clips, final videos | MinIO/S3                          | Project owner                            | Project lifecycle/version rules |
| Workflow state    | Stage, job IDs, approvals       | MongoDB + Redis operational state | Owner/system                             | Until run cleanup rules         |
| Operational logs  | Request IDs, errors, timings    | Logs                              | Operations/admin based on policy         | Defined retention period        |

The AI provider boundary must be documented. Before selecting a provider, the team should confirm what data is sent, whether prompts/files are retained by that provider, the available data-control settings and the permitted commercial use of outputs. The application cannot promise privacy beyond what the chosen provider contract and settings actually support.

# 30\. API AND DATA SECURITY

API security is a combination of secure transport, authentication middleware, validation, authorization and safe object access. The browser should never receive long-lived cloud credentials. For direct browser uploads/downloads, the server should mint a short-lived signed URL after confirming the user owns the project asset.

| **Area**      | **Rule**                                                                         |
| ------------- | -------------------------------------------------------------------------------- |
| Request size  | Apply body and upload limits appropriate to each endpoint.                       |
| JSON parsing  | Reject malformed JSON early.                                                     |
| File names    | Do not trust client path names; generate object keys server-side.                |
| Object access | Never accept an arbitrary bucket/key pair from the client as proof of ownership. |
| Admin APIs    | Use explicit role middleware plus server-side checks.                            |
| Idempotency   | Use a request key for generation commands that can be retried.                   |
| CORS          | Allow only known frontend origins in production.                                 |
| Headers       | Use secure defaults and explicit response headers as appropriate.                |
| Logging       | Redact authorization headers, tokens, file contents and secrets.                 |

# 31\. CACHING AND PERFORMANCE

The PRD has a dashboard load target below two seconds. This is primarily a frontend and API performance problem, not a video-generation problem. The workspace should load quickly using small metadata calls while expensive generation tasks happen asynchronously.

| **Optimization**       | **How**                                                               | **Expected Benefit**                     |
| ---------------------- | --------------------------------------------------------------------- | ---------------------------------------- |
| Metadata-first loading | Load projects/chats/assets as lightweight JSON before large media.    | Fast initial workspace render.           |
| TanStack Query caching | Cache stable project metadata and refetch only when invalidated.      | Reduces repeated network/database calls. |
| Lazy artifact loading  | Fetch script/clip detail only when tab opens.                         | Avoids loading every asset at startup.   |
| CDN                    | Serve frontend static assets via CloudFront in production.            | Lower latency for browser assets.        |
| Pagination             | Paginate projects, messages and asset history.                        | Avoids huge responses.                   |
| Database indexes       | Index ownerId, projectId, status and ordering fields used in queries. | Reduces query latency.                   |
| Async generation       | Never block a normal browser request on video generation.             | Keeps UI responsive.                     |

Performance measurement should be explicit. The team should measure dashboard navigation with a representative data set, cold and warm loads, API latency for common queries, and the time from generation request to visible job acknowledgement. A two-second target should not be achieved by hiding a slow API call behind a spinner; the user should see the shell quickly and meaningful progress soon after.

# 32\. OBSERVABILITY AND MONITORING

The system needs to answer three questions when something fails: what did the user do, where did the request go, and what component failed? Correlation identifiers make this possible across Node, FastAPI, Redis workers and AI provider calls.

| **Signal** | **Examples**                                              | **Purpose**                                   |
| ---------- | --------------------------------------------------------- | --------------------------------------------- |
| Logs       | requestId, workflowId, jobId, errorCode                   | Detailed troubleshooting                      |
| Metrics    | API latency, queue depth, worker success rate             | Capacity and health                           |
| Traces     | User request -> Node -> FastAPI -> provider               | Find bottlenecks and failures across services |
| Events     | workflow stage changes, approvals, job completion         | Product activity and audit trail              |
| Alerts     | High queue depth, repeated provider errors, auth failures | Operational response                          |

Logs should be structured JSON in production so CloudWatch or another log system can query fields directly. A human-readable console format can still be used locally. The same requestId should be passed through internal service calls when possible, and a workflowId/jobId should be added for long-running tasks.

# 33\. TESTING ARCHITECTURE

Testing should be layered. Unit tests protect small logic such as duration calculations and authorization helpers. Integration tests verify that services work together. End-to-end tests verify a user journey. AI evaluation tests verify output quality. No one test layer is enough for this product because AI outputs are probabilistic while API contracts should remain deterministic.

| **Test Layer**          | **Scope**              | **Examples**                                                       |
| ----------------------- | ---------------------- | ------------------------------------------------------------------ |
| Frontend unit/component | UI logic               | Tab reducer, approval button states, upload form validation        |
| Backend unit            | Business rules         | Ownership checks, project rename rules, idempotency handling       |
| FastAPI unit            | AI service helpers     | Prompt construction, provider normalization, schema validation     |
| Agent tests             | Agent output contracts | Script schema, character mapping, shot package generation          |
| LangGraph tests         | Graph behavior         | Approve/reject transitions, resume, failure branch                 |
| Queue/worker tests      | Async execution        | Retry count, delayed jobs, dedupe, partial shot failure            |
| Integration             | Service boundaries     | Node -> FastAPI, Node -> MongoDB, worker -> object storage         |
| End-to-end              | User journeys          | Login -> project -> script approval -> character approval -> video |
| Security                | Unauthorized behavior  | Cross-project access, admin-only endpoints                         |
| Performance             | Latency and throughput | Dashboard load, project list, concurrent jobs                      |

# 34\. AI EVALUATION AND QUALITY

AI quality must be evaluated separately from infrastructure correctness. A workflow can be technically successful yet still produce a poor script or inconsistent characters. The evaluation layer therefore checks both structured validity and creative usefulness.

| **Agent** | **Quality Dimension**      | **Possible Evaluation Method**                                           |
| --------- | -------------------------- | ------------------------------------------------------------------------ |
| Script    | Duration fit               | Check total shot duration and dialogue fit automatically.                |
| Script    | Story coherence            | Human rubric on narrative continuity.                                    |
| Character | Prompt/reference adherence | Human comparison plus structured metadata checks.                        |
| Voice     | Dialogue fidelity          | Compare generated speech to expected text; human listening sample.       |
| Video     | Prompt adherence           | Human rubric plus provider metadata/validation.                          |
| Video     | Character consistency      | Human side-by-side comparison across shots.                              |
| Pipeline  | Cross-agent consistency    | Check names, shot IDs, speaker IDs and asset links across stages.        |
| System    | Regressions                | Maintain a fixed evaluation set and rerun after prompt/provider changes. |

A provider change should be treated as a potential behavior change even if the API contract is unchanged. Prompt versions, model names and generation parameters should be recorded with outputs so the team can trace why two generations differ.

# 35\. VERSIONING ARCHITECTURE

Versioning exists because generation is iterative. The user may reject a script, regenerate one character, or replace one video shot. Overwriting the old asset would make review and recovery harder. Instead, every meaningful generation attempt receives a version or generation identifier, while the project points to the currently approved one.

| **Artifact**      | **Versioning Rule**                                                                    | **Current Pointer**                                  |
| ----------------- | -------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| Script            | Increment version when regenerated after feedback                                      | Project/workflow points to approved scriptId/version |
| Character image   | Increment image version per regeneration                                               | Character.approvedVersion                            |
| Voiceover segment | Increment per segment regeneration                                                     | Voiceover current approved version                   |
| Video shot        | Each provider generation gets a generation record; approved generation becomes current | Shot.currentGenerationId                             |
| Final video       | New assembly can create a new final version                                            | Project current final asset reference                |

Version numbers should never be reused. Deleting a rejected version from the user interface should not cause the next generation to reuse its number. The audit relationship between attempts should remain clear enough to answer: which prompt, script version and character versions were used for this final video?

# 36\. PROJECT LIFECYCLE ARCHITECTURE

```
CREATE -> DRAFT -> ACTIVE -> COMPLETED -> ARCHIVED
                   |             |
                   +----> FAILED/RECOVERY
Deletion is a controlled lifecycle, not an immediate blind delete.
```

Project deletion should be a controlled operation because a project contains many dependent assets. The Node API should create a deletion state, prevent new jobs from starting, queue cleanup of object-storage assets and remove or archive database records according to the retention policy. This is safer than deleting the project row first and leaving orphaned media behind.

| **Lifecycle Stage** | **Technical Behavior**                                                                 |
| ------------------- | -------------------------------------------------------------------------------------- |
| DRAFT               | Project record exists; workflow not yet started.                                       |
| ACTIVE              | Normal editing/generation is allowed.                                                  |
| COMPLETED           | Final output exists; normal viewing remains allowed.                                   |
| ARCHIVED            | Read-only or limited editing according to future rule.                                 |
| DELETING            | No new jobs; cleanup process active.                                                   |
| DELETED             | Application records removed/anonymized according to policy; storage cleanup confirmed. |

# 37\. FRONTEND-BACKEND COMMUNICATION FLOW

## 37.1 Login Flow

```
React -> GET /auth/google/start -> Google -> callback -> Node
Node validates identity -> upsert user -> session -> React loads /auth/me
```

## 37.2 Start Script Flow

```
React -> POST /projects/{id}/workflows
Node validates ownership -> create workflow -> FastAPI command
FastAPI -> LangGraph -> Script Agent -> LLM provider
result -> save script draft -> WAIT checkpoint -> realtime update -> React
```

## 37.3 Video Generation Flow

```
React -> POST /projects/{id}/video/generate
Node validates approved inputs -> create per-shot jobs in Redis
Workers -> VideoProvider -> store clip in MinIO/S3
MongoDB updated -> realtime shot status -> React review grid
```

## 37.4 Final Assembly Flow

```
React approve-all -> Node workflow command -> LangGraph -> Editor Agent
Editor loads approved clips -> FFmpeg -> final asset -> S3/MinIO
MongoDB updated -> realtime completion -> React Final Video tab
```

# 38\. REAL-TIME COMMUNICATION ARCHITECTURE

The user needs to know that an agent is working without refreshing the page. The exact transport can be WebSocket or Server-Sent Events. For this product, SSE is a simple default for one-way server-to-browser updates, while WebSocket remains an option if bidirectional realtime control becomes important.

| **Event**              | **Payload Fields**                   | **Frontend Use**                |
| ---------------------- | ------------------------------------ | ------------------------------- |
| workflow.stage.changed | workflowId, stage, status            | Update agent progress banner    |
| job.created            | jobId, type, shotId                  | Add generation to progress list |
| job.progress           | jobId, progress, message             | Update spinner/progress meter   |
| job.completed          | jobId, assetId, status               | Enable preview                  |
| approval.required      | workflowId, artifactType, artifactId | Open/notify review tab          |
| workflow.failed        | workflowId, errorCode                | Show recovery UI                |
| workflow.completed     | workflowId, finalAssetId             | Open final video state          |

Realtime events should be treated as hints about current state, not the source of truth. If the browser misses an event because it was offline, reconnecting should trigger a fresh status fetch. This design prevents the UI from becoming permanently stale when a WebSocket/SSE connection drops.

# 39\. DEPLOYMENT ARCHITECTURE

Local development and production should have the same logical service boundaries. AWS is the intended production platform once college-provided credits are available. The first deployment can use a modest ECS setup and grow as traffic or demonstration requirements increase.

```
AWS
  CloudFront + S3        -> React frontend
           |
        HTTPS
           v
   Load Balancer / Ingress
           |
      ECS Services
      +----------+----------------+
      |          |                |
   Node API   FastAPI          Workers
      |          |                |
      +----------+----------------+
           |       |       |
         Mongo   Redis     S3
                          |
                     AI Providers
```

| **Component**  | **Development**                   | **Production**                          |
| -------------- | --------------------------------- | --------------------------------------- |
| Frontend       | Vite dev server                   | Static build in S3 + CloudFront         |
| Node API       | Docker container                  | ECS service                             |
| FastAPI        | Docker container                  | ECS service                             |
| Workers        | Docker container                  | ECS worker service                      |
| MongoDB        | Local Docker MongoDB              | MongoDB Atlas deployment                |
| Redis          | Local Docker Redis                | Managed Redis/Valkey-compatible service |
| Object storage | MinIO                             | Amazon S3                               |
| Secrets        | Local .env file excluded from Git | AWS Secrets Manager                     |
| Logs           | Container stdout                  | CloudWatch                              |

# 40\. DOCKER ARCHITECTURE

Docker is used during local development as well as deployment packaging. Docker Compose should bring up the infrastructure that the team needs consistently. Application services can also run in Compose when the team wants an all-in-one environment.

| **Service** | **Container Purpose**                      | **Persistent Volume?**                    |
| ----------- | ------------------------------------------ | ----------------------------------------- |
| mongodb     | Local development database                 | Yes                                       |
| redis       | Queue/cache/job coordination               | Yes where needed for local recovery tests |
| minio       | Local object storage                       | Yes                                       |
| node-api    | Application backend                        | No                                        |
| fastapi     | AI/agent service                           | No                                        |
| worker      | Background job executor                    | No; job state externalized                |
| frontend    | Optional local static server/build preview | No                                        |

```
docker compose up -d

# Example logical service network
frontend -> node-api -> mongodb
                    -> redis
                    -> fastapi -> redis
                    -> minio
```

The Compose file should use health checks so dependent services do not start before their dependencies are ready. Environment variables should be passed through Compose rather than copied into image layers. Production images should not contain development credentials or local endpoints.

# 41\. CI/CD ARCHITECTURE

CI/CD turns the repository into a repeatable build process. The minimum useful pipeline should run formatting/linting, type checks, unit tests and build verification on every pull request. A merge to the deployment branch can then build Docker images and deploy the selected environment.

| **Pipeline Stage** | **Action**                         | **Gate**                       |
| ------------------ | ---------------------------------- | ------------------------------ |
| Validate           | Lint, format check, type check     | Must pass                      |
| Test               | Unit/integration tests             | Must pass                      |
| Build              | Frontend build and backend images  | Must pass                      |
| Security           | Dependency and secret scanning     | Must pass according to policy  |
| Package            | Tag Docker images                  | Only from approved commit      |
| Deploy staging     | Apply new images                   | Automated                      |
| Smoke test         | Health endpoints + core API checks | Must pass                      |
| Production deploy  | Deploy approved artifact           | Manual/controlled approval     |
| Rollback           | Revert to prior image/version      | Available on failed deployment |

# 42\. INFRASTRUCTURE CONFIGURATION

Configuration must be environment-specific but code-independent. The application should read connection strings, provider credentials, allowed origins, storage endpoints, queue names and feature flags from environment variables or a secret/config service.

| **Configuration Group** | **Local Example**               | **Production Approach**                                 |
| ----------------------- | ------------------------------- | ------------------------------------------------------- |
| Database                | MONGO_URI to Docker Mongo       | MongoDB Atlas connection string                         |
| Redis                   | REDIS_URL to local container    | Managed Redis/Valkey endpoint                           |
| Storage                 | S3-compatible endpoint to MinIO | S3 bucket/region                                        |
| OAuth                   | Local Google client credentials | Production Google client credentials in Secrets Manager |
| AI providers            | API keys in local ignored .env  | Secrets Manager                                         |
| Frontend origin         | localhost URL                   | Production domain                                       |
| Logging                 | Console                         | Structured CloudWatch logs                              |

**Rule**

Never commit .env files containing secrets. Commit an .env.example containing variable names and safe placeholders only.

# 43\. DISASTER RECOVERY AND RELIABILITY

The most important reliability principle is to keep intermediate approved artifacts and source information safe enough to regenerate downstream outputs. If a worker crashes during video generation, the script and character references should not disappear. If one shot fails, the other shots remain usable.

| **Failure**        | **Expected Recovery**                                                                                                            |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------- |
| Node restart       | Requests resume normally; persistent state comes from MongoDB.                                                                   |
| FastAPI restart    | Workflow/job state is recovered from persisted references/checkpoints.                                                           |
| Worker crash       | Queued or timed-out jobs are re-claimed or retried according to policy.                                                          |
| Redis restart      | Recover from MongoDB job records/re-enqueue policy as needed; Redis is not the only source of truth.                             |
| MinIO/S3 issue     | Generation remains in failed/waiting state until storage recovers; no successful asset is acknowledged before upload validation. |
| AI provider outage | Pause/retry affected jobs and avoid restarting approved earlier stages.                                                          |
| MongoDB outage     | Fail safe; do not acknowledge writes as successful until committed.                                                              |

Backup policy must cover MongoDB and production object storage. Recovery procedures should be tested, not just documented. The exact backup schedule can be decided based on deployment cost and project scope, but the technical design should assume that data can be lost unless backups and recovery are intentionally configured.

# 44\. SCALABILITY ARCHITECTURE

The architecture scales by separating stateless services from stateful infrastructure. Node API and FastAPI instances can be replicated because the source of truth lives in MongoDB, Redis and object storage. Workers can be scaled separately from API services because their workload is queue-driven.

| **Component**  | **How It Scales**                                   | **Primary Bottleneck**      |
| -------------- | --------------------------------------------------- | --------------------------- |
| React frontend | CDN and browser caching                             | Asset size / network        |
| Node API       | Multiple stateless ECS tasks                        | Database/API latency        |
| FastAPI        | Multiple service tasks if provider/API quotas allow | AI provider or CPU          |
| Workers        | Increase worker count/concurrency carefully         | Provider quota and cost     |
| MongoDB        | Indexes, query tuning, cluster sizing               | Query pattern/data size     |
| Redis          | Managed capacity and consumer scaling               | Queue volume / memory       |
| S3             | Service-managed object capacity                     | Transfer cost and lifecycle |

The first demonstration should prioritize correctness over premature horizontal scaling. However, the TDD includes scaling boundaries now so that later work does not require redesigning the application around a queue or storage abstraction that we failed to create early.

# 45\. ADMIN ARCHITECTURE

The Admin role is separate from ordinary film-production access. The admin dashboard should query aggregated, authorized data rather than exposing raw database credentials or direct database tools. The frontend can show analytics, user/project counts, job health and other approved operational information.

| **Admin Capability** | **API Boundary** | **Data Access Principle**                           |
| -------------------- | ---------------- | --------------------------------------------------- |
| Platform overview    | /admin/overview  | Aggregated data only where possible                 |
| User management      | /admin/users     | Only fields needed for administration               |
| Project monitoring   | /admin/projects  | Respect privacy policy and minimum-access principle |
| Metrics              | /admin/metrics   | Server-generated metrics                            |
| Audit review         | /admin/audit     | Restricted operational logs                         |

Admin access should be auditable. Sensitive actions such as role changes, account actions or deletion should generate audit records containing the actor, time, target resource and action outcome. The Admin UI must not be the source of truth for authorization; the Node backend must enforce it.

# 46\. TECHNICAL EDGE CASES

| **ID** | **Scenario**                                                  | **Expected Handling**                                                                  | **Priority** |
| ------ | ------------------------------------------------------------- | -------------------------------------------------------------------------------------- | ------------ |
| TE-001 | User refreshes while script is waiting for approval           | Reload workflow status and reopen pending review state                                 | High         |
| TE-002 | User double-clicks Approve                                    | Idempotent command; second click is no-op                                              | High         |
| TE-003 | User rejects a script with empty feedback                     | Frontend blocks submit; backend validates too                                          | High         |
| TE-004 | One of six video jobs fails                                   | Only failed shot enters recovery; successful shots remain approved/current             | High         |
| TE-005 | Provider returns a clip shorter than requested                | Validate and reject output or apply defined normalization rule                         | High         |
| TE-006 | Character reference image belongs to another project          | Backend rejects cross-project asset association                                        | Critical     |
| TE-007 | User deletes an asset that current workflow needs             | Prevent deletion or mark as pending deletion until workflow releases dependency        | High         |
| TE-008 | Worker crashes after provider generation but before DB update | Use external job ID/idempotency and reconciliation worker to discover result           | High         |
| TE-009 | Network disconnects during upload                             | Resume/restart upload intent; do not create READY asset until commit                   | Medium       |
| TE-010 | Two browser tabs edit same project                            | Use server version/state checks; last write must not silently overwrite approved state | High         |
| TE-011 | AI provider changes response schema                           | Adapter validation fails safely and logs provider incompatibility                      | High         |
| TE-012 | Redis unavailable                                             | User-facing requests fail gracefully; no false success; durable records allow recovery | High         |
| TE-013 | S3/MinIO object missing                                       | Asset status becomes missing/failed and UI offers regeneration where possible          | High         |
| TE-014 | User logs out while job is running                            | Job continues; ownership remains; user can resume later                                | Medium       |
| TE-015 | Browser closes during video generation                        | Worker continues; project persists and can be reopened                                 | High         |

# 47\. CONCURRENCY AND RACE-CONDITION HANDLING

Concurrency is unavoidable because the product supports parallel video generation and users may have multiple browser tabs. The design must prevent stale actions from modifying newer approved state. Idempotency, optimistic version checks and job-level locks are the main tools.

| **Race**                                       | **Mitigation**                                                       |
| ---------------------------------------------- | -------------------------------------------------------------------- |
| Two Approve clicks                             | Unique approval command ID + server idempotency                      |
| Two regeneration requests for same shot        | Idempotency key based on shot + requested version + user action ID   |
| Two workers claim same job                     | Queue consumer group/atomic claim pattern                            |
| Two tabs open same artifact                    | Server stores version; update requires expectedVersion               |
| Old workflow resumes after new workflow starts | Project has activeWorkflowId and transition guard                    |
| Delete vs generate                             | Project lifecycle state prevents new generation once DELETING begins |
| Parallel shots finish out of order             | Sequence number, not completion time, defines final assembly order   |

The server should prefer rejecting ambiguous conflicting writes over silently merging them. A clear conflict message is safer than letting two users or tabs believe both changes were accepted.

# 48\. API COST AND RESOURCE MANAGEMENT

External AI APIs make the project simpler to build, but generation requests can become the most expensive part of the system. Cost control should therefore be designed into the workflow. The backend should know when a request is a new generation, a retry of a failed request or a user-initiated regeneration, because those actions have different product meaning and may produce different usage.

| **Control**          | **Design**                                                                              |
| -------------------- | --------------------------------------------------------------------------------------- |
| Usage recording      | Store provider, model identifier, job type, attempt and timestamp for every generation. |
| Duplicate protection | Idempotency prevents accidental repeated requests.                                      |
| Concurrency cap      | Limit parallel video jobs by provider.                                                  |
| Retry cap            | Only retry transient errors and stop after a bounded number.                            |
| Per-user quota       | Optional feature flag for future cost protection.                                       |
| Per-project guard    | Prevent runaway regeneration loops if repeated failures occur.                          |
| Cost visibility      | Admin metrics can aggregate requests/attempts by provider and project.                  |

The application should not assume that an API call is free just because a provider offers a free tier. Provider pricing and limits can change. The exact provider cost table belongs in deployment/config documentation and should be updated whenever the selected providers change.

# 49\. TECHNICAL DECISIONS AND ARCHITECTURE DECISION RECORDS

| **ADR ID** | **Decision**                                 | **Reason**                                             | **Alternatives Considered**                 | **Status** |
| ---------- | -------------------------------------------- | ------------------------------------------------------ | ------------------------------------------- | ---------- |
| ADR-001    | Use React + TypeScript for frontend          | Complex workspace UI and safer refactoring             | Plain React JavaScript, other SPA framework | Accepted   |
| ADR-002    | Use Node + Express as public application API | Matches MERN and separates app logic from AI execution | All-Python backend                          | Accepted   |
| ADR-003    | Use FastAPI + LangGraph for AI service       | Python AI ecosystem and stateful agent graph           | AI directly inside Node                     | Accepted   |
| ADR-004    | Use MongoDB for application database         | Flexible project metadata and MERN alignment           | PostgreSQL                                  | Accepted   |
| ADR-005    | Use Redis for background jobs                | Long-running generation and worker coordination        | SQS, database polling                       | Accepted   |
| ADR-006    | Use MinIO locally and S3 in production       | S3-compatible migration path                           | Local filesystem only                       | Accepted   |
| ADR-007    | Use external AI APIs initially               | Avoid model-serving/GPU complexity                     | Self-hosted open-weight models              | Accepted   |
| ADR-008    | Use provider abstraction                     | Reduce provider lock-in                                | Direct SDK calls inside agents              | Accepted   |
| ADR-009    | Generate video per shot                      | Parallelism and targeted regeneration                  | Single long video call                      | Accepted   |
| ADR-010    | Keep Chat as permanent primary tab           | Stable interaction surface                             | All tabs closable                           | Accepted   |

An ADR should be added before a major technical change rather than after the code has already diverged. The goal is not paperwork; it is to preserve the reasoning behind decisions so the team does not repeatedly reopen the same debate.

# 50\. IMPLEMENTATION STRUCTURE

The repository should be organized so a new contributor can identify the frontend, Node API, Python AI service, workers, infrastructure and documentation quickly. Exact library names may change, but the boundary between services should remain visible in the tree.

```
root/
  frontend/
  backend/
  ai-service/
  worker/
  shared/
  infrastructure/
  docs/
    PRD/
    TDD/
  tests/
  docker-compose.yml
  README.md
```

| **Directory**   | **Responsibilities**                                                                            |
| --------------- | ----------------------------------------------------------------------------------------------- |
| frontend/       | React application, UI features, client state and view-level tests.                              |
| backend/        | Express application, REST routes, auth, domain services, MongoDB access.                        |
| ai-service/     | FastAPI routes, LangGraph graphs, agent implementations, provider adapters.                     |
| worker/         | Queue consumers and long-running job execution.                                                 |
| shared/         | Only provider-neutral models/constants that can safely be shared; avoid cross-service coupling. |
| infrastructure/ | Docker, deployment manifests, environment templates and infrastructure scripts.                 |
| docs/           | PRD, TDD, ADRs and operational documentation.                                                   |

# 51\. CODING AND ENGINEERING STANDARDS

| **Area**       | **Standard**                                                              | **Why**                                         |
| -------------- | ------------------------------------------------------------------------- | ----------------------------------------------- |
| Naming         | Use clear nouns for data, verbs for commands and consistent IDs.          | Makes APIs and code easier to read.             |
| Type safety    | TypeScript strict mode and typed API schemas; Pydantic models in FastAPI. | Reduces contract drift.                         |
| Validation     | Validate at the service boundary and again before expensive operations.   | Prevents invalid state from flowing downstream. |
| Error handling | Use typed/stable error codes and centralized logging.                     | Consistent client behavior and troubleshooting. |
| Logging        | Structured logs with correlation IDs.                                     | Cross-service debugging.                        |
| Git            | Small focused commits and pull requests.                                  | Easier review and rollback.                     |
| Tests          | New business behavior should ship with corresponding tests.               | Prevents regressions.                           |
| Documentation  | Update TDD/ADR when architecture changes.                                 | Keeps documentation trustworthy.                |

The code should prefer small modules with one clear responsibility. Avoid putting database queries, provider calls, business rules and HTTP response formatting in the same function. This separation is especially important in agent code, because agent logic is likely to change as prompts and providers are refined.

# 52\. TECHNICAL IMPLEMENTATION PLAN

| **Phase**                    | **Technical Work**                                                 | **Exit Condition**                                    |
| ---------------------------- | ------------------------------------------------------------------ | ----------------------------------------------------- |
| 1\. Repository foundation    | Set up frontend, backend, ai-service, worker and Docker Compose.   | All services start locally.                           |
| 2\. Infrastructure locally   | MongoDB, Redis, MinIO, health checks and environment templates.    | Local dependencies are reproducible.                  |
| 3\. Authentication           | Google OAuth, session, user record and role checks.                | User can log in/logout and access only own workspace. |
| 4\. Workspace shell          | 25/50/25 layout, routing, permanent chat tab, artifact tabs.       | UI shell works with mocked data.                      |
| 5\. Project and asset layer  | Projects, assets, MinIO upload/download abstraction.               | Files persist and remain linked to projects.          |
| 6\. Chat                     | Persist conversations/messages and render agent/system blocks.     | Chat survives refresh.                                |
| 7\. LangGraph base           | Workflow state, checkpoint, approval interrupt/resume.             | Script stage can pause and resume.                    |
| 8\. Script Agent             | Provider adapter, structured script and approval loop.             | Approved script persisted.                            |
| 9\. Character Agent          | Character data, per-character references and generation.           | Approved characters persisted.                        |
| 10\. Voiceover Agent         | Dialogue mapping and TTS generation.                               | Approved voice assets persisted.                      |
| 11\. Video Agent             | Shot jobs, concurrency, provider adapter, review.                  | Individual clips can be generated and regenerated.    |
| 12\. Editor Agent            | FFmpeg assembly and final asset storage.                           | Playable final video produced.                        |
| 13\. Reliability             | Retries, idempotency, reconciliation and edge cases.               | Representative failure tests pass.                    |
| 14\. Admin                   | Admin dashboard and analytics.                                     | Admin access is role-protected.                       |
| 15\. Testing and performance | E2E, AI evaluation, dashboard performance and security checks.     | Acceptance matrix passes.                             |
| 16\. AWS deployment          | Containers, ECS, S3, managed Redis, Atlas, CloudFront, monitoring. | Production environment runs the core workflow.        |

# 53\. TECHNICAL RISKS AND MITIGATIONS

| **Risk**                          | **Impact** | **Mitigation**                                          | **Fallback**                       |
| --------------------------------- | ---------- | ------------------------------------------------------- | ---------------------------------- |
| Video provider API changes        | High       | Provider adapter + contract tests                       | Switch adapter/provider            |
| Rate limits too low               | High       | Concurrency cap + queue + backoff                       | Reduce parallelism                 |
| AI output quality inconsistent    | High       | Structured validation + evaluation set + human approval | Regenerate targeted artifacts      |
| Workflow state lost               | Critical   | Persist checkpoint/state and workflow IDs               | Recover from latest durable state  |
| Media storage migration difficult | Medium     | S3-compatible abstraction                               | Provider-specific migration script |
| Cross-project data leak           | Critical   | Centralized authz + ownership checks + tests            | Block release until fixed          |
| Workers stuck                     | High       | Heartbeat/timeout + reclaimer                           | Manual retry/admin action          |
| Cloud cost grows unexpectedly     | Medium     | Usage tracking, limits and provider controls            | Reduce quotas/concurrency          |
| Dashboard slow                    | Medium     | Metadata-first load, query indexes, caching             | Defer non-critical panels          |
| Version drift between services    | Medium     | API schemas and contract tests                          | Roll back incompatible service     |

# 54\. TECHNICAL ACCEPTANCE CRITERIA

| **ID**  | **Technical Acceptance Criterion**                                                  | **Verification**           |
| ------- | ----------------------------------------------------------------------------------- | -------------------------- |
| TAC-001 | React app can authenticate and retrieve current user state.                         | E2E auth test              |
| TAC-002 | Protected API rejects missing/invalid auth.                                         | API security tests         |
| TAC-003 | User A cannot read User B project data.                                             | Authorization test suite   |
| TAC-004 | MinIO storage can be swapped to S3 by configuration without changing feature code.  | Storage integration tests  |
| TAC-005 | A workflow pauses at script approval and resumes after approval.                    | LangGraph integration test |
| TAC-006 | Rejected script creates a new version while prior version remains accessible.       | Workflow/version test      |
| TAC-007 | Character reference image remains attached to the intended character.               | Asset association test     |
| TAC-008 | Voiceover segments remain mapped to character and shot.                             | Data integrity test        |
| TAC-009 | Six independent video jobs can be submitted concurrently subject to configured cap. | Worker integration test    |
| TAC-010 | One failed shot can be regenerated without replacing approved shots.                | Workflow test              |
| TAC-011 | Final editor uses approved shot ordering regardless of job completion order.        | Media integration test     |
| TAC-012 | A duplicate approval request does not advance workflow twice.                       | Idempotency test           |
| TAC-013 | Browser refresh during long-running job restores correct state.                     | E2E resume test            |
| TAC-014 | Secrets are absent from frontend bundle and logs.                                   | Security/build scan        |
| TAC-015 | Docker Compose starts all required local dependencies.                              | Environment smoke test     |
| TAC-016 | Production containers have health checks and can be redeployed.                     | Deployment test            |

# 55\. TDD TRACEABILITY MATRIX

This final matrix creates the bridge from product intent to implementation. It should be maintained during development so every important PRD requirement can be located in the technical design and then in code/tests.

| **PRD Area**        | **TDD Section** | **Primary Component**    | **Implementation Artifact**    | **Test Artifact**          |
| ------------------- | --------------- | ------------------------ | ------------------------------ | -------------------------- |
| Authentication      | 10, 28, 30      | Node auth middleware     | Auth module/routes             | Auth E2E/security tests    |
| Dashboard/workspace | 8, 9, 31        | React workspace          | Workspace features/components  | Component/E2E tests        |
| Project manager     | 13, 15, 36      | Node + Mongo + storage   | Project/asset services         | CRUD/integration tests     |
| Chat                | 16, 37, 38      | React + Node + realtime  | Chat feature/routes/events     | Chat E2E                   |
| Script workflow     | 17-22           | LangGraph + Script Agent | Graph/node implementation      | Workflow tests             |
| Characters          | 19, 15, 35      | Character Agent + assets | Character services             | Character tests            |
| Voiceover           | 19, 26          | Voiceover Agent          | Voice service/provider adapter | Voice integration tests    |
| Video generation    | 19, 23-25       | Video Agent + workers    | Shot jobs/providers            | Concurrency/provider tests |
| Final editing       | 19, 26          | Editor Agent + FFmpeg    | Assembly worker                | Media integration tests    |
| Security/privacy    | 28-30           | All services             | Authz/storage/logging modules  | Security tests             |
| Admin               | 45              | Node + React admin       | Admin APIs/pages               | RBAC/admin tests           |
| Deployment          | 39-43           | Infrastructure           | Docker/AWS config              | Smoke/deployment tests     |

# 56\. APPENDIX

## 56.1 Architecture Diagram Index

| **Diagram**               | **Purpose**                                                | **Referenced Sections** |
| ------------------------- | ---------------------------------------------------------- | ----------------------- |
| System architecture       | Shows browser, APIs, agents, queues, storage and providers | 2, 6, 39                |
| Workflow graph            | Shows five-agent flow and approvals                        | 18, 21, 22              |
| Parallel video generation | Shows per-shot fan-out and aggregation                     | 24                      |
| Deployment architecture   | Shows local-to-AWS mapping                                 | 39, 40                  |
| Data relationship diagram | To be added after schema stabilization                     | 13, 14                  |

## 56.2 Glossary

| **Term**            | **Meaning**                                                                                                   |
| ------------------- | ------------------------------------------------------------------------------------------------------------- |
| Artifact            | A project output such as a script, image, voice segment, clip or final video.                                 |
| Approval checkpoint | A workflow state where the system waits for the user before continuing.                                       |
| Asset               | Metadata record representing a stored file in MinIO/S3.                                                       |
| Agent               | A specialized AI-driven workflow component with a defined input/output responsibility.                        |
| Workflow run        | One execution of the LangGraph production process for a project.                                              |
| Shot                | A bounded segment of the final film with its own script, duration and generation state.                       |
| Generation          | One attempt to create an artifact through an external provider.                                               |
| Idempotency         | The property that repeating the same command does not cause duplicate side effects.                           |
| Provider adapter    | A wrapper that converts internal application requests into one specific AI provider's API contract.           |
| Signed URL          | A temporary URL granting controlled access to a private object without exposing long-lived cloud credentials. |

## 56.3 External References

The following official documentation is used to validate the current capabilities assumed by this TDD. Architecture choices remain project decisions; these references document the underlying service/framework capabilities.

| **Reference**                                | **URL**                                                                                    |
| -------------------------------------------- | ------------------------------------------------------------------------------------------ |
| Google OAuth 2.0 for Web Server Applications | <https://developers.google.com/identity/protocols/oauth2/web-server>                       |
| FastAPI official documentation               | <https://fastapi.tiangolo.com/>                                                            |
| FastAPI Docker deployment                    | <https://fastapi.tiangolo.com/deployment/docker/>                                          |
| MongoDB data modeling                        | <https://www.mongodb.com/docs/atlas/atlas-ui/data-modeling/>                               |
| MongoDB transactions                         | <https://www.mongodb.com/docs/manual/data-modeling/enforce-consistency/transactions/>      |
| Redis job queue documentation                | <https://redis.io/docs/latest/develop/use-cases/job-queue/>                                |
| MinIO S3 API compatibility                   | <https://docs.min.io/aistor/developers/s3-api-compatibility/>                              |
| Amazon S3 object storage                     | <https://docs.aws.amazon.com/AmazonS3/latest/userguide/uploading-downloading-objects.html> |
| Amazon S3 presigned URLs                     | <https://docs.aws.amazon.com/AmazonS3/latest/userguide/using-presigned-url.html>           |
| Amazon ECS documentation                     | <https://docs.aws.amazon.com/ecs/>                                                         |

## 56.4 Final Design Summary

The final architecture is intentionally practical: React and TypeScript provide the interactive studio, Node/Express provides the main application API, Python/FastAPI hosts the agent system, LangGraph coordinates the multi-stage workflow, MongoDB keeps authoritative project state, Redis handles asynchronous work, MinIO provides local S3-compatible media storage and S3 is the production object store. Docker makes the environment reproducible, and AWS provides the production runtime once credits are available.

The most important implementation rule is to preserve the boundaries described in this document. The application should not become a single giant process, the AI workflow should not depend on browser state, Redis should not become the permanent database, and object storage should not become the business database. Keeping these boundaries is what allows the project to evolve without repeated architectural rewrites.

## 56.5 Detailed End-to-End Sequence Examples

The following sequences turn the architecture into concrete execution stories. They are intentionally detailed because the same sequence should guide implementation, debugging and testing. Each sequence separates the user action, the application API, the workflow engine, asynchronous jobs, persistence and the final UI update.

### 56.5.1 Starting a New Film

1\. User selects or creates project Video1.  
2\. React sends POST /api/v1/projects/{projectId}/workflows.  
3\. Node authenticates user and checks project ownership.  
4\. Node creates workflow_run with status=RUNNING and graphVersion.  
5\. Node stores the initial prompt and references as input metadata.  
6\. Node asks FastAPI to start the LangGraph run.  
7\. FastAPI loads only the relevant project context.  
8\. Script Agent builds a structured script request.  
9\. LLM provider returns structured output.  
10\. Script validator checks schema, shot count and timing.  
11\. Script version is saved.  
12\. Workflow moves to SCRIPT_REVIEW.  
13\. Realtime event is emitted.  
14\. React opens or highlights the Script review tab.

The important detail is that the browser never owns the workflow state. If the browser closes after step 11, the workflow still exists in the backend. When the user returns, the frontend fetches the workflow and sees that the next action is script approval. This is the same pattern used for every other checkpoint.

### 56.5.2 Approving a Script

1\. User opens Script tab.  
2\. React loads current draft and pending approval.  
3\. User clicks Approve.  
4\. React disables the action immediately to prevent duplicate clicks.  
5\. POST /workflows/{id}/approve with approvalActionId.  
6\. Node authenticates and checks workflow ownership.  
7\. Node checks state == SCRIPT_REVIEW.  
8\. Node atomically records approval if not already recorded.  
9\. Node requests workflow resume.  
10\. LangGraph resumes from checkpoint.  
11\. Character Agent starts and asks for required character information.  
12\. Workflow becomes CHARACTER_INPUT.  
13\. Realtime event updates the workspace.

### 56.5.3 Rejecting a Video Shot

1\. User clicks Shot 3.  
2\. React opens the Clip tab and shows current generation.  
3\. User selects Request Changes.  
4\. React requires feedback.  
5\. POST /shots/{shotId}/regenerate with feedback + expectedVersion.  
6\. Node checks project ownership and current shot version.  
7\. Node creates a new video_generation attempt.  
8\. Node creates a Redis job with idempotency key.  
9\. Worker claims the job.  
10\. Worker loads approved script/character/voice context.  
11\. VideoProvider adapter sends provider request.  
12\. Worker stores returned video in object storage.  
13\. Worker validates the file.  
14\. MongoDB records the new attempt.  
15\. Shot enters REVIEW again.  
16\. React receives completion event and refreshes only Shot 3.

## 56.6 Detailed API Payload Examples

These examples show the shape and reasoning behind the API contracts. They are not copy-paste implementation requirements; they are reference contracts that should be turned into typed schemas during implementation.

### 56.6.1 Create Workflow Request

{  
"projectId": "&lt;project-id&gt;",  
"conversationId": "&lt;conversation-id&gt;",  
"prompt": "&lt;user creative request&gt;",  
"durationSeconds": 60,  
"referenceAssetIds": \["&lt;asset-id&gt;"\]  
}

| **Field**         | **Validation**                         | **Why It Exists**                                         |
| ----------------- | -------------------------------------- | --------------------------------------------------------- |
| projectId         | Must belong to authenticated user      | Prevents starting a workflow inside another user project. |
| conversationId    | Must belong to same project            | Keeps chat and workflow traceable.                        |
| prompt            | Non-empty, length-limited              | Provides creative direction.                              |
| durationSeconds   | Must match supported product option    | Creates deterministic planning constraints.               |
| referenceAssetIds | Each asset must belong to same project | Prevents cross-project data leakage.                      |

### 56.6.2 Approval Request

{  
"actionId": "&lt;unique-action-id&gt;",  
"artifactType": "SCRIPT",  
"artifactId": "&lt;artifact-id&gt;",  
"artifactVersion": 2  
}

The artifact version is included to prevent approving an old screen accidentally. Suppose the user has two tabs open and one tab shows Script v2 while another tab has already created Script v3. The server compares the submitted version with the current review target. A mismatch becomes a conflict rather than silently approving the wrong version.

### 56.6.3 Regeneration Request

{  
"actionId": "&lt;unique-action-id&gt;",  
"reason": "&lt;user feedback&gt;",  
"expectedVersion": 3,  
"instructions": {  
"keepApprovedInputs": true  
}  
}

The keepApprovedInputs flag expresses an important product principle: a regeneration request should use approved upstream artifacts unless the user explicitly changes them. This prevents a later script draft from accidentally leaking into a video regeneration.

## 56.7 Detailed Data Ownership and Relationship Model

A clean data model is not only about deciding where fields live. It is also about deciding which record is authoritative when two records appear to contain the same information. The rule for this project is: the most specific artifact record is authoritative for that artifact, while the project record is authoritative for project identity and ownership.

| **Data Concern**        | **Authoritative Record**              | **Supporting Records**     | **Why**                                                              |
| ----------------------- | ------------------------------------- | -------------------------- | -------------------------------------------------------------------- |
| User identity           | users                                 | OAuth session data         | One local user owner is needed for all resources.                    |
| Project ownership       | projects.ownerId                      | Asset/project links        | Ownership should be checked from the project.                        |
| Current script          | scripts approved version              | workflow_runs              | Workflow references which script is approved; script stores content. |
| Current character image | characters.approvedVersion            | assets                     | Character decides which generated image is current.                  |
| Current voice segment   | voiceovers current approved reference | assets                     | Audio file is stored as an asset; voice record carries semantics.    |
| Current shot clip       | shots.currentGenerationId             | video_generations + assets | Shot points to the selected generation.                              |
| Workflow state          | workflow_runs / checkpoint            | Redis operational job data | MongoDB/persisted workflow reference remains durable.                |
| Final video             | project/final asset reference         | assets, assembly manifest  | Project tells the UI what final output is current.                   |

This separation matters because the same asset may have a history. An asset ID should not be treated as a substitute for semantic state. The character record needs to say which version is approved; the asset record should simply say what file it represents and where it is stored.

## 56.8 Security Threat Scenarios and Technical Responses

Security should be tested as a set of concrete attack stories. The application should assume that a client can be modified, a request can be replayed, a project ID can be guessed, and uploaded content can contain malicious or manipulative instructions.

| **Threat Scenario** | **Attack Path**                                                     | **Technical Response**                                                              | **Detection/Test**             |
| ------------------- | ------------------------------------------------------------------- | ----------------------------------------------------------------------------------- | ------------------------------ |
| Cross-project read  | User changes projectId in a GET request                             | Authenticate -> load project -> verify owner/role before returning data             | Authorization integration test |
| Admin escalation    | User changes role in browser payload                                | Ignore client role; read role from server-side user record                          | RBAC test                      |
| Signed URL abuse    | User obtains URL for someone else's object                          | Generate URLs only after server-side ownership check and short expiry               | Storage security test          |
| Prompt injection    | Uploaded PDF contains instructions aimed at changing agent behavior | Extract content as untrusted reference data; keep system/tool instructions separate | Adversarial fixture test       |
| Replay approval     | Old approve request is sent twice                                   | actionId/idempotency + current state check                                          | Duplicate command test         |
| Cost abuse          | User repeatedly starts generation                                   | Rate limits, idempotency and project/job guards                                     | Load/abuse test                |
| Malicious file      | Executable or malformed content uploaded                            | Allowlist MIME types/extensions, validate bytes and avoid executing uploads         | Upload security test           |
| Secret leakage      | Key printed in logs or frontend bundle                              | Secret manager, log redaction, build scan                                           | Static scan + log fixture test |

## 56.9 Prompt and Context Construction in Practice

A reliable agent does not simply pass the entire conversation to the model. Large, mixed-context prompts make it harder to control which information is authoritative. Instead, the application should construct a compact context package for each agent. The package should clearly mark approved inputs, current user instructions and untrusted reference content.

| **Context Section**      | **Included**                                           | **Excluded**                                   | **Reason**                                                |
| ------------------------ | ------------------------------------------------------ | ---------------------------------------------- | --------------------------------------------------------- |
| Identity of task         | Agent role and exact operation                         | Unrelated chat history                         | Keeps the model focused.                                  |
| Approved source of truth | Approved script/character/voice IDs and content needed | Rejected drafts                                | Avoids accidentally using invalid versions.               |
| User feedback            | Current change request                                 | Old feedback not relevant to this regeneration | Keeps the new instruction clear.                          |
| Reference content        | Relevant extracted paragraphs/images                   | Entire document when unnecessary               | Controls context size.                                    |
| Tool/provider data       | Validated normalized output                            | Raw secret-bearing responses                   | Prevents untrusted response from becoming an instruction. |

Prompt templates should be versioned just like code. If a prompt is changed, the generated artifact should record the prompt version. This is necessary for debugging and regression evaluation. Otherwise the team will not know whether a quality change came from the model, provider, user input or prompt revision.

## 56.10 Worker Lifecycle and Reconciliation

Long-running provider jobs create a difficult failure window: the external provider may have accepted the request, but our worker can crash before recording the result. A robust worker system therefore needs a reconciliation process rather than assuming that every provider operation either fully succeeded or fully failed from our point of view.

QUEUED  
\-> CLAIMED  
\-> SUBMITTED_TO_PROVIDER  
\-> WAITING_PROVIDER  
\-> DOWNLOADING  
\-> VALIDATING  
\-> STORED  
\-> SUCCEEDED  
<br/>Error path:  
WAITING_PROVIDER -> TIMEOUT -> RETRYING -> WAITING_PROVIDER  
VALIDATING -> INVALID -> FAILED/REGENERATE  
ANY STATE -> CANCELLED (where provider cancellation is possible)

| **Worker Concern**       | **Design Detail**                                                                                                                   |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------- |
| Heartbeat                | Worker periodically records that it is alive for long jobs.                                                                         |
| Lease/visibility timeout | A job that stops updating can become eligible for reclaim.                                                                          |
| Provider external ID     | Store the provider job ID so the worker can check status after restart.                                                             |
| Idempotency              | Use a stable generation key so a retry does not accidentally create duplicate provider work when the provider supports idempotency. |
| Reconciliation           | Periodic worker checks jobs stuck in intermediate states and compares them with provider status.                                    |
| Finalization             | Only after output exists in storage and passes validation is the job marked successful.                                             |

## 56.11 Storage and Database Consistency Scenarios

Database and object storage are separate systems, so they cannot be assumed to commit together. The design therefore treats asset creation as a small state machine. This is safer than immediately writing READY=true to MongoDB before verifying that the file exists.

| **Scenario**                           | **Safe Sequence**                                               | **Result**                                        |
| -------------------------------------- | --------------------------------------------------------------- | ------------------------------------------------- |
| Upload succeeds, DB insert fails       | Object remains under temporary key; cleanup worker finds orphan | No false READY asset; orphan can be deleted.      |
| DB asset created, upload fails         | Asset remains UPLOADING/FAILED; no user preview                 | User sees failure, not a broken link.             |
| Upload succeeds, validation fails      | Asset stored but marked FAILED                                  | Object can be cleaned later; not used downstream. |
| Generation succeeds, download fails    | Job remains provider-complete but app-incomplete                | Reconciliation retries download.                  |
| User deletes while workflow uses asset | Deletion checks active dependencies                             | Deletion is blocked or deferred.                  |

## 56.12 Frontend State Design in Detail

Every important asynchronous operation should have explicit UI states. A common source of bugs is using one boolean such as loading=true for a complex screen. The workspace should instead represent the exact state of the operation and the action available to the user.

| **UI State**    | **Meaning**                       | **Controls Enabled**                         | **What User Sees**                              |
| --------------- | --------------------------------- | -------------------------------------------- | ----------------------------------------------- |
| Idle            | No active operation               | Normal actions                               | Normal workspace                                |
| Submitting      | Command sent but not acknowledged | Disable duplicate submit                     | Progress indicator near action                  |
| Queued          | Background job accepted           | Allow navigation                             | Queued status and position/info where available |
| Running         | Worker is executing               | Allow navigation; prevent conflicting action | Agent/job progress                              |
| WaitingApproval | Workflow is paused for user       | Approval controls enabled                    | Review UI prominently                           |
| Succeeded       | Output is available               | Open/review/regenerate where allowed         | Artifact preview                                |
| Failed          | Operation ended with failure      | Retry where safe                             | Simple error + recovery action                  |
| Conflict        | Another version/state changed     | Refresh/resolve                              | Explain that displayed state is stale           |

These states should be represented in reusable UI components so Script Review, Character Review and Video Review behave consistently. The difference should be the artifact being reviewed, not a completely different interaction pattern for each stage.

## 56.13 REST Endpoint Design Checklist

| **Checkpoint** | **Question the Implementation Must Answer**                 |
| -------------- | ----------------------------------------------------------- |
| Authentication | How is the caller identified?                               |
| Authorization  | How is ownership or Admin access checked?                   |
| Validation     | What happens if the input shape is invalid?                 |
| Idempotency    | Can the request be safely retried?                          |
| Concurrency    | What happens if another request changes the resource first? |
| Persistence    | Which data is written and which write is authoritative?     |
| Async          | Does the request start a background job rather than block?  |
| Response       | What stable identifier lets the client track the operation? |
| Realtime       | Which event tells the UI to update?                         |
| Errors         | Which stable error code is returned?                        |
| Audit          | Does the action need an audit record?                       |

## 56.14 Correlation ID Example

A single user action may cross five services. The following identifiers should be carried through the entire path so the team can reconstruct what happened without reading hundreds of unrelated log lines.

requestId = req_8f...  
workflowId = wf_91...  
jobId = job_42...  
projectId = proj_11...  
shotId = shot_03...  
actionId = act_77...

| **Identifier** | **Created By**                | **Used By**                        | **Lifetime**                    |
| -------------- | ----------------------------- | ---------------------------------- | ------------------------------- |
| requestId      | API gateway/middleware        | Node, FastAPI, worker logs         | One request                     |
| workflowId     | Node when workflow begins     | Node, FastAPI, LangGraph, realtime | Whole workflow run              |
| jobId          | Queue producer                | Redis, worker, Mongo, realtime     | Whole async job                 |
| projectId      | Mongo/project creation        | Every project-owned operation      | Project lifetime                |
| shotId         | Script/shot creation          | Video worker, clip UI, editor      | Project lifetime                |
| actionId       | Client/server command creator | Idempotency and audit              | Command lifetime / audit record |

## 56.15 Local-to-Production Environment Matrix

| **Concern**      | **Local**          | **Production**                          | **Application Change**                        |
| ---------------- | ------------------ | --------------------------------------- | --------------------------------------------- |
| Object storage   | MinIO              | Amazon S3                               | Configuration only through FileStorageService |
| Redis            | Docker Redis       | Managed Redis/Valkey-compatible service | Connection configuration                      |
| MongoDB          | Docker MongoDB     | MongoDB Atlas                           | Connection configuration                      |
| Frontend hosting | Vite dev server    | S3 + CloudFront                         | Build/deploy command                          |
| Node hosting     | Docker container   | ECS service                             | Container/runtime configuration               |
| FastAPI hosting  | Docker container   | ECS service                             | Container/runtime configuration               |
| Workers          | Docker container   | ECS worker service                      | Scaling/configuration                         |
| Secrets          | Ignored local .env | AWS Secrets Manager                     | Secret source configuration                   |
| Logs             | Container stdout   | CloudWatch                              | Logging transport configuration               |

The key architectural goal is that switching from local to production changes configuration and infrastructure, not business logic. The same domain-level methods should continue to work. For example, FileStorageService.upload should remain the same operation whether the implementation object is MinioStorageAdapter or S3StorageAdapter.

## 56.16 Test Fixture and Simulation Strategy

External AI APIs are expensive and unpredictable, so most automated tests should not call real providers. The application should define fake provider adapters that return deterministic outputs. A smaller evaluation suite can then use real providers when needed for quality checks.

| **Fixture**                    | **Purpose**                                 | **Used In**       |
| ------------------------------ | ------------------------------------------- | ----------------- |
| Fake LLM valid script          | Tests normal script flow without API cost   | Unit/integration  |
| Fake LLM malformed output      | Tests schema validation and repair          | Agent tests       |
| Fake image provider            | Returns deterministic image asset           | Character tests   |
| Fake TTS provider              | Returns deterministic audio file            | Voice tests       |
| Fake video provider success    | Returns test clip and job transitions       | Video tests       |
| Fake video provider rate limit | Triggers retry/backoff                      | Worker tests      |
| Fake video provider timeout    | Triggers reconciliation                     | Failure tests     |
| Fake storage                   | Simulates upload/download/delete            | Storage tests     |
| Fake Redis                     | Tests queue behavior without external infra | Worker unit tests |

## 56.17 Pre-Implementation Technical Checklist

- Freeze the public API resource names and core status vocabulary.
- Freeze the project ownership rule and Admin permission boundary.
- Implement storage abstraction before writing feature-level upload/download code.
- Implement provider adapters before connecting agents to real AI APIs.
- Define structured schemas for script, characters, voice segments, shots and workflow state.
- Define idempotency strategy before implementing approval and generation commands.
- Create local Docker Compose with MongoDB, Redis and MinIO.
- Create health endpoints for every long-running service.
- Create correlation IDs and structured logging before integrating asynchronous workers.
- Build a fake provider test harness before spending API credits on end-to-end development.
- Create the basic LangGraph checkpoint/resume flow before implementing all five agents.