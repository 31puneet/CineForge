**Product Requirements Document (PRD)**

**Agentic Film Studio**

Document Version: 0.1 (Draft)

**Project Specification and Product Behavior**

# . TABLE OF CONTENTS

| **Section** | **Title**                               |
| ----------- | --------------------------------------- |
| 1           | DOCUMENT CONTROL                        |
| 2           | PRODUCT OVERVIEW                        |
| 3           | GOALS AND NON-GOALS                     |
| 4           | TARGET USERS AND PERSONAS               |
| 5           | PRODUCT SCOPE                           |
| 6           | PRODUCT INFORMATION ARCHITECTURE        |
| 7           | USER JOURNEY / END-TO-END WORKFLOW      |
| 8           | DETAILED UI / UX REQUIREMENTS           |
| 9           | WORKSPACE AND TAB SYSTEM                |
| 10          | PROJECT / FOLDER MANAGEMENT             |
| 11          | CHAT SYSTEM                             |
| 12          | INPUT AND ATTACHMENT REQUIREMENTS       |
| 13          | VIDEO CONFIGURATION                     |
| 14          | AGENT WORKFLOW REQUIREMENTS             |
| 15          | SCRIPT AGENT                            |
| 16          | CHARACTER AGENT                         |
| 17          | VOICEOVER AGENT                         |
| 18          | VIDEO GENERATION AGENT                  |
| 19          | EDITOR AGENT                            |
| 20          | HUMAN-IN-THE-LOOP / APPROVAL SYSTEM     |
| 21          | WORKFLOW STATE AND RESUME BEHAVIOR      |
| 22          | DATA AND PROJECT LIFECYCLE REQUIREMENTS |
| 23          | NOTIFICATIONS AND PROGRESS              |
| 24          | DASHBOARD AND ANALYTICS REQUIREMENTS    |
| 25          | PROFILE AND ACCOUNT                     |
| 26          | SEARCH AND NAVIGATION                   |
| 27          | FUNCTIONAL REQUIREMENTS                 |
| 28          | NON-FUNCTIONAL REQUIREMENTS             |
| 29          | SECURITY AND PRIVACY REQUIREMENTS       |
| 30          | ERROR AND EDGE-CASE CATALOG             |
| 31          | PERMISSIONS AND OWNERSHIP               |
| 32          | REPORTS AND EXPORT                      |
| 33          | TESTING REQUIREMENTS                    |
| 34          | DEPLOYMENT AND ENVIRONMENT EXPECTATIONS |
| 35          | ACCEPTANCE CRITERIA                     |
| 36          | MVP DEFINITION                          |
| 37          | FUTURE ROADMAP                          |
| 38          | OPEN QUESTIONS / DECISION LOG           |
| 39          | PRODUCT RULES / BUSINESS RULES          |
| 40          | APPENDIX                                |

**Document note**

This PRD is the product-level source of truth. It defines user-facing behavior, scope, workflow expectations, requirements, edge cases, and acceptance conditions. Detailed implementation architecture will be specified in the TDD.

# 1\. DOCUMENT CONTROL

- Project Name: Agentic Film Studio
- Document Name: Product Requirements Document (PRD)
- Authors: Puneet Seervi
- Creation Date: 30 September 2026
- Last Updated Date: 30 September 2026

## 1.1 Change Log

| **Date**          | **Author**    | **Description of Changes**                                                                                                                                           |
| ----------------- | ------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 30 September 2026 | Puneet Seervi | Initial comprehensive PRD draft covering the agreed product concept, five-agent workflow, workspace behavior, requirements, edge cases, and acceptance expectations. |

# 2\. PRODUCT OVERVIEW

## 2.1 Product Vision

Agentic Film Studio is an AI-powered content creation workspace for content creators, filmmakers, and video producers. It is designed to turn a user's idea, script, audio input, or reference material into a personalized short film through a coordinated, project-based workflow. The product combines conversation, project management, AI generation, review, revision, and final assembly in one environment.

The user remains the creative decision-maker. Specialized AI agents handle production-oriented stages while the user reviews important outputs before the workflow continues. The product preserves project context, generated assets, versions, approvals, and workflow state so that long-running work can continue across multiple sessions.

## 2.2 Problem Statement

Short-form film creation involves several dependent stages: story and shot planning, character design, dialogue and voice generation, visual shot generation, asset management, and final assembly. Using disconnected tools for these stages forces creators to repeatedly move context, manually organize generated outputs, and track which versions are approved.

| **Problem Area**      | **Impact on the User Workflow**                                                                                   |
| --------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Fragmented production | Separate tools make it difficult to move smoothly from story to characters, audio, video, and final assembly.     |
| Context loss          | A script, reference image, character identity, or dialogue can lose its relationship to later production outputs. |
| Manual coordination   | Users must repeatedly provide the same context or manually decide what information a downstream tool should use.  |
| Asset sprawl          | Generated scripts, images, audio, clips, and final outputs can become difficult to organize and retrieve.         |
| Review and revision   | AI outputs need human review, but unstructured review can lead to unnecessary full-project regeneration.          |
| Long-running work     | Media generation may take time and may involve failures, retries, and parallel jobs, requiring persistent state.  |

## 2.3 Product Concept

Agentic Film Studio is centered on a project folder and a persistent chat workspace. After authentication, the user creates or opens a project, supplies a prompt and supported references, selects a target duration, and interacts with five specialized agents. Each downstream stage consumes approved upstream artifacts and produces a reviewable output.

```
User -> Project Folder -> Chat / Inputs
          |
          +-> Script Agent -> Script Review
                    |
                    +-> Character Agent -> Character Review
                    |
                    +-> Voiceover Agent -> Voice Review
                    |
                    +-> Video Agent -> Per-Shot Review
                    |
                    +-> Editor Agent -> Final Video
```

The main studio uses a 25% / 50% / 25% layout: the left area contains navigation and chat history, the center area contains chat and artifact tabs, and the right area contains the folder/project manager. Clicking an artifact opens a secondary tab in the central workspace. The primary Chat tab remains available.

## 2.4 Core Value Proposition

| **Value**              | **Description**                                                                                         |
| ---------------------- | ------------------------------------------------------------------------------------------------------- |
| End-to-end AI workflow | Coordinates major short-film production stages in one workspace.                                        |
| Specialized agents     | Gives scripting, character design, voiceover, video generation, and editing clear responsibilities.     |
| Persistent context     | Keeps prompts, references, approved outputs, versions, and workflow state connected.                    |
| Human creative control | Uses explicit review checkpoints rather than silently accepting generated outputs.                      |
| Targeted iteration     | Allows a rejected artifact or shot to be regenerated without unnecessarily regenerating unrelated work. |
| Studio-style workspace | Combines chat, folders, artifact tabs, reviews, and progress into one interface.                        |

## 2.5 Project Alignment Table

| **Mapping Category**  | **Strategic Alignment & Description**                                                                                                                       |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GenAI                 | Uses generative AI to create and transform film-production artifacts.                                                                                       |
| Content Creation      | Focused on personalized short-form film and video creation.                                                                                                 |
| Multi-Agent           | Uses five specialized AI agents across the production workflow.                                                                                             |
| LangGraph             | Orchestrates stateful agent transitions and human approval checkpoints.                                                                                     |
| MERN                  | Uses React, Node.js/Express, and MongoDB for the application foundation.                                                                                    |
| Python                | Provides the AI/agent service layer.                                                                                                                        |
| REST APIs             | Provides structured communication between frontend, application services, and AI services.                                                                  |
| Dashboard             | The main studio workspace functions as the interactive dashboard.                                                                                           |
| Authentication        | Uses Google account login for user authentication.                                                                                                          |
| Deployment            | Supports local containerized development and eventual AWS deployment.                                                                                       |
| Industry              | Media / Creator Economy.                                                                                                                                    |
| Course Learning Goals | Covers DSA-oriented application logic, DBMS, full-stack development, REST APIs, LangGraph, multi-agent systems, AI integration, evaluation, and deployment. |
| Evaluation Metrics    | Addresses dashboard load time, secure authentication, CRUD accuracy, report generation, and responsive UI.                                                  |
| Reference Documents   | Uses AutoGPT: An Autonomous GPT-4 Experiment and ReAct Benchmarks & TaskBench as agentic-system references.                                                 |

| **Reference**       | **Resource**                            |
| ------------------- | --------------------------------------- |
| Paper               | AutoGPT: An Autonomous GPT-4 Experiment |
| Paper URL           | <https://arxiv.org/abs/2306.05861>      |
| Dataset / Benchmark | ReAct Benchmarks & TaskBench            |
| Resource URL        | <https://github.com/ysymyf/TaskBench>   |

# 3\. GOALS AND NON-GOALS

## 3.1 Goals

| **Goal ID** | **Category**  | **Goal Description**                                                                                   |
| ----------- | ------------- | ------------------------------------------------------------------------------------------------------ |
| G-001       | Product       | Deliver a complete AI-assisted film workflow from project input to a final generated video.            |
| G-002       | Workspace     | Provide a persistent 25/50/25 studio workspace combining chat, navigation, folders, tabs, and reviews. |
| G-003       | Project       | Allow users to create and manage separate film projects with persistent assets and state.              |
| G-004       | Agents        | Use five specialized agents with clear stage boundaries.                                               |
| G-005       | Script        | Generate a duration-aware shot-structured script from prompts and references.                          |
| G-006       | Characters    | Generate and manage character visuals with character-specific references.                              |
| G-007       | Voiceover     | Generate dialogue voiceovers and support efficient review and regeneration.                            |
| G-008       | Video         | Generate and track individual shots using approved project context.                                    |
| G-009       | Editing       | Assemble approved shots into a final video.                                                            |
| G-010       | Human Control | Provide approval, feedback, and targeted regeneration at defined checkpoints.                          |
| G-011       | Persistence   | Preserve chats, artifacts, versions, approvals, and workflow state across sessions.                    |
| G-012       | Security      | Keep projects and private assets isolated by user and role.                                            |
| G-013       | Performance   | Meet the project evaluation target for dashboard loading.                                              |
| G-014       | Deployability | Support local development and later deployment to AWS without changing the product workflow.           |

## 3.2 Non-Goals

| **Non-Goal ID** | **Out-of-Scope Item**                                 | **Rationale**                                                                         |
| --------------- | ----------------------------------------------------- | ------------------------------------------------------------------------------------- |
| NG-001          | Training a proprietary foundation model               | The product uses existing AI capabilities.                                            |
| NG-002          | Training a proprietary video model                    | The initial video workflow uses an external video-generation API.                     |
| NG-003          | Training a proprietary voice model                    | Voice generation uses an external provider.                                           |
| NG-004          | Self-hosting large generative models in the MVP       | Avoids GPU/model-serving complexity during initial development.                       |
| NG-005          | Building a general-purpose model-serving platform     | The product is an end-user film application.                                          |
| NG-006          | Replacing professional desktop video-editing software | The Editor Agent performs the defined automated assembly workflow.                    |
| NG-007          | Unrestricted video duration                           | The MVP uses defined duration choices.                                                |
| NG-008          | Native mobile application                             | The MVP is web-first.                                                                 |
| NG-009          | Social-network features                               | Social feeds, followers, likes, comments, and messaging are outside the core product. |
| NG-010          | Full multi-tenant enterprise platform                 | Multi-tenancy is a future/stretch capability.                                         |
| NG-011          | Fully autonomous production with no user checkpoints  | Human review is intentionally part of the product.                                    |
| NG-012          | Unlimited support for every possible file type        | Input formats are explicitly defined by the product.                                  |
| NG-013          | Unlimited retention of every intermediate artifact    | Data lifecycle and retention rules will govern storage.                               |

## 3.3 Success Criteria

| **Criteria ID** | **Success Metric**            | **Measurement Method**                                                  | **Target**            |
| --------------- | ----------------------------- | ----------------------------------------------------------------------- | --------------------- |
| SC-001          | End-to-end workflow           | Complete a supported film project from input through final video.       | Pass                  |
| SC-002          | Authentication                | Test Google sign-in, protected access, logout, and unauthorized access. | Pass                  |
| SC-003          | CRUD accuracy                 | Exercise supported create/read/update/delete operations.                | Pass                  |
| SC-004          | Agent workflow                | Run all five defined workflow stages.                                   | Pass                  |
| SC-005          | Human approval                | Verify approval, rejection, feedback, and regeneration paths.           | Pass                  |
| SC-006          | Project isolation             | Attempt unauthorized project or asset access.                           | Denied                |
| SC-007          | Character reference isolation | Use multiple characters and separate reference images.                  | Correct mapping       |
| SC-008          | Shot regeneration             | Reject one shot and regenerate only that shot.                          | Pass                  |
| SC-009          | Workflow resume               | Interrupt and reopen an unfinished project.                             | Valid state preserved |
| SC-010          | Tabs                          | Open, switch, and close artifact tabs.                                  | Pass                  |
| SC-011          | Final video                   | Assemble approved clips into a playable final output.                   | Pass                  |
| SC-012          | Dashboard performance         | Measure initial dashboard load under agreed evaluation conditions.      | < 2 sec               |
| SC-013          | Responsive UI                 | Test supported viewports and core workflow actions.                     | Pass                  |
| SC-014          | Report generation             | Generate the required report/output.                                    | Pass                  |

# 4\. TARGET USERS AND PERSONAS

## 4.1 Primary Users

| **User Group ID** | **User Category** | **Description**                                                                                | **Primary Objectives**                                                              |
| ----------------- | ----------------- | ---------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| UG-001            | Content Creator   | Creates digital video content for online audiences, campaigns, education, or social platforms. | Create personalized content efficiently while retaining creative control.           |
| UG-002            | Filmmaker         | Creates narrative or short-film content involving stories, characters, dialogue, and scenes.   | Translate creative ideas into coherent visual stories and refine generated outputs. |
| UG-003            | Video Producer    | Coordinates video production stages and manages multiple assets and deliverables.              | Keep projects organized, monitor production, and obtain final deliverables.         |

## 4.2 User Personas

### P-001 Content Creator Persona

| **Persona Attribute**  | **Details**                                                                                                      |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Persona ID             | P-001                                                                                                            |
| Persona Name           | Content Creator                                                                                                  |
| User Type              | Primary User                                                                                                     |
| Background             | Creates video content independently or in a small creative team.                                                 |
| Goals                  | Fast personalized content creation and experimentation.                                                          |
| Needs                  | Simple input, organized projects, review, targeted regeneration.                                                 |
| Pain Points            | Managing multiple stages and moving context between tools.                                                       |
| Typical Workflow       | Idea -> prompt/reference -> review -> final output.                                                              |
| Technical Familiarity  | Creative/product familiarity is expected; deep knowledge of the underlying agent implementation is not required. |
| Motivations            | Efficiency, control, experimentation, consistency, and organized project management.                             |
| Usage Context          | Web-based project sessions that may span multiple visits.                                                        |
| Expected Outcomes      | A persistent, reviewable project with approved intermediate artifacts and a final video.                         |
| Relevant Product Needs | Chat, project folders, artifact tabs, approvals, targeted regeneration, progress visibility, and persistence.    |

### P-002 Filmmaker Persona

| **Persona Attribute**  | **Details**                                                                                                      |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Persona ID             | P-002                                                                                                            |
| Persona Name           | Filmmaker                                                                                                        |
| User Type              | Primary User                                                                                                     |
| Background             | Develops narrative video/film content with stories, characters, and scenes.                                      |
| Goals                  | Creative control and continuity.                                                                                 |
| Needs                  | Structured scripts, character references, voice configuration, shot review.                                      |
| Pain Points            | Maintaining continuity across production stages.                                                                 |
| Typical Workflow       | Story -> characters -> voice -> scenes -> review -> final.                                                       |
| Technical Familiarity  | Creative/product familiarity is expected; deep knowledge of the underlying agent implementation is not required. |
| Motivations            | Efficiency, control, experimentation, consistency, and organized project management.                             |
| Usage Context          | Web-based project sessions that may span multiple visits.                                                        |
| Expected Outcomes      | A persistent, reviewable project with approved intermediate artifacts and a final video.                         |
| Relevant Product Needs | Chat, project folders, artifact tabs, approvals, targeted regeneration, progress visibility, and persistence.    |

### P-003 Video Producer Persona

| **Persona Attribute**  | **Details**                                                                                                      |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Persona ID             | P-003                                                                                                            |
| Persona Name           | Video Producer                                                                                                   |
| User Type              | Primary User                                                                                                     |
| Background             | Coordinates production activity and assets.                                                                      |
| Goals                  | Reliable and organized workflow completion.                                                                      |
| Needs                  | Project management, status visibility, revision management.                                                      |
| Pain Points            | Tracking jobs, assets, failures, and final deliverables.                                                         |
| Typical Workflow       | Project setup -> monitor -> review -> revise -> finalize.                                                        |
| Technical Familiarity  | Creative/product familiarity is expected; deep knowledge of the underlying agent implementation is not required. |
| Motivations            | Efficiency, control, experimentation, consistency, and organized project management.                             |
| Usage Context          | Web-based project sessions that may span multiple visits.                                                        |
| Expected Outcomes      | A persistent, reviewable project with approved intermediate artifacts and a final video.                         |
| Relevant Product Needs | Chat, project folders, artifact tabs, approvals, targeted regeneration, progress visibility, and persistence.    |

## 4.3 User Roles

| **Role ID** | **Role** | **Responsibilities**                                                    | **Permissions**                                                               | **Product Access**        |
| ----------- | -------- | ----------------------------------------------------------------------- | ----------------------------------------------------------------------------- | ------------------------- |
| ROLE-001    | User     | Create/manage film projects and use the AI workflow.                    | Access own projects, chats, assets, approvals, and supported project actions. | Standard studio workspace |
| ROLE-002    | Admin    | Manage and monitor the platform within authorized administrative scope. | Access approved administration, analytics, and management capabilities.       | Admin workspace           |

### 4.3.1 Role Principles

| **Principle**             | **Description**                                                                   |
| ------------------------- | --------------------------------------------------------------------------------- |
| User isolation            | A standard user can access only authorized resources.                             |
| Project ownership         | Projects and their assets remain tied to the owning user in the MVP.              |
| Administrative separation | Admin capabilities are distinct from standard film-production capabilities.       |
| Explicit authorization    | Admin functionality is available only to authorized Admin users.                  |
| Controlled access         | Projects, assets, chats, and administration follow defined permission boundaries. |

## 4.4 Administrative User

### 4.4.1 Administrative Profile, Responsibilities and Goals

| **Attribute**     | **Details**                                                                                                             |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Persona ID        | P-004                                                                                                                   |
| Persona Name      | Administrator                                                                                                           |
| User Type         | Administrative User                                                                                                     |
| Primary Purpose   | Manage and monitor the Agentic Film Studio platform.                                                                    |
| Primary Workspace | Administrative dashboard and authorized administration interfaces.                                                      |
| Responsibilities  | Monitor platform activity, review analytics, manage authorized resources, and perform permitted administrative actions. |
| Goals             | Maintain platform visibility, support operational oversight, and manage authorized resources.                           |
| Needs             | Secure admin access, clear permissions, analytics, management controls, and operational information.                    |

### 4.4.2 Administrative Usage, Outcomes and Access Boundaries

| **Area**          | **Requirement**                                                                                            |
| ----------------- | ---------------------------------------------------------------------------------------------------------- |
| Usage Context     | Admin primarily uses the administration area rather than the standard film-production workflow.            |
| Expected Outcomes | Admin can securely access authorized platform information and management actions.                          |
| Access Boundaries | Admin access is defined explicitly and does not imply unrestricted access to all user content.             |
| Authorization     | Only authorized Admin users can access admin functionality.                                                |
| Auditing          | Administrative actions and sensitive operations should be traceable where required by later product rules. |

# 5\. PRODUCT SCOPE

## 5.1 Core / MVP Features

| **ID**  | **Feature Area**  | **MVP Capability**                                                                                                   |
| ------- | ----------------- | -------------------------------------------------------------------------------------------------------------------- |
| MVP-001 | Authentication    | Landing page, Google login, logout, protected workspace.                                                             |
| MVP-002 | Projects          | Create, open, rename, delete, and select film projects.                                                              |
| MVP-003 | Workspace         | 25/50/25 layout with sidebar, central workspace, and folder manager.                                                 |
| MVP-004 | Chat              | Project-aware chat with text, file, and image input.                                                                 |
| MVP-005 | Tabs              | Permanent Chat tab plus closable artifact tabs.                                                                      |
| MVP-006 | Script Agent      | Generate, review, revise, version, and approve scripts.                                                              |
| MVP-007 | Character Agent   | Configure characters, references, generation, review, and regeneration.                                              |
| MVP-008 | Voiceover Agent   | Configure voices, edit dialogue, generate, preview, approve, and regenerate.                                         |
| MVP-009 | Video Agent       | Generate shots, track jobs, review per-shot, regenerate targeted shots, and handle background music where supported. |
| MVP-010 | Editor Agent      | Confirm and assemble approved clips into final video.                                                                |
| MVP-011 | Human-in-the-Loop | Review/approval checkpoints with feedback and regeneration.                                                          |
| MVP-012 | Persistence       | Persist chats, project state, artifacts, versions, and workflow state.                                               |
| MVP-013 | Asset Management  | Project-centered organization and artifact access.                                                                   |
| MVP-014 | CRUD              | Correct CRUD for core project/application data.                                                                      |
| MVP-015 | Responsive UI     | Usable responsive web experience for supported viewports.                                                            |

## 5.2 Secondary Features

| **ID**  | **Feature**              | **Purpose**                                              |
| ------- | ------------------------ | -------------------------------------------------------- |
| SEC-001 | Rich Charts              | Visual analytics for supported project/platform metrics. |
| SEC-002 | Dark Mode                | Alternative workspace theme.                             |
| SEC-003 | PDF/CSV Export           | Export reports or supported structured data.             |
| SEC-004 | Email Notifications      | Important asynchronous workflow notifications.           |
| SEC-005 | Admin Analytics          | Administrative platform analytics.                       |
| SEC-006 | Expanded Automated Tests | Broader unit/integration test coverage.                  |

## 5.3 Stretch Features

| **ID** | **Feature**             | **Scope**                                       |
| ------ | ----------------------- | ----------------------------------------------- |
| ST-001 | Real-Time Analytics     | Live analytics beyond core workflow progress.   |
| ST-002 | Multi-Tenant Support    | Multiple isolated organizations/tenants.        |
| ST-003 | Mobile PWA              | Installable mobile-oriented web experience.     |
| ST-004 | Production CI/CD        | Automated build, test, and deployment pipeline. |
| ST-005 | Model Drift Monitoring  | Track model behavior/quality changes over time. |
| ST-006 | Advanced Administration | Broader operational and auditing capabilities.  |

## 5.4 Future Possibilities

| **Future Area**                 | **Purpose**                                                  | **Scope Note**                                                           |
| ------------------------------- | ------------------------------------------------------------ | ------------------------------------------------------------------------ |
| Additional AI providers         | Support provider switching and experimentation.              | Provider details should not reshape the product workflow.                |
| Expanded media controls         | Add creative controls such as style, framing, or resolution. | Only after core workflow is stable.                                      |
| Advanced collaboration          | Shared projects and team workflows.                          | Future product expansion.                                                |
| Open-weight/self-hosted options | Enable additional model backends where appropriate.          | Requires separate model, infrastructure, licensing, and cost evaluation. |

# 6\. PRODUCT INFORMATION ARCHITECTURE

## 6.1 Application-Level Information Architecture

```
Public
  Landing -> Google Login
Authenticated
  Dashboard / Studio
    +-- Sidebar: chats / tools / profile
    +-- Center: chat / artifact tabs / reviews
    +-- Right: project folders / project artifacts
Admin
  Admin Dashboard (role-restricted)
```

## 6.2 Navigation Structure

| **Area**       | **Purpose**                                    | **Entry**        | **Primary Destination**  |
| -------------- | ---------------------------------------------- | ---------------- | ------------------------ |
| Landing        | Product introduction and authentication entry. | Public           | Google login             |
| Studio         | Film-production workspace.                     | Authenticated    | Chat, project, artifacts |
| Folder Manager | Project and asset navigation.                  | Studio           | Project contents         |
| Chat History   | Resume previous conversations.                 | Sidebar          | Selected conversation    |
| Profile        | Account information/preferences.               | Sidebar bottom   | Profile                  |
| Admin          | Platform administration.                       | Authorized users | Admin dashboard          |

## 6.3 Main Application Areas

| **Area**             | **Core Contents**                                                                     |
| -------------------- | ------------------------------------------------------------------------------------- |
| Left Sidebar         | New chat, current chats, past chats, tools, profile.                                  |
| Central Workspace    | Chat, prompts, uploads, agent messages, approvals, artifact tabs, previews, progress. |
| Right Folder Manager | Projects, active project, project contents, artifact access, final video.             |
| Profile              | Account details and supported preferences.                                            |
| Admin Workspace      | Authorized administration, analytics, and monitoring.                                 |

## 6.4 Project / Workspace Structure

```
Project Folder
  +-- Conversations
  +-- References
  +-- Script versions
  +-- Characters / character references
  +-- Voiceovers
  +-- Video clips / versions
  +-- Music / audio where applicable
  +-- Final video
  +-- Workflow history / approvals
```

## 6.5 Asset Organization

| **Asset Class** | **Purpose**                 | **Scope**              |
| --------------- | --------------------------- | ---------------------- |
| Reference file  | Source material or context. | Project                |
| Reference image | Visual guidance.            | Project or character   |
| Script          | Story/shot/dialogue plan.   | Project/version        |
| Character asset | Generated character visual. | Project/character      |
| Voiceover       | Generated dialogue audio.   | Project/character/shot |
| Video clip      | Generated shot output.      | Project/shot/version   |
| Final video     | Assembled film output.      | Project/final version  |

# 7\. USER JOURNEY / END-TO-END WORKFLOW

## 7.1 First-Time User Journey

| **Step** | **User Action**     | **System Response**                    | **Visible Result**                   |
| -------- | ------------------- | -------------------------------------- | ------------------------------------ |
| 1        | Open website        | Loads landing page.                    | Product information and login entry. |
| 2        | Select Google login | Starts authentication.                 | Authentication flow.                 |
| 3        | Complete login      | Validates identity and starts session. | Protected workspace opens.           |
| 4        | Open studio         | Loads dashboard layout.                | 25/50/25 workspace.                  |
| 5        | Create project      | Creates project folder.                | Project appears in folder manager.   |
| 6        | Start project chat  | Associates conversation with project.  | Agent interaction is ready.          |

## 7.2 Returning User Journey

A returning user should be able to sign in, reopen an existing project, see its current workflow state, continue any pending approval, inspect prior artifacts, and continue generation without recreating approved inputs.

## 7.3 Complete Film-Creation Journey

```
Create/select project
 -> Provide prompt + references + duration
 -> Script Agent
 -> Script Review
 -> Character Agent
 -> Character Review
 -> Voiceover Agent
 -> Voice Review / Edit
 -> Video Agent
 -> Parallel shot generation
 -> Per-shot Review / Regeneration
 -> Editor Agent
 -> Confirm final assembly
 -> Final Video
```

## 7.4 Workflow Resume Journey

| **Interruption**           | **Expected Behavior**                                                       |
| -------------------------- | --------------------------------------------------------------------------- |
| Refresh                    | Reload persisted project state; do not create duplicate workflow execution. |
| Browser close              | Persist workflow; asynchronous jobs may continue according to job policy.   |
| Logout                     | End session while preserving authorized project state.                      |
| Network loss               | Show connection state and prevent duplicate destructive actions.            |
| Return after approval wait | Restore pending approval and allow continuation.                            |
| Job failure                | Preserve successful outputs and show a recovery/retry path.                 |

# 8\. DETAILED UI / UX REQUIREMENTS

## 8.1 Landing Page

| **Component**       | **Requirement**                                             |
| ------------------- | ----------------------------------------------------------- |
| Hero                | Communicate product purpose and provide authentication CTA. |
| Product Information | Explain high-level workflow and capabilities.               |
| Login Entry         | Provide Google account login.                               |

## 8.2 Authentication

| **Component**   | **Requirement**                                         |
| --------------- | ------------------------------------------------------- |
| Loading         | Indicate login progress and prevent duplicate attempts. |
| Failure         | Show recoverable authentication error.                  |
| Protected Pages | Redirect or block unauthorized access.                  |
| Logout          | Return user to public/authentication state.             |

## 8.3 Main Dashboard

| **Component**    | **Requirement**                                                             |
| ---------------- | --------------------------------------------------------------------------- |
| Layout           | Desktop workspace uses 25% / 50% / 25% structure.                           |
| Persistent Areas | Sidebar, center workspace, and folder manager remain conceptually distinct. |
| Active Project   | Clearly identify the project currently controlling workflow context.        |

## 8.4 Left 25% Sidebar

| **Component** | **Requirement**                                                         |
| ------------- | ----------------------------------------------------------------------- |
| New Chat      | Start a new conversation.                                               |
| History       | Show current and prior accessible chats.                                |
| Tools         | Provide supported auxiliary tools.                                      |
| Profile       | Open profile page.                                                      |
| Collapse      | Collapse during artifact review when additional center focus is useful. |

## 8.5 Middle 50% Workspace

| **Component** | **Requirement**                                        |
| ------------- | ------------------------------------------------------ |
| Chat          | Primary interaction with the agent.                    |
| Tabs          | Show Chat plus open artifacts.                         |
| Composer      | Text input, file/image attachment, duration selector.  |
| Review        | Show structured artifact review and approval controls. |
| Progress      | Show agent/job status.                                 |

## 8.6 Right 25% Folder Manager

| **Component**   | **Requirement**                                   |
| --------------- | ------------------------------------------------- |
| Projects        | List/create/open project folders.                 |
| Active Project  | Highlight selected project.                       |
| Artifacts       | Show project contents.                            |
| Artifact Open   | Clicking artifact opens or focuses a central tab. |
| Project Actions | Rename/delete and other supported actions.        |

# 9\. WORKSPACE AND TAB SYSTEM

## 9.1 Primary Chat Tab

The Chat tab is always available and cannot be closed. It represents the ongoing conversational control surface for the active project.

## 9.2 Secondary Tabs

| **Tab Type** | **Purpose**                                      | **Closable** |
| ------------ | ------------------------------------------------ | ------------ |
| Script       | Review script and versions.                      | Yes          |
| Characters   | Review character setup and generated images.     | Yes          |
| Voiceover    | Review voice configuration, dialogue, and audio. | Yes          |
| Clips        | Review generated shots.                          | Yes          |
| Final Video  | Play the completed output.                       | Yes          |

## 9.3 Tab Creation Rules

| **Trigger**                        | **Behavior**                                              |
| ---------------------------------- | --------------------------------------------------------- |
| Artifact clicked in folder manager | Open a new tab or focus an existing tab for the artifact. |
| Artifact opened from chat          | Open/focus the corresponding tab.                         |
| Review requested                   | Focus the artifact and expose review controls.            |
| Repeated click                     | Do not create duplicate tabs for the same artifact view.  |

## 9.4 Tab Closing Rules

| **Rule**      | **Behavior**                                                                  |
| ------------- | ----------------------------------------------------------------------------- |
| Chat tab      | Cannot be closed.                                                             |
| Secondary tab | Closing only removes the view; it does not delete the artifact.               |
| Unsaved edits | Protect user changes with a clear save/discard decision where editing exists. |
| Reopen        | Artifact can be reopened from the project folder or chat.                     |

## 9.5 Active Tab Behavior

Exactly one central tab is active at a time. Switching tabs must not terminate or restart the underlying workflow.

## 9.6 Multiple Open Tabs

Users may keep several artifact tabs open. The interface should use horizontal scrolling, overflow handling, or another clear navigation pattern when the tab bar becomes full.

## 9.7 Responsive Behavior

| **Viewport**   | **Expected Behavior**                                                                      |
| -------------- | ------------------------------------------------------------------------------------------ |
| Desktop        | Full 25/50/25 workspace.                                                                   |
| Narrow desktop | Side panels may compress/collapse while preserving the central workspace.                  |
| Small screen   | Prioritize active chat/artifact content and convert side panels to collapsible navigation. |
| Tab overflow   | Use scrolling or an overflow menu.                                                         |

## 9.8 Review Mode

When the user enters a script, character, voiceover, or clip review, the normal chat-history sidebar can collapse. The left area then shows the focused agent conversation/review context, the center area focuses on the artifact, and the project folder manager remains available on the right.

# 10\. PROJECT / FOLDER MANAGEMENT

## 10.1 Create Project / Folder

Users can create a named project folder. The new project starts in a valid empty state and is immediately selectable.

## 10.2 Rename

Renaming changes the display name while preserving project identity, assets, conversations, versions, and workflow state.

## 10.3 Delete

Deletion must have clear scope and confirmation. Deletion must not occur accidentally through normal navigation.

## 10.4 Open

Opening a project loads its accessible project state, artifact list, chat context, and workflow status.

## 10.5 Active Project

The active project is explicit and controls the default context for new workflow actions.

## 10.6 Project Contents

The project contains conversations, references, script versions, character assets, voiceovers, clips, audio/music, and final video.

## 10.7 Asset Organization

Artifacts should be grouped by production stage and identify version/state where relevant.

## 10.8 Empty Project

An empty project shows an obvious starting action.

## 10.9 Duplicate Project

Not required for the core MVP; future implementation must define what is copied.

## 10.10 Project Deletion / Recovery

Production behavior must define confirmation, dependent-asset handling, retention, and recovery before rollout.

# 11\. CHAT SYSTEM

## 11.1 New Chat

Start a new project-aware conversation without silently inheriting unrelated project context.

## 11.2 Existing Chat

Reopen persisted messages and original project relationship.

## 11.3 Chat History

Show current and prior accessible conversations with consistent ordering and clear project association.

## 11.4 Message Types

Support user, agent, system, progress, approval, error, and artifact messages.

## 11.5 Attachments

Keep uploaded inputs associated with the message/action and project that uses them.

## 11.6 Message Editing

Not required for MVP; future behavior must define whether editing changes workflow execution or only visible text.

## 11.7 Message Retry

Expose recovery actions for failed agent operations without duplicating successful work.

## 11.8 Chat Persistence

Persist chats across refreshes and later sessions subject to lifecycle policy.

## 11.9 Chat-to-Project Association

Project context must be visible and must not leak across user/project boundaries.

# 12\. INPUT AND ATTACHMENT REQUIREMENTS

## 12.1 Text Input

| **Requirement**    | **Behavior**                                       |
| ------------------ | -------------------------------------------------- |
| Prompt entry       | Allow creative instruction.                        |
| Empty input        | Block submission when meaningful text is required. |
| Long input         | Avoid silent truncation of important content.      |
| Edit before submit | Allow correction before submission.                |

## 12.2 File Upload

| **Requirement**   | **Behavior**                                       |
| ----------------- | -------------------------------------------------- |
| Supported formats | Only defined formats are accepted.                 |
| Validation        | Check type, size, processability, and security.    |
| Progress          | Show meaningful upload status.                     |
| Failure           | Provide retry/remove action.                       |
| Association       | Keep the file tied to its intended project/action. |

## 12.3 Image Upload

| **Requirement** | **Behavior**                                      |
| --------------- | ------------------------------------------------- |
| Project image   | May guide overall visual direction.               |
| Character image | Linked to one specific character.                 |
| Preview         | User sees destination before upload is committed. |

## 12.4 Reference Images

| **Requirement**       | **Behavior**                                  |
| --------------------- | --------------------------------------------- |
| Project reference     | Applies to project-level context.             |
| Character reference   | Applies only to the selected character.       |
| Future shot reference | Can be supported later for shot-specific use. |

## 12.5 Character-Specific Images

| **Requirement**       | **Behavior**                                                          |
| --------------------- | --------------------------------------------------------------------- |
| Per-character control | Each character has an isolated upload area.                           |
| Association           | No image is silently attached to another character.                   |
| Downstream use        | Relevant character references are available to downstream generation. |

## 12.6 File Validation

| **Requirement** | **Behavior**                        |
| --------------- | ----------------------------------- |
| Type            | Reject unsupported files.           |
| Size            | Enforce product limit.              |
| Corruption      | Reject unreadable files.            |
| Security        | Apply appropriate screening.        |
| Extraction      | Clearly report extraction failures. |

## 12.7 Upload Progress

Show transfer/processing status for inputs that take meaningful time.

## 12.8 Upload Failure

Do not present incomplete uploads as usable artifacts; provide recovery.

## 12.9 Duplicate Files

Avoid confusing the user with silent replacement or ambiguous active references.

## 12.10 File Removal

Removing an input reference must not unexpectedly delete already-generated outputs.

# 13\. VIDEO CONFIGURATION

## 13.1 Duration

| **User Option** | **Meaning**              | **Planning Behavior**                                                |
| --------------- | ------------------------ | -------------------------------------------------------------------- |
| 15 seconds      | Target short-form video. | Plan generation units according to provider-supported clip duration. |
| 30 seconds      | Target short-form video. | Plan generation units according to provider-supported clip duration. |
| 1 minute        | Target one-minute video. | Plan generation units according to provider-supported clip duration. |
| 2 minutes       | Target two-minute video. | Plan generation units according to provider-supported clip duration. |

## 13.2 Reference Inputs

Prompt, files, and images can provide context. The system preserves which inputs were used so downstream agents can work from a stable project context.

## 13.3 Prompt

The user's prompt is the main creative instruction. It should remain available as project context and can influence downstream visual generation.

## 13.4 Future Parameters

| **Potential Parameter** | **Purpose**                          | **Initial Scope** |
| ----------------------- | ------------------------------------ | ----------------- |
| Aspect ratio            | Framing/output format.               | Future decision   |
| Resolution              | Output quality.                      | Future decision   |
| Visual style            | Additional creative direction.       | Future decision   |
| Language                | Dialogue/output language context.    | Future decision   |
| Other provider controls | Provider-specific creative settings. | Future decision   |

## 13.5 Duration-to-Shot Calculation

The product converts the selected target duration into a generation plan using the selected video's provider-supported clip duration. This keeps the workflow independent of a permanently hard-coded clip length.

**Current product rule**

The user-facing duration choices are 15 seconds, 30 seconds, 1 minute, and 2 minutes. The exact number of generation shots is derived from the configured provider's supported clip duration.

# 14\. AGENT WORKFLOW REQUIREMENTS

## 14.1 Overall Agent Workflow

```
Script Agent
  -> Script Review
  -> Character Generation Agent
  -> Character Review
  -> Voiceover Agent
  -> Voice Review
  -> Video Generation Agent
  -> Per-Shot Review
  -> Editor Agent
  -> Final Video
```

The workflow is logically continuous from the user's perspective. The underlying execution may pause at human approvals or asynchronous generation jobs. When paused, the workflow state must be persisted and resumed from the correct point.

## 14.2 Agent Responsibilities

| **Agent**       | **Responsibility**                                                                    | **Primary Output**         |
| --------------- | ------------------------------------------------------------------------------------- | -------------------------- |
| Script Agent    | Plan story and shots from prompt/references/duration.                                 | Structured script          |
| Character Agent | Define and generate project characters.                                               | Approved character visuals |
| Voiceover Agent | Configure and generate character dialogue audio.                                      | Approved voice assets      |
| Video Agent     | Generate shots using approved project context and supported audio/music capabilities. | Approved video shots       |
| Editor Agent    | Assemble approved clips into a final output.                                          | Final video                |

## 14.3 Agent Inputs

| **Input Class**    | **Product Context**                                        |
| ------------------ | ---------------------------------------------------------- |
| User instructions  | Prompt and requested revisions.                            |
| References         | Files and images.                                          |
| Approved artifacts | Approved upstream outputs.                                 |
| Project metadata   | Project identity, target duration, current workflow state. |
| Feedback           | User reasons for changes/rejection.                        |

## 14.4 Agent Outputs

| **Output Characteristic** | **Requirement**                                                  |
| ------------------------- | ---------------------------------------------------------------- |
| Artifact                  | Persisted and reviewable.                                        |
| State                     | Clearly shows processing/review/approved/failed condition.       |
| Version                   | Regenerated outputs are distinguishable.                         |
| User explanation          | Agent communicates what was created and what action is required. |

## 14.5 Agent Triggers

| **Trigger**                 | **Next Action**                                 |
| --------------------------- | ----------------------------------------------- |
| Initial project input       | Run Script Agent.                               |
| Script approved             | Run Character Agent.                            |
| Characters approved         | Run Voiceover Agent.                            |
| Voiceovers approved         | Run Video Agent.                                |
| All required clips approved | Run Editor Agent.                               |
| Final assembly confirmed    | Produce final video and mark workflow complete. |

## 14.6 Agent Dependencies

Downstream agents consume the current approved upstream artifacts. Rejected or superseded artifacts must not become downstream inputs accidentally.

## 14.7 Agent Questions to User

The agent communicates conversationally, but structured questions should use appropriate controls such as fields, dropdowns, upload components, previews, and approval actions.

## 14.8 Agent Decisions

Agents may decide how to perform their assigned production task, but creative acceptance, major revisions, and approval-gated progression remain under user control.

## 14.9 Human Approval Points

| **Stage**      | **Approval Scope**                   | **Feedback**                    |
| -------------- | ------------------------------------ | ------------------------------- |
| Script         | Whole current script version.        | Required for requested changes. |
| Characters     | Required character outputs.          | Required for rejected outputs.  |
| Voiceover      | Batch/segment review.                | Used for targeted regeneration. |
| Video          | Individual shots.                    | Required for rejected shots.    |
| Final Assembly | Confirmation to join approved clips. | Not a creative rewrite stage.   |

## 14.10 Retry Behavior

Technical retries and user-requested creative regeneration are distinct. Automatic retries should not create a new visible creative version unless necessary; user-driven regeneration should create a traceable new output.

## 14.11 Failure Behavior

Failure moves the affected stage into a recoverable state while preserving successful outputs from other stages or shots.

## 14.12 State Transitions

Forward transitions happen after completion/approval. Pauses happen for approvals or asynchronous jobs. Rejection moves the stage to revision/regeneration. Completion occurs only after the final output is successfully created and persisted.

# 15\. SCRIPT AGENT

## 15.1 Inputs

| **Input**         | **Use**                                    |
| ----------------- | ------------------------------------------ |
| Prompt            | Primary story instruction.                 |
| Reference file    | Additional story/factual/creative context. |
| Reference image   | Visual context.                            |
| Target duration   | Determines planned output duration.        |
| Revision feedback | Guides script regeneration.                |

## 15.2 Processing

The Script Agent interprets the prompt and references, identifies story elements and characters, structures the narrative into generation-ready shots, and allocates dialogue and visual descriptions according to the target duration and provider generation constraints.

## 15.3 Output

| **Component**            | **Requirement**                                  |
| ------------------------ | ------------------------------------------------ |
| Shot ID                  | Stable identifier used by downstream stages.     |
| Duration                 | Explicit allocation for the shot.                |
| Scene/visual description | What should happen visually.                     |
| Characters               | Characters appearing in the shot.                |
| Dialogue                 | Dialogue lines.                                  |
| Speaker                  | Character mapped to each line.                   |
| Continuity/context       | Important information for downstream generation. |

## 15.4 Script Review

The Script tab presents the generated script in a structured, readable view. The user can inspect the whole script and use Approve or Request Changes.

## 15.5 Rejection Flow

Request Changes requires user feedback. The previous version remains available.

## 15.6 Regeneration

The agent uses the previous script plus the user's feedback to create a new version while respecting the latest user direction.

## 15.7 Script Versioning

| **Rule**           | **Behavior**                                           |
| ------------------ | ------------------------------------------------------ |
| New version        | Each regeneration creates a distinguishable version.   |
| Current version    | One version is active for downstream use.              |
| History            | Prior versions remain traceable under lifecycle rules. |
| Downstream context | Uses the selected approved/current version.            |

## 15.8 Failure Cases

| **Failure**          | **Behavior**                                                  |
| -------------------- | ------------------------------------------------------------- |
| Unreadable reference | Report the failure and allow retry/removal.                   |
| Invalid input        | Prevent generation and request usable input.                  |
| Generation failure   | Preserve state and allow retry.                               |
| Conflicting sources  | Ask for clarification or apply a defined resolution behavior. |
| Repeated rejection   | Continue revision while preserving versions.                  |

# 16\. CHARACTER AGENT

## 16.1 Character Detection

Use the approved script to identify characters and pre-populate a character list for user confirmation.

## 16.2 Character Count

Allow the user to confirm, add, or remove characters without silently losing valid character data.

## 16.3 Character Naming

Give each character a stable project-level identity used by references, dialogue, and shots.

## 16.4 Character Description

Collect a description of appearance and behavior relevant to visual generation.

## 16.5 Character-Specific References

| **Requirement**      | **Behavior**                                                          |
| -------------------- | --------------------------------------------------------------------- |
| Per-character upload | Each character has a dedicated upload control.                        |
| Association          | Reference is tied only to the selected character.                     |
| Preview              | User can see reference ownership before generation.                   |
| Downstream use       | Relevant references are included for shots containing that character. |

## 16.6 Image Generation

Generate character visuals from approved descriptions and associated references.

## 16.7 Review

Present generated character outputs in the Characters tab and allow approval or change requests.

## 16.8 Regeneration

Regenerate only the affected character whenever possible.

## 16.9 Versioning

Keep distinguishable generations and identify the current approved version.

## 16.10 Character Consistency Requirements

| **Area**    | **Requirement**                                                   |
| ----------- | ----------------------------------------------------------------- |
| Identity    | Maintain recognizable identity when provider capabilities permit. |
| Appearance  | Approved appearance information remains downstream context.       |
| Association | Character references are never silently mixed.                    |
| Continuity  | Changes are traceable to a specific version.                      |

# 17\. VOICEOVER AGENT

## 17.1 Dialogue Extraction

Read the approved script and map dialogue to characters and shots.

## 17.2 Shot-by-Shot Organization

Present dialogue grouped by shot so that voice generation remains traceable.

## 17.3 Character Voice Selection

Allow voice configuration per character and preserve consistency across dialogue.

## 17.4 Voice Parameters

Expose only provider-supported voice controls and preserve the chosen settings.

## 17.5 Dialogue Editing

Allow the user to edit dialogue at the voiceover stage before generation; make it clear that this is a voiceover-stage edit.

## 17.6 Voice Generation

Generate audio segments linked to project, character, shot, and dialogue.

## 17.7 Playback / Preview

Provide play, pause/resume, identification, and targeted regeneration.

## 17.8 Batch Approval

Review by shot/segment or voiceover set rather than requiring yes/no approval for every dialogue line.

## 17.9 Regeneration

Regenerate only the affected segment, character, or shot where possible.

## 17.10 Voiceover Failures

| **Failure**             | **Expected Behavior**                               |
| ----------------------- | --------------------------------------------------- |
| Provider failure        | Recoverable error with retry.                       |
| Invalid voice option    | Prevent or clearly reject generation.               |
| Dialogue too long       | Explain constraint and provide correction.          |
| Missing speaker mapping | Block generation until mapping is resolved.         |
| Partial generation      | Preserve successful segments and retry failed ones. |

# 18\. VIDEO GENERATION AGENT

## 18.1 Inputs

| **Input**               | **Requirement**                                  |
| ----------------------- | ------------------------------------------------ |
| Approved script         | Shot story, characters, dialogue, visual intent. |
| Approved character data | Descriptions and visuals.                        |
| Character references    | Relevant visual references.                      |
| Voice/audio             | Use approved audio where provider supports it.   |
| User video prompt       | Creative/visual direction.                       |
| Shot data               | Specific shot content and duration context.      |

## 18.2 Shot Generation

Generate each required shot as an independently trackable unit using the configured provider.

## 18.3 Parallel Generation

Submit independent shot jobs concurrently where provider limits allow. Queue excess work rather than exceeding limits.

## 18.4 Job Tracking

Represent queued, processing, completed, failed, and cancelled states in a user-understandable way.

## 18.5 Progress

Show overall generation progress and per-shot status.

## 18.6 Individual Clip Review

Allow the user to play, approve, reject, and request regeneration for each shot.

## 18.7 Individual Regeneration

A rejected shot should be regenerated without unnecessarily invalidating approved shots.

## 18.8 Background Music

The Video Agent is responsible for background music as part of video generation where the selected provider supports it. Music must not interfere with dialogue.

## 18.9 Provider Failure

A provider failure affects the relevant shot/job, not already successful shots.

## 18.10 Rate Limits

Respect provider rate/concurrency limits; queue work when necessary.

## 18.11 Timeouts

Move timed-out jobs to a recoverable state rather than leaving them indefinitely processing.

## 18.12 Partial Completion

Completed shots remain reviewable while pending/failed shots remain actionable.

**Audio/video capability note**

The product assumes a video API capable of receiving or generating the audio needed for the intended Method A workflow. The final provider must be validated against dialogue/audio and background-music requirements before implementation.

# 19\. EDITOR AGENT

## 19.1 Final Assembly Trigger

After required shots are approved, ask the user to confirm that the approved clips should be joined.

## 19.2 Clip Ordering

Use the approved shot sequence from the script.

## 19.3 Joining

Assemble approved clips into one final playable output.

## 19.4 Audio Handling

Preserve audio generated with the clips and avoid accidental dialogue loss.

## 19.5 Music

Retain music provided in the approved video outputs during assembly.

## 19.6 Final Output

Persist one final video asset associated with the project.

## 19.7 Export

Make the final output retrievable from the project workspace.

## 19.8 Final Video Review

Open the final output in its own tab for playback and inspection; no additional mandatory approval is required in the core workflow.

## 19.9 Failure Recovery

Preserve all source clips and expose assembly retry if final creation fails.

# 20\. HUMAN-IN-THE-LOOP / APPROVAL SYSTEM

## 20.1 Approval Checkpoints

| **Checkpoint** | **Artifact**   | **Scope**                       |
| -------------- | -------------- | ------------------------------- |
| HITL-001       | Script         | Whole script version.           |
| HITL-002       | Characters     | Required character outputs.     |
| HITL-003       | Voiceover      | Batch/segment review.           |
| HITL-004       | Video          | Individual shot review.         |
| HITL-005       | Final Assembly | Confirm joining approved clips. |

## 20.2 Approval UI

Approval controls must be visually distinct from normal chat messages and available beside the artifact being reviewed.

## 20.3 Approval Action

Approve records acceptance and advances workflow; Open focuses the relevant artifact tab.

## 20.4 Rejection Action

Request Changes preserves the artifact and requires user feedback.

## 20.5 Required Feedback

Regeneration requests must include sufficient feedback to identify the intended change.

## 20.6 Regeneration

Create a new output/version and preserve the previous output.

## 20.7 Versioning

Current and prior outputs must remain distinguishable.

## 20.8 Workflow Transition After Approval

Approval advances exactly once.

## 20.9 Workflow Transition After Rejection

Rejection returns the stage to revision/regeneration and blocks downstream progression on the rejected artifact.

## 20.10 Duplicate / Repeated Actions

| **Scenario**         | **Behavior**                                                         |
| -------------------- | -------------------------------------------------------------------- |
| Double-click approve | Only one logical approval transition.                                |
| Repeated regenerate  | Track distinct generation attempts/versions.                         |
| Stale review view    | Revalidate current state before accepting action.                    |
| Conflicting tabs     | Use current valid project state and block stale destructive actions. |

# 21\. WORKFLOW STATE AND RESUME BEHAVIOR

## 21.1 Workflow States

| **State Category** | **Meaning**                                    |
| ------------------ | ---------------------------------------------- |
| Input              | Collecting/validating project inputs.          |
| Generating         | Agent/job is actively processing.              |
| Review             | User must inspect an artifact.                 |
| Waiting            | Paused for user action or external completion. |
| Revision           | User requested a change.                       |
| Failed             | Operation requires recovery.                   |
| Completed          | Stage/workflow successfully completed.         |

## 21.2 State Transitions

```
Input -> Script -> Review -> Characters -> Review -> Voiceover -> Review -> Video -> Review -> Editing -> Complete
                              ^             ^             ^
                              +--- revision / regeneration ---+
```

## 21.3 Browser Refresh

Reload persisted state without creating duplicate execution.

## 21.4 Browser Close

Persist state; asynchronous jobs may continue based on job policy.

## 21.5 Logout During Workflow

End session while preserving authorized project state.

## 21.6 Network Disconnect

Show connection state and reconcile with persisted state after reconnect.

## 21.7 Reopen Project

Display current state, pending actions, and job statuses.

## 21.8 Resume Workflow

Continue from the latest durable state using current approved artifacts.

## 21.9 Duplicate Execution Prevention

Prevent refreshes and repeated clicks from launching duplicate logical stage executions.

## 21.10 Stuck / Abandoned Workflow

Keep projects recoverable and define handling for stale jobs before production.

## 21.11 Long-Running Operations

Represent generation as asynchronous jobs rather than indefinitely blocking interactive requests.

# 22\. DATA AND PROJECT LIFECYCLE REQUIREMENTS

## 22.1 User Data

| **Data Aspect**    | **Requirement**                                        |
| ------------------ | ------------------------------------------------------ |
| Stored information | Identity, profile, and authentication linkage.         |
| Why it is stored   | Support authenticated access, profile, and ownership.  |
| Lifecycle          | Defined by project/account state and retention policy. |

## 22.2 Project Data

| **Data Aspect**    | **Requirement**                                        |
| ------------------ | ------------------------------------------------------ |
| Stored information | Project identity, name, status, dates, ownership.      |
| Why it is stored   | Support navigation, persistence, and workflow.         |
| Lifecycle          | Defined by project/account state and retention policy. |

## 22.3 Chat Data

| **Data Aspect**    | **Requirement**                                        |
| ------------------ | ------------------------------------------------------ |
| Stored information | Messages, message metadata, attachment references.     |
| Why it is stored   | Preserve conversations and workflow context.           |
| Lifecycle          | Defined by project/account state and retention policy. |

## 22.4 Script Data

| **Data Aspect**    | **Requirement**                                        |
| ------------------ | ------------------------------------------------------ |
| Stored information | Script versions, shots, dialogue, approval.            |
| Why it is stored   | Drive downstream character/voice/video stages.         |
| Lifecycle          | Defined by project/account state and retention policy. |

## 22.5 Character Data

| **Data Aspect**    | **Requirement**                                                               |
| ------------------ | ----------------------------------------------------------------------------- |
| Stored information | Character identity, descriptions, reference associations, generated versions. |
| Why it is stored   | Maintain character consistency.                                               |
| Lifecycle          | Defined by project/account state and retention policy.                        |

## 22.6 Voiceover Data

| **Data Aspect**    | **Requirement**                                        |
| ------------------ | ------------------------------------------------------ |
| Stored information | Voice settings, dialogue segments, audio assets.       |
| Why it is stored   | Drive audio review and video generation.               |
| Lifecycle          | Defined by project/account state and retention policy. |

## 22.7 Video Shot Data

| **Data Aspect**    | **Requirement**                                        |
| ------------------ | ------------------------------------------------------ |
| Stored information | Shot definitions, generation jobs, versions, approval. |
| Why it is stored   | Track parallel generation and review.                  |
| Lifecycle          | Defined by project/account state and retention policy. |

## 22.8 Final Video Data

| **Data Aspect**    | **Requirement**                                        |
| ------------------ | ------------------------------------------------------ |
| Stored information | Final output metadata and media location.              |
| Why it is stored   | Provide completed project deliverable.                 |
| Lifecycle          | Defined by project/account state and retention policy. |

## 22.9 Asset Data

| **Data Aspect**    | **Requirement**                                        |
| ------------------ | ------------------------------------------------------ |
| Stored information | Media metadata, file location, ownership, state.       |
| Why it is stored   | Manage actual files and relationships.                 |
| Lifecycle          | Defined by project/account state and retention policy. |

## 22.10 Workflow Run Data

| **Data Aspect**    | **Requirement**                                                       |
| ------------------ | --------------------------------------------------------------------- |
| Stored information | Current stage, pending action, job references, failure data, history. |
| Why it is stored   | Resume and troubleshoot long-running workflows.                       |
| Lifecycle          | Defined by project/account state and retention policy.                |

## 22.11 Approval Data

| **Data Aspect**    | **Requirement**                                               |
| ------------------ | ------------------------------------------------------------- |
| Stored information | Reviewed artifact/version, user action, feedback, transition. |
| Why it is stored   | Trace approvals and revisions.                                |
| Lifecycle          | Defined by project/account state and retention policy.        |

## 22.12 Storage Separation

| **Data Aspect**    | **Requirement**                                                                                                                  |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------- |
| Stored information | Application state versus large media objects.                                                                                    |
| Why it is stored   | MongoDB stores application data; Redis handles transient jobs; MinIO stores files locally, with S3 planned later for production. |
| Lifecycle          | Defined by project/account state and retention policy.                                                                           |

# 23\. NOTIFICATIONS AND PROGRESS

## 23.1 In-App Notifications

| **Event**              | **User Need**                                   | **Priority** |
| ---------------------- | ----------------------------------------------- | ------------ |
| Approval required      | Know that user action is blocking the workflow. | High         |
| Generation completed   | Know that an artifact is ready.                 | High         |
| Generation failed      | Know that recovery is needed.                   | High         |
| Final video ready      | Know that the project reached completion.       | High         |
| General project update | Stay aware of relevant non-blocking changes.    | Medium       |

## 23.2 Email Notifications

Optional notification channel for important asynchronous events.

## 23.3 Progress Indicators

Distinguish queued, processing, waiting for approval, completed, and failed states.

## 23.4 Agent Status

Identify current stage, completed stages, and pending next action.

## 23.5 Generation Status

Show both overall project progress and per-shot status.

## 23.6 Completion Notifications

Link users to the relevant project/artifact rather than only showing a generic message.

## 23.7 Failure Notifications

Identify affected stage/artifact and provide recovery where possible.

# 24\. DASHBOARD AND ANALYTICS REQUIREMENTS

## 24.1 User Dashboard

Provide project overview, recent chats, current workflow, recent artifacts, and progress.

## 24.2 Project Overview

Summarize workflow stage, overall progress, approved outputs, and next user action.

## 24.3 Agent Activity

Show current agent, completed stages, blocked stage, and recent activity.

## 24.4 Generation Jobs

Make job progress and required user actions understandable.

## 24.5 Recent Assets

Provide shortcuts to recent artifacts without changing their project ownership.

## 24.6 Charts

Support rich charts as a secondary feature for defined metrics.

## 24.7 Real-Time Progress

Provide live/near-live job updates when practical.

## 24.8 Admin Analytics

Provide authorized platform-level analytics such as activity, project counts, workflow stages, job status, and other defined metrics.

# 25\. PROFILE AND ACCOUNT

## 25.1 Profile Page

Accessible from the bottom of the sidebar.

## 25.2 Profile Information

Display available authenticated account information such as name, email, and profile image.

## 25.3 Preferences

May include theme and notification preferences; exact settings are finalized with the product.

## 25.4 Account Actions

Logout and supported account-management actions.

## 25.5 Logout

Terminate protected access and return to a public/authentication state.

## 25.6 Account Deletion

If implemented, clearly define impact on projects, files, workflow state, and retained records.

# 26\. SEARCH AND NAVIGATION

## 26.1 Search Projects

Allow users to find accessible projects by supported metadata.

## 26.2 Search Chats

Allow users to locate prior conversations while respecting authorization boundaries.

## 26.3 Search Assets

Allow users to find artifacts within authorized project scope.

## 26.4 Sort

Support consistent sorting by relevant metadata such as updated time, creation time, name, or status where applicable.

## 26.5 Filter

Support defined filters such as project state or artifact type when available.

## 26.6 Recent Items

Provide shortcuts to recently accessed/changed projects, chats, and artifacts.

# 27\. FUNCTIONAL REQUIREMENTS

The following consolidated requirements capture major product behavior and provide a basis for later acceptance testing and TDD traceability.

| **Req ID** | **Area**       | **Requirement**                                                    | **Priority** |
| ---------- | -------------- | ------------------------------------------------------------------ | ------------ |
| FR-001     | Authentication | User can sign in through Google.                                   | High         |
| FR-002     | Authentication | Protected workspace content requires authentication.               | High         |
| FR-003     | Authentication | User can log out.                                                  | High         |
| FR-004     | Project        | User can create a project folder.                                  | High         |
| FR-005     | Project        | User can open an accessible project.                               | High         |
| FR-006     | Project        | User can rename a project.                                         | High         |
| FR-007     | Project        | User can perform safe project deletion.                            | High         |
| FR-008     | Project        | System identifies the active project.                              | High         |
| FR-009     | Chat           | System supports project-aware conversations.                       | High         |
| FR-010     | Chat           | Chat history persists.                                             | High         |
| FR-011     | Chat           | User can enter text.                                               | High         |
| FR-012     | Chat           | User can attach supported files.                                   | High         |
| FR-013     | Chat           | User can attach supported images.                                  | High         |
| FR-014     | Workspace      | System provides 25/50/25 layout on supported desktop widths.       | High         |
| FR-015     | Workspace      | Primary Chat tab is always present.                                | High         |
| FR-016     | Workspace      | Artifacts can open in secondary tabs.                              | High         |
| FR-017     | Workspace      | Closing a secondary tab does not delete its artifact.              | High         |
| FR-018     | Workspace      | Review mode focuses artifact and agent context.                    | High         |
| FR-019     | Script         | Script Agent consumes prompt and references.                       | High         |
| FR-020     | Script         | Script Agent generates duration-aware shot structure.              | High         |
| FR-021     | Script         | Script Agent maps dialogue to speakers.                            | High         |
| FR-022     | Script         | User can review generated script.                                  | High         |
| FR-023     | Script         | User can approve script.                                           | High         |
| FR-024     | Script         | User can request script changes with feedback.                     | High         |
| FR-025     | Script         | Script regeneration creates a distinguishable version.             | High         |
| FR-026     | Character      | Character Agent uses approved script.                              | High         |
| FR-027     | Character      | User can define characters.                                        | High         |
| FR-028     | Character      | User can define character appearance.                              | High         |
| FR-029     | Character      | User can upload character-specific references.                     | High         |
| FR-030     | Character      | Character reference associations remain isolated.                  | High         |
| FR-031     | Character      | Character Agent generates visual character outputs.                | High         |
| FR-032     | Character      | User can review character outputs.                                 | High         |
| FR-033     | Character      | Character regeneration targets the affected character.             | High         |
| FR-034     | Voice          | Voiceover Agent consumes approved script dialogue.                 | High         |
| FR-035     | Voice          | User can configure voice per character.                            | High         |
| FR-036     | Voice          | User can review dialogue by shot/segment.                          | High         |
| FR-037     | Voice          | User can edit dialogue before voice generation.                    | High         |
| FR-038     | Voice          | System generates voiceover assets.                                 | High         |
| FR-039     | Voice          | System supports batch/segment-level voice review.                  | High         |
| FR-040     | Voice          | Voice regeneration is targeted where possible.                     | High         |
| FR-041     | Video          | Video Agent uses approved project context automatically.           | High         |
| FR-042     | Video          | Video Agent generates individual shots.                            | High         |
| FR-043     | Video          | Independent shot jobs may run concurrently within provider limits. | High         |
| FR-044     | Video          | System shows per-shot generation status.                           | High         |
| FR-045     | Video          | User can review each generated shot.                               | High         |
| FR-046     | Video          | User can reject and regenerate an individual shot.                 | High         |
| FR-047     | Video          | Video Agent handles background music where supported.              | High         |
| FR-048     | Editor         | Editor asks for final assembly confirmation.                       | High         |
| FR-049     | Editor         | Editor joins approved clips in shot order.                         | High         |
| FR-050     | Editor         | System stores the final video.                                     | High         |
| FR-051     | Workflow       | Workflow state is persisted at major transitions.                  | High         |
| FR-052     | Workflow       | Unfinished projects resume from persisted state.                   | High         |
| FR-053     | Workflow       | Repeated actions do not cause duplicate logical transitions.       | High         |
| FR-054     | Workflow       | Successful outputs are preserved when another job fails.           | High         |
| FR-055     | Assets         | Assets are associated with the owning project.                     | High         |
| FR-056     | Assets         | Regenerated assets are versioned.                                  | High         |
| FR-057     | Review         | Regeneration requests require user feedback.                       | High         |
| FR-058     | Review         | Approval actions are idempotent.                                   | High         |
| FR-059     | Profile        | User can open profile page.                                        | High         |
| FR-060     | Profile        | Profile shows available account information.                       | High         |
| FR-061     | Admin          | Admin functionality is role-restricted.                            | High         |
| FR-062     | Notifications  | System communicates important workflow/generation state.           | High         |
| FR-063     | Performance    | Dashboard meets defined load target.                               | High         |
| FR-064     | Responsive     | Core workspace remains usable on supported viewports.              | High         |
| FR-065     | Reports        | System generates supported reports.                                | High         |
| FR-066     | CRUD           | Core records persist and retrieve correctly.                       | High         |
| FR-067     | Security       | User cannot access another user's private project assets.          | High         |
| FR-068     | Errors         | Supported generation failures expose recovery actions.             | High         |
| FR-069     | Files          | Unsupported/invalid uploads are rejected.                          | High         |
| FR-070     | Navigation     | Folder manager provides artifact access.                           | High         |

# 28\. NON-FUNCTIONAL REQUIREMENTS

## 28.1 Performance

| **ID**       | **Area**    | **Requirement**                                                                   | **Validation**   |
| ------------ | ----------- | --------------------------------------------------------------------------------- | ---------------- |
| NFR-PERF-001 | Performance | Dashboard load should be less than 2 seconds under defined evaluation conditions. | Performance test |
| NFR-PERF-002 | Performance | Long-running generation should not freeze the main UI.                            | UX/job test      |

## 28.2 Security

| **ID**      | **Area** | **Requirement**                                           | **Validation**     |
| ----------- | -------- | --------------------------------------------------------- | ------------------ |
| NFR-SEC-001 | Security | Protected product content requires authentication.        | Security test      |
| NFR-SEC-002 | Security | Resources are accessible only within defined permissions. | Authorization test |
| NFR-SEC-003 | Security | Provider credentials are never exposed to the client.     | Security review    |

## 28.3 Reliability

| **ID**      | **Area**    | **Requirement**                                                            | **Validation**          |
| ----------- | ----------- | -------------------------------------------------------------------------- | ----------------------- |
| NFR-REL-001 | Reliability | Valid project state survives routine application restarts.                 | Recovery test           |
| NFR-REL-002 | Reliability | Recoverable failures expose a retry/recovery path.                         | Failure test            |
| NFR-REL-003 | Reliability | Repeated actions are idempotent where the user expects one logical action. | Replay/concurrency test |

## 28.4 Scalability

| **ID**       | **Area**    | **Requirement**                                                                    | **Validation** |
| ------------ | ----------- | ---------------------------------------------------------------------------------- | -------------- |
| NFR-SCAL-001 | Scalability | System can coordinate multiple independent generation jobs within provider limits. | Job/load test  |

## 28.5 Availability

User-facing services should provide stable access during normal supported operation, with environment-specific availability objectives defined during production planning.

## 28.6 Maintainability

| **ID**       | **Area**        | **Requirement**                                                              | **Validation**      |
| ------------ | --------------- | ---------------------------------------------------------------------------- | ------------------- |
| NFR-MAIN-001 | Maintainability | Application responsibilities are separated so product changes are localized. | Architecture review |
| NFR-MAIN-002 | Maintainability | AI provider-specific behavior does not redefine the user workflow.           | Architecture review |

## 28.7 Accessibility

| **ID**      | **Area**      | **Requirement**                                             | **Validation**     |
| ----------- | ------------- | ----------------------------------------------------------- | ------------------ |
| NFR-ACC-001 | Accessibility | Core interactions are usable without mouse-only input.      | Accessibility test |
| NFR-ACC-002 | Accessibility | Status and approval meaning is not conveyed by color alone. | UX review          |

## 28.8 Responsiveness

| **ID**       | **Area**       | **Requirement**                                                            | **Validation**  |
| ------------ | -------------- | -------------------------------------------------------------------------- | --------------- |
| NFR-RESP-001 | Responsiveness | 25/50/25 workspace remains usable on supported desktop widths.             | Responsive test |
| NFR-RESP-002 | Responsiveness | Small screens retain access to core functions through adaptive navigation. | Responsive test |

## 28.9 Observability

| **ID**      | **Area**      | **Requirement**                                     | **Validation** |
| ----------- | ------------- | --------------------------------------------------- | -------------- |
| NFR-OBS-001 | Observability | Important job/workflow states are visible to users. | UI review      |

## 28.10 Data Integrity

| **ID**     | **Area**       | **Requirement**                                                  | **Validation** |
| ---------- | -------------- | ---------------------------------------------------------------- | -------------- |
| NFR-DI-001 | Data Integrity | Assets remain linked to the correct project, character, or shot. | Integrity test |
| NFR-DI-002 | Data Integrity | Current and historical versions remain distinguishable.          | Lifecycle test |

## 28.11 Privacy

| **ID**      | **Area** | **Requirement**                                              | **Validation** |
| ----------- | -------- | ------------------------------------------------------------ | -------------- |
| NFR-PRV-001 | Privacy  | Only necessary personal/project data is stored.              | Privacy review |
| NFR-PRV-002 | Privacy  | Defined deletion behavior can be applied to applicable data. | Lifecycle test |

# 29\. SECURITY AND PRIVACY REQUIREMENTS

## 29.1 Authentication

Use Google sign-in for the primary authentication flow and protect authenticated routes.

## 29.2 Authorization

Enforce authorization for every project, asset, chat, and administrative action.

## 29.3 Project Ownership

Projects belong to their owner in the MVP.

## 29.4 File Access

Private project media must not be publicly accessible by default.

## 29.5 API Key Protection

External AI and infrastructure credentials stay server-side.

## 29.6 User Data Isolation

No cross-user leakage of projects, chats, assets, or workflow state.

## 29.7 File Validation

Validate file type, size, processability, and relevant security concerns.

## 29.8 Rate Limiting

Protect expensive operations from accidental or abusive repetition.

## 29.9 Session Security

Use secure session behavior and invalidate protected access on logout/expiry.

## 29.10 Data Deletion

Define deletion behavior for users, projects, files, and dependent data.

## 29.11 Privacy

Use user content according to product needs and applicable AI-provider/deployment policies.

## 29.12 Security Failure Scenarios

| **Scenario**                 | **Expected Behavior**                                 |
| ---------------------------- | ----------------------------------------------------- |
| Unauthorized project access  | Deny request and disclose no protected content.       |
| Invalid session              | Require authentication again.                         |
| Malformed upload             | Reject safely.                                        |
| Credential exposure attempt  | Do not reveal provider credentials.                   |
| Repeated generation requests | Apply safeguards and avoid unintended duplicate jobs. |
| Unauthorized admin access    | Block admin functionality.                            |

# 30\. ERROR AND EDGE-CASE CATALOG

## 30.1 Authentication Edge Cases

| **Edge ID** | **Scenario**           | **Expected System Behavior**                                  | **User-Visible Behavior**                          | **Recovery** | **Severity / Priority** |
| ----------- | ---------------------- | ------------------------------------------------------------- | -------------------------------------------------- | ------------ | ----------------------- |
| 30.1-E001   | User cancels login     | Expected safe and recoverable behavior is defined and tested. | Clear user-visible state/recovery where applicable |              |                         |
| 30.1-E002   | Callback failure       | Expected safe and recoverable behavior is defined and tested. | Clear user-visible state/recovery where applicable |              |                         |
| 30.1-E003   | Expired session        | Expected safe and recoverable behavior is defined and tested. | Clear user-visible state/recovery where applicable |              |                         |
| 30.1-E004   | Revoked account access | Expected safe and recoverable behavior is defined and tested. | Clear user-visible state/recovery where applicable |              |                         |

## 30.2 Upload Edge Cases

| **Edge ID** | **Scenario**       | **Expected System Behavior**                                  | **User-Visible Behavior**                          | **Recovery** | **Severity / Priority** |
| ----------- | ------------------ | ------------------------------------------------------------- | -------------------------------------------------- | ------------ | ----------------------- |
| 30.2-E001   | Unsupported file   | Expected safe and recoverable behavior is defined and tested. | Clear user-visible state/recovery where applicable |              |                         |
| 30.2-E002   | Oversized file     | Expected safe and recoverable behavior is defined and tested. | Clear user-visible state/recovery where applicable |              |                         |
| 30.2-E003   | Corrupted file     | Expected safe and recoverable behavior is defined and tested. | Clear user-visible state/recovery where applicable |              |                         |
| 30.2-E004   | Interrupted upload | Expected safe and recoverable behavior is defined and tested. | Clear user-visible state/recovery where applicable |              |                         |
| 30.2-E005   | Duplicate upload   | Expected safe and recoverable behavior is defined and tested. | Clear user-visible state/recovery where applicable |              |                         |
| 30.2-E006   | Processing failure | Expected safe and recoverable behavior is defined and tested. | Clear user-visible state/recovery where applicable |              |                         |

## 30.3 Script Agent Edge Cases

| **Edge ID** | **Scenario**                | **Expected System Behavior**                                  | **User-Visible Behavior**                          | **Recovery** | **Severity / Priority** |
| ----------- | --------------------------- | ------------------------------------------------------------- | -------------------------------------------------- | ------------ | ----------------------- |
| 30.3-E001   | Empty prompt                | Expected safe and recoverable behavior is defined and tested. | Clear user-visible state/recovery where applicable |              |                         |
| 30.3-E002   | Unreadable reference        | Expected safe and recoverable behavior is defined and tested. | Clear user-visible state/recovery where applicable |              |                         |
| 30.3-E003   | Conflicting source material | Expected safe and recoverable behavior is defined and tested. | Clear user-visible state/recovery where applicable |              |                         |
| 30.3-E004   | Generation timeout          | Expected safe and recoverable behavior is defined and tested. | Clear user-visible state/recovery where applicable |              |                         |
| 30.3-E005   | Repeated rejection          | Expected safe and recoverable behavior is defined and tested. | Clear user-visible state/recovery where applicable |              |                         |
| 30.3-E006   | Provider failure            | Expected safe and recoverable behavior is defined and tested. | Clear user-visible state/recovery where applicable |              |                         |

## 30.4 Character Agent Edge Cases

| **Edge ID** | **Scenario**              | **Expected System Behavior**                                  | **User-Visible Behavior**                          | **Recovery** | **Severity / Priority** |
| ----------- | ------------------------- | ------------------------------------------------------------- | -------------------------------------------------- | ------------ | ----------------------- |
| 30.4-E001   | No usable characters      | Expected safe and recoverable behavior is defined and tested. | Clear user-visible state/recovery where applicable |              |                         |
| 30.4-E002   | Duplicate character names | Expected safe and recoverable behavior is defined and tested. | Clear user-visible state/recovery where applicable |              |                         |
| 30.4-E003   | Missing reference         | Expected safe and recoverable behavior is defined and tested. | Clear user-visible state/recovery where applicable |              |                         |
| 30.4-E004   | Invalid image             | Expected safe and recoverable behavior is defined and tested. | Clear user-visible state/recovery where applicable |              |                         |
| 30.4-E005   | Generation failure        | Expected safe and recoverable behavior is defined and tested. | Clear user-visible state/recovery where applicable |              |                         |
| 30.4-E006   | Consistency issue         | Expected safe and recoverable behavior is defined and tested. | Clear user-visible state/recovery where applicable |              |                         |

## 30.5 Voiceover Agent Edge Cases

| **Edge ID** | **Scenario**             | **Expected System Behavior**                                  | **User-Visible Behavior**                          | **Recovery** | **Severity / Priority** |
| ----------- | ------------------------ | ------------------------------------------------------------- | -------------------------------------------------- | ------------ | ----------------------- |
| 30.5-E001   | Missing speaker          | Expected safe and recoverable behavior is defined and tested. | Clear user-visible state/recovery where applicable |              |                         |
| 30.5-E002   | Unsupported voice option | Expected safe and recoverable behavior is defined and tested. | Clear user-visible state/recovery where applicable |              |                         |
| 30.5-E003   | Audio failure            | Expected safe and recoverable behavior is defined and tested. | Clear user-visible state/recovery where applicable |              |                         |
| 30.5-E004   | Dialogue length mismatch | Expected safe and recoverable behavior is defined and tested. | Clear user-visible state/recovery where applicable |              |                         |
| 30.5-E005   | Partial generation       | Expected safe and recoverable behavior is defined and tested. | Clear user-visible state/recovery where applicable |              |                         |
| 30.5-E006   | Repeated regeneration    | Expected safe and recoverable behavior is defined and tested. | Clear user-visible state/recovery where applicable |              |                         |

## 30.6 Video Agent Edge Cases

| **Edge ID** | **Scenario**                    | **Expected System Behavior**                                  | **User-Visible Behavior**                          | **Recovery** | **Severity / Priority** |
| ----------- | ------------------------------- | ------------------------------------------------------------- | -------------------------------------------------- | ------------ | ----------------------- |
| 30.6-E001   | Provider unavailable            | Expected safe and recoverable behavior is defined and tested. | Clear user-visible state/recovery where applicable |              |                         |
| 30.6-E002   | Rate limit                      | Expected safe and recoverable behavior is defined and tested. | Clear user-visible state/recovery where applicable |              |                         |
| 30.6-E003   | Timeout                         | Expected safe and recoverable behavior is defined and tested. | Clear user-visible state/recovery where applicable |              |                         |
| 30.6-E004   | Partial completion              | Expected safe and recoverable behavior is defined and tested. | Clear user-visible state/recovery where applicable |              |                         |
| 30.6-E005   | Single-shot failure             | Expected safe and recoverable behavior is defined and tested. | Clear user-visible state/recovery where applicable |              |                         |
| 30.6-E006   | Audio/music capability mismatch | Expected safe and recoverable behavior is defined and tested. | Clear user-visible state/recovery where applicable |              |                         |

## 30.7 Workflow Edge Cases

| **Edge ID** | **Scenario**              | **Expected System Behavior**                                  | **User-Visible Behavior**                          | **Recovery** | **Severity / Priority** |
| ----------- | ------------------------- | ------------------------------------------------------------- | -------------------------------------------------- | ------------ | ----------------------- |
| 30.7-E001   | Refresh during generation | Expected safe and recoverable behavior is defined and tested. | Clear user-visible state/recovery where applicable |              |                         |
| 30.7-E002   | Browser close             | Expected safe and recoverable behavior is defined and tested. | Clear user-visible state/recovery where applicable |              |                         |
| 30.7-E003   | Logout during approval    | Expected safe and recoverable behavior is defined and tested. | Clear user-visible state/recovery where applicable |              |                         |
| 30.7-E004   | Stale review              | Expected safe and recoverable behavior is defined and tested. | Clear user-visible state/recovery where applicable |              |                         |
| 30.7-E005   | Duplicate transition      | Expected safe and recoverable behavior is defined and tested. | Clear user-visible state/recovery where applicable |              |                         |
| 30.7-E006   | Abandoned project         | Expected safe and recoverable behavior is defined and tested. | Clear user-visible state/recovery where applicable |              |                         |

## 30.8 Storage Edge Cases

| **Edge ID** | **Scenario**                       | **Expected System Behavior**                                  | **User-Visible Behavior**                          | **Recovery** | **Severity / Priority** |
| ----------- | ---------------------------------- | ------------------------------------------------------------- | -------------------------------------------------- | ------------ | ----------------------- |
| 30.8-E001   | Object missing                     | Expected safe and recoverable behavior is defined and tested. | Clear user-visible state/recovery where applicable |              |                         |
| 30.8-E002   | Upload succeeds but metadata fails | Expected safe and recoverable behavior is defined and tested. | Clear user-visible state/recovery where applicable |              |                         |
| 30.8-E003   | Metadata succeeds but upload fails | Expected safe and recoverable behavior is defined and tested. | Clear user-visible state/recovery where applicable |              |                         |
| 30.8-E004   | Expired temporary access           | Expected safe and recoverable behavior is defined and tested. | Clear user-visible state/recovery where applicable |              |                         |

## 30.9 Database Edge Cases

| **Edge ID** | **Scenario**   | **Expected System Behavior**                                  | **User-Visible Behavior**                          | **Recovery** | **Severity / Priority** |
| ----------- | -------------- | ------------------------------------------------------------- | -------------------------------------------------- | ------------ | ----------------------- |
| 30.9-E001   | Read failure   | Expected safe and recoverable behavior is defined and tested. | Clear user-visible state/recovery where applicable |              |                         |
| 30.9-E002   | Write conflict | Expected safe and recoverable behavior is defined and tested. | Clear user-visible state/recovery where applicable |              |                         |
| 30.9-E003   | Partial write  | Expected safe and recoverable behavior is defined and tested. | Clear user-visible state/recovery where applicable |              |                         |
| 30.9-E004   | Stale update   | Expected safe and recoverable behavior is defined and tested. | Clear user-visible state/recovery where applicable |              |                         |

## 30.10 Network Edge Cases

| **Edge ID** | **Scenario**                   | **Expected System Behavior**                                  | **User-Visible Behavior**                          | **Recovery** | **Severity / Priority** |
| ----------- | ------------------------------ | ------------------------------------------------------------- | -------------------------------------------------- | ------------ | ----------------------- |
| 30.10-E001  | Connection loss                | Expected safe and recoverable behavior is defined and tested. | Clear user-visible state/recovery where applicable |              |                         |
| 30.10-E002  | Request timeout                | Expected safe and recoverable behavior is defined and tested. | Clear user-visible state/recovery where applicable |              |                         |
| 30.10-E003  | Provider network failure       | Expected safe and recoverable behavior is defined and tested. | Clear user-visible state/recovery where applicable |              |                         |
| 30.10-E004  | Reconnect while job is running | Expected safe and recoverable behavior is defined and tested. | Clear user-visible state/recovery where applicable |              |                         |

## 30.11 UI Edge Cases

| **Edge ID** | **Scenario**            | **Expected System Behavior**                                  | **User-Visible Behavior**                          | **Recovery** | **Severity / Priority** |
| ----------- | ----------------------- | ------------------------------------------------------------- | -------------------------------------------------- | ------------ | ----------------------- |
| 30.11-E001  | Tab overflow            | Expected safe and recoverable behavior is defined and tested. | Clear user-visible state/recovery where applicable |              |                         |
| 30.11-E002  | Sidebar collapse        | Expected safe and recoverable behavior is defined and tested. | Clear user-visible state/recovery where applicable |              |                         |
| 30.11-E003  | Empty state             | Expected safe and recoverable behavior is defined and tested. | Clear user-visible state/recovery where applicable |              |                         |
| 30.11-E004  | Long message            | Expected safe and recoverable behavior is defined and tested. | Clear user-visible state/recovery where applicable |              |                         |
| 30.11-E005  | Large preview           | Expected safe and recoverable behavior is defined and tested. | Clear user-visible state/recovery where applicable |              |                         |
| 30.11-E006  | Responsive layout issue | Expected safe and recoverable behavior is defined and tested. | Clear user-visible state/recovery where applicable |              |                         |

## 30.12 Concurrency Edge Cases

| **Edge ID** | **Scenario**             | **Expected System Behavior**                                  | **User-Visible Behavior**                          | **Recovery** | **Severity / Priority** |
| ----------- | ------------------------ | ------------------------------------------------------------- | -------------------------------------------------- | ------------ | ----------------------- |
| 30.12-E001  | Repeated approval clicks | Expected safe and recoverable behavior is defined and tested. | Clear user-visible state/recovery where applicable |              |                         |
| 30.12-E002  | Repeated regeneration    | Expected safe and recoverable behavior is defined and tested. | Clear user-visible state/recovery where applicable |              |                         |
| 30.12-E003  | Parallel job saturation  | Expected safe and recoverable behavior is defined and tested. | Clear user-visible state/recovery where applicable |              |                         |
| 30.12-E004  | Conflicting updates      | Expected safe and recoverable behavior is defined and tested. | Clear user-visible state/recovery where applicable |              |                         |

## 30.13 User-Behavior Edge Cases

| **Edge ID** | **Scenario**                | **Expected System Behavior**                                  | **User-Visible Behavior**                          | **Recovery** | **Severity / Priority** |
| ----------- | --------------------------- | ------------------------------------------------------------- | -------------------------------------------------- | ------------ | ----------------------- |
| 30.13-E001  | User changes active project | Expected safe and recoverable behavior is defined and tested. | Clear user-visible state/recovery where applicable |              |                         |
| 30.13-E002  | User closes artifact tab    | Expected safe and recoverable behavior is defined and tested. | Clear user-visible state/recovery where applicable |              |                         |
| 30.13-E003  | User navigates away         | Expected safe and recoverable behavior is defined and tested. | Clear user-visible state/recovery where applicable |              |                         |
| 30.13-E004  | Repeated rejection          | Expected safe and recoverable behavior is defined and tested. | Clear user-visible state/recovery where applicable |              |                         |
| 30.13-E005  | Long gap before returning   | Expected safe and recoverable behavior is defined and tested. | Clear user-visible state/recovery where applicable |              |                         |

# 31\. PERMISSIONS AND OWNERSHIP

## 31.1 Ownership Model

Each project and its associated assets are owned by a user account in the MVP. Administrative access is separately role-controlled.

## 31.2 User Permissions

| **Resource**          | **User Access**                                              |
| --------------------- | ------------------------------------------------------------ |
| Own projects          | Create/view/update/manage/delete according to defined rules. |
| Own chats             | Create/view/continue/manage.                                 |
| Own assets            | View/manage through project workflows.                       |
| Other users' projects | No access.                                                   |
| Admin functions       | No access.                                                   |

## 31.3 Project Permissions

Project actions are restricted to the owning user in the MVP.

## 31.4 Asset Permissions

Assets inherit project authorization in the MVP.

## 31.5 Chat Permissions

Chat access follows project/user authorization.

## 31.6 Admin Permissions

Admin functions are limited to authorized administrative capabilities.

## 31.7 Cross-User Isolation

| **Isolation Rule** | **Expected Outcome**                                |
| ------------------ | --------------------------------------------------- |
| Project isolation  | A user cannot view another user's project.          |
| Asset isolation    | A user cannot fetch another user's private media.   |
| Chat isolation     | A user cannot access another user's conversation.   |
| Admin isolation    | Standard users cannot access admin-only operations. |

# 32\. REPORTS AND EXPORT

## 32.1 Report Types

| **Report Type**       | **Purpose**                                        | **Scope**      |
| --------------------- | -------------------------------------------------- | -------------- |
| Project report        | Summarize project status and production artifacts. | Required       |
| Generation report     | Summarize generation jobs and outcomes.            | Secondary      |
| Administrative report | Provide platform-level management information.     | Admin / future |

## 32.2 Report Contents

Use persisted project/application information; exact fields are finalized with reporting requirements.

## 32.3 Report Generation

Produce a user-accessible report without requiring media regeneration.

## 32.4 PDF Export

Export supported reports in readable structured form.

## 32.5 CSV Export

Export structured tabular data where appropriate.

## 32.6 Project Report

Summarize major stages, state, and relevant project artifacts.

## 32.7 Generation Statistics

May summarize job counts and states once the final metric set is defined.

## 32.8 Report Failure

Do not modify project data on report failure; allow retry.

# 33\. TESTING REQUIREMENTS

## 33.1 Authentication Testing Requirements

| **Test ID**   | **Area**         | **Requirement**                         |
| ------------- | ---------------- | --------------------------------------- |
| TEST-AUTH-001 | Login            | Google login creates authorized access. |
| TEST-AUTH-002 | Protected access | Unauthenticated access is denied.       |
| TEST-AUTH-003 | Logout           | Logout ends protected access.           |

## 33.2 CRUD Testing Requirements

| **Test ID**   | **Area** | **Requirement**                         |
| ------------- | -------- | --------------------------------------- |
| TEST-CRUD-001 | Create   | Project creation persists correctly.    |
| TEST-CRUD-002 | Read     | Project retrieval returns correct data. |
| TEST-CRUD-003 | Update   | Rename/update preserves linked assets.  |
| TEST-CRUD-004 | Delete   | Deletion follows lifecycle rule.        |

## 33.3 Agent Workflow Testing Requirements

| **Test ID** | **Area**    | **Requirement**                       |
| ----------- | ----------- | ------------------------------------- |
| TEST-AG-001 | Progression | Approval triggers correct next stage. |
| TEST-AG-002 | Persistence | Workflow survives interruption.       |
| TEST-AG-003 | Failure     | Provider/job failure can recover.     |

## 33.4 Approval Flow Testing Requirements

| **Test ID**   | **Area**   | **Requirement**                                    |
| ------------- | ---------- | -------------------------------------------------- |
| TEST-HITL-001 | Approve    | Approval advances once.                            |
| TEST-HITL-002 | Reject     | Rejection requires feedback.                       |
| TEST-HITL-003 | Regenerate | Only affected artifact regenerates where possible. |

## 33.5 Input Validation Testing Requirements

| **Test ID** | **Area**       | **Requirement**                           |
| ----------- | -------------- | ----------------------------------------- |
| TEST-IN-001 | Files          | Invalid files are rejected.               |
| TEST-IN-002 | Character refs | Per-character references remain isolated. |
| TEST-IN-003 | Duration       | Duration planning follows defined rules.  |

## 33.6 Error Handling Testing Requirements

| **Test ID**  | **Area**   | **Requirement**                           |
| ------------ | ---------- | ----------------------------------------- |
| TEST-ERR-001 | Network    | User sees recoverable state.              |
| TEST-ERR-002 | Generation | Failed job is identifiable and retryable. |

## 33.7 Persistence Testing Requirements

| **Test ID**  | **Area**  | **Requirement**          |
| ------------ | --------- | ------------------------ |
| TEST-PER-001 | Project   | Project persists.        |
| TEST-PER-002 | Chat      | Chat persists.           |
| TEST-PER-003 | Artifacts | Approved assets persist. |

## 33.8 UI Behavior Testing Requirements

| **Test ID** | **Area**    | **Requirement**                     |
| ----------- | ----------- | ----------------------------------- |
| TEST-UI-001 | Tabs        | Open/switch/close works.            |
| TEST-UI-002 | Review mode | Artifact review layout works.       |
| TEST-UI-003 | Sidebar     | Collapse/restore preserves context. |

## 33.9 Responsive Behavior Testing Requirements

| **Test ID**   | **Area**        | **Requirement**            |
| ------------- | --------------- | -------------------------- |
| TEST-RESP-001 | Desktop         | 25/50/25 layout works.     |
| TEST-RESP-002 | Narrow viewport | Adaptive navigation works. |

## 33.10 Acceptance Testing

| **Test ID**  | **Area**   | **Requirement**                                                         |
| ------------ | ---------- | ----------------------------------------------------------------------- |
| TEST-ACC-001 | End-to-end | Complete supported film workflow.                                       |
| TEST-ACC-002 | Evaluation | Performance, auth, CRUD, reporting, responsiveness can be demonstrated. |

# 34\. DEPLOYMENT AND ENVIRONMENT EXPECTATIONS

## 34.1 Local Development

Use Docker/Docker Compose so the application and supporting dependencies can be started consistently.

## 34.2 Development Environment

Use isolated non-production credentials/data for development.

## 34.3 Staging Environment

When used, approximate production behavior for authentication, generation, storage, and deployment validation.

## 34.4 Production Environment

Plan for AWS deployment after the working local product is demonstrated and cloud credits/resources are available.

## 34.5 Environment Configuration

Keep AI keys, database settings, object storage settings, queues, and other configuration environment-specific.

## 34.6 Persistent Data

Production must provide durable project metadata and media storage.

## 34.7 External AI Services

Use API-based AI services initially and keep provider-specific details behind a provider abstraction.

| **Local Development**      | **Planned Production Direction**     |
| -------------------------- | ------------------------------------ |
| MinIO object storage       | Amazon S3                            |
| Redis job coordination     | AWS-compatible managed Redis service |
| Docker / Docker Compose    | Containerized AWS deployment         |
| Local application services | AWS-hosted application services      |

# 35\. ACCEPTANCE CRITERIA

| **Acceptance ID** | **Feature**            | **Preconditions**               | **Action**                        | **Expected Result**                                                         |
| ----------------- | ---------------------- | ------------------------------- | --------------------------------- | --------------------------------------------------------------------------- |
| AC-001            | Authentication         | On landing page.                | Complete Google login.            | Protected workspace opens.                                                  |
| AC-002            | Project                | Authenticated user.             | Create named project.             | Project appears in folder manager.                                          |
| AC-003            | Script approval        | Script generated.               | Approve.                          | Workflow advances.                                                          |
| AC-004            | Script rejection       | Script generated.               | Request changes without feedback. | System requests feedback and does not advance.                              |
| AC-005            | Script regeneration    | Feedback supplied.              | Submit changes.                   | New version is generated and prior version remains traceable.               |
| AC-006            | Character references   | Multiple characters configured. | Upload separate images.           | Each image maps to the correct character.                                   |
| AC-007            | Character regeneration | Character output rejected.      | Regenerate with feedback.         | Only affected character changes.                                            |
| AC-008            | Voice review           | Voiceovers generated.           | Approve batch/segment.            | Workflow advances without per-line approval.                                |
| AC-009            | Voice edit             | Dialogue visible.               | Edit and regenerate.              | New audio uses edited content.                                              |
| AC-010            | Parallel video         | Multiple shots ready.           | Start generation.                 | Shot jobs are tracked independently and may run concurrently within limits. |
| AC-011            | Shot rejection         | One clip ready.                 | Reject one shot.                  | Only selected shot is eligible for regeneration.                            |
| AC-012            | Final assembly         | All required clips approved.    | Confirm assembly.                 | Final video is created and stored.                                          |
| AC-013            | Tabs                   | Project has artifacts.          | Open/switch/close tabs.           | Views behave correctly; artifacts are preserved.                            |
| AC-014            | Resume                 | Project waiting for approval.   | Close and reopen.                 | Pending approval is restored.                                               |
| AC-015            | Isolation              | Two users exist.                | Attempt cross-user access.        | Access is denied.                                                           |
| AC-016            | Performance            | Evaluation environment ready.   | Load dashboard.                   | Less than 2 seconds target is met.                                          |
| AC-017            | Responsive             | Supported small viewport.       | Use core workflow.                | Core interaction remains usable.                                            |

# 36\. MVP DEFINITION

## 36.1 Must Work

| **Area**       | **MVP Requirement**                                                       |
| -------------- | ------------------------------------------------------------------------- |
| Authentication | Google login, logout, protected access.                                   |
| Projects       | Create/open/rename/delete, active project.                                |
| Workspace      | 25/50/25 studio.                                                          |
| Chat           | Project-aware text/file/image input.                                      |
| Script         | Generate/review/revise/version/approve.                                   |
| Characters     | Configure/references/generate/review/regenerate.                          |
| Voiceover      | Configure/edit/generate/review/regenerate.                                |
| Video          | Generate/track/review/regenerate shots; background music where supported. |
| Editor         | Assemble final video.                                                     |
| Persistence    | Project, chat, workflow, artifacts.                                       |
| Security       | Authentication and isolation.                                             |
| Performance    | Dashboard target and responsive UI.                                       |

## 36.2 Nice to Have

| **Feature**              | **Priority** |
| ------------------------ | ------------ |
| Rich charts              | Good to Have |
| Dark mode                | Good to Have |
| PDF/CSV export           | Good to Have |
| Email notifications      | Good to Have |
| Admin analytics panel    | Good to Have |
| Expanded automated tests | Good to Have |

## 36.3 Can Be Incomplete

Non-blocking analytics, optional exports, advanced administration, and secondary navigation enhancements may remain incomplete while the end-to-end film workflow is being stabilized.

## 36.4 Not Required for First Demo

| **Capability**                  | **Rationale**              |
| ------------------------------- | -------------------------- |
| Native mobile application       | Future scope.              |
| Multi-tenant enterprise support | Future/stretch.            |
| Model drift monitoring          | Future/stretch.            |
| Full professional editing suite | Outside initial scope.     |
| Self-hosted large models        | MVP uses external AI APIs. |

## 36.5 MVP Exit Criteria

| **Exit Criterion** | **Requirement**                                            |
| ------------------ | ---------------------------------------------------------- |
| Core workflow      | Supported end-to-end workflow completes.                   |
| Approval           | Script, character, voiceover, and video review paths work. |
| Persistence        | Unfinished project can be resumed.                         |
| Data integrity     | Correct project/character/shot association is maintained.  |
| Security           | Authenticated access and user isolation work.              |
| Evaluation         | Core evaluation metrics can be demonstrated.               |

# 37\. FUTURE ROADMAP

## 37.1 Post-MVP

| **Feature**                  | **Intended Release** | **Priority** | **Dependencies** | **Value** | **Complexity** | **Status** |
| ---------------------------- | -------------------- | ------------ | ---------------- | --------- | -------------- | ---------- |
| Real-time analytics          |                      |              |                  |           |                |            |
| Advanced dashboard analytics |                      |              |                  |           |                |            |
| Expanded export options      |                      |              |                  |           |                |            |
| Additional AI providers      |                      |              |                  |           |                |            |

## 37.2 Version 2

Potential focus: richer project controls, broader provider support, collaboration improvements, and deeper analytics.

## 37.3 Version 3

Potential focus: multi-tenant capabilities, broader PWA support, enterprise administration, and additional model backends.

## 37.4 Long-Term Ideas

Collaboration, provider ecosystem, creator tools, advanced editing, and operational intelligence.

## 37.5 Stretch Goals

| **Stretch Goal**        | **Relationship to Product**                                |
| ----------------------- | ---------------------------------------------------------- |
| Real-time analytics     | Extends visibility beyond core job progress.               |
| Multi-tenant support    | Extends single-user ownership to organizational isolation. |
| Mobile PWA              | Extends access to installable mobile experiences.          |
| Automated tests         | Expands confidence in changes.                             |
| Docker containerization | Standardizes packaging and deployment.                     |
| CI/CD                   | Automates build/test/deploy.                               |
| Model drift monitoring  | Adds ongoing output-quality monitoring.                    |

# 38\. OPEN QUESTIONS / DECISION LOG

## 38.1 Open Questions

| **ID** | **Question**                    | **Why It Matters**                                                    | **Decision** | **Owner** | **Status** | **Impact** |
| ------ | ------------------------------- | --------------------------------------------------------------------- | ------------ | --------- | ---------- | ---------- |
| DQ-001 | Final video-generation provider | Determines clip duration, audio/music support, concurrency, and cost. |              |           | Open       | High       |
| DQ-002 | Supported file types/limits     | Needed for upload validation.                                         |              |           | Open       | Medium     |
| DQ-003 | Exact report contents           | Needed for report requirements and acceptance.                        |              |           | Open       | Medium     |
| DQ-004 | Admin analytics metric set      | Needed before admin analytics implementation.                         |              |           | Open       | Medium     |
| DQ-005 | Retention/deletion policy       | Needed for production lifecycle and privacy.                          |              |           | Open       | High       |

## 38.2 Decision Log

| **ID**  | **Topic**         | **Decision**                                                                      | **Reason**                                            | **Alternatives Considered** | **Owner**     | **Impact** |
| ------- | ----------------- | --------------------------------------------------------------------------------- | ----------------------------------------------------- | --------------------------- | ------------- | ---------- |
| DEC-001 | AI model strategy | Use external API-based AI services initially.                                     | Reduces model-serving complexity.                     | Self-hosted/open-weight.    | Puneet Seervi | High       |
| DEC-002 | Object storage    | Use MinIO locally and S3 in production.                                           | Low-cost local development with S3-compatible design. | AWS S3 from day one.        | Puneet Seervi | High       |
| DEC-003 | Background jobs   | Use Redis for local job coordination and an AWS-compatible managed option later.  | Fits async jobs and live status needs.                | AWS SQS.                    | Puneet Seervi | High       |
| DEC-004 | Containerization  | Use Docker/Docker Compose locally and prepare for container-based AWS deployment. | Repeatable environment and easier migration.          | Manual local installs.      | Puneet Seervi | Medium     |

## 38.3 Assumptions

| **ID** | **Assumption**                                                                           | **Validation Needed**   | **Status**  |
| ------ | ---------------------------------------------------------------------------------------- | ----------------------- | ----------- |
| A-001  | Selected video provider supports required Method A workflow or an equivalent capability. | Provider review.        | To Validate |
| A-002  | Local machine can run application dependencies and containers.                           | Development setup test. | To Validate |
| A-003  | External AI API usage fits available budget/credits.                                     | Pricing review.         | To Validate |

# 39\. PRODUCT RULES / BUSINESS RULES

## 39.1 Product Rules

| **Rule ID** | **Rule**                                                      | **Scope**  | **Expected Behavior**                | **Status** |
| ----------- | ------------------------------------------------------------- | ---------- | ------------------------------------ | ---------- |
| BR-001      | Primary Chat tab is always available.                         | Workspace  | Chat cannot be closed.               | Locked     |
| BR-002      | Closing a secondary tab does not delete its artifact.         | Workspace  | Only the view closes.                | Locked     |
| BR-003      | Active project controls default workflow context.             | Project    | New work attaches to active project. | Locked     |
| BR-004      | Character references are character-scoped.                    | Characters | References do not mix.               | Locked     |
| BR-005      | Approved unrelated outputs are preserved during regeneration. | Workflow   | Only affected work changes.          | Locked     |

## 39.2 Workflow Rules

| **Rule**              | **Requirement**                                                           |
| --------------------- | ------------------------------------------------------------------------- |
| Sequential dependency | Downstream stages use approved upstream artifacts.                        |
| Logical continuity    | Workflow remains a continuous project process even when execution pauses. |
| State persistence     | Major transitions are saved.                                              |
| Targeted regeneration | Regenerate the smallest affected unit where possible.                     |
| Completion            | Workflow is complete only after final video persistence succeeds.         |

## 39.3 Approval Rules

| **Stage**      | **Rule**                                                              |
| -------------- | --------------------------------------------------------------------- |
| Script         | User approval is required before Character Agent progression.         |
| Characters     | Required character outputs are approved before Voiceover progression. |
| Voiceover      | Voice set/segments are approved before Video progression.             |
| Video          | Required shots are approved before final assembly.                    |
| Final assembly | User confirms joining approved clips.                                 |

## 39.4 Versioning Rules

| **Rule**            | **Requirement**                                        |
| ------------------- | ------------------------------------------------------ |
| Regeneration        | Creates a distinguishable new attempt/version.         |
| Current version     | Downstream workflow uses the current approved version. |
| History             | Prior versions remain traceable under lifecycle rules. |
| No silent overwrite | Regeneration does not silently destroy prior output.   |

## 39.5 Project Rules

A project is the authoritative container for conversations and production artifacts. New generation actions require a known project context.

## 39.6 Asset Rules

Assets are associated with a project and, where relevant, a character, shot, dialogue segment, or final version.

## 39.7 Duration Rules

User-facing durations are fixed; generation-shot planning follows the selected provider's supported clip duration.

## 39.8 User Interaction Rules

| **Rule**                     | **Requirement**                                            |
| ---------------------------- | ---------------------------------------------------------- |
| Structured questions         | Use UI controls for structured inputs where practical.     |
| Feedback on rejection        | Require feedback before regeneration.                      |
| No silent destructive action | Irreversible actions require clear confirmation.           |
| Progress clarity             | Long-running tasks show meaningful state.                  |
| Preserve context             | Tabs and navigation do not terminate underlying workflows. |

# 40\. APPENDIX

## 40.1 Glossary

| **Term**            | **Definition**                                                           |
| ------------------- | ------------------------------------------------------------------------ |
| Agent               | Specialized AI-driven component responsible for one production stage.    |
| Workflow            | Ordered process connecting the five agents, approvals, and final output. |
| Project Folder      | User-facing container representing one film project.                     |
| Artifact            | Uploaded or generated project object.                                    |
| Shot                | Individual video-generation unit from the approved shot plan.            |
| Approval Checkpoint | A workflow point requiring explicit user review.                         |
| Regeneration        | Creation of a new output/version after feedback or failure.              |
| Workspace Tab       | Central workspace view for chat or an artifact.                          |
| Generation Job      | Asynchronous unit of AI/media processing.                                |
| Active Project      | Project whose context controls the current workflow.                     |

## 40.2 Acronyms

| **Acronym** | **Meaning**                        |
| ----------- | ---------------------------------- |
| PRD         | Product Requirements Document      |
| TDD         | Technical Design Document          |
| MVP         | Minimum Viable Product             |
| AI          | Artificial Intelligence            |
| GenAI       | Generative Artificial Intelligence |
| API         | Application Programming Interface  |
| REST        | Representational State Transfer    |
| UI          | User Interface                     |
| UX          | User Experience                    |
| PWA         | Progressive Web Application        |
| CRUD        | Create, Read, Update, Delete       |

## 40.3 Reference Documents

| **Type**            | **Title / Resource**                    | **Link**                              |
| ------------------- | --------------------------------------- | ------------------------------------- |
| Paper               | AutoGPT: An Autonomous GPT-4 Experiment | <https://arxiv.org/abs/2306.05861>    |
| Dataset / Benchmark | ReAct Benchmarks & TaskBench            | <https://github.com/ysymyf/TaskBench> |

## 40.4 Workflow Diagrams

```
END-TO-END
User -> Project -> Script -> Characters -> Voiceover -> Video -> Editor -> Final Video

REVIEW LOOP
Generate -> Review -> Approve -> Continue
                    -> Reject + Feedback -> Regenerate -> Review
```

## 40.5 User-Flow Diagrams

```
AUTH
Landing -> Google Login -> Dashboard -> Project -> Chat

ARTIFACT
Folder Manager -> Artifact -> Secondary Tab -> Review / View
```

## 40.6 Example Artifact Structures

The artifact structure is defined by the agent and lifecycle requirements in this PRD. Exact technical representations are reserved for the TDD.

## 40.7 Example Approval States

| **State**         | **Purpose**                                          |
| ----------------- | ---------------------------------------------------- |
| Draft             | Artifact exists but is not approved.                 |
| Ready for Review  | Artifact is available for inspection.                |
| Approved          | Artifact is accepted for downstream use.             |
| Changes Requested | User rejected output and supplied feedback.          |
| Regenerating      | A new output is being produced.                      |
| Failed            | Generation/processing did not complete successfully. |

## 40.8 Requirements Traceability

| **Requirement ID** | **Feature / Area** | **PRD Section** | **Acceptance Criterion** | **Future TDD Reference** | **Future Test Reference** |
| ------------------ | ------------------ | --------------- | ------------------------ | ------------------------ | ------------------------- |
|                    |                    |                 |                          |                          |                           |
|                    |                    |                 |                          |                          |                           |
|                    |                    |                 |                          |                          |                           |
|                    |                    |                 |                          |                          |                           |
|                    |                    |                 |                          |                          |                           |
|                    |                    |                 |                          |                          |                           |

## 40.9 Additional Notes

This PRD remains the product-level source of truth during implementation. Material product changes should be recorded here before being treated as settled requirements in the TDD or codebase.