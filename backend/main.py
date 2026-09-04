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

if api_key:
    client = genai.Client(api_key=api_key)
else:
    client = None

app = FastAPI(
    title="AI Code Reviewer",
    description="AI-powered code review and bug fixing agent",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
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
            detail="GEMINI_API_KEY is not configured."
        )

    max_retries = 3

    for attempt in range(max_retries):
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
                    detail="Gemini returned no response."
                )

            return response.text

        except HTTPException:
            raise

        except Exception as error:
            error_text = str(error)

            print(f"Gemini Error (attempt {attempt + 1}/{max_retries}):")
            print(error_text)

            temporary_error = (
                "503" in error_text
                or "UNAVAILABLE" in error_text
                or "high demand" in error_text
                or "temporarily" in error_text
                or "429" in error_text
                or "RESOURCE_EXHAUSTED" in error_text
            )

            if temporary_error and attempt < max_retries - 1:
                wait_time = 2 ** attempt

                print(
                    f"Temporary Gemini error. "
                    f"Retrying in {wait_time} seconds..."
                )

                time.sleep(wait_time)
                continue

            raise HTTPException(
                status_code=503 if temporary_error else 500,
                detail=(
                    "Gemini is temporarily unavailable. "
                    "Please try again in a few seconds."
                    if temporary_error
                    else "Gemini AI request failed. Check the backend terminal."
                )
            )

    raise HTTPException(
        status_code=503,
        detail="Gemini is temporarily unavailable."
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
            detail="Code cannot be empty."
        )

    prompt = f"""
You are an expert software engineer and code reviewer.

Analyze the submitted source code.

Programming language:
{request.language}

Source code:
{request.code}

Focus on:

1. Bugs and correctness
2. Security vulnerabilities
3. Performance problems
4. Reliability and maintainability

For every meaningful issue provide:

- id
- severity: critical, warning, or suggestion
- category: bug, security, performance, reliability, or maintainability
- line number
- title
- explanation
- suggested fix
- 2 to 3 alternative approaches
- exactly one recommended approach

For each alternative approach:
- name
- description
- recommended

Do not invent issues.

Only report problems supported by the code.

If there are no issues, return an empty issues array.

The score must be between 0 and 100.

You are reviewing code, not executing it.

Return ONLY valid JSON matching the requested schema.
"""

    result_json = generate_json(prompt, ReviewResponse)

    try:
        return ReviewResponse.model_validate_json(result_json)

    except Exception as error:
        print("Review JSON Error:", error)

        raise HTTPException(
            status_code=500,
            detail="Gemini returned an invalid review."
        )


@app.post("/api/fix", response_model=FixResponse)
def fix_code(request: FixRequest):

    if not request.code.strip():
        raise HTTPException(
            status_code=400,
            detail="Code cannot be empty."
        )

    if not request.issue.strip():
        raise HTTPException(
            status_code=400,
            detail="Issue description cannot be empty."
        )

    prompt = f"""
You are an expert software engineer.

Fix the specific issue identified in the submitted code.

Programming language:
{request.language}

Original code:
{request.code}

Issue:
{request.issue}

Requirements:

- Preserve the intended behavior.
- Fix the identified issue.
- Do not remove unrelated functionality.
- Do not invent requirements.
- Keep the code readable.
- Return the complete corrected source code.
- Also provide a short explanation of the fix.
- Do not execute the code.

Return ONLY valid JSON matching this structure:

{{
    "explanation": "short explanation of the fix",
    "fixed_code": "complete corrected source code"
}}
"""

    result_json = generate_json(prompt, FixResponse)

    try:
        return FixResponse.model_validate_json(result_json)

    except Exception as error:
        print("Fix JSON Error:", error)

        raise HTTPException(
            status_code=500,
            detail="Gemini returned an invalid fix."
        )