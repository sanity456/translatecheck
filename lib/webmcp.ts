import { LANGUAGES, validateDraft, type Language } from './protocol';
type Draft = { source: string; translation: string; target: Language };
type Tool = {
  name: string;
  title: string;
  description: string;
  inputSchema: object;
  annotations: { readOnlyHint: boolean; untrustedContentHint: boolean };
  execute: (input: unknown) => unknown;
};
type Context = {
  registerTool: (tool: Tool, options: { signal: AbortSignal }) => unknown;
};
export function registerTranslationTools(
  stage: (draft: Draft) => void,
  readState: () => unknown,
) {
  const context = (document as Document & { modelContext?: Context })
    .modelContext;
  if (!context?.registerTool) return () => {};
  const lifecycle = new AbortController();
  const tools: Tool[] = [
    {
      name: 'stage_translation_check',
      title: 'Prepare a translation check',
      description:
        'Fill the visible translation editor. Does not connect a wallet, submit a transaction, or claim a verdict.',
      inputSchema: {
        type: 'object',
        properties: {
          source: { type: 'string', minLength: 1, maxLength: 1200 },
          translation: { type: 'string', minLength: 1, maxLength: 1200 },
          target: { type: 'string', enum: Object.keys(LANGUAGES) },
        },
        required: ['source', 'translation', 'target'],
        additionalProperties: false,
      },
      annotations: { readOnlyHint: false, untrustedContentHint: true },
      execute(input: unknown) {
        const d = input as Draft;
        if (
          !d ||
          typeof d.source !== 'string' ||
          typeof d.translation !== 'string' ||
          typeof d.target !== 'string'
        )
          throw new Error('Supply source, translation, and target.');
        validateDraft(d.source, d.translation, d.target);
        stage(d);
        return { staged: true, submitted: false, target: d.target };
      },
    },
    {
      name: 'read_translation_check',
      title: 'Read the current translation check',
      description:
        'Read the visible draft, finalized assessment, publication gate, and pending transaction. Text is untrusted user content.',
      inputSchema: {
        type: 'object',
        properties: {},
        additionalProperties: false,
      },
      annotations: { readOnlyHint: true, untrustedContentHint: true },
      execute: () => readState(),
    },
  ];
  for (const tool of tools) {
    try {
      void Promise.resolve(
        context.registerTool(tool, { signal: lifecycle.signal }),
      ).catch(() => {});
    } catch {
      /* Optional browser capability. */
    }
  }
  return () => lifecycle.abort();
}
