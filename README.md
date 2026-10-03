#  CineForge

**CineForge** is an open-source, AI-powered agentic film studio. It provides a robust, human-in-the-loop (HITL) interface for orchestrating complex AI workflows to generate cinematic trailers and short films.

Powered by a multi-agent pipeline (Script, Character, Voiceover, Video, Editor), CineForge breaks down the filmmaking process into manageable, reviewable stages. Users act as the Director, guiding the AI through an intuitive chat interface while reviewing and approving structured JSON scripts, character reference sheets, and generated video clips before the final cut is assembled.

##  Tech Stack

- **Frontend:** React, Vite, TypeScript, Tailwind CSS
- **Backend:** Node.js, Express, TypeScript
- **AI Service:** Python, FastAPI, LangGraph, Google Gemini
- **Infrastructure:** Docker, MongoDB (State), Redis (Queues), MinIO (Object Storage)

##  Local Development Setup

To run CineForge locally, you will need **Docker** and **Docker Compose** installed on your machine. The entire infrastructure is containerized for a seamless setup.

### 1. Clone the repository
```bash
git clone https://github.com/31puneet/CineForge.git
cd CineForge
```

### 2. Configure Environment Variables
You need to provide a Gemini API Key for the AI service to function.
Create a `.env` file inside the `ai-service/` directory:

```bash
# ai-service/.env
GEMINI_API_KEY="your_google_gemini_api_key_here"
```

### 3. Build and Start the Containers
Run the following command in the root of the project to build and spin up all services:

```bash
docker compose up --build
```

This will launch:
- **Frontend** at [http://localhost:5173](http://localhost:5173)
- **Backend (Node.js)** at `http://localhost:3000`
- **AI Service (FastAPI)** at `http://localhost:8000`
- **MongoDB** at `localhost:27017`
- **Redis** at `localhost:6379`
- **MinIO** at `localhost:9000` (Console at `9001`)

### 4. Start Creating
Open [http://localhost:5173](http://localhost:5173) in your browser and start directing your first film!