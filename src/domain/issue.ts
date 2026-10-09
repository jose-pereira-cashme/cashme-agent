export type Attachment = {
  id: string;
  filename: string;
  mimeType: string;
  size: number;
};

export type Assignee = {
  id: string;
  name: string | null;
};

export type Issue = {
  key: string;
  summary: string;
  description: string;
  issueType: string;
  assignee: Assignee | null;
  comments: string;
  attachments: Attachment[];
  systemFields: string;
  linkedDocs?: string;
  referenceImages?: string[];
};
