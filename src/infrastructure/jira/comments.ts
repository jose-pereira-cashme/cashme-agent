import type { TextNode, MentionNode, InlineNode, ParagraphNode, BlockNode, RuleNode, AdfDocument } from "./adf.ts";
import type { Assignee } from "../../domain/issue.ts";
import type { RepoOutcome, ReplicaOutcome } from "../../domain/outcomes.ts";
import type { Report } from "../../domain/report.ts";

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
  return { type: "mention", attrs: { id, text: `@${name ?? "assignee"}` } };
}

// Opens a comment with an @mention of the assignee, or nothing when the ticket
// has no assignee account to ping.
function introMention(assignee: Assignee | null): InlineNode[] {
  if (!assignee) return [];
  return [mention(assignee.id, assignee.name), text(" ")];
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

function buildFailureComment(args: {
  reason: string;
  assignee: Assignee | null;
}): AdfDocument {
  const intro: InlineNode[] = introMention(args.assignee);
  intro.push(text("A automação não conseguiu concluir esta tarefa."));

  return commentDoc(
    paragraph(...intro),
    paragraph(text(`Motivo: ${args.reason}`)),
  );
}

// Triage could not route the ticket: it is neither an implementation nor a
// research task, or no repository in the catalog matched. Both are usually a
// description problem, so the assignee is pinged and told what is missing.
function buildTriageNeedsInfoComment(args: {
  triageReason: string;
  assignee: Assignee | null;
}): AdfDocument {
  const intro: InlineNode[] = introMention(args.assignee);
  intro.push(text("Não consegui processar este card automaticamente."));

  return commentDoc(
    paragraph(...intro),
    paragraph(text(
      "Pela descrição, não consegui identificar se este card é uma tarefa de implementação (mudança de código) ou de investigação (pesquisa), nem em qual repositório ela deve ser executada.",
    )),
    ...(args.triageReason ? [paragraph(text(`Análise da triagem: ${args.triageReason}`))] : []),
    paragraph(text("Para que eu consiga seguir, revise a descrição do card deixando claro:")),
    paragraph(text("• o que precisa ser feito (implementar uma mudança de código ou investigar/pesquisar algo);")),
    paragraph(text("• qual sistema/repositório é afetado, usando o nome do repositório;")),
    paragraph(text("• o comportamento esperado e, se houver, o passo a passo para reproduzir o problema.")),
    paragraph(text("Depois de atualizar a descrição, é só me acionar novamente neste card.")),
  );
}

// A replica whose cherry-pick conflicted was merged by the agent, and unlike the
// work branch that merge never went through the verify loop. The card says so
// rather than presenting the PR as routine.
function conflictNote(replica: ReplicaOutcome): string {
  const files = replica.resolvedFiles ?? [];
  if (files.length === 0) return "";
  return ` ⚠️ conflito resolvido automaticamente em ${files.join(", ")} — revise com atenção`;
}

function buildMultiRepoComment(args: {
  results: RepoOutcome[];
  assignee: Assignee | null;
}): AdfDocument {
  const succeeded = args.results.filter((r) => r.branch);
  const failed = args.results.filter((r) => !r.branch);

  const intro: InlineNode[] = failed.length > 0
    ? introMention(args.assignee)
    : [];
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
            ? `↳ ${replica.base}: ${replica.prUrl}${conflictNote(replica)}`
            : replica.upToDate
            ? `↳ ${replica.base}: ✅ já contém esta alteração — nenhum PR necessário`
            : `↳ ${replica.base}: ❌ ${replica.reason ?? "falha desconhecida"}`,
        ))),
      ]
      : [paragraph(text(`❌ ${r.repo}: ${r.reason ?? "falha desconhecida"}`))],
  );

  return commentDoc(paragraph(...intro), ...lines);
}

function buildResearchComment(args: {
  findings: string;
  assignee: Assignee | null;
}): AdfDocument {
  const intro: InlineNode[] = introMention(args.assignee);

  // Split the markdown findings into blocks so each becomes its own paragraph.
  // Empty text nodes are rejected by Jira, so blanks are filtered out.
  const blocks = args.findings.split(/\n{2,}/).map((b) => b.trim()).filter(Boolean);
  const body = blocks.length > 0 ? blocks : ["(sem resultados)"];

  return commentDoc(
    // Without an assignee the intro carries nothing, and an empty paragraph is
    // dead space in the comment, so it is dropped rather than rendered blank.
    ...(intro.length > 0 ? [paragraph(...intro)] : []),
    paragraph(text("Resultado da investigação:")),
    ...body.map((block) => paragraph(text(block))),
  );
}

export function renderReport(report: Report): AdfDocument {
  switch (report.kind) {
    case "failure":
      return buildFailureComment(report);
    case "needsInfo":
      return buildTriageNeedsInfoComment(report);
    case "implementation":
      return buildMultiRepoComment(report);
    case "research":
      return buildResearchComment(report);
  }
}
