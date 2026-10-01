**AGENTIC FILM STUDIO**

**AGENTS.md - Engineering and Coding Guidelines**

Professional implementation standards for AI coding agents and human contributors

| **Document Field**       | **Value**                                                                              |
| ------------------------ | -------------------------------------------------------------------------------------- |
| Project                  | Agentic Film Studio                                                                    |
| Document Type            | Engineering and Coding Guidelines                                                      |
| Document Purpose         | Define how the codebase must be implemented, reviewed, tested, secured, and maintained |
| Primary Sources of Truth | PRD and TDD                                                                            |
| Development Principle    | Correct, readable, secure, maintainable implementation                                 |

**Core principle**

Build the real thing. If the real thing cannot be built correctly yet, do not pretend that it exists. A missing feature is better than a misleading fake implementation.

# Contents

1\. Purpose

2\. Source of Truth

3\. Core Engineering Principles

4\. No Dummy or Fake Implementation

5\. No Hacks or Shortcuts

6\. Code Readability

7\. No Hardcoding

8\. JSON and Configuration Files

9\. JSX / TSX Separation Rules

10\. Separation of Concerns

11\. TypeScript Rules

12\. Python Rules

13\. Frontend Architecture Rules

14\. React Component Rules

15\. State Management

16\. Frontend API Communication

17\. Frontend UI States

18\. Workspace UI Rules

19\. Tab System Rules

20\. Backend Architecture Rules

21\. Backend Layering

22\. FastAPI / AI Service Rules

23\. Database Rules

24\. Database Design Rules

25\. Database Query Rules

26\. Data Ownership Rules

27\. Resource Authorization

28\. File Storage Architecture

29\. Object Storage Rules

30\. Storage Security

31\. File Validation

32\. Redis Rules

33\. Background Job Rules

34\. Job Idempotency

35\. Worker Rules

36\. LangGraph Rules

37\. Agent Responsibilities

38\. Structured Agent State

39\. Agent Context Rules

40\. Structured AI Outputs

41\. AI Output Validation

42\. Human-in-the-Loop Rules

43\. Approval State

44\. Rejection and Regeneration

45\. Versioning

46\. Video Generation

47\. Parallel Video Generation

48\. AI Provider Abstraction

49\. AI API Keys

50\. AI Provider Failures

51\. API Design Rules

52\. API Validation

53\. API Error Responses

54\. Error Handling

55\. Never Swallow Errors

56\. Retry Rules

57\. Partial Failure

58\. Security Architecture

59\. Authentication

60\. Authorization

61\. Admin Security

62\. Privacy

63\. Logging

64\. Observability

65\. Testing Philosophy

66\. Testing Requirements

67\. Agent Testing

68\. Regression Testing

69\. Debugging Rules

70\. No Unrelated Changes

71\. Dependency Rules

72\. Environment Configuration

73\. Docker Rules

74\. Local Development Rules

75\. AWS Migration Rules

76\. Performance Rules

77\. Concurrency Rules

78\. Idempotency Rules

79\. Cost Protection

80\. UI Destructive Actions

81\. Media Handling

82\. FFmpeg Security

83\. Prompt Engineering Rules

84\. Prompt Injection Protection

85\. External API Boundaries

86\. No Hidden Fallbacks

87\. Mocking Rules

88\. Git Rules

89\. Git Safety

90\. Code Review Readiness

91\. Documentation Rules

92\. Change Management

93\. When Requirements Are Ambiguous

94\. When Existing Code Is Poor

95\. No Premature Architecture Changes

96\. Feature Completeness

97\. Readability Before Cleverness

98\. Main Files Must Remain Clean

99\. UI Content and Configuration

100\. Definition of Done

101\. Forbidden Patterns

102\. Preferred Development Workflow

103\. When Something Cannot Be Implemented Yet

104\. Final Engineering Principle

# 1\. Purpose

This document defines the engineering rules, coding standards, architectural boundaries, development practices, and quality requirements that all AI coding agents and human contributors must follow while working on Agentic Film Studio.

The purpose is not to force a particular coding style for its own sake. The purpose is to make the codebase predictable, easy to maintain, safe to change, and understandable by every developer who works on it. The application contains a React frontend, Node.js application backend, Python/FastAPI AI service, LangGraph orchestration, Redis-based background jobs, MongoDB persistence, MinIO/S3 object storage, external AI providers, and media processing. Poor boundaries between these parts can create difficult bugs and large amounts of rework.

The agent must therefore optimize for long-term correctness rather than short-term completion. A task is not considered complete merely because a page renders or an API returns a successful status. The implementation must perform the real behavior required by the PRD and TDD.

- Quality priority
- Correctness; Maintainability; Security; Readability; Type safety; Reliability; Testability; Clear architecture; Performance; User experience

# 2\. Source of Truth

The project has three primary engineering references. The PRD describes what the product should do from the user's and product's perspective. The TDD describes how the product is technically designed. AGENTS.md describes how the implementation must be written and maintained.

The agent must not invent a different architecture simply because another approach is faster to code. When a task appears to conflict with the PRD or TDD, the agent must identify the conflict rather than silently creating a workaround.

The existing codebase is also important evidence. Before modifying existing behavior, inspect the current implementation, tests, types, configuration, and adjacent modules. Existing behavior should not be changed accidentally.

# 3\. Core Engineering Principles

All code must be written as professional software that another developer can understand and safely change.

Favor simple and correct solutions over clever solutions. A small function with a clear purpose is usually easier to test than a large function with hidden responsibilities. Reuse existing abstractions when they fit. Create new abstractions when there is a real repeated responsibility or clear architectural boundary, not merely because abstraction looks sophisticated.

The agent must avoid dead code, unexplained behavior, duplicated business rules, brittle condition chains, and temporary implementations that are likely to become permanent. Every meaningful change should fit naturally into the architecture already defined by the project.

# 4\. No Dummy or Fake Implementation

This is one of the strictest rules in the project. The agent must never create something only to make the interface look finished.

A dummy button that does nothing, a fake card that shows made-up values, a hardcoded video result, or an API that returns success without performing the real operation is misleading. It makes later development harder because other parts of the system begin depending on behavior that was never real.

When a feature cannot be implemented yet, leave it genuinely unimplemented or expose an honest disabled/unavailable state if the PRD requires a visible entry point. Do not manufacture fake success.

- Allowed exception
- Mocks are allowed only when they are explicitly part of a test environment or clearly configured development mode and cannot silently become production behavior.

# 5\. No Hacks or Shortcuts

The agent must not bypass architecture, typing, validation, security, authentication, authorization, tests, or workflow rules merely to make a task pass.

For example, disabling TypeScript checks is not a fix for a type error. Returning an empty array is not a fix for a failed database query. Automatically approving an AI artifact is not a fix for a missing human-review implementation. Rewriting an unrelated service is not a fix for a local bug.

When a workaround is genuinely required, it must be technically justified, documented, scoped, and consistent with the PRD and TDD.

# 6\. Code Readability

Readability is a first-class engineering requirement. The project should be understandable by a teammate who did not write the original code.

Use descriptive variable, function, component, class, file, and type names. Avoid unnecessary abbreviations. Keep functions focused. Keep classes and modules cohesive. Prefer straightforward control flow over compressed clever expressions.

Comments should explain why a non-obvious decision exists, not repeat what the code obviously does. When an algorithm or provider limitation is difficult to understand, document the reasoning close to the relevant code.

- Readable naming
- Names should describe what something represents.
- Readable functions
- One clear responsibility per function where practical.
- Readable modules
- Keep unrelated responsibilities separated.

# 7\. No Hardcoding

Do not hardcode values that are configurable, environment-specific, user-specific, project-specific, or likely to change independently of the implementation.

This includes API URLs, credentials, user IDs, project IDs, provider settings, storage endpoints, large static content, repeated business configuration, and environment-specific paths.

Hardcoding a genuinely fixed programming constant is acceptable when its meaning is clear. Hardcoding business configuration that should come from configuration or data is not.

- Preferred sources
- Environment variables, typed configuration, JSON/config files, database data, shared constants, or approved runtime configuration.

# 8\. JSON and Configuration Files

Large static configuration and structured content should not be embedded inside main application files when it can be maintained separately.

Examples include navigation definitions, supported duration options, static metadata, feature configuration, and other non-sensitive configuration. Keeping these values separate improves readability and makes changes less likely to require editing component logic.

Configuration files must never contain secrets. Sensitive values belong in environment configuration or a secure secret manager.

- Preferred structure
- Keep data/configuration in dedicated data, config, constants, or JSON locations and expose typed interfaces to application code.

# 9\. JSX / TSX Separation Rules

A JSX or TSX file should primarily contain component and JSX logic. Do not turn a component file into a mixture of large CSS systems, raw HTTP clients, business rules, database logic, and unrelated configuration.

With Tailwind, utility classes may be used directly in JSX where appropriate. With traditional CSS, keep CSS in the appropriate stylesheet. Avoid large inline style objects for application-wide styling because they make reuse and review harder.

This rule is about separation of concerns, not about banning small component-specific styling decisions.

- Preferred patterns
- Component.tsx + Component.css, or Component.tsx using the project's approved Tailwind conventions.

# 10\. Separation of Concerns

Each module should own a clear responsibility. The frontend presentation layer should not become a backend service. The backend should not contain AI orchestration that belongs in the Python agent service. Database access should not be scattered throughout UI components.

Use appropriate folders and abstractions such as components, pages, hooks, services, API clients, types, utilities, repositories, workers, and agent modules. Separation is intended to reduce coupling and make changes easier to test.

# 11\. TypeScript Rules

TypeScript must be used as a type-safety system rather than as JavaScript with optional annotations. Strict compiler settings should remain enabled. Fix type errors instead of hiding them.

The use of \`any\` is prohibited by default. Do not use \`as any\` or broad unsafe casts merely to make code compile. Avoid compiler suppression such as \`@ts-ignore\` and \`@ts-nocheck\`. When data comes from outside the program, validate it at runtime before treating it as a trusted type.

Use interfaces, discriminated unions, type guards, schema validation, and explicit data-transfer types where they improve correctness.

- Hard rule
- Never weaken compiler configuration to hide an implementation defect.

# 12\. Python Rules

Python services must be written with the same professional standard as the TypeScript code. Use type hints for service boundaries, important data models, function inputs, return values, and agent state.

Do not silently swallow exceptions. Avoid unnecessary global state. Use explicit models and validation where data crosses service boundaries. Keep API handlers, agent logic, provider clients, storage clients, and workflow state management separated according to the TDD.

# 13\. Frontend Architecture Rules

The React frontend is responsible for user interaction, presentation, local UI state, rendering project information, showing agent progress, displaying review flows, and interacting with the application API.

The frontend must not connect directly to MongoDB, Redis, internal MinIO/S3 credentials, or protected AI provider APIs. Secrets and backend-only capabilities must remain behind the approved service boundaries.

The UI should reflect actual server state. A local visual state must not claim that a server-side operation is complete until the backend confirms it.

# 14\. React Component Rules

React components should remain focused and understandable. Avoid giant components that contain every piece of page logic.

When a component becomes too large, consider whether logic belongs in child components, hooks, services, state modules, or utility functions. Do not split components artificially just to reduce line count.

A component should ideally answer a clear question: what UI does this represent and what state or interaction does it own?

# 15\. State Management

Do not put every piece of application state into a single global store. Use the smallest state scope that fits the problem.

Transient form state can remain local. Authentication state belongs to an authentication boundary. Server data should have a consistent server-state strategy. Workspace tabs and active project state should be shared only as broadly as required.

Avoid maintaining multiple competing copies of the same server state because they can become inconsistent.

| **State type**  | **Typical responsibility**                          | **Do not do**                                    |
| --------------- | --------------------------------------------------- | ------------------------------------------------ |
| State type      | Typical responsibility                              | Do not do                                        |
| Local UI        | Inputs, modal visibility, temporary component state | Do not make it a global store without a reason   |
| Server state    | Projects, chats, artifacts, job results             | Do not duplicate it across arbitrary stores      |
| Workspace state | Active project, tabs, review context                | Do not mix it with unrelated backend persistence |

# 16\. Frontend API Communication

API calls should go through a clear client/service layer rather than being scattered across arbitrary UI components.

A typical flow is component -> hook/service -> API client -> backend. This makes authentication handling, request formatting, error normalization, and response typing more consistent.

The UI should handle loading, error, retry, unauthorized, timeout, and success states intentionally. Do not assume every network call succeeds.

# 17\. Frontend UI States

Every asynchronous feature should have meaningful states. At minimum, the implementation should consider initial, loading, success, empty, error, retrying, processing, completed, and cancelled states when the feature requires them.

A progress indicator must reflect actual backend or job state. It must not animate indefinitely merely to give the user the impression that work is occurring.

Empty states should be honest. If no projects exist, say there are no projects rather than showing made-up project cards.

# 18\. Workspace UI Rules

The main Agentic Film Studio workspace uses the product-defined 25% sidebar, 50% main workspace, and 25% project/folder manager model.

The implementation must preserve the conceptual responsibilities of these areas. The left area supports navigation and chat history, the middle area hosts the main conversation and artifact workspace, and the right area manages projects and project assets.

Any future visual refinement must preserve the underlying interaction model unless the product requirements are intentionally changed.

- Workspace
- 25% Sidebar | 50% Main Workspace | 25% Project/Folder Manager

# 19\. Tab System Rules

The primary Chat tab is persistent. Secondary tabs represent artifacts or views associated with the active project. Examples include the script, characters, voiceover, clips, and final video.

Closing a tab must not delete the artifact. Opening an artifact should open it or focus its existing tab. Duplicate tabs should be avoided unless the product explicitly supports them.

Tabs should remain tied to the correct project context. Switching projects must not silently display artifacts from another project.

# 20\. Backend Architecture Rules

Node.js and Express form the main application backend. This service is responsible for application APIs, user and project operations, authentication integration, authorization, persistence coordination, and interaction with the AI service.

AI-specific orchestration should live in the Python/FastAPI service when the TDD assigns it there. This separation prevents the Node service from becoming a mixture of HTTP handling, AI orchestration, background processing, and provider-specific logic.

# 21\. Backend Layering

Where appropriate, use a layered structure such as route -> controller -> service -> repository/data access.

The goal is not to add layers for the sake of architecture. The goal is to keep HTTP transport concerns, business rules, data access, and external integrations understandable and testable.

Avoid route handlers that contain all validation, database work, business rules, storage calls, AI calls, and response formatting in one long function.

# 22\. FastAPI / AI Service Rules

The Python/FastAPI service is the home for the agent workflow, LangGraph orchestration, AI provider calls, document processing, generation coordination, and AI-specific transformations defined by the TDD.

It should expose clear service boundaries to the Node backend and should not become a second application backend with duplicate user-management or project-management logic.

# 23\. Database Rules

MongoDB is the persistent application database. It stores durable application state and metadata, not large media blobs by default.

Appropriate durable information includes users, projects, conversations, messages, scripts, character metadata, voiceover metadata, video-shot metadata, workflow information, approval state, reports, notifications, and generation metadata.

Large PDFs, images, audio files, video clips, and final videos belong in object storage. MongoDB stores the metadata and references needed to retrieve those objects.

# 24\. Database Design Rules

Before creating a collection, understand why the collection exists, what data belongs in it, how it relates to other entities, how it will be queried, what its lifecycle is, and what ownership and deletion rules apply.

Use consistent naming and timestamps. Choose embedded documents or references intentionally. The schema should support the actual query patterns rather than merely mirroring the screen layout.

Do not create a new collection just because it makes one route easier to code.

# 25\. Database Query Rules

Avoid unbounded queries and large result sets when the product does not need them. Use pagination where collections can grow. Create indexes for important query and ownership patterns.

Always include the correct ownership and authorization conditions when retrieving user-owned resources. Avoid repeated database calls when a better query or repository operation can provide the same information safely.

Database performance should be considered alongside correctness. A query is not acceptable simply because it works on a tiny development dataset.

# 26\. Data Ownership Rules

Every user-owned project and artifact must remain associated with its owner. Ownership must be preserved across projects, chats, scripts, characters, voiceovers, clips, assets, and final videos.

Use explicit ownership relationships and validate them server-side. Never assume a client-supplied identifier belongs to the current user.

This rule is foundational to privacy, authorization, and data integrity.

# 27\. Resource Authorization

Client-provided IDs are untrusted. A request containing a projectId, characterId, shotId, or assetId must be checked against the authenticated user and the relevant ownership relationships before the resource is read or changed.

Frontend route visibility is not authorization. Hiding an admin menu does not prevent an unauthorized API call. Every protected backend resource must enforce its own authorization boundary.

# 28\. File Storage Architecture

Local development uses MinIO and production uses Amazon S3. The application must use a storage abstraction so provider-specific details remain isolated.

A conceptual structure is application -> FileStorageService -> MinIO/S3. Application code should work with a storage interface such as upload, download, delete, metadata, and signed URL creation rather than calling provider SDKs everywhere.

This keeps the local development environment close to production and reduces migration rework later.

# 29\. Object Storage Rules

Large objects such as PDFs, reference images, generated character images, voiceover audio, video clips, music, and final videos belong in object storage.

MongoDB should store metadata such as object keys, media type, version, project association, and generation information. Redis should not be used as a media store.

Objects should use predictable project-scoped paths so they are easy to reason about and clean up.

# 30\. Storage Security

Object storage should be private by default. The frontend should not receive storage credentials.

Use authenticated backend access or presigned/signed URLs where the product requires direct client download or upload. Check authorization before generating those URLs.

Do not expose internal bucket names, credentials, or infrastructure configuration unless the TDD explicitly requires a safe public identifier.

# 31\. File Validation

Uploaded files are untrusted input. Validate type, MIME type, size, filename safety, and content compatibility as required.

Do not trust a file extension alone. A file named \`document.pdf\` is not proof that the contents are a valid PDF.

Validate files before sending them to expensive AI or media-processing operations. This protects cost, reliability, and security.

# 32\. Redis Rules

Redis is used for operational workloads such as background queues, temporary processing state, and realtime job information where appropriate.

Redis is not the durable source of truth for user projects or historical artifacts. If Redis is restarted, the application must still be able to recover durable project state from MongoDB and object storage.

Do not place large media objects in Redis.

# 33\. Background Job Rules

Long-running generation work must not block ordinary HTTP requests. Video generation, image generation, voice generation, large document processing, and media assembly may need asynchronous jobs.

Jobs should have clear IDs, states, retry rules, and ownership. The API can create and monitor a job while a worker performs the long-running operation.

The user interface should display the actual job state rather than assuming completion immediately after queueing.

# 34\. Job Idempotency

Expensive operations must guard against duplicate execution. Network retries and double-clicks are real-world behaviors, and video generation may have meaningful cost.

Use idempotency keys, stable generation IDs, state checks, and deduplication where appropriate. The same logical request should not create multiple expensive operations merely because a browser retried the HTTP request.

# 35\. Worker Rules

Workers must validate jobs before processing, update job state, handle retryable errors deliberately, stop retrying after the configured policy, and preserve useful diagnostics.

A worker crash must not cause the job to become permanently invisible. A job that is partially completed must have a recoverable and understandable state.

Workers should avoid duplicate processing and should not mark a job successful before verifying the actual result.

# 36\. LangGraph Rules

LangGraph is the workflow orchestration layer for the multi-agent film-generation process.

The approved agent sequence is:

Script Agent -> Character Generation Agent -> Voiceover Agent -> Video Generation Agent -> Editor Agent

The graph must represent workflow states and human approval points explicitly. The agent must not silently bypass a required checkpoint, reorder the workflow, or mark a stage complete without evidence that the stage actually completed.

- Workflow principle
- One continuous project workflow can pause at human approval points and resume later. It does not need to keep a process running while the user is away.

# 37\. Agent Responsibilities

Each agent should have a focused responsibility.

The Script Agent should handle script and shot planning. The Character Generation Agent should handle character definition and visual generation. The Voiceover Agent should handle dialogue/voice preparation and generation. The Video Generation Agent should generate shot-level video content using approved project context. The Editor Agent should assemble approved clips into the final output.

Do not turn one agent into a giant function that performs every stage.

# 38\. Structured Agent State

Agent state must be explicit and typed. It should be possible to understand what project is running, what stage is active, what artifacts are approved, what user action is pending, what jobs exist, and what errors have occurred.

Do not pass arbitrary untyped dictionaries through the entire workflow. Use appropriate data models or structured types so downstream nodes know what they can safely consume.

# 39\. Agent Context Rules

Agents should receive only the context needed for their task.

The Script Agent needs user instructions and relevant references. The Character Agent needs the approved script and character requirements. The Voiceover Agent needs approved dialogue and character information. The Video Agent needs approved script, characters, references, voice/audio context where supported, and video instructions. The Editor Agent needs approved generated media.

Do not send entire chat histories, every uploaded file, or unrelated project assets simply because they are available.

# 40\. Structured AI Outputs

When an AI response becomes input to deterministic application code, prefer structured output.

Important concepts such as shots, characters, dialogue segments, jobs, approvals, and asset metadata should have predictable fields and validation.

Free-form model text can still be useful for user-facing explanations, but downstream logic should not depend on fragile parsing of natural language when a structured representation is possible.

# 41\. AI Output Validation

Never assume a model returned correct structure simply because the model provider returned HTTP success.

Validate required fields, types, allowed values, relationships, lengths, and structural integrity before storing or executing the data. Invalid model output should become a handled failure or repair path, not silently become corrupted application state.

# 42\. Human-in-the-Loop Rules

Human approval is part of the product design. The implementation must preserve the user's control over the defined review checkpoints.

Do not automatically approve generated scripts, characters, voiceovers, or video clips. Do not skip review just because the model returned an output.

Approval must be a real state transition, persisted and reflected in the workflow.

# 43\. Approval State

An approval interaction should have meaningful states such as generated, waiting for review, approved, or rejected as defined by the TDD.

The frontend can show the button, but the backend and workflow must persist the result. A user clicking Approve twice should not trigger uncontrolled duplicate transitions.

Approval information should include the relevant artifact, version, user, time, and decision metadata as required by the design.

# 44\. Rejection and Regeneration

When a user rejects an artifact, the system should record the rejection and feedback, then regenerate the relevant artifact according to the workflow.

Previous valid versions should be preserved where the PRD requires versioning. Rejection of Shot 3 should not automatically destroy approved Shot 1 or Shot 2.

The system should prefer targeted regeneration so that unnecessary expensive work is avoided.

# 45\. Versioning

Generated artifacts may evolve through multiple versions. Script revisions, character revisions, regenerated voiceovers, and repeated generations of an individual video shot should have clear version relationships.

Do not overwrite historical versions when the product requires traceability. Store which version is current and preserve relationships between old and new versions so users and agents can understand the evolution of the project.

# 46\. Video Generation

The Video Agent must use the approved project context required by the video provider. It should consider the approved script, shot data, character information, character reference images, audio/voice context where supported, and the user's video-generation instructions.

The implementation should not silently replace approved inputs with unrelated project information. Provider constraints such as maximum duration, resolution, input support, rate limits, and audio capabilities belong in the provider integration and TDD rather than being hidden inside frontend code.

# 47\. Parallel Video Generation

Independent video shots may be generated concurrently when provider limits and worker capacity allow.

Each shot should have its own job and status. A failure in Shot 3 should not unnecessarily discard successful Shot 1 and Shot 2 results. The system should support targeted regeneration of failed or rejected shots.

Concurrency must respect external provider rate limits and the application's cost and worker limits.

# 48\. AI Provider Abstraction

Do not hard-code agent logic directly against one provider SDK everywhere.

Prefer a provider interface or service boundary. For example, Video Agent calls a Video Provider abstraction, which delegates to the selected provider implementation.

This allows the project to change providers or introduce another provider later without rewriting workflow logic, UI code, and database models.

# 49\. AI API Keys

AI provider keys must remain server-side. They must never be embedded in frontend bundles, committed to Git, placed into public JSON, logged, or returned to clients.

Use environment variables or secure secret management. Development keys and production keys should be isolated according to the environment configuration.

# 50\. AI Provider Failures

External AI services are unreliable boundaries. Handle provider timeouts, rate limits, invalid requests, authentication failures, temporary outages, malformed responses, and quota-related failures intentionally.

The system should distinguish retryable failures from failures that require user action or configuration changes. Never retry forever, especially for expensive media-generation operations.

# 51\. API Design Rules

REST APIs should be consistent, predictable, versioned where required, authenticated when protected, authorized, validated, and documented.

Use appropriate HTTP methods and status codes. Do not create hidden request flags or undocumented behaviors simply to satisfy one frontend screen.

The API contract is an important boundary between the frontend, application backend, AI service, and workers.

# 52\. API Validation

Validate every request before performing expensive work.

Validation should consider required fields, data types, allowed values, formats, ranges, ownership, relationships, and authorization.

Do not trust a client because the UI is supposed to restrict the value. The backend must still enforce the rule.

# 53\. API Error Responses

API errors should use a consistent response shape. Client errors should provide enough information for the UI to respond appropriately without exposing internal secrets or implementation details.

Never return stack traces, database connection strings, API keys, internal credentials, or sensitive provider responses to the frontend.

# 54\. Error Handling

Errors must be handled intentionally at every layer.

Classify failures so they can be processed correctly: validation, authentication, authorization, database, storage, queue, AI provider, workflow, network, media processing, and internal failures.

A user-facing message should be understandable while internal logs should preserve enough technical context for diagnosis.

# 55\. Never Swallow Errors

Do not silently ignore failures.

Code such as \`catch { return null; }\` hides problems and causes downstream code to fail in confusing ways. If an error can be safely ignored, that decision should be explicit and documented.

Most failures should be logged appropriately, surfaced, retried, recovered, or propagated.

# 56\. Retry Rules

Retries should be deliberate and limited. Only retry failures known to be temporary or retryable.

Define maximum attempts, backoff, timeout, idempotency behavior, and provider limits. Do not retry validation errors or authentication errors indefinitely.

Retries must also consider cost. A blind retry loop around video generation can turn one failed request into many paid requests.

# 57\. Partial Failure

Distributed workflows can partially succeed.

For example, a media upload may succeed while the corresponding database write fails, or a database state update may succeed while storage fails.

The implementation must include recovery or reconciliation strategies for such situations. Orphaned files, dangling database references, and ambiguous job states must not be silently accepted.

# 58\. Security Architecture

Security must be treated as a system property, not a final checklist item.

The architecture must protect authentication, authorization, project isolation, file access, secrets, inputs, API boundaries, sessions, and administrative functionality.

Every new feature should ask what an attacker could control, what data they could access, and whether the server verifies the relevant permissions.

# 59\. Authentication

Protected resources require authentication. The application uses the approved Google authentication flow and appropriate secure session/token handling.

Authentication tells the system who the user is. It does not automatically determine what the user can access. Protected routes should fail safely when authentication is missing or invalid.

# 60\. Authorization

Authorization must be enforced server-side. The system must determine whether the authenticated user can perform the requested action on the requested resource.

Do not rely on frontend route hiding. Do not trust role or permission values supplied by the client. Resource-level authorization should be checked for user-owned projects and assets.

# 61\. Admin Security

Administrative functionality requires stronger authorization boundaries.

An admin menu being visible only to administrators is not enough. Backend endpoints must verify administrative privileges.

A standard user must not gain admin access by changing frontend state, request body values, URL parameters, or local storage values.

# 62\. Privacy

User content should be treated as private user-owned data unless the product explicitly defines it as public.

This includes uploaded documents, reference images, scripts, conversations, voiceovers, clips, final videos, and project metadata.

Do not expose one user's assets to another user. Do not log private content unnecessarily. Do not make storage objects public merely for convenience.

# 63\. Logging

Logs should make production failures diagnosable while protecting sensitive information.

Useful identifiers include requestId, projectId, workflowId, jobId, and agent identifiers where appropriate. Do not log tokens, credentials, API keys, private documents, or unnecessary raw user content.

Structured logs are preferred over unstructured debug prints for long-lived services.

# 64\. Observability

Important asynchronous operations should be traceable end-to-end.

A video generation failure should be understandable as a chain from user request to API request to workflow to agent to job to provider to storage.

Use correlation identifiers and consistent status reporting so failures can be investigated without guessing which operation a log entry belongs to.

# 65\. Testing Philosophy

Code is not complete merely because it compiles, launches, or returns 200 responses.

Tests should exercise happy paths and failure paths. For important workflows, verify validation, authorization, persistence, retries, recovery, concurrency, and state transitions.

Tests should protect behavior, not merely increase coverage percentages.

# 66\. Testing Requirements

Use the appropriate mix of unit, integration, API, agent, workflow, end-to-end, regression, performance, and security tests.

The exact framework choices are defined by the TDD. The agent must add or update tests when a meaningful behavior changes.

A test should be valuable enough that a future regression would be caught by it.

# 67\. Agent Testing

Agent workflows should be tested independently from the UI where practical.

Tests should verify inputs, structured outputs, state transitions, human approval, rejection, regeneration, failure recovery, resume behavior, and malformed model outputs.

Avoid tests that simply mock everything and therefore never verify the real workflow rules.

# 68\. Regression Testing

Every meaningful bug fix should consider whether a regression test is appropriate.

Fix the root cause, add a test when practical, run relevant existing tests, and check nearby behavior. Do not remove a failing test merely because it makes the build pass.

# 69\. Debugging Rules

Debugging should follow evidence rather than guesswork.

Start with the error and trace the data flow. Identify the affected component, determine the root cause, make the smallest complete fix, run relevant checks, and review for regressions.

Do not respond to every failure by rewriting entire modules or introducing new architecture.

# 70\. No Unrelated Changes

Keep changes scoped to the task.

Do not reformat unrelated files, rename unrelated variables, remove unrelated functionality, or refactor another service merely because you are working in the same repository.

Focused changes are easier to review, test, revert, and merge.

# 71\. Dependency Rules

Before adding a dependency, check whether the project already has a library that solves the problem. Prefer maintained, well-supported packages and avoid adding dependencies for trivial functionality.

A dependency adds security, maintenance, build, and upgrade cost. It should have a real reason to exist.

# 72\. Environment Configuration

Environment-specific settings must not be hardcoded into the source code.

Use environment configuration for database URLs, Redis settings, storage endpoints, AI provider settings, authentication settings, and application URLs.

Never commit production secrets. Example or local configuration should not contain real credentials.

# 73\. Docker Rules

Docker is used for reproducible development and deployment.

Local development may use Docker Compose for MongoDB, Redis, MinIO, Node.js, FastAPI, and workers. Production containerization follows the TDD and AWS deployment plan.

Containers should package the actual application consistently. Do not create one set of business logic for local containers and another for production.

# 74\. Local Development Rules

The local environment should be a realistic representation of the production architecture where practical.

MinIO can stand in for S3, local Redis can stand in for a managed Redis service, and Docker Compose can orchestrate the local stack.

Avoid local-only hacks that require a rewrite before deployment.

# 75\. AWS Migration Rules

The project is designed for eventual AWS deployment. The application should therefore rely on abstraction boundaries rather than hard-coded infrastructure providers.

Typical migration paths include MinIO -> S3, local Redis -> managed Redis/Valkey, and local containers -> ECS.

The goal is infrastructure migration without rewriting product logic.

# 76\. Performance Rules

Performance should be considered during implementation but should not lead to premature complexity.

Use appropriate database indexes, pagination, lazy loading, background jobs, parallel generation, and caching when justified.

Measure real bottlenecks where possible. Do not add complicated optimization merely because it sounds faster.

# 77\. Concurrency Rules

The application can have concurrent operations through multiple browser tabs, repeated approval clicks, multiple workers, parallel video jobs, and simultaneous regenerations.

The system must protect against race conditions, stale state, duplicate jobs, and conflicting updates.

Concurrency should be considered whenever an operation changes durable state or triggers an expensive external request.

# 78\. Idempotency Rules

State-changing operations should be idempotent where the product allows it.

Examples include approve, reject, generate, regenerate, upload, delete, queue, and complete operations.

A network retry or double-click should not cause uncontrolled duplicate work.

# 79\. Cost Protection

External AI calls can incur cost, especially image, voice, and video generation.

The implementation must prevent duplicate expensive requests, infinite retries, accidental generation caused by UI re-renders, and unnecessary regeneration.

Validate inputs before expensive work. Track external job IDs. Make expensive actions deliberate and auditable.

# 80\. UI Destructive Actions

Destructive actions such as deleting a project, deleting important assets, or deleting an account should have appropriate confirmation and clear consequences.

Do not silently delete user data. The UI should accurately describe what will happen and the backend must enforce the same authorization and deletion rules.

# 81\. Media Handling

Media should be treated as large, potentially expensive, and failure-prone.

Before a generated or uploaded media file is used downstream, verify that it exists, is readable, has an expected format, and satisfies required metadata constraints.

Do not assume a successful provider response guarantees that the media file is valid.

# 82\. FFmpeg Security

When FFmpeg is used, inputs must be validated and command construction must be safe.

Never interpolate raw user-controlled strings into shell commands. Use safe argument handling, validated paths, and explicit subprocess mechanisms.

Capture useful errors, validate outputs, and avoid using FFmpeg as an undocumented workaround for unrelated application problems.

# 83\. Prompt Engineering Rules

Prompts are software artifacts. Important prompts should be reviewable, versioned where appropriate, consistently stored, and separated from unrelated application code.

Prompts should specify expected structure when downstream code depends on it. Deterministic business rules should remain deterministic code rather than being hidden inside vague natural-language instructions when reliable application logic is possible.

# 84\. Prompt Injection Protection

User-provided prompts, uploaded documents, and generated text are untrusted content.

They must not be allowed to override system instructions, security policies, authorization, or workflow state. Treat external text as data unless the product explicitly defines it as trusted system configuration.

Agent prompts should clearly separate system instructions from user content.

# 85\. External API Boundaries

Every external API should be treated as an unreliable boundary. Validate outgoing requests and incoming responses.

Consider provider status codes, timeouts, quotas, rate limits, schema changes, and malformed data.

Do not depend on undocumented behavior. If a provider changes, update its isolated adapter rather than spreading provider-specific workarounds across the application.

# 86\. No Hidden Fallbacks

Do not silently replace real functionality with fake functionality.

For example, if the video provider fails, do not return a prebuilt sample video. If the database fails, do not return a hardcoded project list.

Fallbacks are allowed only when explicitly designed, documented, and semantically correct. A mock is not a production fallback.

# 87\. Mocking Rules

Mocks are allowed in tests and in explicitly configured local development environments.

Mocks must be clearly identified and isolated from production paths. They should not silently activate because an external provider failed.

The purpose of a mock is to test a boundary or enable controlled development, not to conceal missing functionality.

# 88\. Git Rules

Use version control professionally.

Commits should represent focused logical changes. Do not commit secrets, temporary debug files, generated junk, local credentials, unnecessary build artifacts, or large media that belongs in object storage.

Keep commits reviewable and related to actual work.

# 89\. Git Safety

Never force-reset or discard repository work merely to make a task easier.

Do not delete another contributor's changes, rewrite unrelated branches, or use destructive commands without explicit authorization.

Inspect the repository before making broad changes. Preserve existing uncommitted work.

# 90\. Code Review Readiness

Before considering a change ready for review, verify readability, architecture, typing, validation, security, tests, error handling, and scope.

Ask whether a teammate can understand the change, whether the change introduces hidden coupling, and whether the behavior matches the PRD and TDD.

Passing a build is necessary but not sufficient.

# 91\. Documentation Rules

When behavior or operational setup changes, update the relevant documentation.

This can include API documentation, environment setup, workflow descriptions, architecture decisions, configuration references, or operational procedures.

Important knowledge must not live only inside one developer's memory or inside an unexplained code path.

# 92\. Change Management

Use a disciplined sequence for meaningful changes:

1\. Understand the task and read the relevant PRD section.  
2\. Read the relevant TDD section.  
3\. Inspect the existing implementation and tests.  
4\. Identify affected components and dependencies.  
5\. Plan the smallest complete change.  
6\. Implement the real behavior.  
7\. Run type checking, linting, formatting, tests, and build as appropriate.  
8\. Review security, readability, and regressions.

Do not skip the understanding and inspection steps simply because the requested change sounds small.

# 93\. When Requirements Are Ambiguous

Do not invent product behavior when the correct behavior cannot be determined from the PRD, TDD, existing code, tests, or documented architecture decisions.

When ambiguity remains, surface it rather than guessing. A wrong assumption can lead to more rework than leaving one piece of work incomplete until the requirement is clarified.

# 94\. When Existing Code Is Poor

Do not rewrite the entire system automatically.

First determine what is broken, why it is broken, what the smallest correct fix is, whether the current design violates the TDD, and whether a larger refactor is genuinely necessary.

A refactor should solve a real engineering problem and should be accompanied by appropriate tests.

# 95\. No Premature Architecture Changes

Do not introduce new services, databases, queues, frameworks, AI providers, or infrastructure simply because they are interesting or convenient.

New architecture should have a clear requirement or technical justification. It should be recorded through the project's decision process and remain consistent with the TDD.

# 96\. Feature Completeness

A feature is not complete merely because a button, card, page, API endpoint, spinner, or mock response exists.

The real functionality must work. Data must be persisted correctly, permissions must be enforced, errors must be handled, and the feature must integrate with the surrounding workflow.

The definition of complete is based on behavior, not appearance.

# 97\. Readability Before Cleverness

Prefer code that a normal developer can understand quickly.

Do not compress logic simply to reduce line count. Avoid unnecessary nested ternaries, clever abstractions, overly generic utilities, or dense one-liners when a straightforward implementation is clearer.

Readable code is easier to test, review, debug, and maintain.

# 98\. Main Files Must Remain Clean

Application entry points and main files must not become dumping grounds for configuration, large data arrays, business rules, API clients, AI prompts, styling systems, or miscellaneous helper functions.

Keep main files focused. Move substantial data, configuration, styles, and services into their appropriate modules.

This rule directly supports the project's readability and maintainability goals.

# 99\. UI Content and Configuration

Static UI content should be separated when it becomes substantial or reusable. Use data, config, constants, or JSON locations where appropriate.

Do not repeat the same business label, configuration value, or structured content across many components. Prefer shared sources of truth.

Again, this does not mean every string must be moved into a JSON file. Use judgment based on size, reuse, change frequency, and clarity.

# 100\. Definition of Done

A meaningful implementation should satisfy the following checklist as applicable.

- PRD requirement understood
- TDD requirement understood
- Existing code inspected
- Correct architecture followed
- Code readable
- Responsibilities separated
- Hardcoding avoided
- No dummy functionality
- No fake success
- Type checking passes
- Linting passes
- Formatting passes
- Relevant tests pass
- Validation implemented
- Authorization considered
- Error handling implemented
- Retry and concurrency considered
- Security reviewed
- No unrelated changes
- Documentation updated where needed

# 101\. Forbidden Patterns

The following patterns are prohibited unless an exceptional case is explicitly reviewed and documented.

- TypeScript \`any\`
- \`as any\`
- \`@ts-ignore\`
- \`@ts-nocheck\`
- Disabling compiler checks
- Disabling linting to hide defects
- Disabling tests to make CI pass
- Hardcoded API keys
- Hardcoded credentials
- Hardcoded user or project IDs
- Fake API responses
- Fake generated media
- Fake progress
- Fake analytics
- Fake success messages
- Dummy buttons
- Dummy cards
- Dummy tabs
- Dummy pages
- Placeholder functionality pretending to be complete
- Silent exception swallowing
- Infinite retries
- Bypassing authentication
- Bypassing authorization
- Skipping approval checkpoints
- Putting AI secrets in frontend code
- Direct frontend access to MongoDB
- Direct frontend access to private storage
- Storing large media in Redis
- Unnecessary large media in MongoDB
- Returning success after failure
- Unrelated rewrites
- Unnecessary dependencies
- Undocumented fallback behavior
- Large static configuration in main files without justification
- Large CSS blocks inside JSX/TSX files
- Mixing unrelated business logic into UI components
- Temporary hacks used as permanent solutions

# 102\. Preferred Development Workflow

For every coding task, follow this sequence:

Understand task -> Read PRD -> Read TDD -> Read AGENTS.md -> Inspect existing code -> Identify affected components -> Plan the change -> Implement real functionality -> Validate types -> Run lint -> Run formatting -> Run tests -> Run build -> Review security -> Review readability -> Review unintended changes -> Complete.

If any step exposes a conflict or missing decision, stop making assumptions and resolve the issue before proceeding.

# 103\. When Something Cannot Be Implemented Yet

Do not fake it.

Do not create a dummy button simply because the final button is not ready. Do not add a fake API response because the backend is missing. Do not return a sample video because a provider is unavailable.

Keep the implementation boundary clean, document what is missing when appropriate, and continue with work that can be implemented correctly.

A missing real feature is better than a fake feature that misleads users or developers.

# 104\. Final Engineering Principle

Build the real thing. Build it cleanly. Build it safely.

Do not optimize for appearing complete. Do not optimize for hiding compiler failures, test failures, architecture problems, or missing integrations.

Optimize for correctness, readability, maintainability, security, reliability, and long-term development.

When the correct implementation requires more work, do the correct work. When requirements are unclear, do not invent them. When a feature is not ready, do not fake it.

# Appendix A - Architecture Boundaries Quick Reference

| **Layer**      | **Primary Responsibility**                              | **Must Not Own**                                   |
| -------------- | ------------------------------------------------------- | -------------------------------------------------- |
| React Frontend | UI, user interaction, presentation, workspace state     | DB credentials, AI secrets, direct DB/Redis access |
| Node/Express   | REST API, auth integration, project/business operations | Primary LangGraph orchestration                    |
| FastAPI        | AI workflows, agent execution, provider integration     | Unrelated UI concerns                              |
| LangGraph      | Workflow orchestration and state transitions            | User interface rendering                           |
| Redis          | Queues, temporary operational state                     | Permanent business truth, large media              |
| MongoDB        | Persistent application data and metadata                | Large media blobs                                  |
| MinIO/S3       | Large object/media storage                              | Application business rules                         |
| Workers        | Long-running jobs and media/AI tasks                    | Synchronous web request handling                   |

# Appendix B - Recommended Project Layout Principles

root/

├── frontend/

│ ├── src/

│ │ ├── components/

│ │ ├── pages/

│ │ ├── hooks/

│ │ ├── services/

│ │ ├── api/

│ │ ├── types/

│ │ ├── data/

│ │ ├── config/

│ │ └── styles/

├── backend/

│ ├── routes/

│ ├── controllers/

│ ├── services/

│ ├── repositories/

│ ├── models/

│ ├── middleware/

│ └── utils/

├── ai-service/

│ ├── agents/

│ ├── graph/

│ ├── providers/

│ ├── schemas/

│ ├── services/

│ └── workers/

├── infrastructure/

├── tests/

└── docs/

# Appendix C - Definition of Done Checklist

| **Check**                      | **Required Before Completion?**       |
| ------------------------------ | ------------------------------------- |
| PRD/TDD reviewed               | Yes, for all non-trivial changes      |
| Existing code inspected        | Yes                                   |
| Real functionality implemented | Yes                                   |
| No dummy/fake behavior         | Yes                                   |
| Type checking                  | Yes, for applicable code              |
| Linting/formatting             | Yes, for applicable code              |
| Relevant tests                 | Yes, when behavior is testable        |
| Security/authorization review  | Yes, for protected or user-owned data |
| No unrelated changes           | Yes                                   |
| Documentation updated          | When behavior/configuration changes   |

# Appendix D - Final Rule

**Nothing is better than a dummy implementation.**

If the real functionality is not ready, do not create a fake version simply to make the project look complete. Honest incompleteness is easier to finish correctly than misleading functionality is to repair.