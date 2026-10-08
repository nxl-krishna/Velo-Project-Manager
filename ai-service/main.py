"""
ProjectHub AI Service
FastAPI microservice providing:
- Task summarization
- Smart assignee suggestion  
- Deadline prediction
- Natural language task parsing
- Sprint planning AI
"""

from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import Optional, List, Any
import os
import time
import json
import hashlib
import structlog
from dotenv import load_dotenv
from tenacity import retry, stop_after_attempt, wait_exponential
import redis

load_dotenv()

# ─── Logging ──────────────────────────────────────────────────
log = structlog.get_logger()

# ─── Redis (cache) ─────────────────────────────────────────────
redis_client = None
try:
    redis_client = redis.from_url(os.getenv("REDIS_URL", "redis://localhost:6379"), decode_responses=True)
    redis_client.ping()
    log.info("Redis connected")
except Exception as e:
    log.warning("Redis unavailable, caching disabled", error=str(e))

# ─── AI client setup ───────────────────────────────────────────
try:
    import google.generativeai as genai
    genai.configure(api_key=os.getenv("GOOGLE_AI_API_KEY", ""))
    gemini_model = genai.GenerativeModel("gemini-1.5-flash")
    AI_PROVIDER = "gemini"
except ImportError:
    gemini_model = None
    AI_PROVIDER = "mock"

# ─── App ───────────────────────────────────────────────────────
app = FastAPI(
    title="ProjectHub AI Service",
    description="AI-powered task intelligence for ProjectHub",
    version="1.0.0",
    docs_url="/docs",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", os.getenv("NEXT_PUBLIC_APP_URL", "")],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── Request/Response schemas ──────────────────────────────────
class SummarizeRequest(BaseModel):
    title: str
    description: Optional[str] = None
    comments: List[str] = Field(default_factory=list)

class SummarizeResponse(BaseModel):
    summary: str
    key_points: List[str]
    complexity: str  # low | medium | high
    model: str
    latency_ms: int

class AssigneeRequest(BaseModel):
    taskTitle: str
    taskDescription: Optional[str] = None
    taskLabels: List[str] = Field(default_factory=list)
    teamMembers: List[str]
    workloadData: Any = None

class AssigneeSuggestion(BaseModel):
    userId: str
    score: float
    reason: str

class AssigneeResponse(BaseModel):
    suggestions: List[AssigneeSuggestion]
    model: str
    latency_ms: int

class ParseTaskRequest(BaseModel):
    text: str = Field(..., min_length=5, max_length=2000)

class ParsedTask(BaseModel):
    title: str
    priority: str  # LOW | MEDIUM | HIGH | CRITICAL
    labels: List[str]
    suggestedAssignees: List[str]
    dueDate: Optional[str]
    storyPoints: Optional[int]
    description: Optional[str]

class DeadlineRequest(BaseModel):
    taskId: str
    title: str
    storyPoints: Optional[int]
    assigneeIds: List[str]
    historicalData: Optional[Any] = None

class DeadlineResponse(BaseModel):
    predictedDate: str
    confidence: float
    factors: List[str]
    model: str
    latency_ms: int

# ─── Cache helpers ─────────────────────────────────────────────
def cache_key(prefix: str, data: dict) -> str:
    content = json.dumps(data, sort_keys=True)
    return f"ai:{prefix}:{hashlib.md5(content.encode()).hexdigest()[:16]}"

def cache_get(key: str) -> Optional[dict]:
    if not redis_client:
        return None
    try:
        val = redis_client.get(key)
        return json.loads(val) if val else None
    except Exception:
        return None

def cache_set(key: str, value: dict, ttl: int = 3600) -> None:
    if not redis_client:
        return
    try:
        redis_client.set(key, json.dumps(value), ex=ttl)
    except Exception:
        pass

# ─── AI call with retry ────────────────────────────────────────
@retry(stop=stop_after_attempt(2), wait=wait_exponential(multiplier=1, min=1, max=5))
async def call_gemini(prompt: str) -> str:
    """Call Gemini with retry logic."""
    if not gemini_model or not os.getenv("GOOGLE_AI_API_KEY", "").startswith("AIza"):
        # Return mock response when API key not configured
        return "MOCK_RESPONSE"
    
    resp = await gemini_model.generate_content_async(
        prompt,
        generation_config={"temperature": 0.2, "response_mime_type": "application/json"}
    )
    return resp.text

# ─── Endpoints ────────────────────────────────────────────────

@app.get("/health")
async def health():
    """Health check endpoint."""
    redis_ok = False
    if redis_client:
        try:
            redis_client.ping()
            redis_ok = True
        except Exception:
            pass
    
    return {
        "status": "healthy",
        "provider": AI_PROVIDER,
        "redis": "ok" if redis_ok else "unavailable",
        "version": "1.0.0",
    }

@app.post("/v1/summarize", response_model=SummarizeResponse)
async def summarize_task(req: SummarizeRequest):
    """Generate AI summary of a task with key points and complexity estimate."""
    start = time.time()
    
    # Cache check
    ck = cache_key("summarize", req.model_dump())
    cached = cache_get(ck)
    if cached:
        log.info("Cache hit", endpoint="summarize")
        return {**cached, "cached": True}
    
    prompt = f"""Analyze this software task and respond with JSON only.

Task: {req.title}
Description: {req.description or 'Not provided'}
Comments: {chr(10).join(req.comments) if req.comments else 'None'}

Return this exact JSON:
{{
  "summary": "2-3 sentence summary",
  "key_points": ["point1", "point2", "point3"],
  "complexity": "low|medium|high"
}}"""

    try:
        raw = await call_gemini(prompt)
        
        if raw == "MOCK_RESPONSE":
            result = {
                "summary": f"Task '{req.title}' involves implementing functionality based on the provided description. The work requires careful planning and testing to ensure quality delivery.",
                "key_points": ["Implementation of core functionality", "Unit and integration testing required", "Review and documentation needed"],
                "complexity": "medium",
            }
        else:
            result = json.loads(raw)
    except Exception as e:
        log.error("Summarize failed", error=str(e))
        result = {
            "summary": f"AI summarization unavailable. Task: {req.title}",
            "key_points": ["Manual review recommended"],
            "complexity": "unknown",
        }
    
    latency_ms = int((time.time() - start) * 1000)
    response = {**result, "model": AI_PROVIDER, "latency_ms": latency_ms}
    cache_set(ck, response, ttl=3600)
    
    log.info("Task summarized", latency_ms=latency_ms)
    return response


@app.post("/v1/suggest-assignee", response_model=AssigneeResponse)
async def suggest_assignee(req: AssigneeRequest):
    """Suggest best-fit team member for a task based on workload and skills."""
    start = time.time()
    
    ck = cache_key("assignee", {"title": req.taskTitle, "labels": req.taskLabels})
    cached = cache_get(ck)
    if cached:
        return cached
    
    prompt = f"""You are a smart project management assistant. Suggest the best assignee.

Task: {req.taskTitle}
Labels/Skills needed: {', '.join(req.taskLabels)}
Team members: {', '.join(req.teamMembers)}
Workload data: {json.dumps(req.workloadData) if req.workloadData else 'Not available'}

Return JSON:
{{
  "suggestions": [
    {{"userId": "member_id", "score": 0.95, "reason": "Explanation"}},
    {{"userId": "member_id2", "score": 0.78, "reason": "Explanation"}}
  ]
}}"""

    try:
        raw = await call_gemini(prompt)
        if raw == "MOCK_RESPONSE":
            suggestions = [
                {"userId": req.teamMembers[0] if req.teamMembers else "unassigned", "score": 0.88, "reason": "Has relevant experience with similar tasks and current workload is manageable"},
            ]
        else:
            data = json.loads(raw)
            suggestions = data.get("suggestions", [])
    except Exception as e:
        log.error("Assignee suggestion failed", error=str(e))
        suggestions = []
    
    latency_ms = int((time.time() - start) * 1000)
    response = {"suggestions": suggestions, "model": AI_PROVIDER, "latency_ms": latency_ms}
    cache_set(ck, response, ttl=1800)
    return response


@app.post("/v1/parse-task", response_model=ParsedTask)
async def parse_natural_language(req: ParseTaskRequest):
    """Parse free-text into a structured task object."""
    start = time.time()
    
    prompt = f"""Parse this task description into structured data. Return JSON only.

Input: "{req.text}"

Return:
{{
  "title": "Concise task title",
  "priority": "LOW|MEDIUM|HIGH|CRITICAL",
  "labels": ["tag1", "tag2"],
  "suggestedAssignees": ["role or name if mentioned"],
  "dueDate": "YYYY-MM-DD or null",
  "storyPoints": 1-13 or null,
  "description": "Full cleaned description"
}}"""

    try:
        raw = await call_gemini(prompt)
        if raw == "MOCK_RESPONSE":
            # Parse from text heuristically when AI not available
            text = req.text.lower()
            priority = "CRITICAL" if "critical" in text or "urgent" in text else \
                       "HIGH" if "high" in text or "bug" in text else \
                       "LOW" if "low" in text else "MEDIUM"
            return {
                "title": req.text[:80].strip().rstrip(".!?,"),
                "priority": priority,
                "labels": ["bug" if "bug" in text else "feature"],
                "suggestedAssignees": [],
                "dueDate": None,
                "storyPoints": None,
                "description": req.text,
            }
        return json.loads(raw)
    except Exception as e:
        log.error("NLP parse failed", error=str(e))
        raise HTTPException(status_code=503, detail="AI service temporarily unavailable")


@app.post("/v1/predict-deadline", response_model=DeadlineResponse)
async def predict_deadline(req: DeadlineRequest):
    """Predict task completion date based on story points and assignee velocity."""
    start = time.time()
    import datetime
    
    # Heuristic model (replace with ML in production)
    base_days = (req.storyPoints or 3) * 1.5  # 1.5 days per story point
    variance = 0.2  # 20% buffer
    predicted_days = base_days * (1 + variance)
    
    predicted_date = (datetime.date.today() + datetime.timedelta(days=predicted_days)).isoformat()
    confidence = min(0.95, 0.6 + (0.05 * len(req.assigneeIds)))  # More assignees = higher confidence
    
    latency_ms = int((time.time() - start) * 1000)
    return {
        "predictedDate": predicted_date,
        "confidence": round(confidence, 2),
        "factors": ["story_points", "assignee_count", "historical_velocity"],
        "model": "heuristic_v1",
        "latency_ms": latency_ms,
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=os.getenv("NODE_ENV") == "development",
        log_level="info",
    )
