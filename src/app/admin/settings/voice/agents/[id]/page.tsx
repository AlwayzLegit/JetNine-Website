import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { getAgent, listVersions } from "@/domain/voice-agents/queries";
import { DeskHeader } from "@/components/admin/desk-ui";
import {
  ELEVENLABS_MODELS,
  ELEVENLABS_VOICES,
  INTERRUPT_SENSITIVITY,
  LLM_MODEL_SUGGESTIONS,
  STT_PROVIDERS,
  TTS_PROVIDERS,
} from "@/lib/voice-agent-config";
import { AgentEditor } from "./agent-editor";

export const dynamic = "force-dynamic";

// One voice agent: every layer of its settings, saved as a new version on
// each save. Owners only (the page gates; so do the voiceAgent.* ops).

export default async function VoiceAgentPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const agent = await getAgent(id).catch(() => null);
  if (!agent) notFound();
  const versions = await listVersions(id).catch(() => []);

  return (
    <div>
      <DeskHeader
        size="md"
        back={{ href: "/admin/settings/voice", label: "Settings › Voice agent" }}
        title={agent.name}
        lead={
          agent.isLive
            ? "This agent answers the JetNine line. Changes apply to the next call after you save."
            : agent.archived
              ? "Archived. Restore it to edit or make it live."
              : "Not live. Save your changes, then make it live when you are ready."
        }
      />
      <div className="mt-6">
        <AgentEditor
          agent={{
            id: agent.id,
            name: agent.name,
            description: agent.description ?? "",
            version: agent.version,
            isLive: agent.isLive,
            archived: agent.archived,
            config: agent.config,
          }}
          versions={versions.map((v) => ({ ...v, createdAt: v.createdAt.toISOString() }))}
          choices={{
            ttsProviders: [...TTS_PROVIDERS],
            elevenLabsModels: [...ELEVENLABS_MODELS],
            voices: ELEVENLABS_VOICES,
            sttProviders: [...STT_PROVIDERS],
            interruptSensitivity: [...INTERRUPT_SENSITIVITY],
            llmModels: LLM_MODEL_SUGGESTIONS.map((m) => ({ id: m.id, label: m.label })),
          }}
        />
      </div>
    </div>
  );
}
