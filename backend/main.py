import os
import time
from typing import List

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from google import genai
from pydantic import BaseModel

load_dotenv()

api_key = os.getenv("GEMINI_API_KEY")
model = os.getenv("GEMINI_MODEL", "gemini-3.5-flash")

client = genai.Client(api_key=api_key) if api_key else None

app = FastAPI(
    title="AI Code Reviewer",
    description="AI-powered code review and bug fixing agent",
    version="1.0.0",
)

frontend_url = os.getenv("FRONTEND_URL", "")

allowed_origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
]

if frontend_url:
    allowed_origins.extend(
        item.strip().rstrip("/")
        for item in frontend_url.split(",")
        if item.strip()
    )

allowed_origins = list(dict.fromkeys(allowed_origins))

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class ReviewRequest(BaseModel):
    code: str
    language: str


class FixRequest(BaseModel):
    code: str
    language: str
    issue: str


class AlternativeApproach(BaseModel):
    name: str
    description: str
    recommended: bool


class Issue(BaseModel):
    id: int
    severity: str
    category: str
    line: int
    title: str
    explanation: str
    suggested_fix: str
    approaches: List[AlternativeApproach]


class ReviewResponse(BaseModel):
    score: int
    issues: List[Issue]


class FixResponse(BaseModel):
    explanation: str
    fixed_code: str


def generate_json(prompt: str, response_model):
    if not api_key or client is None:
        raise HTTPException(
            status_code=500,
            detail="GEMINI_API_KEY is not configured.",
        )

    for attempt in range(3):
        try:
            response = client.models.generate_content(
                model=model,
                contents=prompt,
                config={
                    "response_mime_type": "application/json",
                    "response_schema": response_model,
                },
            )

            if not response.text:
                raise HTTPException(
                    status_code=500,
                    detail="Gemini returned no response.",
                )

            return response.text

        except HTTPException:
            raise

        except Exception as error:
            error_text = str(error)

            temporary_error = any(
                marker in error_text
                for marker in (
                    "503",
                    "UNAVAILABLE",
                    "high demand",
                    "temporarily",
                    "429",
                    "RESOURCE_EXHAUSTED",
                )
            )

            if temporary_error and attempt < 2:
                time.sleep(2 ** attempt)
                continue

            raise HTTPException(
                status_code=503 if temporary_error else 500,
                detail=(
                    "Gemini is temporarily unavailable. "
                    "Please try again in a few seconds."
                    if temporary_error
                    else "Gemini AI request failed. Check the backend terminal."
                ),
            )


@app.get("/")
def root():
    return {"message": "AI Code Reviewer API is running"}


@app.get("/health")
def health():
    return {"status": "healthy"}


@app.post("/api/review", response_model=ReviewResponse)
def review_code(request: ReviewRequest):
    if not request.code.strip():
        raise HTTPException(
            status_code=400,
            detail="Code cannot be empty.",
        )

    prompt = f"""
You are CodePilot, an expert AI code reviewer.

Analyze the following {request.language} code.

Focus on:
1. Bugs and correctness problems
2. Security vulnerabilities
3. Performance problems
4. Code quality and maintainability

For every meaningful issue:
- Assign severity: critical, warning, or suggestion.
- Assign category: bugs, security, performance, or quality.
- Identify the most relevant line number.
- Give a concise title.
- Explain clearly why it is a problem.
- Provide a practical recommended fix.
- Provide multiple alternative approaches.
- Mark exactly one approach as recommended.
- Explain trade-offs between approaches.

Do not invent problems.
Only report issues reasonably supported by the code.

Give the code a quality score from 0 to 100.

Return only structured JSON matching the requested schema.

Language: {request.language}

Code:
```text
{request.code}
```
"""

    result_json = generate_json(prompt, ReviewResponse)

    try:
        return ReviewResponse.model_validate_json(result_json)
    except Exception:
        raise HTTPException(
            status_code=500,
            detail="Gemini returned an invalid review.",
        )


@app.post("/api/fix", response_model=FixResponse)
def fix_code(request: FixRequest):
    if not request.code.strip():
        raise HTTPException(
            status_code=400,
            detail="Code cannot be empty.",
        )

    if not request.issue.strip():
        raise HTTPException(
            status_code=400,
            detail="Issue description cannot be empty.",
        )

    prompt = f"""
You are CodePilot, an expert AI software engineer.

Fix the specified issue in the provided {request.language} code.

Requirements:
1. Preserve the original functionality wherever possible.
2. Fix the reported issue correctly.
3. Do not introduce unrelated changes.
4. Keep the code readable and maintainable.
5. Return the complete corrected code.
6. Briefly explain what was changed and why.

Issue to fix:
{request.issue}

Original code:
```text
{request.code}
```

Return only structured JSON matching the requested schema.
"""

    result_json = generate_json(prompt, FixResponse)

    try:
        return FixResponse.model_validate_json(result_json)
    except Exception:
        raise HTTPException(
            status_code=500,
            detail="Gemini returned an invalid fix.",
        )
