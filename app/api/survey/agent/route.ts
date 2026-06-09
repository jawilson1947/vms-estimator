import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export interface AgentMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface AgentLocationData {
  projectId: number;
  areaName:  string;
  floor:     string | null;
  surveyNotes: string | null;
  markSurveyed: boolean;
}

export interface AgentAction {
  type: 'confirm' | 'save' | 'next' | 'exit';
  data?: AgentLocationData;
}

export interface AgentResponse {
  message: string;
  action:  AgentAction | null;
}

function buildSystemPrompt(projectId: number, buildingName: string): string {
  return `You are a survey assistant helping a field technician log camera locations for a security system survey.

The survey is for project ID ${projectId}, conducted in building: "${buildingName}".

Your job is to conduct a friendly, one-question-at-a-time conversation to collect these fields for each location:
1. Floor (optional) — e.g. "Ground", "1", "2", "Basement"
2. Area name (required) — e.g. "Main Lobby", "Server Room Hallway"
3. Survey notes (optional) — any observations, mounting notes, coverage requirements
4. Mark as surveyed — yes or no

Rules:
- Ask one question at a time. Be brief and conversational.
- Accept natural language answers. "yeah" = yes, "nah" / "skip" = no/skip, "dunno" = null/unknown.
- After collecting all fields, show a confirmation summary before saving. Format it clearly.
- After the summary, wait for the user to confirm. Accept "yes", "save", "ok", "confirm", "correct" as confirmation.
- After saving, ask "Add another location?" — accept "yes"/"next"/"another" to start a new form, "no"/"done"/"exit"/"quit" to exit.
- If the user says "exit", "done", "quit", or "stop" at any point, exit gracefully.

IMPORTANT: You must always respond with valid JSON in this exact shape:
{
  "message": "<your conversational reply to show the user>",
  "action": null
}

When you have collected all fields AND the user has confirmed the summary, set action to:
{
  "message": "Saving location...",
  "action": { "type": "save", "data": { "projectId": ${projectId}, "areaName": "<string>", "floor": "<string or null>", "surveyNotes": "<string or null>", "markSurveyed": <boolean> } }
}

When the user wants to add another location after saving, set action to:
{
  "message": "Starting a new location. Which floor?",
  "action": { "type": "next" }
}

When the user wants to exit, set action to:
{
  "message": "Survey session complete. Great work!",
  "action": { "type": "exit" }
}

Never include markdown formatting in the "message" field — plain text only.
Always output valid JSON. No prose outside the JSON object.`;
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  if (!process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY === 'YOUR_ANTHROPIC_API_KEY_HERE') {
    return NextResponse.json(
      { error: 'ANTHROPIC_API_KEY is not configured. Add it to .env.local.' },
      { status: 503 }
    );
  }

  const body = await req.json();
  const { messages, projectId, buildingName }: {
    messages: AgentMessage[];
    projectId: number;
    buildingName: string;
  } = body;

  if (!messages || !projectId || !buildingName) {
    return NextResponse.json({ error: 'messages, projectId, and buildingName are required' }, { status: 400 });
  }

  try {
    const response = await client.messages.create({
      model:      'claude-haiku-4-5-20251001',
      max_tokens: 512,
      system:     buildSystemPrompt(projectId, buildingName),
      messages:   messages.map(m => ({ role: m.role, content: m.content })),
    });

    const text = response.content[0].type === 'text' ? response.content[0].text : '';

    let parsed: AgentResponse;
    try {
      const start   = text.indexOf('{');
      const end     = text.lastIndexOf('}');
      const cleaned = start !== -1 && end > start ? text.slice(start, end + 1) : text;
      parsed = JSON.parse(cleaned);
    } catch {
      parsed = { message: text, action: null };
    }

    return NextResponse.json(parsed);
  } catch (err) {
    console.error('[survey/agent]', err);
    return NextResponse.json({ error: 'Agent request failed' }, { status: 500 });
  }
}
