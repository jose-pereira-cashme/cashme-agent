export type Mark = {
  type: "em";
};

export type TextNode = {
  type: "text";
  text: string;
  marks?: Mark[];
};

export type MentionNode = {
  type: "mention";
  attrs: { id: string; text: string };
};

export type InlineNode = TextNode | MentionNode;

export type ParagraphNode = {
  type: "paragraph";
  content: InlineNode[];
};

export type RuleNode = {
  type: "rule";
};

export type BlockNode = ParagraphNode | RuleNode;

export type AdfDocument = {
  version: 1;
  type: "doc";
  content: BlockNode[];
};
