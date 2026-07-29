import type { TextNode, MentionNode, InlineNode, ParagraphNode, BlockNode, RuleNode, AdfDocument } from "./types.ts";
import type { RepoOutcome } from "../operations/types.ts";

const FOOTER_TEXT = "🤖 Este comentário foi gerado autonomamente pelo CashMe Agent.";

export function text(value: string): TextNode {
  return { type: "text", text: value };
}

export function emphasis(value: string): TextNode {
  return { type: "text", text: value, marks: [{ type: "em" }] };
}

export function rule(): RuleNode {
  return { type: "rule" };
}

export function mention(id: string, name: string | null): MentionNode {
  return { type: "mention", attrs: { id, text: `@${name ?? "reporter"}` } };
}

export function paragraph(...content: InlineNode[]): ParagraphNode {
  return { type: "paragraph", content };
}

export function doc(...content: BlockNode[]): AdfDocument {
  return { version: 1, type: "doc", content };
}

export function commentDoc(...content: BlockNode[]): AdfDocument {
  return doc(...content, rule(), paragraph(emphasis(FOOTER_TEXT)));
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

  return commentDoc(
    paragraph(...intro),
    paragraph(text(`Motivo: ${args.reason}`)),
  );
}

export function buildMultiRepoComment(args: {
  results: RepoOutcome[];
  reporterAccountId: string | null;
  reporterName: string | null;
}): AdfDocument {
  const succeeded = args.results.filter((r) => r.branch);
  const failed = args.results.filter((r) => !r.branch);

  const intro: InlineNode[] = [];
  if (failed.length > 0 && args.reporterAccountId) {
    intro.push(mention(args.reporterAccountId, args.reporterName), text(" "));
  }
  intro.push(text(
    succeeded.length > 0
      ? "A automação processou esta tarefa nos repositórios abaixo:"
      : "A automação não conseguiu concluir esta tarefa em nenhum repositório:",
  ));

  const lines: ParagraphNode[] = args.results.flatMap((r) =>
    r.branch
      ? [
        paragraph(text(`✅ ${r.repo}: ${r.summary ? `${r.summary} — ` : ""}branch ${r.branch}`)),
        ...(r.replicas ?? []).map((replica) => paragraph(text(
          replica.prUrl
            ? `↳ ${replica.base}: ${replica.prUrl}`
            : `↳ ${replica.base}: ❌ ${replica.reason ?? "falha desconhecida"}`,
        ))),
      ]
      : [paragraph(text(`❌ ${r.repo}: ${r.reason ?? "falha desconhecida"}`))],
  );

  return commentDoc(paragraph(...intro), ...lines);
}

export function buildResearchComment(args: {
  findings: string;
  reporterAccountId: string | null;
  reporterName: string | null;
}): AdfDocument {
  const intro: InlineNode[] = [];
  if (args.reporterAccountId) {
    intro.push(mention(args.reporterAccountId, args.reporterName), text(" "));
  }

  // Split the markdown findings into blocks so each becomes its own paragraph.
  // Empty text nodes are rejected by Jira, so blanks are filtered out.
  const blocks = args.findings.split(/\n{2,}/).map((b) => b.trim()).filter(Boolean);
  const body = blocks.length > 0 ? blocks : ["(sem resultados)"];

  return commentDoc(
    paragraph(...intro),
    paragraph(text("Resultado da investigação:")),
    ...body.map((block) => paragraph(text(block))),
  );
}
