# SkillQuest 🎯

A full-stack web application built with React (Vite) for the frontend and Node.js/Express for the backend, using MySQL as the database.

## 📁 Project Structure

```
SkillQuest/
├── backend/              # Node.js/Express server
│   ├── config/           # Database configuration
│   ├── controllers/      # Route controllers
│   ├── middleware/       # Authentication middleware
│   ├── routes/           # API routes
│   ├── server.js         # Entry point
│   ├── package.json
│   └── .env              # Environment variables (not in repo)
│
└── frontend/             # React + Vite app
    ├── src/
    │   ├── pages/        # Page components
    │   ├── services/     # API service functions
    │   ├── styles/       # CSS files
    │   ├── assets/       # Static assets
    │   ├── App.jsx       # Main app component
    │   └── main.jsx      # Entry point
    ├── package.json
    └── vite.config.js
```

## 🚀 Architecture & Microservices

SkillQuest has evolved into a fully containerized microservices architecture:

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
*Note: If you already have the `.cosmos-db-data` folder, you do NOT need to run this.*

### 5. Start the Frontend

Open a new terminal and navigate to the frontend folder:
```bash
cd frontend
npm install
npm run dev
```
The app will open at `http://localhost:5173`

## 🛠️ Available Scripts

### Backend

| Command | Description |
|---------|-------------|
| `npm start` | Start the server |
| `npm run dev` | Start in development mode |

### Frontend

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Build for production |
| `npm run preview` | Preview production build |
| `npm run lint` | Run ESLint |

## 🔧 Making Changes to the Project

### For Contributors / Friends

1. **Fork the repository** (optional, for external contributors)
   - Click the "Fork" button on GitHub

2. **Clone your fork or the main repo:**
   ```bash
   git clone <repository-url>
   cd SkillQuest
   ```

3. **Create a new branch for your feature:**
   ```bash
   git checkout -b feature/your-feature-name
   ```

4. **Make your changes** in the appropriate folder:
   - Frontend code → `frontend/src/`
   - Backend code → `backend/`

5. **Test your changes locally:**
   - Make sure both frontend and backend are running
   - Test the feature you added/modified

6. **Commit your changes:**
   ```bash
   git add .
   git commit -m "Add: description of your changes"
   ```

7. **Push your branch:**
   ```bash
   git push origin feature/your-feature-name
   ```

8. **Create a Pull Request:**
   - Go to the repository on GitHub
   - Click "Compare & pull request"
   - Describe your changes and submit

### Recommended Commit Message Format

- `Add:` for new features
- `Fix:` for bug fixes
- `Update:` for updates to existing features
- `Remove:` for removed features
- `Style:` for CSS/styling changes

## 📂 Where to Add New Code

| What you're adding | Where to add it |
|-------------------|-----------------|
| New page | `frontend/src/pages/` |
| New API endpoint | `backend/routes/` and `backend/controllers/` |
| New styles | `frontend/src/styles/` |
| New API service | `frontend/src/services/` |
| Static images | `frontend/src/assets/` |

## 🔐 Environment Variables

The `.env` file contains sensitive information and should **NEVER** be committed to the repository. Each contributor needs to create their own `.env` file with the required variables.

## 📡 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/health` | Health check |
| POST | `/api/auth/register` | User registration |
| POST | `/api/auth/login` | User login |
| GET | `/api/rl/recommend` | Get RL action recommendation |
| POST | `/api/rl/engage` | Track frontend engagement with an RL action |
| POST | `/api/rl/feedback` | Send reward feedback to Python RL model |
| GET | `/api/rl/metrics` | Debug: Get user state vector metrics |
| GET | `/api/rl/interactions`| Debug: View interaction history |

## 🐛 Troubleshooting

### Common Issues

1. **Port already in use**
   - Change the port in `.env` file
   - Or kill the process using that port

2. **Database connection failed**
   - Check your `.env` credentials
   - Ensure MySQL server is running

3. **CORS errors**
   - Make sure frontend is running on `http://localhost:5173`
   - Backend CORS is configured for this origin

## 📝 License

ISC

---

**Happy Coding! 🎉**

If you have any questions, feel free to reach out or open an issue on GitHub.
