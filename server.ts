import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import axios from 'axios';
import { initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { GoogleGenAI } from '@google/genai';
import firebaseConfig from './firebase-applet-config.json' with { type: 'json' };

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

// Initialize Firebase Admin (for background processing of webhooks)
if (getApps().length === 0) {
  initializeApp({
    projectId: firebaseConfig.projectId,
  });
}

const db = getFirestore(firebaseConfig.firestoreDatabaseId);
// Note: In AI Studio, the database ID is often non-default.
// But admin SDK usually picks up the project environment if running in Cloud Run.

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

// Messenger Webhook Handlers
app.get('/webhook/:userId', async (req, res) => {
  const userId = req.params.userId;
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode && token) {
    const configDoc = await db.collection('configs').doc(userId).get();
    if (mode === 'subscribe' && token === configDoc.data()?.verificationToken) {
      console.log('WEBHOOK_VERIFIED');
      res.status(200).send(challenge);
    } else {
      console.log('WEBHOOK_VERIFICATION_FAILED. Mode:', mode, 'Token:', token);
      res.sendStatus(403);
    }
  } else {
    res.sendStatus(400);
  }
});

app.post('/webhook/:userId', express.json(), async (req, res) => {
  const userId = req.params.userId;
  const body = req.body;

  if (body.object === 'page') {
    for (const entry of body.entry) {
      const webhookEvent = entry.messaging[0];
      const senderPsid = webhookEvent.sender.id;

      if (webhookEvent.message) {
        await handleMessage(userId, senderPsid, webhookEvent.message);
      }
    }
    res.status(200).send('EVENT_RECEIVED');
  } else {
    res.sendStatus(404);
  }
});

async function handleMessage(userId: string, senderPsid: string, receivedMessage: any) {
  try {
    const configDoc = await db.collection('configs').doc(userId).get();
    if (!configDoc.exists) return;

    const config = configDoc.data()!;
    const messageText = receivedMessage.text;

    // Track user for broadcasts
    await db.collection('messenger_users').doc(`${userId}_${senderPsid}`).set({
      userId,
      psid: senderPsid,
      lastContact: new Date().toISOString()
    }, { merge: true });

    if (!messageText) return;

    // Fetch products for context
    const productsSnapshot = await db.collection('products').where('userId', '==', userId).get();
    const products = productsSnapshot.docs.map(doc => doc.data());

    // Prepare AI Prompt
    const productsContext = products.map(p => `- ${p.title}: ${p.description}`).join('\n');
    const systemInstruction = `
      ${config.aiPrompt || 'You are a helpful assistant.'}
      
      You represent a business. Here are our products:
      ${productsContext}
      
      GUIDELINES:
      1. If the user asks for products or is new, give the list of titles only and ask them to choose.
      2. If they choose a product, explain it based on the description provided.
      3. After explaining, always append the EXACT product title on a new line (this helps the system identify which product was discussed).
      4. If you don't know, refer to the business owner.
      5. ${config.defaultResponse || ''}
      
      Current Request: ${messageText}
    `;

    const model = ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: messageText,
      config: { systemInstruction }
    });

    const aiResponse = await model;
    const aiText = aiResponse.text;

    // Find if a product title is at the end
    let mediaToSend = null;
    for (const product of products) {
      if (aiText.includes(product.title)) {
        mediaToSend = product;
        break;
      }
    }

    // Send AI Text Response
    await sendToMessenger(config.accessToken, senderPsid, { text: aiText });

    // Send Media if product matched
    if (mediaToSend && mediaToSend.fileUrl) {
      const attachmentType = getAttachmentType(mediaToSend.fileType);
      await sendToMessenger(config.accessToken, senderPsid, {
        attachment: {
          type: attachmentType,
          payload: {
            url: mediaToSend.fileUrl,
            is_selectable: true
          }
        }
      });
    }

  } catch (error) {
    console.error('Error handling message:', error);
  }
}

async function sendToMessenger(accessToken: string, psid: string, message: any) {
  try {
    await axios.post(`https://graph.facebook.com/v12.0/me/messages?access_token=${accessToken}`, {
      recipient: { id: psid },
      message
    });
  } catch (err: any) {
    console.error('Messenger Send Error:', err.response?.data || err.message);
  }
}

function getAttachmentType(type: string) {
  switch (type) {
    case 'image': return 'image';
    case 'video': return 'video';
    case 'audio': return 'audio';
    case 'pdf': return 'file';
    default: return 'file';
  }
}

async function startServer() {
  const PORT = 3000;
  
  // API routes for Broadcast (to be called from client)
  app.post('/api/broadcast', express.json(), async (req, res) => {
    const { userId, type, content, mediaUrl } = req.body;
    try {
      const configDoc = await db.collection('configs').doc(userId).get();
      if (!configDoc.exists) return res.status(404).send('Config not found');
      
      const config = configDoc.data()!;
      const usersSnapshot = await db.collection('messenger_users').where('userId', '==', userId).get();
      
      const sendPromises = usersSnapshot.docs.map(userDoc => {
        const psid = userDoc.data().psid;
        if (type === 'text') {
            return sendToMessenger(config.accessToken, psid, { text: content });
        } else {
            return sendToMessenger(config.accessToken, psid, {
                attachment: {
                    type,
                    payload: { url: mediaUrl }
                }
            });
        }
      });
      
      await Promise.all(sendPromises);
      res.json({ success: true, count: usersSnapshot.size });
    } catch (error) {
      res.status(500).json({ error: String(error) });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
