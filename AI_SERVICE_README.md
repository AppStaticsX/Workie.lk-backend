# Workie AI Backend Setup

This guide will help you set up the AI service backend using Puter's JavaScript SDK.

## 📋 Prerequisites

- Node.js (v16 or higher)
- npm or yarn package manager
- Your existing Workie backend server

## 🚀 Installation Steps

### 1. Install Required Dependencies

Navigate to your backend directory and install the required packages:

```bash
cd backend
npm install axios
# or if using yarn:
# yarn add axios
```

Note: The `puter` package is optional since we're using direct HTTP calls to Puter's API.

### 2. Backend Configuration

The AI service is already configured and integrated into your Express server. The following files have been added/modified:

- `services/aiService.js` - Main AI service using Puter API
- `routes/ai.js` - API endpoints for AI functionality
- `server.js` - Updated to include AI routes

### 3. Start Your Backend Server

```bash
# Development mode
npm run dev

# Production mode
npm start
```

### 4. Update Flutter Configuration

In your Flutter app, update the base URL in `ai_post_generation_service.dart`:

```dart
static const String _baseUrl = 'http://YOUR_SERVER_IP:5000/api/ai';
```

For local development, use:
```dart
static const String _baseUrl = 'http://localhost:5000/api/ai';
```

For production, use your actual server URL:
```dart
static const String _baseUrl = 'https://your-domain.com/api/ai';
```

## 🧪 Testing the Service

### Test API Health

```bash
curl http://localhost:5000/api/ai/health
```

### Test Content Generation

```bash
curl -X POST http://localhost:5000/api/ai/generate-post \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "Write about the importance of teamwork in the workplace",
    "postType": "general",
    "tone": "professional",
    "maxLength": 300
  }'
```

### Test Hashtag Generation

```bash
curl -X POST http://localhost:5000/api/ai/generate-hashtags \
  -H "Content-Type: application/json" \
  -d '{
    "content": "Teamwork makes the dream work! Collaboration is key to success in any workplace.",
    "maxSuggestions": 5
  }'
```

### Get Available Models

```bash
curl http://localhost:5000/api/ai/models
```

## 🔧 Available API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/ai/generate-post` | Generate AI content for posts |
| POST | `/api/ai/generate-hashtags` | Generate hashtag suggestions |
| GET | `/api/ai/models` | Get available AI models |
| GET | `/api/ai/health` | Check service health |
| POST | `/api/ai/test` | Run a simple AI test |

## 📱 Flutter Integration

Your Flutter app will now call these endpoints instead of making direct API calls to Puter. The benefits include:

- ✅ **Simplified Flutter code** - No complex API handling in mobile app
- ✅ **Better error handling** - Centralized error management in backend
- ✅ **Easier debugging** - Server-side logging and monitoring
- ✅ **Scalability** - Can add caching, rate limiting, and other optimizations
- ✅ **Security** - API keys and sensitive logic stay on server
- ✅ **Multiple model support** - Easy to switch between different AI models

## 🐛 Troubleshooting

### Backend Connection Issues

1. **Check if backend is running:**
   ```bash
   curl http://localhost:5000/api/health
   ```

2. **Check AI service health:**
   ```bash
   curl http://localhost:5000/api/ai/health
   ```

3. **View backend logs:**
   ```bash
   npm run logs
   ```

### Flutter Connection Issues

1. **Check network permissions** in `android/app/src/main/AndroidManifest.xml`:
   ```xml
   <uses-permission android:name="android.permission.INTERNET" />
   ```

2. **For Android emulator**, use `10.0.2.2` instead of `localhost`:
   ```dart
   static const String _baseUrl = 'http://10.0.2.2:5000/api/ai';
   ```

3. **Enable clear text traffic** for development in `android/app/src/main/AndroidManifest.xml`:
   ```xml
   <application
       android:usesCleartextTraffic="true"
       ...>
   ```

## 🌟 Features

### Available AI Models

- **gpt-5** - Most capable model, best quality
- **gpt-5-nano** - Fastest model, good for quick tasks
- **gpt-5-mini** - Balanced speed and quality (recommended)
- **gpt-5-chat-latest** - Latest chat optimized model

### Post Types Supported

- **General** - General professional content
- **Job** - Job opportunities and career content
- **Achievement** - Celebrate accomplishments
- **Tip** - Share valuable insights
- **Question** - Engage with questions

### Tone Options

- Professional, Casual, Friendly, Motivational, Informative, Humorous, Inspirational, Conversational

## 🚀 Production Deployment

When deploying to production:

1. Update the Flutter base URL to your production server
2. Ensure your server has proper CORS configuration
3. Add proper authentication if needed
4. Consider adding rate limiting for the AI endpoints
5. Monitor API usage and costs

## 📊 Monitoring

The backend includes comprehensive logging:
- Request/response logging
- Error tracking
- Performance monitoring
- Health check endpoints

Check your server logs to monitor AI service usage and performance.