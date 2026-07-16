interface TextNode {
  type: "text";
  text: string;
}

interface MentionNode {
  type: "mention";
  attrs: { id: string; text: string };
}

type InlineNode = TextNode | MentionNode;

interface ParagraphNode {
  type: "paragraph";
  content: InlineNode[];
}

export interface AdfDocument {
  version: 1;
  type: "doc";
  content: ParagraphNode[];
}

export function text(value: string): TextNode {
  return { type: "text", text: value };
}

export function mention(id: string, name: string | null): MentionNode {
  return { type: "mention", attrs: { id, text: `@${name ?? "reporter"}` } };
}

export function paragraph(...content: InlineNode[]): ParagraphNode {
  return { type: "paragraph", content };
}

export function doc(...content: ParagraphNode[]): AdfDocument {
  return { version: 1, type: "doc", content };
}

export function buildFailureComment(args: {
  reason: string;
  reporterAccountId: string | null;
  reporterName: string | null;
}): AdfDocument {
  const intro: InlineNode[] = [];
  if (args.reporterAccountId) {
    intro.push(mention(args.reporterAccountId, args.reporterName), text(" "));
  }
  intro.push(text("A automação não conseguiu concluir esta tarefa."));

  return doc(
    paragraph(...intro),
    paragraph(text(`Motivo: ${args.reason}`)),
  );
}

export function buildSuccessComment(args: {
  prUrl: string;
  summary: string;
}): AdfDocument {
  const paragraphs: ParagraphNode[] = [
    paragraph(text("A automação concluiu esta tarefa e abriu um pull request.")),
    paragraph(text(`Resumo: ${args.summary}`)),
    paragraph(text(`Pull request: ${args.prUrl}`)),
  ];

  return doc(...paragraphs);
}

export function buildResearchComment(findings: string): AdfDocument {
  // Split the markdown findings into blocks so each becomes its own paragraph.
  // Empty text nodes are rejected by Jira, so blanks are filtered out.
  const blocks = findings.split(/\n{2,}/).map((b) => b.trim()).filter(Boolean);
  const body = blocks.length > 0 ? blocks : ["(sem resultados)"];

  return doc(
    paragraph(text("Resultado da investigação:")),
    ...body.map((block) => paragraph(text(block))),
  );
}
