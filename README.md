# Engineering Journey System

This repository implements a portable, dual‑layer system for capturing:

- Solution Journey Records (primary learning artifact)
- Architecture Decision Records (stable decision memory)
- Agent Memory Extracts (prompt patterns, anti‑patterns, heuristics)

## Purpose

Modern development involves human + AI collaboration. Traditional ADRs only capture the decision, not the reasoning, collaboration, or learning behind it. This system fixes that.

## Structure

/docs/journey → learning-first session records  
/docs/adr → architectural decisions  
/docs/agent-memory → reusable AI + dev heuristics  
/.github/copilot → Copilot agent behavior 
/.agents → sub-agents for extraction

## Usage Flow

1. Finish a coding session
2. Trigger Copilot: **"Create Journey Record"**
3. Commit the generated Journey + ADR (if present)
4. Agent memory gets updated automatically

## Long-Term Vision

A portable cognitive memory system for:
- Developer learning  
- AI agent alignment  
- Architectural traceability  
