require('dotenv').config();
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());

// Serve the compiled Vite static files
app.use(express.static(path.join(__dirname, 'public')));

const PORT = process.env.PORT || 28341;
const VAPI_PRIVATE_KEY = process.env.VAPI_PRIVATE_KEY;
const VAPI_ASSISTANT_ID = process.env.VAPI_ASSISTANT_ID;
const VAPI_PHONE_NUMBER_ID = process.env.VAPI_PHONE_NUMBER_ID;

const { OpenAI } = require('openai');
let openai = null;
try {
  openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || 'missing_key' });
} catch (err) {
  console.warn("WARN: OPENAI_API_KEY is missing. AI features will fail until configured.");
}

// In-memory store for call records (replace with DB for production)
const callsDatabase = {};

// 1. Initiate outbound call
app.post('/api/calls', async (req, res) => {
  const { guestPhone, prompt, guestName, guestId, reservationId } = req.body;
  
  if (!guestPhone) {
    return res.status(400).json({ error: 'guestPhone is required' });
  }

  try {
    const payload = {
      assistantId: VAPI_ASSISTANT_ID,
      phoneNumberId: VAPI_PHONE_NUMBER_ID,
      customer: {
        number: guestPhone,
        name: guestName || 'Guest'
      }
    };

    // Only append assistantOverrides if a prompt is explicitly provided
    if (prompt && prompt.trim() !== '') {
      try {
        // 1. Fetch the user's assistant configuration to gracefully clone their provider/model settings
        const assistantRes = await axios.get(
          `https://api.vapi.ai/assistant/${VAPI_ASSISTANT_ID}`,
          { headers: { Authorization: `Bearer ${VAPI_PRIVATE_KEY}` } }
        );
        
        // 2. Clone their model configuration (handle case where model is missing entirely)
        const originalModel = assistantRes.data.model || {};

        // 3. Update or Insert the system prompt inside the messages array
        if (!originalModel.messages) {
          originalModel.messages = [];
        }

        const systemMsgIndex = originalModel.messages.findIndex(msg => msg.role === 'system');
        if (systemMsgIndex >= 0) {
          originalModel.messages[systemMsgIndex].content = prompt;
        } else {
          // If the user created a blank agent with no prompt, force inject the system prompt!
          originalModel.messages.push({ role: 'system', content: prompt });
        }

        payload.assistantOverrides = {
          model: originalModel
        };
      } catch (err) {
        console.warn("Could not fetch base assistant to override prompt, falling back to variable injection", err.message);
        payload.assistantOverrides = {
          variableValues: { custom_prompt: prompt }
        };
      }
    }

    console.log("Initiating call to", guestPhone, "with payload", JSON.stringify(payload, null, 2));

    const response = await axios.post(
      'https://api.vapi.ai/call/phone',
      payload,
      { 
        headers: { 
          Authorization: `Bearer ${VAPI_PRIVATE_KEY}`,
          'Content-Type': 'application/json'
        } 
      }
    );

    const callId = response.data.id;
    
    // Store in our mock database
    callsDatabase[callId] = {
      id: callId,
      guestId,
      reservationId,
      guestName,
      guestPhone,
      prompt,
      status: response.data.status || 'queued',
      createdAt: new Date().toISOString(),
      transcript: '',
      summary: '',
      recordingUrl: ''
    };

    return res.json({ success: true, callId, data: response.data });
  } catch(error) {
    console.error('Vapi API Error:', error.response?.data || error.message);
    return res.status(500).json({ 
      error: 'Failed to initiate call', 
      details: error.response?.data || error.message 
    });
  }
});

// 2. Webhook receiver for Vapi
app.post('/api/webhook/vapi', (req, res) => {
  console.log("Received Vapi Webhook:", req.body.message?.type);
  
  // Vapi sends various events (status update, transcript, end of call report)
  if (req.body.message?.type === 'end-of-call-report') {
    const callId = req.body.message.call.id;
    const { transcript, summary, recordingUrl } = req.body.message;
    
    if (callsDatabase[callId]) {
      callsDatabase[callId].status = 'completed';
      callsDatabase[callId].transcript = transcript;
      callsDatabase[callId].summary = summary;
      callsDatabase[callId].recordingUrl = recordingUrl;
    } else {
      // Save it anyway if we didn't track it initially
      callsDatabase[callId] = {
        id: callId,
        status: 'completed',
        transcript,
        summary,
        recordingUrl,
        updatedAt: new Date().toISOString()
      };
    }
  } else if (req.body.message?.type === 'status-update') {
    const callId = req.body.message.call.id;
    if (callsDatabase[callId]) {
      callsDatabase[callId].status = req.body.message.status;
    }
  }

  // Return exactly what Vapi expects, or just 200 OK
  return res.status(200).send();
});

// 3. Get calls for a specific reservation/guest
app.get('/api/calls', (req, res) => {
  const { reservationId } = req.query;
  const calls = Object.values(callsDatabase);
  
  if (reservationId) {
    const filtered = calls.filter(c => c.reservationId === reservationId);
    return res.json(filtered);
  }
  
  return res.json(calls);
});

// Get specific call details (Proxy to Vapi API)
app.get('/api/calls/:callId', async (req, res) => {
  const { callId } = req.params;
  
  try {
    // Poll Vapi directly to get the real-time transcript and status
    // since webhooks cannot reach localhost.
    const vapiRes = await axios.get(
      `https://api.vapi.ai/call/${callId}`,
      { headers: { Authorization: `Bearer ${VAPI_PRIVATE_KEY}` } }
    );
    
    const callData = vapiRes.data;
    
    // Merge Vapi's live data with our local guest tracking
    if (callsDatabase[callId]) {
      callsDatabase[callId].status = callData.status;
      callsDatabase[callId].transcript = callData.transcript;
      callsDatabase[callId].summary = callData.summary;
      callsDatabase[callId].recordingUrl = callData.recordingUrl;
      return res.json(callsDatabase[callId]);
    }
    
    return res.json(callData);
  } catch (error) {
    console.error('Error polling Vapi:', error.message);
    if (callsDatabase[callId]) {
      return res.json(callsDatabase[callId]);
    }
    return res.status(404).json({ error: 'Call not found' });
  }
});

// OpenAI UI Enhance Route
app.post('/api/enhance-prompt', async (req, res) => {
  const { prompt } = req.body;
  if (!prompt) return res.status(400).json({ error: 'Prompt is required' });

  try {
    const aiRes = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ 
        role: 'system', 
        content: `You are an expert prompt engineer for voice AI agents in the hospitality industry. 
The user is a property manager writing instructions for an outbound call. They might write in Spanish or broken English.
Please wildly ENHANCE and expand their instructions into a highly detailed, professional English system prompt designed for a Voice AI to follow. Do not just translate it. 
Add crucial AI voice behaviors automatically (e.g. "Be highly empathetic, warm, and concise. Wait for the user to answer. Do not sound robotic").
Also provide a strict Spanish translation of this newly enhanced English prompt so the user understands what the AI will now do.
Return ONLY a strictly valid JSON object with {"englishPrompt": "...", "spanishTranslation": "..."}. Do not wrap in markdown tags.` 
      }, { role: 'user', content: prompt }],
      response_format: { type: "json_object" },
      temperature: 0.7
    });
    
    const result = JSON.parse(aiRes.choices[0].message.content);
    return res.json(result);
  } catch (error) {
    console.error('AI Enhance Error:', error);
    return res.status(500).json({ error: 'Failed to enhance prompt.' });
  }
});

// General Translation Route
app.post('/api/translate-text', async (req, res) => {
  const { text, targetLanguage = 'Spanish' } = req.body;
  if (!text) return res.json({ translatedText: '' });

  try {
    const aiRes = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ 
        role: 'system', 
        content: `You are a professional translator. Translate the following text into ${targetLanguage}. Maintain the original tone and context. Only return the translated text.` 
      }, { role: 'user', content: text }],
    });
    
    return res.json({ translatedText: aiRes.choices[0].message.content });
  } catch (error) {
    console.error('Translation Error:', error);
    return res.status(500).json({ error: 'Translation failed.' });
  }
});

// Fallback for React routing
app.use((req, res, next) => {
  if (req.method === 'GET' && !req.path.startsWith('/api')) {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
  } else {
    next();
  }
});

app.listen(PORT, () => {
  console.log(`Backend server running on http://localhost:${PORT}`);
});
