# Product Context

## What We're Building

Fellowship is a LotR-themed multi-agent system for solo product developers, built as a Claude Code plugin. Ten named companions — each with distinct domain expertise, character voice, and tool scoping — handle the full product development lifecycle: planning, architecture, engineering, code review, security, testing, design, DevOps, and technical writing. Gandalf orchestrates. The user carries the Ring.

The core insight: named personas with genuine character produce more consistent, predictable agent behavior than generic functional labels. Identity constrains behavior in ways job descriptions don't.

## Target Users

Solo product developers building real products — not hobbyists or learners. People who work across the full stack, make product decisions themselves, and need reliable AI help on every layer of the work: from brainstorming what to build to shipping it with confidence. The kind of developer who would otherwise hire a small team.

Secondary: small teams (2–3 people) where coverage gaps make specialized agents genuinely useful.

## Business Objectives

Open-source, MIT licensed. Goals: adoption by solo developers who find current multi-agent tools either too generic (raw Claude), too narrow (code-only agents), or too complex to set up. Fellowship aims to be the most opinionated, most character-consistent, and most lifecycle-complete Claude Code plugin available.

Success metric: developers who install it and keep it across multiple real projects.

## Key Constraints

- **Plugin model** — must work as a native Claude Code plugin (no standalone CLI, no external servers required for core functionality). Low-friction install is non-negotiable.
- **Solo-dev scale** — token budget and complexity must be appropriate for one developer. No enterprise-scale features that add overhead without proportional value.
- **Character consistency** — every addition must fit the Fellowship aesthetic. Generic agents dilute identity. Ten companions with depth beats twenty with none.
- **MCP tools are opt-in** — Figma MCPs, browser server, Pencil are available but not required. Core workflow works without them.

## Current State

Usable. All ten companions are built and tested. The plugin installs, Gandalf orchestrates, companions dispatch and report. Health check passes 18/0.

What's not yet built: debug knowledge base, plan-before-build gate, context handoff protocol, codebase map command. All four are designed (spec at `docs/fellowship/specs/2026-03-27-plugin-improvement-spec.md`) and ready to implement.

Validation gap: Fellowship has not been used on a substantial real project yet. Orchestration gaps that only appear under real conditions are unknown.

## Team & Stakeholders

- **Karolus** — sole developer and product owner. Makes all decisions. When Karolus says "we" he means himself and the Fellowship.

## Product Principles

- **The Ring must not grow heavier.** Every addition is a burden. Scope is sacred.
- **Character is craft.** Voice consistency isn't cosmetic — it produces behavioral reliability.
- **Not every quest needs the full Fellowship.** Most tasks need one companion, maybe two. Default conservative.
- **Agent craft lives in the agent.** Each agent is a complete document. No cross-referencing, no drift.
- **Use the platform.** Claude Code provides memory, subagents, hooks, skills. Fellowship builds on these rather than reimplementing them.
- **Latency is the enemy.** Escalate only when the task demands it.
