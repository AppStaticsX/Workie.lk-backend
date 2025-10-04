/**
 * AI Service using Puter's JavaScript SDK
 * Provides AI content generation for Workie platform
 */

const axios = require('axios');

class AIService {
    constructor() {
        this.models = {
            'gpt-5': 'gpt-5',
            'gpt-5-nano': 'gpt-5-nano', 
            'gpt-5-mini': 'gpt-5-mini',
            'gpt-5-chat-latest': 'gpt-5-chat-latest'
        };
        this.defaultModel = 'gpt-5-mini'; // Fast and efficient
        this.puterApiUrl = 'https://api.puter.com/drivers/openai/v1/chat/completions';
    }

    /**
     * Generate AI content using Puter's API
     * @param {string} prompt - User prompt
     * @param {Object} options - Generation options
     * @returns {Promise<Object>} Generated content response
     */
    async generatePost({
        prompt,
        postType = 'general',
        tone = 'professional',
        maxLength = 300,
        hashtags = [],
        model = null
    }) {
        try {
            const selectedModel = model || this.defaultModel;
            const systemPrompt = this._buildSystemPrompt(postType, tone, maxLength, hashtags);
            
            console.log(`🤖 Generating content using ${selectedModel}...`);
            
            // Use direct API call to Puter since we're in Node.js
            const response = await this._callPuterAPI(systemPrompt, prompt, selectedModel);
            
            if (response && response.content) {
                const cleanedContent = this._cleanupContent(response.content);
                
                return {
                    success: true,
                    content: cleanedContent,
                    model: selectedModel,
                    message: 'Content generated successfully'
                };
            } else {
                throw new Error('Invalid response format from AI service');
            }
            
        } catch (error) {
            console.error('❌ AI Generation Error:', error.message);
            
            return {
                success: false,
                content: '',
                model: model || this.defaultModel,
                message: `Failed to generate content: ${error.message}`
            };
        }
    }

    /**
     * Generate hashtag suggestions
     * @param {string} content - Post content
     * @param {number} maxSuggestions - Maximum number of hashtags
     * @returns {Promise<Object>} Hashtag suggestions
     */
    async generateHashtagSuggestions(content, maxSuggestions = 10) {
        try {
            const prompt = `Based on this post content, suggest ${maxSuggestions} relevant hashtags for a professional platform like LinkedIn.

Post content: "${content}"

Return only the hashtags (without # symbol), one per line, no additional text or formatting.`;

            const response = await this._callPuterAPI(
                'You are a hashtag expert for professional social media platforms.',
                prompt,
                'gpt-5-nano' // Use fastest model for hashtags
            );

            if (response && response.content) {
                const hashtags = response.content
                    .split('\n')
                    .map(line => line.trim())
                    .filter(line => line.length > 0)
                    .map(line => line.replace(/^#/, '').trim())
                    .filter(tag => tag.length > 0)
                    .slice(0, maxSuggestions);

                return {
                    success: true,
                    hashtags: hashtags,
                    message: 'Hashtags generated successfully'
                };
            }

            throw new Error('Invalid response format');

        } catch (error) {
            console.error('❌ Hashtag Generation Error:', error.message);
            
            return {
                success: false,
                hashtags: [],
                message: `Failed to generate hashtags: ${error.message}`
            };
        }
    }

    /**
     * Call Puter AI API directly
     * @private
     */
    async _callPuterAPI(systemPrompt, userPrompt, model) {
        try {
            const requestBody = {
                model: model,
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: userPrompt }
                ],
                max_tokens: 500,
                temperature: 0.7,
                top_p: 0.9
            };

            console.log(`📡 Calling Puter API with model: ${model}`);
            
            const response = await axios.post(this.puterApiUrl, requestBody, {
                headers: {
                    'Content-Type': 'application/json',
                    'User-Agent': 'Workie/1.0'
                },
                timeout: 30000 // 30 seconds timeout
            });

            if (response.status === 200 && response.data) {
                console.log('✅ Puter API response received');
                
                // Handle OpenAI format response
                if (response.data.choices && response.data.choices.length > 0) {
                    const choice = response.data.choices[0];
                    if (choice.message && choice.message.content) {
                        return {
                            content: choice.message.content,
                            model: model
                        };
                    }
                }

                // Handle direct content response
                if (response.data.content) {
                    return {
                        content: response.data.content,
                        model: model
                    };
                }

                console.warn('⚠️ Unexpected response format:', Object.keys(response.data));
                throw new Error('Unexpected response format from Puter API');
            }

            throw new Error(`HTTP ${response.status}: ${response.statusText}`);

        } catch (error) {
            if (error.response) {
                console.error('❌ Puter API Error:', error.response.status, error.response.data);
                throw new Error(`Puter API Error: ${error.response.status}`);
            } else if (error.code === 'ECONNABORTED') {
                throw new Error('Request timeout - Puter API took too long to respond');
            } else {
                console.error('❌ Network Error:', error.message);
                throw new Error(`Network error: ${error.message}`);
            }
        }
    }

    /**
     * Build system prompt based on requirements
     * @private
     */
    _buildSystemPrompt(postType, tone, maxLength, hashtags) {
        let basePrompt = `You are an expert social media content creator for Workie, a professional platform for skilled workers and job seekers.

Create engaging, professional social media posts that:
- Are authentic and relatable
- Include relevant emojis naturally
- Use proper grammar and formatting
- Are optimized for engagement`;

        // Add post type specific instructions
        switch (postType) {
            case 'job':
                basePrompt += '\n- Focus on job opportunities, career advice, or professional development';
                break;
            case 'achievement':
                basePrompt += '\n- Celebrate accomplishments and milestones professionally';
                break;
            case 'tip':
                basePrompt += '\n- Share valuable tips, insights, or industry knowledge';
                break;
            case 'question':
                basePrompt += '\n- Engage the community with thoughtful questions';
                break;
            case 'general':
            default:
                basePrompt += '\n- Create general professional content suitable for the platform';
                break;
        }

        // Add tone specification
        if (tone && tone !== 'professional') {
            basePrompt += `\n- Use a ${tone} tone throughout the post`;
        }

        // Add length constraint
        if (maxLength) {
            basePrompt += `\n- Keep the post under ${maxLength} characters`;
        }

        // Add hashtag guidance
        if (hashtags && hashtags.length > 0) {
            basePrompt += `\n- Consider incorporating these hashtags naturally: ${hashtags.join(', ')}`;
        }

        basePrompt += `\n\nRules:
- Do NOT include hashtags in the generated content (they will be added separately)
- Do NOT use quotation marks around the entire post
- Do NOT add meta-commentary like "Here's your post:"
- Return ONLY the post content, nothing else
- Keep it engaging but professional`;

        return basePrompt;
    }

    /**
     * Clean up generated content
     * @private
     */
    _cleanupContent(content) {
        if (!content) return '';
        
        // Remove common unwanted patterns
        content = content.trim();
        
        // Remove quotes if the entire content is wrapped in quotes
        if ((content.startsWith('"') && content.endsWith('"')) ||
            (content.startsWith("'") && content.endsWith("'"))) {
            content = content.substring(1, content.length - 1);
        }
        
        // Remove meta-commentary patterns
        const metaPatterns = [
            /^Here's your post:?\s*/i,
            /^Here's a post:?\s*/i,
            /^Post:?\s*/i,
            /^Here you go:?\s*/i,
            /^Content:?\s*/i
        ];
        
        metaPatterns.forEach(pattern => {
            content = content.replace(pattern, '');
        });
        
        return content.trim();
    }

    /**
     * Test connection to Puter API
     */
    async testConnection() {
        try {
            console.log('🧪 Testing Puter AI connection...');
            
            const response = await this._callPuterAPI(
                'You are a helpful assistant.',
                'Say "Hello from Workie backend!" if you can respond.',
                'gpt-5-nano'
            );

            if (response && response.content) {
                console.log('✅ Puter AI connection successful!');
                console.log('📝 Test response:', response.content);
                return true;
            }

            return false;
        } catch (error) {
            console.error('❌ Puter AI connection failed:', error.message);
            return false;
        }
    }

    /**
     * Get available models
     */
    getAvailableModels() {
        return Object.keys(this.models).map(key => ({
            id: key,
            name: this.models[key],
            description: this._getModelDescription(key)
        }));
    }

    /**
     * Get model descriptions
     * @private
     */
    _getModelDescription(modelId) {
        const descriptions = {
            'gpt-5': 'Most capable model, best quality',
            'gpt-5-nano': 'Fastest model, good for quick tasks',
            'gpt-5-mini': 'Balanced speed and quality (recommended)',
            'gpt-5-chat-latest': 'Latest chat optimized model'
        };
        return descriptions[modelId] || 'AI model';
    }
}

module.exports = new AIService();