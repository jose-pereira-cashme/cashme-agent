import express from 'express'
import { handleWebhook } from './operations/HandleWebhook.ts';
import { createQueue } from './queue.ts';

const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET
const PORT = process.env.PORT || 3000

const app = express();
app.use(express.json());

const queue = createQueue(handleWebhook);

app.get("/health", (_req, res) => {
  res.status(200).json({ status: "ok" });
});

app.post("/webhook/agent", (req, res) => {
  const secretHeader = req.header("X-Webhook-Secret")
  const { issueKey } = req.body

  if (secretHeader !== WEBHOOK_SECRET) {
    return res.status(401).json({ error: "unauthorized" });
  }

  if (!issueKey) {
    return res.status(400).json({ error: "missing issue key" });
  }

  queue.enqueue(issueKey)

  return res.status(202).json({ status: "queued", issueKey });
});

app.listen(PORT, () => {
  console.log('Server is running on http://localhost:3000')
})
