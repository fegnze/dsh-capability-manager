import { ManagerError } from './errors.mjs';

const GET_KEYS = {
  list: ['sessionId'],
  detail: ['id', 'sessionId'],
  binding: ['sessionId'],
};
const POST_KEYS = {
  previewBind: ['sessionId', 'id'],
  bind: ['sessionId', 'id', 'revision', 'confirm'],
};

/** One control plane shared by HTTP and read-only model tools.
 * Installation is intentionally left to the official Plugins page: Desktop owns
 * package operations, pending scripts and runtime-application feedback there.
 */
export function createAssistantControl(runtime) {
  const check = (input, keys) => {
    if (!input || typeof input !== 'object' || Array.isArray(input)) throw new ManagerError('INVALID_REQUEST');
    for (const key of Object.keys(input)) if (!keys.includes(key)) throw new ManagerError('INVALID_REQUEST');
    for (const key of keys) {
      if (key === 'confirm') continue;
      if (input[key] !== undefined && (typeof input[key] !== 'string' || !input[key].trim() || input[key].length > 4096)) throw new ManagerError('INVALID_REQUEST');
    }
  };
  const required = (input, keys) => {
    for (const key of keys) if (typeof input[key] !== 'string' || !input[key].trim()) throw new ManagerError('INVALID_REQUEST');
  };
  const invoke = async (action, input, signal) => {
    if (!runtime) throw new ManagerError('ASSISTANTS_UNAVAILABLE', 503);
    if (action === 'binding') {
      required(input, ['sessionId']);
      return runtime.readBinding(input.sessionId);
    }
    if (action === 'detail') required(input, ['id']);
    if (action === 'previewBind' || action === 'bind') required(input, ['sessionId', 'id']);
    if (action === 'bind') {
      required(input, ['revision']);
      if (input.confirm !== true) throw new ManagerError('CONFIRM_REQUIRED');
    }
    return runtime[action]({ ...input, signal });
  };
  return {
    async read(action, input = {}, signal) {
      if (!Object.hasOwn(GET_KEYS, action)) throw new ManagerError('UNSUPPORTED_ACTION');
      check(input, GET_KEYS[action]);
      return invoke(action, input, signal);
    },
    async write(action, input = {}, signal) {
      if (!Object.hasOwn(POST_KEYS, action)) throw new ManagerError('UNSUPPORTED_ACTION');
      check(input, POST_KEYS[action]);
      return invoke(action, input, signal);
    },
    async query(action, input = {}, signal) {
      // Preview is read-only even though HTTP uses POST for its structured input.
      if (action === 'previewBind') {
        check(input, POST_KEYS.previewBind);
        return invoke(action, input, signal);
      }
      if (!Object.hasOwn(GET_KEYS, action)) throw new ManagerError('UNSUPPORTED_ACTION');
      check(input, GET_KEYS[action]);
      return invoke(action, input, signal);
    },
  };
}

export function registerAssistantQueryTool(ctx, control) {
  return ctx.tools.register({
    name: 'assistant_manager',
    description: 'List installed assistant capabilities, inspect readiness or session binding, or preview binding. Choose an assistant in the input toolbar; install and remove packages in the official Plugins page.',
    parameters: {
      type: 'object', additionalProperties: false, required: ['action'],
      properties: {
        action: { type: 'string', enum: ['list', 'detail', 'binding', 'previewBind'] },
        id: { type: 'string', description: 'Assistant id from list; required for detail and previewBind.' },
        sessionId: { type: 'string', description: 'Session to inspect; defaults to the calling session.' },
      },
    },
    output: { schema: { type: 'object' }, render: (_args, value) => [{ type: 'text', text: JSON.stringify(value) }] },
    execute: async (args, execution) => {
      const { action, ...input } = args ?? {};
      if (!input.sessionId) {
        const agent = ctx.agents.currentInitiator();
        if (agent) input.sessionId = agent.id;
      }
      return control.query(action, input, execution?.signal);
    },
  });
}
