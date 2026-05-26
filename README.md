# SkillQuest 🎯

A fully containerized microservices platform built with React (Vite) for the frontend, Node.js/Express for core backend services, and Python for an advanced LLM/RAG AI Engine.

## ✨ Key Features

- **Adaptive AI Learning**: An intelligent Python AI engine leveraging RAG (Retrieval-Augmented Generation) and Cosmos DB vector search to create personalized readings and quizzes.
- **Smart Fallback Generation**: The AI engine uses Gemini 2.0 Flash as the primary generator, with a robust fallback to Groq (Llama 3.3) to bypass rate limits seamlessly.
- **Gamification**: Earn XP, badges, and maintain streaks to stay motivated.
- **Secure Authentication**: JWT-based session management.
- **Performance Analytics**: Visual data on your learning velocity and engagement tracked via a dedicated reinforcement learning loop.

## 📁 Project Structure

```
SkillQuest/
├── docker-compose.yml       # Docker orchestration for all 10 containers
├── .env.example             # Template for API keys
├── .cosmos-db-data/         # Persistent local volume for vector DB
├── frontend/                # React + Vite application
│   └── src/
└── services/                # Microservices directory
    ├── ai-service/          # Node.js API gateway to Python Engine
    ├── analytics-service/   # RL tracking and gamification
    ├── auth-service/        # User authentication & registration
    ├── quiz-service/        # Profile scoring & quiz validation
    ├── study-plan-service/  # Curriculum path generation
    ├── shared/              # Shared DB connection and auth logic
    └── SkillQuest AI Engine/# Python FastAPI, RAG logic, and LLM Orchestrator
```

## 🚀 Architecture & Microservices

The entire stack is orchestrated by Docker Compose:

- **Frontend**: React + Vite (Port 5173)
- **auth-service**: Handles users and login (Node.js, Port 5002)
- **quiz-service**: Handles user profiling and scoring (Node.js, Port 5003)
- **analytics-service**: Handles Reinforcement Learning tracking (Node.js, Port 5004)
- **study-plan-service**: Handles path generation (Node.js, Port 5005)
- **ai-service**: Node.js gateway for AI generation (Port 5006)
- **SkillQuest AI Engine**: Python backend for RAG and LLM orchestration (Port 8001)
- **MySQL**: Relational database for users and progress (Port 3306)
- **Cosmos DB**: Vector database for RAG document storage (Port 8081)

---

## 🚀 Prerequisites

Before running the project, make sure you have the following installed:

- **Docker Desktop** (must be running) - [Download here](https://www.docker.com/products/docker-desktop)
- **Node.js** (v18 or higher) - For frontend development
- **Python 3.10+** - (Optional) Only needed if you are manually re-seeding the AI database.

---

## ⚙️ Setup Instructions

### 1. Clone the Repository

```bash
git clone https://github.com/PasiAbey/Project-Skill-Quest.git
cd SkillQuest
```

### 2. Configure Environment Variables

Create a single `.env` file in the root directory. You can copy the template:
```bash
cp .env.example .env
```
Make sure to fill in your `GEMINI_API_KEY` and `GROQ_API_KEY` in the `.env` file to enable the AI Engine.

### 3. Start the Backend (Docker)

All backend services, databases, and AI engines are orchestrated by Docker. Simply run:
```bash
docker compose up -d --build
```
*Note: The first time you run this, it will take a few minutes to download the database images and build the microservices.*

### 4. (Optional) Seed the Cosmos DB Vector Database
If you are running this for the very first time on a new machine, your Cosmos DB will be empty. To seed it with educational books:
1. Ensure the containers are running.
2. Install Python dependencies: `pip install -r "services/SkillQuest AI Engine/requirements.txt"`
3. Run the seeder: `python seed_local.py` (This process can take 30+ minutes as it generates thousands of vector embeddings).
*Note: If you already have the `.cosmos-db-data` folder, you do NOT need to run this step! The data is persistent.*

### 5. Start the Frontend

Open a new terminal and navigate to the frontend folder:
```bash
cd frontend
npm install
npm run dev
```
The app will open at `http://localhost:5173`

## 🔧 Making Changes to the Project

1. **Fork the repository** (optional, for external contributors)
2. **Create a new branch for your feature:**
   ```bash
   git checkout -b feature/your-feature-name
   ```
3. **Make your changes** in the appropriate folder:
   - Frontend code → `frontend/src/`
   - Specific Backend Microservice → `services/<service-name>/`
   - Python AI Logic → `services/SkillQuest AI Engine/`
4. **Rebuild the specific Docker container** (if testing backend changes):
   ```bash
   docker compose up -d --build <service-name>
   ```
5. **Commit and Push your changes:**
   ```bash
   git add .
   git commit -m "Add: description of your changes"
   git push origin feature/your-feature-name
   ```

## 🐛 Troubleshooting

### Common Issues

1. **Container fails to start (Port already in use)**
   - Check if you have a local MySQL or another service running on your machine taking up port 3306 or 5000+.
   - Stop the local service or change the port mapping in `docker-compose.yml`.

2. **AI Engine fails to generate content (500 Error)**
   - Check your API keys in the `.env` file.
   - Run `docker logs skillquest-ai-engine` to see if there is a rate limit or connection issue.

3. **CORS errors**
   - Make sure your frontend is running on `http://localhost:5173`. The backend microservices strictly enforce CORS for this URL.

## 📝 License

ISC

---

**Happy Coding! 🎉**
