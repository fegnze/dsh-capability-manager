import { z } from 'zod';
import { createUserMessage } from '@deepseek-ai/dsh-llm';
import { identitySchema, sameIdentity } from './schema.mjs';

export const EVIDENCE_KEY = 'dshAssistantBinding';
export const EVIDENCE_SOURCE = 'dsh-assistant-binding';
const markerSchema = z.object({
  kind: z.literal(EVIDENCE_SOURCE), form: z.literal('notice'), summary: z.string(),
  schemaVersion: z.literal(1), sessionId: z.string().min(1), selectionId: z.string().min(1), identity: identitySchema,
}).strict();
const evidenceSchema = z.object({
  sessionId: z.string(), marker: markerSchema.nullable(), conflict: z.boolean(),
}).strict();
/** Pure native projection: raw inbox events survive compaction; foreign fork markers do not bind. */
export const evidenceProjection = {
  key: EVIDENCE_KEY, stateSchema: evidenceSchema, stateVersion: 1,
  init: header => ({ sessionId: header.id, marker: null, conflict: false }),
  apply(state, event) {
    if (event.type !== 'agent/inbox/spliced' || !Array.isArray(event.data?.inserted)) return state;
    let result = state;
    for (const message of event.data.inserted) {
      const source = message?.source;
      if (source?.kind !== EVIDENCE_SOURCE || source.sessionId !== state.sessionId) continue;
      const parsed = markerSchema.safeParse(source);
      if (!parsed.success || message.role !== 'user') { result = { ...result, conflict: true }; continue; }
      const marker = parsed.data;
      if (result.marker && (result.marker.selectionId !== marker.selectionId || !sameIdentity(result.marker.identity, marker.identity))) {
        result = { ...result, conflict: true };
      } else if (!result.marker) result = { ...result, marker };
    }
    return result;
  },
};
export function bindingNotice(record) {
  return createUserMessage({
    content: [{ type: 'text', text: `[DSH 助理绑定记录 · 非用户任务]\n本会话已明确选择助理 ${record.identity.assistantId}（${record.identity.packageName}@${record.identity.packageVersion}）。此记录只标识绑定，不授权发布、认证或其他操作。运行是否可用以助理基座校验为准。` }],
    source: {
      kind: EVIDENCE_SOURCE, form: 'notice', summary: `助理选择：${record.identity.assistantId}`.slice(0, 120),
      schemaVersion: 1, sessionId: record.sessionId, selectionId: record.selectionId, identity: record.identity,
    },
  });
}
export function isOwnNotice(message, sessionId) {
  return message?.source?.kind === EVIDENCE_SOURCE && message.source.sessionId === sessionId;
}
