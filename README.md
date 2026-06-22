# FRIDAY — Local Desktop AI Assistant

Jarvis-inspired, safety-first local assistant built with **Next.js**, **Electron**, **TypeScript**, **Tailwind CSS**, and **Ollama**.

## Features

- Type or speak commands (Web Speech API MVP)
- Local AI via Ollama with structured JSON action plans
- Safe file search in allowed folders (Desktop, Documents, Downloads, Pictures)
- Open files, create/append `.txt` / `.md` with confirmation
- Web search via DuckDuckGo
- Centralized safety guard (no shell commands, no deletion, blocked sensitive paths)
- Action logs, settings page, confirmation modals

## Prerequisites

1. **Node.js 20+**
2. **Ollama** — [https://ollama.com](https://ollama.com)

```bash
ollama serve
ollama pull llama3.2
```

## Quick Start

```bash
npm install
npm run dev
```

This starts Next.js on `http://localhost:3000` and launches the Electron desktop shell.

## Project Structure

```
app/              Next.js UI (dashboard, settings)
components/       React UI components
electron/         Electron main + preload
lib/              Settings, safety, logger, orchestrator
services/         AI (Ollama), web search
tools/            Safe tool implementations
types/            Shared TypeScript types
scripts/          Electron build script
```

## Architecture

1. User sends a command from the UI
2. Electron main process calls Ollama for a **structured JSON action plan**
3. Safety guard validates tool, path, and risk level
4. Medium-risk actions require user confirmation in a modal
5. Approved tools execute via controlled Node/Electron APIs
6. Results and logs are shown in the dashboard

## Safety Rules (v1)

- AI never runs shell commands directly
- File deletion disabled
- Sensitive paths blocked (`.ssh`, system dirs, credentials)
- Writes require confirmation with content preview
- High-risk intents blocked

## Settings

Open **Settings** in the app to configure:

- Ollama model and base URL
- Allowed folders
- Safety mode
- Voice options

Settings are stored at `~/.friday-assistant/settings.json`.

## Build for Production

```bash
npm run build
npm start
```

## Example Commands

- `Search Google for Groq API key generation`
- `Check whether resume.pdf exists in Downloads`
- `List all PDF files in my Downloads`
- `Open my latest screenshot`
- `Create a file called ideas.md in Documents and write these notes`
- `Open VS Code`

## Future Providers

The AI layer is designed for optional OpenAI/Groq providers. Ollama is the default local-first option.
