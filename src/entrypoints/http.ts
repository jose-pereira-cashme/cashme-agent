import express from 'express'

export function startHttp(options: {
  port: number;
  secret: string;
  enqueue: (issueKey: string) => void;
}): void {
  const app = express();
  app.use(express.json());

  app.get("/health", (_req, res) => {
    res.status(200).json({ status: "ok" });
  });

  app.post("/agent", (req, res) => {
    const secretHeader = req.header("X-Agent-Secret")
    const { issueKey } = req.body

    if (secretHeader !== options.secret) {
      return res.status(401).json({ error: "unauthorized" });
    }

    if (!issueKey) {
      return res.status(400).json({ error: "missing issue key" });
    }

    options.enqueue(issueKey)

    return res.status(202).json({ status: "queued", issueKey });
  });

  app.listen(options.port, () => {
    console.log(`Server is running on http://localhost:${options.port}`)
  })
}
