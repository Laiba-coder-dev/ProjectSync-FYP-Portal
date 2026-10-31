"""
ProjectSync AI Microservice
FastAPI server providing AI-powered features using local sentence-transformers.
Replaces Gemini API calls with fully offline, cost-free computation.

Endpoints:
  POST /ai/extract-tags          - Extract domain tags from project abstract
  POST /ai/similarity-check      - Check plagiarism against past projects
  POST /ai/recommend-supervisors - Capacity-aware supervisor matching
  POST /ai/suggest-ideas         - Domain-based project idea suggestions
  POST /ai/smart-feedback        - Generate structural feedback report
  GET  /health                   - Health check
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
import pandas as pd
import numpy as np
from sklearn.metrics.pairwise import cosine_similarity
from sentence_transformers import SentenceTransformer
import os
import logging
import asyncio
from concurrent.futures import ThreadPoolExecutor

executor = ThreadPoolExecutor(max_workers=4)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="ProjectSync AI Service",
    description="Local AI microservice for FYP Portal using sentence-transformers",
    version="2.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# =====================================================================
# GLOBAL STATE — Model & Data loaded once at startup
# =====================================================================

SERVICE_DIR = os.path.dirname(os.path.abspath(__file__))
TEACHER_FILE = os.path.join(SERVICE_DIR, "Teacher_Expertise.xlsx")
PROJECT_FILE = os.path.join(SERVICE_DIR, "Past_Projects.xlsx")

# Global variables set during startup
model: SentenceTransformer = None
teachers_df: pd.DataFrame = None
past_projects_df: pd.DataFrame = None
domain_embeddings: np.ndarray = None
past_project_embeddings: np.ndarray = None
tag_embeddings: np.ndarray = None

TAXONOMY_TAGS = [
    "Machine Learning", "Deep Learning", "Computer Vision",
    "Natural Language Processing", "Cybersecurity", "Cryptography",
    "Cloud Computing", "Kubernetes", "DevOps", "Blockchain",
    "Smart Contracts", "Data Science", "Mobile Development",
    "Penetration Testing", "Web Development", "IoT",
    "Augmented Reality", "Database Systems", "Network Security",
    "Software Engineering"
]


def create_sample_teacher_data() -> pd.DataFrame:
    """Creates realistic seed data for USKT faculty."""
    data = [
        {"Teacher": "Dr. Ahmed Raza",       "Expertise": "Machine Learning, Deep Learning, Computer Vision",     "Department": "CS",   "Max_Slots": 5, "Current_Occupied": 2},
        {"Teacher": "Dr. Sara Khan",         "Expertise": "Natural Language Processing, Data Science, AI",         "Department": "CS",   "Max_Slots": 4, "Current_Occupied": 4},
        {"Teacher": "Dr. Usman Ali",         "Expertise": "Cybersecurity, Cryptography, Network Security",          "Department": "IT",   "Max_Slots": 5, "Current_Occupied": 1},
        {"Teacher": "Dr. Fatima Malik",      "Expertise": "Cloud Computing, DevOps, Kubernetes",                    "Department": "SE",   "Max_Slots": 4, "Current_Occupied": 2},
        {"Teacher": "Dr. Bilal Hassan",      "Expertise": "Blockchain, Smart Contracts, Web Development",           "Department": "CS",   "Max_Slots": 3, "Current_Occupied": 3},
        {"Teacher": "Prof. Nadia Iqbal",     "Expertise": "Mobile Development, IoT, Augmented Reality",             "Department": "IT",   "Max_Slots": 5, "Current_Occupied": 0},
        {"Teacher": "Dr. Kamran Siddiqui",   "Expertise": "Database Systems, Software Engineering, Web Development","Department": "SE",   "Max_Slots": 4, "Current_Occupied": 1},
        {"Teacher": "Dr. Hina Zafar",        "Expertise": "Penetration Testing, Cybersecurity, Ethical Hacking",   "Department": "IT",   "Max_Slots": 4, "Current_Occupied": 2},
        {"Teacher": "Prof. Tariq Mehmood",   "Expertise": "Data Science, Machine Learning, Statistical Modeling",  "Department": "CS",   "Max_Slots": 5, "Current_Occupied": 3},
        {"Teacher": "Dr. Asma Nawaz",        "Expertise": "Computer Vision, Deep Learning, Image Processing",       "Department": "CS",   "Max_Slots": 3, "Current_Occupied": 1},
    ]
    return pd.DataFrame(data)


def create_sample_project_data() -> pd.DataFrame:
    """Creates realistic seed data for past FYP projects."""
    data = [
        {"Project Title": "Deep Learning Based Face Recognition System",                   "Supervisor": "Dr. Ahmed Raza",     "Year": 2023, "Domain": "Computer Vision"},
        {"Project Title": "Blockchain Based Academic Certificate Verification",             "Supervisor": "Dr. Bilal Hassan",   "Year": 2023, "Domain": "Blockchain"},
        {"Project Title": "IoT Smart Home Automation System",                             "Supervisor": "Prof. Nadia Iqbal",  "Year": 2022, "Domain": "IoT"},
        {"Project Title": "Sentiment Analysis of Urdu Social Media Text",                 "Supervisor": "Dr. Sara Khan",      "Year": 2023, "Domain": "NLP"},
        {"Project Title": "Network Intrusion Detection Using Machine Learning",            "Supervisor": "Dr. Usman Ali",      "Year": 2022, "Domain": "Cybersecurity"},
        {"Project Title": "Cloud Based Hospital Management System",                       "Supervisor": "Dr. Fatima Malik",   "Year": 2023, "Domain": "Cloud Computing"},
        {"Project Title": "Cryptographic Key Management for IoT Devices",                 "Supervisor": "Dr. Usman Ali",      "Year": 2022, "Domain": "Cryptography"},
        {"Project Title": "E-Commerce Mobile Application with AR Try-On",                 "Supervisor": "Prof. Nadia Iqbal",  "Year": 2023, "Domain": "Mobile Development"},
        {"Project Title": "Predictive Analytics for Student Performance",                  "Supervisor": "Prof. Tariq Mehmood","Year": 2023, "Domain": "Data Science"},
        {"Project Title": "Automated Penetration Testing Framework",                       "Supervisor": "Dr. Hina Zafar",     "Year": 2022, "Domain": "Cybersecurity"},
        {"Project Title": "Medical Image Segmentation Using Deep Neural Networks",         "Supervisor": "Dr. Asma Nawaz",     "Year": 2023, "Domain": "Computer Vision"},
        {"Project Title": "Real-Time Traffic Management Using Computer Vision",            "Supervisor": "Dr. Ahmed Raza",     "Year": 2022, "Domain": "Computer Vision"},
        {"Project Title": "Decentralized Voting System on Ethereum Blockchain",           "Supervisor": "Dr. Bilal Hassan",   "Year": 2023, "Domain": "Blockchain"},
        {"Project Title": "DevOps Pipeline Automation for Microservices",                 "Supervisor": "Dr. Fatima Malik",   "Year": 2023, "Domain": "DevOps"},
        {"Project Title": "Natural Language Question Answering System for Urdu",          "Supervisor": "Dr. Sara Khan",      "Year": 2022, "Domain": "NLP"},
    ]
    return pd.DataFrame(data)

# =====================================================================
# GLOBAL STATE — Model & Data loaded once at startup
# =====================================================================

logger.info("[STARTUP] Loading sentence-transformers model (all-MiniLM-L6-v2)...")
model = SentenceTransformer("all-MiniLM-L6-v2")
logger.info("[STARTUP] Model loaded successfully.")

# Load or create Teacher data
if os.path.exists(TEACHER_FILE):
    teachers_df = pd.read_excel(TEACHER_FILE)
    logger.info(f"[STARTUP] Loaded {len(teachers_df)} teachers from {TEACHER_FILE}")
else:
    teachers_df = create_sample_teacher_data()
    teachers_df.to_excel(TEACHER_FILE, index=False)
    logger.info(f"[STARTUP] Created sample teacher data with {len(teachers_df)} records at {TEACHER_FILE}")

teachers_df["Domain_Clean"] = teachers_df["Expertise"].astype(str).str.lower().str.strip()

# Load or create Past Projects data
if os.path.exists(PROJECT_FILE):
    past_projects_df = pd.read_excel(PROJECT_FILE)
    logger.info(f"[STARTUP] Loaded {len(past_projects_df)} past projects from {PROJECT_FILE}")
else:
    past_projects_df = create_sample_project_data()
    past_projects_df.to_excel(PROJECT_FILE, index=False)
    logger.info(f"[STARTUP] Created sample project data with {len(past_projects_df)} records at {PROJECT_FILE}")

past_projects_df["Title_Clean"] = past_projects_df["Project Title"].astype(str).str.lower().str.strip()

# Pre-compute all embeddings
logger.info("[STARTUP] Computing embeddings...")
domain_embeddings = model.encode(teachers_df["Domain_Clean"].tolist())
past_project_embeddings = model.encode(past_projects_df["Title_Clean"].tolist())
tag_embeddings = model.encode(TAXONOMY_TAGS)
logger.info("[STARTUP] All embeddings computed. Service ready.")


# =====================================================================
# REQUEST / RESPONSE MODELS
# =====================================================================

class ExtractTagsRequest(BaseModel):
    abstract: str

class SimilarityCheckRequest(BaseModel):
    title: str

class RecommendSupervisorsRequest(BaseModel):
    title: str
    abstract: str
    tags: list[str] = []
    supervisor_data: Optional[list[dict]] = None  # Live data from Firestore via C# proxy

class SuggestIdeasRequest(BaseModel):
    domain: str

class SmartFeedbackRequest(BaseModel):
    title: str
    abstract: str
    milestone_type: str = "proposal"
    top_match: Optional[dict] = None


# =====================================================================
# FEATURE 1: AI AUTO-TAG ENGINE
# =====================================================================

@app.post("/ai/extract-tags")
async def extract_tags(req: ExtractTagsRequest):
    """Extract domain tags from project abstract using cosine similarity."""
    if not req.abstract or len(req.abstract.strip()) < 10:
        raise HTTPException(status_code=400, detail="Abstract is too short (minimum 10 characters).")

    title_clean = req.abstract.strip().lower()

    def process_tags():
        project_embedding = model.encode([title_clean])
        return cosine_similarity(project_embedding, tag_embeddings).flatten()

    loop = asyncio.get_running_loop()
    similarities = await loop.run_in_executor(executor, process_tags)

    extracted_tags = []
    for idx, score in enumerate(similarities):
        boost = 0.20 if TAXONOMY_TAGS[idx].lower() in title_clean else 0.0
        if (score + boost) >= 0.38:
            extracted_tags.append(TAXONOMY_TAGS[idx])

    result = extracted_tags if extracted_tags else ["General Research"]
    return {"tags": result}


# =====================================================================
# FEATURE 2: PLAGIARISM & SIMILARITY AUDITOR
# =====================================================================

@app.post("/ai/similarity-check")
async def similarity_check(req: SimilarityCheckRequest):
    """Cross-check project title against past projects for plagiarism."""
    if not req.title or len(req.title.strip()) < 5:
        raise HTTPException(status_code=400, detail="Title is too short.")

    title_clean = req.title.strip().lower()

    def process_similarity():
        new_embedding = model.encode([title_clean])
        return cosine_similarity(new_embedding, past_project_embeddings).flatten()

    loop = asyncio.get_running_loop()
    similarities = await loop.run_in_executor(executor, process_similarity)

    max_idx = int(np.argmax(similarities))
    top_score = float(similarities[max_idx])

    if top_score >= 0.75:
        status = "CRITICAL REJECTION: Severe Overlap Detected"
    elif top_score >= 0.45:
        status = "WARNING: Moderate Similarity Found (Manual Panel Audit Advised)"
    else:
        status = "Approved / Unique"

    conflicting_row = past_projects_df.iloc[max_idx]
    return {
        "similarityScore": round(top_score * 100, 2),
        "status": status,
        "conflictingProject": str(conflicting_row["Project Title"]),
        "conflictingSupervisor": str(conflicting_row["Supervisor"]),
        "similarProjects": [
            {
                "id": f"past_{max_idx}",
                "title": str(conflicting_row["Project Title"]),
                "reason": f"Semantic similarity score: {round(top_score * 100, 2)}%"
            }
        ] if top_score >= 0.45 else []
    }


# =====================================================================
# FEATURE 3: CAPACITY-AWARE SUPERVISOR RECOMMENDATION
# =====================================================================

@app.post("/ai/recommend-supervisors")
async def recommend_supervisors(req: RecommendSupervisorsRequest):
    """Capacity-aware hybrid scoring for supervisor recommendations."""
    if not req.title:
        raise HTTPException(status_code=400, detail="Title is required.")

    if not req.supervisor_data or len(req.supervisor_data) == 0:
        return {"recommendations": [], "totalCandidates": 0}

    final_rankings = []
    for sup in req.supervisor_data:
        max_slots = int(sup.get("maxGroups", 5))
        current_occupied = int(sup.get("currentGroups", 0))

        is_available = current_occupied < max_slots
        slots_left = max(0, max_slots - current_occupied)

        # Match score based purely on availability (slots left / max slots)
        confidence = round((slots_left / max_slots) * 100, 2) if max_slots > 0 else 0.0

        final_rankings.append({
            "supervisorId": sup.get("id"),
            "name": str(sup.get("name", "Unknown Faculty")),
            "expertise": str(sup.get("expertise", "")),
            "department": str(sup.get("department", "CS")),
            "matchScore": confidence,
            "slotsLeft": slots_left,
            "totalSlots": max_slots,
            "isAvailable": is_available
        })

    # Sort primarily by slots left, then by match score
    final_rankings.sort(key=lambda x: (x["slotsLeft"], x["matchScore"]), reverse=True)

    # Return top 3 available + top overall
    available = [r for r in final_rankings if r["isAvailable"]][:3]
    if len(available) < 3:
        # Pad with unavailable but show them as such
        rest = [r for r in final_rankings if not r["isAvailable"]]
        available += rest[:3 - len(available)]

    return {"recommendations": available[:3], "totalCandidates": len(final_rankings)}


# =====================================================================
# FEATURE 3.5: PROPOSAL PROCESS & SUPERVISOR RECOMMENDATION
# =====================================================================

import json
from fastapi import UploadFile, Form, File
import io

@app.post("/ai/process-proposal-and-recommend")
async def process_proposal_and_recommend(
    proposalDocument: UploadFile = File(None),
    projectTitle: str = Form(None),
    abstractText: str = Form(None),
    domain: str = Form(None),
    supervisors_json: str = Form(...)
):
    """Process uploaded proposal document and return ranked supervisors based on 50% domain / 50% semantic match."""
    # 1. Parse Supervisors
    try:
        supervisors = json.loads(supervisors_json)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid supervisors_json format.")

    # 2. Extract Text
    document_text = ""
    if proposalDocument:
        contents = await proposalDocument.read()
        filename = proposalDocument.filename.lower()
        
        if filename.endswith(".pdf"):
            try:
                from PyPDF2 import PdfReader
                reader = PdfReader(io.BytesIO(contents))
                document_text = " ".join([page.extract_text() for page in reader.pages if page.extract_text()])
            except Exception as e:
                logger.error(f"Failed to parse PDF: {e}")
        elif filename.endswith(".docx"):
            try:
                import docx
                doc = docx.Document(io.BytesIO(contents))
                document_text = " ".join([p.text for p in doc.paragraphs])
            except Exception as e:
                logger.error(f"Failed to parse DOCX: {e}")
                
    if not document_text:
        # Fallback to provided fields if no file or extraction failed
        document_text = f"{projectTitle or ''} {abstractText or ''} {domain or ''}"

    document_text = document_text.strip()
    if not document_text:
        return {"recommendations": [], "totalCandidates": 0}

    # 3. Calculate Matches
    # For content overlap, we use semantic similarity
    def process_recommendations():
        doc_embedding = model.encode([document_text.lower()])[0]
        input_domain = (domain or "").lower()
        
        valid_sups = []
        for sup in supervisors:
            max_slots = int(sup.get("maxGroups", 4))
            current_occupied = int(sup.get("activeGroupsCount", 0))
            if current_occupied >= max_slots:
                continue
                
            expertise_list = sup.get("expertise", [])
            if not isinstance(expertise_list, list):
                expertise_list = [e.strip() for e in str(expertise_list).split(",") if e.strip()]
            if not expertise_list:
                continue
                
            valid_sups.append((sup, expertise_list, max_slots, current_occupied))
            
        if not valid_sups:
            return []
            
        # Batch encode expertise texts
        exp_texts = [" ".join(e_list).lower() for _, e_list, _, _ in valid_sups]
        exp_embeddings = model.encode(exp_texts) if exp_texts else []
        
        # Batch encode all skills
        all_skills = []
        skill_counts = []
        for _, e_list, _, _ in valid_sups:
            for s in e_list:
                all_skills.append(s.lower())
            skill_counts.append(len(e_list))
            
        all_skill_embeddings = model.encode(all_skills) if all_skills else []
        
        results = []
        skill_idx = 0
        for i, (sup, expertise_list, max_slots, current_occupied) in enumerate(valid_sups):
            domain_match = 0.0
            matched_skills = []
            if input_domain:
                for exp in expertise_list:
                    if input_domain in exp.lower() or exp.lower() in input_domain:
                        domain_match = 1.0
                        if exp not in matched_skills:
                            matched_skills.append(exp)
                            
            semantic_sim = float(cosine_similarity([doc_embedding], [exp_embeddings[i]])[0][0])
            semantic_sim = max(0.0, min(1.0, semantic_sim))
            
            # Extract skills for this supervisor
            count = skill_counts[i]
            if count > 0:
                sup_skill_embs = all_skill_embeddings[skill_idx : skill_idx + count]
                skill_idx += count
                skill_sims = cosine_similarity([doc_embedding], sup_skill_embs)[0]
                for idx, s in enumerate(expertise_list):
                    if skill_sims[idx] > 0.3 and s not in matched_skills:
                        matched_skills.append(s)
            
            final_score = ( (domain_match * 0.5) + (semantic_sim * 0.5) ) * 100
            
            results.append({
                "id": sup.get("id"),
                "name": sup.get("name"),
                "email": sup.get("email"),
                "department": sup.get("department"),
                "matchPercentage": int(round(final_score)),
                "matchedSkills": matched_skills[:3],
                "activeGroupsCount": current_occupied,
                "maxGroups": max_slots
            })
            
        results.sort(key=lambda x: x["matchPercentage"], reverse=True)
        return results

    loop = asyncio.get_running_loop()
    final_rankings = await loop.run_in_executor(executor, process_recommendations)

    return {"recommendations": final_rankings[:5], "totalCandidates": len(final_rankings)}

# =====================================================================
# FEATURE 4: LOCAL IDEA SUGGESTER
# =====================================================================

@app.post("/ai/suggest-ideas")
async def suggest_ideas(req: SuggestIdeasRequest):
    """Generate project idea suggestions based on domain tag."""
    if not req.domain:
        raise HTTPException(status_code=400, detail="Domain is required.")

    domain = req.domain.strip()
    templates = [
        {
            "title": f"Intelligent {domain} Optimization Framework Using Ensemble Methods",
            "abstract": f"This project proposes an adaptive optimization framework targeting core {domain} challenges. Using ensemble machine learning and performance profiling, the system aims to automate bottleneck resolution and improve operational efficiency by 40%."
        },
        {
            "title": f"Next-Generation {domain} Security and Anomaly Detection Platform",
            "abstract": f"A robust, real-time security platform for {domain} environments leveraging behavioral analysis and unsupervised clustering to detect anomalies. The system integrates automated alerting and a compliance reporting dashboard for enterprise deployments."
        },
        {
            "title": f"Scalable {domain} Architecture with Federated Learning Integration",
            "abstract": f"Designing a privacy-preserving federated architecture for distributed {domain} applications. The project implements decentralized model training across heterogeneous nodes, enabling collaborative intelligence without sharing raw data."
        }
    ]

    # Enhance suggestions using semantic similarity if relevant past projects exist
    try:
        def get_top_project():
            domain_embedding = model.encode([domain.lower()])
            sims = cosine_similarity(domain_embedding, past_project_embeddings).flatten()
            top_idx = int(np.argmax(sims))
            top_project = str(past_projects_df.iloc[top_idx]["Project Title"])
            return float(sims[top_idx]), top_project
            
        loop = asyncio.get_running_loop()
        top_score, top_project = await loop.run_in_executor(executor, get_top_project)
        
        if top_score > 0.3:
            templates.append({
                "title": f"Extended Research: Advanced {domain} Analysis Beyond {top_project.split()[-1]}",
                "abstract": f"Building upon established {domain} research, this project extends prior work on similar domains by incorporating novel data sources, improved model architectures, and real-world deployment constraints for Pakistani institutional contexts."
            })
    except Exception:
        pass

    return {"ideas": templates[:3]}


# =====================================================================
# FEATURE 5: SMART FEEDBACK GENERATOR
# =====================================================================

@app.post("/ai/smart-feedback")
async def smart_feedback(req: SmartFeedbackRequest):
    """Generate structural feedback for a project submission."""
    feedback_items = []
    word_count = len(req.title.split())
    abstract_word_count = len(req.abstract.split()) if req.abstract else 0

    # Score performance based on title-tag similarity
    def get_best_tag_score():
        title_embedding = model.encode([req.title.lower()])
        tag_sims = cosine_similarity(title_embedding, tag_embeddings).flatten()
        return float(np.max(tag_sims)) * 100

    loop = asyncio.get_running_loop()
    best_tag_score = await loop.run_in_executor(executor, get_best_tag_score)

    # Check 1: Domain alignment
    if best_tag_score < 30:
        strengths = ["Project shows initiative in exploring a research area"]
        weaknesses = ["General vocabulary suggests poor departmental domain integration", "Keywords lack specificity for academic evaluation"]
        suggestions = ["Consult cross-discipline tags to refine research scope", "Align title terminology with established CS sub-domains", "Review past FYP examples for title structuring"]
        overall_score = max(1, int(best_tag_score / 10))
        summary = "The submission shows limited domain alignment. Significant refinement is recommended before supervisor review."
    elif best_tag_score < 60:
        strengths = ["Title shows awareness of a specific technical domain", "Research scope appears defined"]
        weaknesses = ["Domain coupling could be strengthened with more precise terminology", "Abstract may benefit from quantifiable objectives"]
        suggestions = ["Add specific methodology keywords to the title", "State measurable outcomes in the abstract", "Consider narrowing the problem scope"]
        overall_score = 5 + int((best_tag_score - 30) / 10)
        summary = "The submission demonstrates moderate domain understanding. Targeted refinements will significantly improve evaluation readiness."
    else:
        strengths = ["Strong baseline semantic coupling with specialized technical fields", "Title clearly communicates the research focus", "Domain terminology is appropriately specific"]
        weaknesses = ["Ensure the abstract details the specific methodology", "Quantify expected outcomes for stronger proposal credibility"]
        suggestions = ["Define evaluation metrics explicitly", "Cite at least one prior work to establish research context", "Align timeline with milestone deliverables"]
        overall_score = min(10, 7 + int((best_tag_score - 60) / 15))
        summary = "The submission demonstrates strong domain alignment and clarity. Minor improvements to methodology specification will complete a high-quality proposal."

    # Check top match availability
    if req.top_match and not req.top_match.get("isAvailable", True):
        teacher = req.top_match.get("name", "top matched supervisor")
        weaknesses.append(f"Top matched supervisor ({teacher}) has exhausted available supervision slots")
        suggestions.insert(0, "Initiate contact with the second or third ranked supervisor immediately")

    # Word count check
    if word_count < 5:
        weaknesses.append("Project title lacks execution parameters — too short for evaluation")
        suggestions.append("Expand title to include methodology or domain qualifier (e.g., 'via deep learning framework')")
    if abstract_word_count < 50:
        weaknesses.append("Abstract is too brief — a minimum of 50 words is recommended for proposal review")

    # Milestone-specific guidance
    milestone_guidance = {
        "proposal": "Ensure the proposal clearly states problem statement, objectives, and expected outcomes.",
        "mid_term": "Mid-term report should include progress metrics, completed milestones, and updated timeline.",
        "final": "Final submission must include full implementation, testing results, and conclusion chapter."
    }
    guidance = milestone_guidance.get(req.milestone_type, milestone_guidance["proposal"])

    return {
        "overallScore": overall_score,
        "summary": summary,
        "strengths": strengths,
        "weaknesses": weaknesses,
        "suggestions": suggestions,
        "milestoneGuidance": guidance
    }


# =====================================================================
# HEALTH CHECK
# =====================================================================

@app.get("/health")
async def health_check():
    return {
        "status": "ok",
        "model": "all-MiniLM-L6-v2",
        "teachers_loaded": len(teachers_df) if teachers_df is not None else 0,
        "past_projects_loaded": len(past_projects_df) if past_projects_df is not None else 0,
        "taxonomy_tags": len(TAXONOMY_TAGS)
    }

# =====================================================================
# FEATURE 6: PROJECT QUALITY ANALYZER
# =====================================================================

from fastapi import UploadFile, Form, File
import json
from quality_analyzer import (
    run_idea_analysis,
    run_document_analysis,
    run_full_analysis,
    run_custom_analysis
)

# Optional import for pyxtxt if needed
try:
    from pyxtxt import xtxt
except ImportError:
    xtxt = lambda content: content.decode("utf-8", errors="ignore")

import uuid

active_tasks = {}

@app.post("/ai/analyzer/start")
async def start_project_analyzer(
    mode: str = Form(...),
    title: str = Form(""),
    description: str = Form(""),
    domain: str = Form(""),
    custom_checks: str = Form(""),  # JSON string array
    file: UploadFile = File(None)
):
    """Start an asynchronous project quality analysis."""
    task_id = str(uuid.uuid4())
    
    document_text = ""
    if file:
        content = await file.read()
        filename = file.filename.lower() if file.filename else ""
        try:
            if filename.endswith(".pdf"):
                import PyPDF2
                import io
                pdf = PyPDF2.PdfReader(io.BytesIO(content))
                document_text = " ".join([page.extract_text() for page in pdf.pages if page.extract_text()])
            elif filename.endswith(".docx"):
                import docx
                import io
                doc = docx.Document(io.BytesIO(content))
                document_text = " ".join([p.text for p in doc.paragraphs])
            else:
                try:
                    document_text = xtxt(content)
                except Exception:
                    # Fallback to UTF-8 only for non-binary formats
                    document_text = content.decode("utf-8", errors="ignore")
        except Exception as e:
            logger.error(f"Extraction error for {filename}: {e}")
            document_text = ""

    active_tasks[task_id] = {
        "status": "processing",
        "progress": 0,
        "current_step": "Initializing analysis...",
        "results": None,
        "task_obj": None
    }
    
    # Spawn background task
    task = asyncio.create_task(run_analysis_task(task_id, mode, title, description, domain, document_text, custom_checks))
    active_tasks[task_id]["task_obj"] = task
    
    return {"task_id": task_id, "status": "processing", "progress": 0}

@app.get("/ai/analyzer/status/{task_id}")
async def get_analyzer_status(task_id: str):
    if task_id not in active_tasks:
        raise HTTPException(status_code=404, detail="Task not found")
        
    task_info = active_tasks[task_id]
    return {
        "status": task_info["status"],
        "progress": task_info["progress"],
        "current_step": task_info["current_step"],
        "results": task_info["results"]
    }

@app.post("/ai/analyzer/cancel/{task_id}")
async def cancel_analyzer(task_id: str):
    if task_id not in active_tasks:
        raise HTTPException(status_code=404, detail="Task not found")
        
    task_info = active_tasks[task_id]
    if task_info["status"] == "processing":
        if task_info["task_obj"]:
            task_info["task_obj"].cancel()
        task_info["status"] = "cancelled"
        task_info["progress"] = 0
        task_info["current_step"] = "Task cancelled by user"
        
    return {"status": "cancelled"}

async def run_analysis_task(task_id, mode, title, description, domain, document_text, custom_checks):
    try:
        active_tasks[task_id]["progress"] = 10
        active_tasks[task_id]["current_step"] = "Checking prerequisites..."
        await asyncio.sleep(1) # simulate initial step
        
        # --- NEW ZERO-CONTENT GUARDRAIL ---
        if mode in ["document", "full"] or (mode == "custom" and document_text):
            clean_text = document_text.strip()
            word_count = len(clean_text.split())
            MINIMUM_REQUIRED_WORDS = 50

            if word_count < MINIMUM_REQUIRED_WORDS:
                active_tasks[task_id]["progress"] = 100
                active_tasks[task_id]["current_step"] = "Validation Failed"
                active_tasks[task_id]["status"] = "completed"
                active_tasks[task_id]["results"] = {
                    "overall_score": 0,
                    "structure_score": 0,
                    "content_quality_score": 0,
                    "grammar_score": 0,
                    "status": "FAILED_VALIDATION",
                    "error_message": f"Document is empty or contains insufficient content ({word_count} words). Minimum required: {MINIMUM_REQUIRED_WORDS} words.",
                    "recommendations": [
                        "Upload a document containing valid project content.",
                        "Ensure the document is not password protected or corrupted."
                    ]
                }
                return
        # --- END GUARDRAIL ---

        loop = asyncio.get_running_loop()
        
        if mode == "idea":
            active_tasks[task_id]["progress"] = 40
            active_tasks[task_id]["current_step"] = "Analyzing idea quality..."
            await asyncio.sleep(1)
            results = await loop.run_in_executor(executor, run_idea_analysis, title, description, domain)
        elif mode == "document":
            active_tasks[task_id]["progress"] = 40
            active_tasks[task_id]["current_step"] = "Analyzing document structure..."
            await asyncio.sleep(1)
            results = await loop.run_in_executor(executor, run_document_analysis, document_text)
        elif mode == "custom":
            try:
                checks = json.loads(custom_checks)
            except Exception:
                checks = []
            active_tasks[task_id]["progress"] = 40
            active_tasks[task_id]["current_step"] = "Running custom checks..."
            await asyncio.sleep(1)
            results = await loop.run_in_executor(executor, run_custom_analysis, title, description, domain, document_text, checks)
        else: # "full"
            active_tasks[task_id]["progress"] = 30
            active_tasks[task_id]["current_step"] = "Evaluating idea and domain match..."
            await asyncio.sleep(1.5)
            
            active_tasks[task_id]["progress"] = 60
            active_tasks[task_id]["current_step"] = "Analyzing document content..."
            await asyncio.sleep(1.5)
            
            active_tasks[task_id]["progress"] = 90
            active_tasks[task_id]["current_step"] = "Finalizing scores..."
            
            results = await loop.run_in_executor(executor, run_full_analysis, title, description, domain, document_text, None, None)
            
        active_tasks[task_id]["progress"] = 100
        active_tasks[task_id]["current_step"] = "Complete"
        active_tasks[task_id]["status"] = "completed"
        active_tasks[task_id]["results"] = results
        
    except asyncio.CancelledError:
        pass # Handle cancellation gracefully
    except Exception as e:
        logger.error(f"Analysis task failed: {e}")
        active_tasks[task_id]["status"] = "failed"
        active_tasks[task_id]["current_step"] = "Analysis failed due to internal error."


# =====================================================================
# FEATURE 7: AI PANEL SCHEDULER
# =====================================================================

import io as _io
from panel_scheduler import generate_panel_schedule


@app.post("/ai/schedule-panels")
async def schedule_panels(
    timetable: UploadFile = File(..., description="Timetable workbook (.xlsx)"),
    expertise: UploadFile = File(..., description="Teacher expertise workbook (.xlsx)"),
    projects:  UploadFile = File(..., description="Project list workbook (.xlsx)"),
    panels:              int = Form(...),
    teachers_per_panel:  int = Form(...),
    duration:            int = Form(...),
    days:               str = Form(...),
    start_time:         str = Form(...),
    end_time:           str = Form(...),
):
    """
    Generate a conflict-free FYP evaluation panel schedule.

    Accepts multipart/form-data with three .xlsx uploads and six
    scheduling parameters.  Returns a JSON schedule ready for the
    React results renderer.
    """
    # --- Input validation ---------------------------------------------------
    errors = []
    if not 1 <= panels <= 20:
        errors.append("'panels' must be between 1 and 20.")
    if not 1 <= teachers_per_panel <= 50:
        errors.append("'teachers_per_panel' must be between 1 and 50.")
    if not 5 <= duration <= 180:
        errors.append("'duration' must be between 5 and 180 minutes.")
    if not days.strip():
        errors.append("'days' must not be empty.")
    if errors:
        raise HTTPException(status_code=400, detail="; ".join(errors))

    # --- Read files into memory --------------------------------------------
    try:
        timetable_bytes = _io.BytesIO(await timetable.read())
        expertise_bytes = _io.BytesIO(await expertise.read())
        projects_bytes  = _io.BytesIO(await projects.read())
    except Exception as exc:
        logger.error(f"[schedule-panels] File read error: {exc}")
        raise HTTPException(status_code=400, detail=f"Failed to read uploaded files: {exc}")

    # --- Run scheduler in thread pool (CPU-bound) --------------------------
    def _run():
        return generate_panel_schedule(
            timetable_file    = timetable_bytes,
            expertise_file    = expertise_bytes,
            projects_file     = projects_bytes,
            num_panels        = panels,
            teachers_per_panel= teachers_per_panel,
            duration          = duration,
            raw_days          = days,
            start_time_str    = start_time,
            end_time_str      = end_time,
        )

    try:
        loop = asyncio.get_running_loop()
        schedule = await loop.run_in_executor(executor, _run)
    except Exception as exc:
        logger.error(f"[schedule-panels] Scheduler error: {exc}", exc_info=True)
        raise HTTPException(
            status_code=400,
            detail=f"Scheduling failed: {str(exc)}. Check that the uploaded files match "
                   "the expected format (multi-sheet timetable, expertise list, project list)."
        )

    return {"success": True, "schedule": schedule}
