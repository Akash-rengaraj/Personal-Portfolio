---
title: How Neo works: a three-agent threat-modelling pipeline with CrewAI and ChromaDB
date: 2026-09-20
summary: Why I split security analysis across three specialised agents, how retrieval feeds them context, and the routing trick that keeps simple questions fast.
tags: [ai, rag, security, crewai]
project: neo
---

Security reviews are slow because they are mostly *reading*: architecture notes, configs, code paths, compliance checklists. I wanted a tool that could do the first pass of that reading with me — interactively — while staying firmly on the defensive side. That became **Neo**, an interactive defensive analytics and auditing studio.

## The shape of the problem

A single large prompt that says "find the security issues in this" produces confident, generic answers. Real threat modelling is a sequence of different jobs:

1. figure out what you are actually looking at and what matters,
2. reason about how it could be attacked,
3. check the result against the rules you have to follow.

Each of those needs a different mindset, so Neo gives each one its own agent.

## Three agents, one crew

Neo uses **CrewAI** to orchestrate a three-tier hierarchy:

- **Triage Architect** — reads the question and the retrieved context, identifies the components, trust boundaries and data flows involved, and decides what is worth deeper analysis.
- **Threat Modeler** — takes the triaged view and reasons about attack paths and weak points for those specific components.
- **Compliance Reviewer** — checks the modelled threats against compliance expectations and turns them into a defensive, prioritised answer.

Passing work down the chain like this keeps each agent's prompt focused, and the final answer carries the reasoning of all three instead of one generalist guess.

## Retrieval: giving the agents something real to read

Agents are only as good as their context. Neo keeps a local cybersecurity knowledge base in **ChromaDB**, embedded with **BAAI/bge-large-en-v1.5**. Before the crew runs, the question is embedded, the most relevant passages are retrieved, and that historical context is injected into the pipeline.

Keeping the vector store local was deliberate: no data leaves the machine, and retrieval stays fast enough to feel conversational.

## The routing trick

Running three agents for every message is wasteful. "What does CSRF stand for?" does not need a triage-model-review pipeline.

So Neo routes each message first:

- **general questions** get a direct answer,
- **architectural or threat-related questions** invoke the full security reasoning chain.

This one decision made the tool feel responsive for everyday questions while keeping the heavy analysis for the questions that deserve it.

## A chat that remembers

The interface is built with **Streamlit**. Its session state keeps the whole conversation, so follow-ups like "and what about the admin panel?" work the way you expect — the context from earlier turns carries forward.

## What I'd do next

- Show the intermediate output of each agent, so the reasoning is auditable rather than a black box.
- Let users attach their own architecture docs to the vector store per session.
- Add evaluation: a fixed set of scenarios with expected findings, to catch regressions when prompts change.

Neo is still in active development — the code is on [GitHub](https://github.com/Akash-rengaraj/Neo), and the full case study is on the [project page](/projects/neo).
