export type TextNode = {
  type: "text";
  text: string;
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

export type AdfDocument = {
  version: 1;
  type: "doc";
  content: ParagraphNode[];
};
