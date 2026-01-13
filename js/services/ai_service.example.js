/**
 * AI Service for FieldHub
 * Uses Groq API with Llama 3.3 70B model for AI features
 */

const AIService = {
    // API Configuration
    // Get your FREE key from: https://console.groq.com/keys
    API_KEY: 'YOUR_GROQ_API_KEY_HERE',

    // Groq API with Llama 3.3 70B (by Meta) - very popular open-source model
    API_URL: 'https://api.groq.com/openai/v1/chat/completions',
    MODEL: 'llama-3.3-70b-versatile',

    /**
     * Generic AI generation
     */
    generate: async function (prompt, systemPrompt = 'You are a helpful assistant.') {
        if (this.API_KEY === 'YOUR_GROQ_API_KEY_HERE') {
            throw new Error('Please set your Groq API key in js/services/ai_service.js');
        }

        const response = await fetch(this.API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.API_KEY}`
            },
            body: JSON.stringify({
                model: this.MODEL,
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: prompt }
                ],
                temperature: 0.7,
                max_tokens: 1024
            })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error?.message || 'AI request failed');
        }

        const data = await response.json();
        return data.choices[0].message.content;
    },

    /**
     * Generate daily briefing for admin
     */
    generateBriefing: async function (stats, attendanceLogs, reports, leaves) {
        const prompt = `You are an NGO field operations analyst. Generate a brief morning briefing (max 200 words) based on this data:

**Staff Statistics:**
- Total Staff: ${stats.totalWorkers}
- Currently Active: ${stats.activeNow}
- On Leave: ${stats.onLeave}

**Recent Attendance (last 20 logs):**
${attendanceLogs.slice(0, 10).map(l => `- ${l.userName}: ${l.action} at ${new Date(l.timestamp).toLocaleTimeString()}`).join('\n')}

**Recent Reports (last 5):**
${reports.slice(0, 5).map(r => `- ${r.content?.substring(0, 100)}...`).join('\n')}

**Pending Leave Requests:** ${leaves.filter(l => l.status === 'pending').length}

Provide:
1. A quick summary of operations status
2. Key things to focus on today
3. Any concerns or recommendations

Keep it professional but friendly. Use bullet points.`;

        return this.generate(prompt, 'You are an operations analyst for an NGO. Be concise and actionable.');
    },

    /**
     * Translate text to target language
     */
    translate: async function (text, targetLanguage) {
        const prompt = `Translate the following text to ${targetLanguage}. Only return the translated text, nothing else:

"${text}"`;

        return this.generate(prompt, `You are a professional translator. Translate accurately to ${targetLanguage}.`);
    }
};

// Make it available globally
window.AIService = AIService;
