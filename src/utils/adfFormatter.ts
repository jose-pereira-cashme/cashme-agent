import type { TextNode, MentionNode, InlineNode, ParagraphNode, AdfDocument } from "./types.ts";
import type { RepoOutcome } from "../operations/types.ts";

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

export function buildMultiRepoComment(args: {
  results: RepoOutcome[];
  reporterAccountId: string | null;
  reporterName: string | null;
}): AdfDocument {
  const succeeded = args.results.filter((r) => r.prUrl);
  const failed = args.results.filter((r) => !r.prUrl);

  const intro: InlineNode[] = [];
  if (failed.length > 0 && args.reporterAccountId) {
    intro.push(mention(args.reporterAccountId, args.reporterName), text(" "));
  }
  intro.push(text(
    succeeded.length > 0
      ? "A automação processou esta tarefa nos repositórios abaixo:"
      : "A automação não conseguiu concluir esta tarefa em nenhum repositório:",
  ));

  const lines: ParagraphNode[] = args.results.map((r) =>
    r.prUrl
      ? paragraph(text(`✅ ${r.repo}: ${r.summary ? `${r.summary} — ` : ""}${r.prUrl}`))
      : paragraph(text(`❌ ${r.repo}: ${r.reason ?? "falha desconhecida"}`)),
  );

  return doc(paragraph(...intro), ...lines);
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
