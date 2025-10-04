/**
 * AI Routes - API endpoints for AI content generation
 * Uses Puter AI service for generating posts and hashtags
 */

const express = require('express');
const router = express.Router();
const aiService = require('../services/aiService');
const { body, validationResult } = require('express-validator');

// Validation middleware
const validatePostGeneration = [
    body('prompt')
        .isString()
        .isLength({ min: 5, max: 1000 })
        .withMessage('Prompt must be between 5 and 1000 characters'),
    body('postType')
        .optional()
        .isIn(['general', 'job', 'achievement', 'tip', 'question'])
        .withMessage('Invalid post type'),
    body('tone')
        .optional()
        .isString()
        .isLength({ max: 50 })
        .withMessage('Tone must be less than 50 characters'),
    body('maxLength')
        .optional()
        .isInt({ min: 50, max: 2000 })
        .withMessage('Max length must be between 50 and 2000 characters'),
    body('hashtags')
        .optional()
        .isArray({ max: 20 })
        .withMessage('Maximum 20 hashtags allowed'),
    body('model')
        .optional()
        .isIn(['gpt-5', 'gpt-5-nano', 'gpt-5-mini', 'gpt-5-chat-latest'])
        .withMessage('Invalid model specified')
];

const validateHashtagGeneration = [
    body('content')
        .isString()
        .isLength({ min: 10, max: 2000 })
        .withMessage('Content must be between 10 and 2000 characters'),
    body('maxSuggestions')
        .optional()
        .isInt({ min: 1, max: 20 })
        .withMessage('Max suggestions must be between 1 and 20')
];

/**
 * POST /api/ai/generate-post
 * Generate AI content for social media posts
 */
router.post('/generate-post', validatePostGeneration, async (req, res) => {
    try {
        // Check validation errors
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                message: 'Validation errors',
                errors: errors.array()
            });
        }

        const { 
            prompt, 
            postType = 'general', 
            tone = 'professional', 
            maxLength = 300, 
            hashtags = [],
            model = null 
        } = req.body;

        console.log(`📝 Generating post - Type: ${postType}, Tone: ${tone}, Length: ${maxLength}`);

        // Generate content using AI service
        const result = await aiService.generatePost({
            prompt,
            postType,
            tone,
            maxLength,
            hashtags,
            model
        });

        if (result.success) {
            console.log('✅ Post generated successfully');
            res.json({
                success: true,
                data: {
                    content: result.content,
                    model: result.model,
                    postType: postType,
                    tone: tone,
                    characterCount: result.content.length
                },
                message: result.message,
                timestamp: new Date().toISOString()
            });
        } else {
            console.log('❌ Post generation failed');
            res.status(500).json({
                success: false,
                message: result.message,
                timestamp: new Date().toISOString()
            });
        }

    } catch (error) {
        console.error('❌ Generate Post Error:', error.message);
        res.status(500).json({
            success: false,
            message: 'Internal server error occurred during content generation',
            timestamp: new Date().toISOString()
        });
    }
});

/**
 * POST /api/ai/generate-hashtags
 * Generate hashtag suggestions based on content
 */
router.post('/generate-hashtags', validateHashtagGeneration, async (req, res) => {
    try {
        // Check validation errors
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                message: 'Validation errors',
                errors: errors.array()
            });
        }

        const { content, maxSuggestions = 10 } = req.body;

        console.log(`#️⃣ Generating ${maxSuggestions} hashtags for content...`);

        // Generate hashtags using AI service
        const result = await aiService.generateHashtagSuggestions(content, maxSuggestions);

        if (result.success) {
            console.log(`✅ Generated ${result.hashtags.length} hashtags`);
            res.json({
                success: true,
                data: {
                    hashtags: result.hashtags,
                    count: result.hashtags.length
                },
                message: result.message,
                timestamp: new Date().toISOString()
            });
        } else {
            console.log('❌ Hashtag generation failed');
            res.status(500).json({
                success: false,
                message: result.message,
                timestamp: new Date().toISOString()
            });
        }

    } catch (error) {
        console.error('❌ Generate Hashtags Error:', error.message);
        res.status(500).json({
            success: false,
            message: 'Internal server error occurred during hashtag generation',
            timestamp: new Date().toISOString()
        });
    }
});

/**
 * GET /api/ai/models
 * Get available AI models
 */
router.get('/models', async (req, res) => {
    try {
        const models = aiService.getAvailableModels();
        
        res.json({
            success: true,
            data: {
                models: models,
                count: models.length,
                default: 'gpt-5-mini'
            },
            message: 'Available models retrieved successfully',
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('❌ Get Models Error:', error.message);
        res.status(500).json({
            success: false,
            message: 'Failed to retrieve available models',
            timestamp: new Date().toISOString()
        });
    }
});

/**
 * GET /api/ai/health
 * Check AI service health and connectivity
 */
router.get('/health', async (req, res) => {
    try {
        console.log('🏥 Checking AI service health...');
        
        const isHealthy = await aiService.testConnection();
        
        if (isHealthy) {
            res.json({
                success: true,
                data: {
                    status: 'healthy',
                    puterConnection: 'connected',
                    modelsAvailable: aiService.getAvailableModels().length
                },
                message: 'AI service is healthy and connected',
                timestamp: new Date().toISOString()
            });
        } else {
            res.status(503).json({
                success: false,
                data: {
                    status: 'unhealthy',
                    puterConnection: 'disconnected'
                },
                message: 'AI service is not responding',
                timestamp: new Date().toISOString()
            });
        }

    } catch (error) {
        console.error('❌ Health Check Error:', error.message);
        res.status(503).json({
            success: false,
            data: {
                status: 'error',
                puterConnection: 'unknown'
            },
            message: 'Health check failed',
            timestamp: new Date().toISOString()
        });
    }
});

/**
 * POST /api/ai/test
 * Test AI generation with a simple prompt (for debugging)
 */
router.post('/test', async (req, res) => {
    try {
        const { model = 'gpt-5-mini' } = req.body;
        
        console.log('🧪 Running AI test...');
        
        const result = await aiService.generatePost({
            prompt: 'Write a short professional message about the importance of teamwork',
            postType: 'general',
            tone: 'professional',
            maxLength: 200,
            hashtags: [],
            model: model
        });

        res.json({
            success: result.success,
            data: {
                testContent: result.content,
                model: result.model,
                characterCount: result.content ? result.content.length : 0
            },
            message: result.success ? 'AI test completed successfully' : result.message,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('❌ AI Test Error:', error.message);
        res.status(500).json({
            success: false,
            message: 'AI test failed',
            timestamp: new Date().toISOString()
        });
    }
});

// Error handling middleware for this router
router.use((error, req, res, next) => {
    console.error('❌ AI Router Error:', error);
    res.status(500).json({
        success: false,
        message: 'An error occurred in the AI service',
        timestamp: new Date().toISOString()
    });
});

module.exports = router;