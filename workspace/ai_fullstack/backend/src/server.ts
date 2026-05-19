import express, { Request, Response } from 'express';

const app = express();

app.use(express.json());

interface GenerateRequestBody {
  prompt: string;
}

app.post('/generate', async (req: Request<{}, {}, GenerateRequestBody>, res: Response) => {
  const { prompt } = req.body;

  if (typeof prompt !== 'string' || prompt.trim() === '') {
    return res.status(400).json({ error: 'Invalid or missing prompt' });
  }

  try {
    const ollamaResponse = await fetch('http://127.0.0.1:11434/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'gpt-oss:120b-cloud', // Using the model configured on your local system
        prompt: prompt,
        stream: false
      })
    });

    if (!ollamaResponse.ok) {
      throw new Error(`Ollama API error: ${ollamaResponse.statusText}`);
    }

    const data = await ollamaResponse.json() as any;
    res.json({ result: data.response });
  } catch (error) {
    console.error('Error calling Ollama:', error);
    res.status(500).json({ error: 'Failed to generate response from local LLM. Make sure Ollama is running.' });
  }
});

const PORT = process.env.PORT ? Number(process.env.PORT) : 4000;

app.listen(PORT, () => {
  console.log(`Backend server is running on http://localhost:${PORT}`);
});