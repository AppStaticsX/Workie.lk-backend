# Workie.lk Backend

A comprehensive backend API for Workie.lk - a job marketplace platform connecting clients with skilled workers.

## Features

- **User Management**: Registration, authentication, and profile management
- **Job Posting & Management**: Create, update, and manage job listings
- **Application System**: Workers can apply for jobs with detailed proposals
- **Review & Rating System**: Bidirectional reviews between clients and workers
- **Real-time Notifications**: Keep users updated on job applications and activities
- **Advanced Search**: Filter jobs and workers by various criteria
- **Secure Authentication**: JWT-based authentication with role-based access control

## Technology Stack

- **Runtime**: Node.js
- **Framework**: Express.js
- **Database**: MongoDB with Mongoose ODM
- **Authentication**: JWT (JSON Web Tokens)
- **Validation**: Express Validator
- **Security**: Helmet, CORS, Rate Limiting
- **File Upload**: Multer with Cloudinary integration
- **Email**: Nodemailer

## API Endpoints

### Authentication

- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `GET /api/auth/me` - Get current user
- `POST /api/auth/logout` - User logout
- `POST /api/auth/forgot-password` - Request password reset
- `PUT /api/auth/reset-password/:token` - Reset password
- `PUT /api/auth/change-password` - Change password

### Users

- `GET /api/users` - Get all users (Admin)
- `GET /api/users/:id` - Get user by ID
- `PUT /api/users/:id` - Update user
- `DELETE /api/users/:id` - Deactivate user (Admin)
- `GET /api/users/workers/search` - Search workers
- `GET /api/users/stats/overview` - User statistics (Admin)

### Jobs

- `GET /api/jobs` - Get all jobs with filtering and pagination
- `GET /api/jobs/:id` - Get single job
- `POST /api/jobs` - Create new job (Clients)
- `PUT /api/jobs/:id` - Update job
- `DELETE /api/jobs/:id` - Delete job
- `GET /api/jobs/:id/applications` - Get job applications
- `POST /api/jobs/:id/assign/:workerId` - Assign job to worker
- `POST /api/jobs/:id/complete` - Mark job as completed
- `GET /api/jobs/user/my-jobs` - Get user's jobs

### Applications

- `POST /api/applications` - Create job application (Workers)
- `GET /api/applications` - Get user's applications
- `GET /api/applications/:id` - Get single application
- `PUT /api/applications/:id` - Update application
- `POST /api/applications/:id/accept` - Accept application (Clients)
- `POST /api/applications/:id/reject` - Reject application (Clients)
- `POST /api/applications/:id/withdraw` - Withdraw application (Workers)
- `GET /api/applications/stats/overview` - Application statistics

### Profiles

- `GET /api/profiles/:userId` - Get user profile
- `PUT /api/profiles/:userId` - Update profile
- `POST /api/profiles/:userId/skills` - Add skill
- `PUT /api/profiles/:userId/skills/:skillId` - Update skill
- `DELETE /api/profiles/:userId/skills/:skillId` - Remove skill
- `POST /api/profiles/:userId/experience` - Add work experience
- `POST /api/profiles/:userId/portfolio` - Add portfolio item
- `PUT /api/profiles/:userId/availability` - Update availability
- `GET /api/profiles/search/workers` - Search worker profiles

### Reviews

- `POST /api/reviews` - Create review
- `GET /api/reviews/user/:userId` - Get user reviews
- `GET /api/reviews/:id` - Get single review
- `PUT /api/reviews/:id` - Update review
- `DELETE /api/reviews/:id` - Delete review
- `POST /api/reviews/:id/helpful` - Mark review as helpful
- `POST /api/reviews/:id/report` - Report review
- `GET /api/reviews/job/:jobId` - Get job reviews

### Notifications

- `GET /api/notifications` - Get user notifications
- `GET /api/notifications/unread-count` - Get unread count
- `PUT /api/notifications/:id/read` - Mark as read
- `PUT /api/notifications/mark-all-read` - Mark all as read
- `DELETE /api/notifications/:id` - Delete notification
- `DELETE /api/notifications/clear-all` - Clear all read notifications
- `POST /api/notifications` - Create notification (Admin)

## Getting Started

### Prerequisites

- Node.js (v14 or higher)
- MongoDB
- npm or yarn

### Installation

1. Install dependencies:

```bash
npm install
```

2. Create environment file:

```bash
cp .env.example .env
```

3. Update environment variables in `.env`:

```env
NODE_ENV=development
PORT=5000
MONGODB_URI=mongodb://localhost:27017/workie_db
JWT_SECRET=your_jwt_secret_key_here
JWT_EXPIRE=30d

# Email Configuration
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your_email@gmail.com
EMAIL_PASS=your_email_password

# Cloudinary Configuration
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret

# Frontend URL
CLIENT_URL=http://localhost:5173
```

4. Start the development server:

```bash
npm run dev
```

5. For production:

```bash
npm start
```

## Project Structure

```
backend/
├── models/           # Database models
│   ├── User.js
│   ├── Job.js
│   ├── Application.js
│   ├── Profile.js
│   ├── Review.js
│   └── Notification.js
├── routes/           # API routes
│   ├── auth.js
│   ├── users.js
│   ├── jobs.js
│   ├── applications.js
│   ├── profiles.js
│   ├── reviews.js
│   └── notifications.js
├── middleware/       # Custom middleware
│   ├── auth.js
│   ├── validation.js
│   ├── errorHandler.js
│   └── notFound.js
├── utils/           # Utility functions
├── .env.example     # Environment variables template
├── server.js        # Entry point
└── package.json
```

## Security Features

- **Authentication**: JWT-based authentication
- **Authorization**: Role-based access control
- **Validation**: Input validation on all endpoints
- **Rate Limiting**: Protection against brute force attacks
- **CORS**: Cross-origin resource sharing configuration
- **Helmet**: Security headers
- **Password Hashing**: Bcrypt for password encryption

## Database Models

### User

- Basic user information (name, email, password)
- User type (worker, client, admin)
- Profile picture and contact details
- Account status and verification

### Job

- Job details (title, description, category)
- Budget and location information
- Requirements and skills
- Status tracking
- Client association

### Application

- Worker applications to jobs
- Proposed pricing and timeline
- Cover letter and portfolio
- Status tracking
- Availability information

### Profile

- Extended user information
- Skills and experience
- Portfolio and certifications
- Availability and preferences
- Ratings and completed jobs

### Review

- Bidirectional reviews (client ↔ worker)
- Rating and detailed feedback
- Category-specific ratings
- Job association

### Notification

- Real-time user notifications
- Various notification types
- Read/unread status
- Priority levels

## Error Handling

The API uses consistent error response format:

```json
{
  "success": false,
  "message": "Error description",
  "errors": [] // Validation errors (if any)
}
```

## Success Response Format

```json
{
  "success": true,
  "message": "Success message",
  "data": {} // Response data
}
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

This project is licensed under the MIT License.
