import { isAbsolute } from 'node:path';
import { ManagerError } from '../errors.mjs';

/** Read the native invocation-neutral registry; never maintain a second catalog. */
export function createManager({ skills, agents, workingDirectory, agentPresets }) {
  const contexts = () => agents.list().map(agent => ({
    id: agent.id,
    cwd: workingDirectory.get(agent.session),
    preset: agentPresets.composedPreset(agent.ctx) ?? null,
  }));
  const resolve = ({ sessionId, cwd, signal } = {}) => {
    if (cwd !== undefined && (typeof cwd !== 'string' || !isAbsolute(cwd) || cwd.includes('\0') || cwd.length > 4096)) {
      throw new ManagerError('INVALID_CWD');
    }
    let agent;
    if (sessionId !== undefined) {
      if (typeof sessionId !== 'string' || !sessionId || sessionId.length > 256) throw new ManagerError('INVALID_SESSION');
      agent = agents.get(sessionId);
      if (!agent) throw new ManagerError('SESSION_NOT_LIVE', 404);
    }
    return {
      lookup: { scope: agent, cwd: cwd ?? (agent ? workingDirectory.get(agent.session) : undefined), signal },
      context: agent ? { id: agent.id, cwd: cwd ?? workingDirectory.get(agent.session), preset: agentPresets.composedPreset(agent.ctx) ?? null } : { id: null, cwd: cwd ?? null, preset: null },
    };
  };
  return {
    async list(options) {
      const { lookup, context } = resolve(options);
      const snapshot = await skills.snapshot(lookup);
      return { skills: snapshot.skills, complete: snapshot.complete, contexts: contexts(), context, readOnly: true };
    },
    async detail({ name, ...options } = {}) {
      if (typeof name !== 'string' || name.length > 128 || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(name)) throw new ManagerError('INVALID_NAME');
      const { lookup, context } = resolve(options);
      const skill = await skills.get(name, lookup);
      if (!skill) throw new ManagerError('SKILL_NOT_FOUND', 404);
      return { skill, context, readOnly: true };
    },
  };
}
