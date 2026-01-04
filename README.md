DailyPaper AI-Powered Research Assistant: Automated daily paper retrieval and social media monitoring tailored to your research field. Generates daily academic posters, provides concise summaries, and offers AI-driven research insights and directions.

# Daily Scholar

**Daily Scholar** is a modern, AI-powered research assistant designed to help researchers stay on top of the latest academic papers. It fetches papers from arXiv, summarizes them using Google Gemini, and generates high-fidelity visual posters.

This repository features a **separated full-stack architecture** designed for scalability and a professional user experience.

## 🏗 Architecture

* **Frontend**: [Next.js 16](https://nextjs.org/) (App Router), [TypeScript](https://www.typescriptlang.org/), [Tailwind CSS](https://tailwindcss.com/), [shadcn/ui](https://ui.shadcn.com/).
* **Backend**: [FastAPI](https://fastapi.tiangolo.com/), Python 3.10+.
* **AI Integration**: Google Gemini 1.5 Pro / Flash.

## 🚀 Getting Started

You need to run both the backend and frontend servers simultaneously.

### Prerequisites

* Python 3.10 or higher
* Node.js 18.17 or higher
* npm

### 1. Backend Setup (FastAPI)

The backend handles business logic, arXiv search, and AI processing.

```bash
cd backend

# Create a virtual environment (optional but recommended)
python -m venv venv
# Windows
.\venv\Scripts\activate
# Mac/Linux
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Start the server
uvicorn main:app --reload --port 8000
```

The API will be available at `http://localhost:8000`.
Health check: `http://localhost:8000/api/health`

### 2. Frontend Setup (Next.js)

The frontend provides a responsive, modern UI.

```bash
cd frontend

# Install dependencies
npm install

# Start the development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## 📂 Project Structure

```
daily-scholar/
├── backend/            # FastAPI Backend
│   ├── main.py         # App entry point & CORS config
│   └── requirements.txt # Python dependencies
│
└── frontend/           # Next.js Frontend
    ├── app/            # App Router pages & layout
    ├── components/     # React components (shadcn/ui)
    ├── lib/            # Utilities
    └── next.config.ts  # Proxy configuration
```

## ✨ Features (Planned)

* **ArXiv Search**: Real-time search for academic papers.
* **AI Summaries**: "One-sentence" summaries and key innovations extracted by Gemini.
* **Poster Generation**: Beautiful, magazine-style HTML posters for papers.
* **Modern UI**: Clean, sidebar-based navigation with a focus on readability.

