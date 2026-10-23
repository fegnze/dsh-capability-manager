import { fail } from './schema.mjs';

/** Thin capability-checked adapter; the native service owns all execution and cancellation. */
export async function delegateNative(services, options) {
  const { agent, provider: providerName, label, prompt, context, signal = new AbortController().signal, delivery = 'parent' } = options;
  if (!agent || services.agents?.get(agent.id) !== agent) fail('SESSION_NOT_LIVE', 409);
  if (!['clean', 'inherited'].includes(context) || !['parent', 'caller'].includes(delivery)) fail('INVALID_DELEGATION');
  if (typeof providerName !== 'string' || typeof label !== 'string' || !label || label.length > 200 || typeof prompt !== 'string' || !prompt || prompt.length > 50000) fail('INVALID_DELEGATION');
  const service = services.subagents;
  if (!service) fail('DELEGATION_UNAVAILABLE', 503);
  const provider = service.getProvider(providerName);
  if (!provider) fail('DELEGATION_PROVIDER_UNAVAILABLE', 503);
  if (provider.inheritsParentContext !== (context === 'inherited')) fail('DELEGATION_CONTEXT_MISMATCH');
  const request = { parent: agent, prompt: [{ type: 'text', text: prompt }] };
  for (const key of ['agentPreset', 'agentOptions', 'outputSchema']) {
    if (Object.hasOwn(options, key)) {
      if (!provider.capabilities[key]) fail(`UNSUPPORTED_${key.replace(/[A-Z]/g, s => `_${s}`).toUpperCase()}`);
      request[key] = options[key];
    }
  }
  const depth = options.depthLimit ?? service.resolveMaxDepth();
  if (depth !== undefined) {
    if (!Number.isSafeInteger(depth) || depth < 0) fail('INVALID_DEPTH_LIMIT');
    if (!provider.capabilities.depthLimit) fail('UNSUPPORTED_DEPTH_LIMIT');
    request.maxDepth = depth;
  }
  signal.throwIfAborted();
  return service.startActivation({ provider: providerName, label, request, signal, delivery });
}
