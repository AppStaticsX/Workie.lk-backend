const express = require('express');
const router = express.Router();
const { auth } = require('../middleware/auth');
const User = require('../models/User');
const Post = require('../models/Post'); // Import the Post model

// Create a new post
router.post('/', auth, async (req, res) => {
  try {
    console.log('📝 Creating new post...');

    const {
      content,
      media,
      privacy,
      location,
      taggedUsers,
      userId,
      userEmail,
      mediaCount,
      hasMedia
    } = req.body;

    // Validate required fields
    if (!content && (!media || media.length === 0)) {
      return res.status(400).json({
        success: false,
        message: 'Post must have content or media'
      });
    }

    // Get user information
    const user = await User.findById(req.user._id).select('firstName lastName email profilePicture');
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    console.log('👤 User found:', {
      id: user._id,
      name: `${user.firstName} ${user.lastName}`
    });

    // Create post object
    const postData = {
      userId: req.user._id,
      userInfo: {
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        profilePicture: user.profilePicture
      },
      content: content || '',
      media: media || [],
      privacy: privacy || 'public',
      location: location || '',
      taggedUsers: taggedUsers || [],
      mediaCount: media ? media.length : 0,
      hasMedia: media ? media.length > 0 : false
    };

    console.log('💾 Creating post in database...');

    // Save post to database
    const newPost = new Post(postData);
    const savedPost = await newPost.save();

    console.log('✅ Post saved successfully:', savedPost._id);

    res.status(201).json({
      success: true,
      message: 'Post created successfully',
      data: savedPost
    });

  } catch (error) {
    console.error('❌ Error creating post:', error);
    console.error('Error details:', error.message);
    console.error('Stack trace:', error.stack);
    
    res.status(500).json({
      success: false,
      message: 'Error creating post',
      error: error.message
    });
  }
});

// Get user's posts
router.get('/user/:userId', auth, async (req, res) => {
  try {
    const { userId } = req.params;
    const { page = 1, limit = 10 } = req.query;

    const posts = await Post.getPaginatedPosts(
      { userId },
      { page: parseInt(page), limit: parseInt(limit) }
    );

    const totalPosts = await Post.countDocuments({ userId });

    res.json({
      success: true,
      data: posts,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: totalPosts,
        pages: Math.ceil(totalPosts / limit)
      }
    });

  } catch (error) {
    console.error('❌ Error fetching user posts:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching posts',
      error: error.message
    });
  }
});

// Get feed posts
router.get('/feed', auth, async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;

    const posts = await Post.getFeedPosts(
      req.user._id,
      { page: parseInt(page), limit: parseInt(limit) }
    );

    const totalPosts = await Post.countDocuments({ 
      privacy: { $in: ['public'] }
    });

    res.json({
      success: true,
      data: posts,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: totalPosts,
        pages: Math.ceil(totalPosts / limit)
      }
    });

  } catch (error) {
    console.error('❌ Error fetching feed posts:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching feed',
      error: error.message
    });
  }
});

// Get video posts for video feed (placed before /:postId to avoid conflicts)
router.get('/videos', async (req, res) => {
  try {
    console.log('🎥 Video endpoint hit!');
    console.log('📝 Query params:', req.query);
    
    const { page = 1, limit = 10 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    console.log('🔍 Searching for video posts...');
    
    // Find posts that have video media
    const posts = await Post.find({
      'media.fileType': 'video',
      privacy: { $in: ['public'] }
    })
    .populate('userId', 'firstName lastName profilePicture')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(parseInt(limit))
    .lean();

    console.log('📊 Found posts with videos:', posts.length);
    console.log('🎬 Raw posts:', posts);
    
    // Let's also check total posts and posts with any media
    const totalPosts = await Post.countDocuments();
    const postsWithMedia = await Post.countDocuments({ 'media': { $exists: true, $ne: [] } });
    const allVideoFileTypes = await Post.distinct('media.fileType');
    
    console.log('📈 Database stats:');
    console.log('   Total posts:', totalPosts);
    console.log('   Posts with media:', postsWithMedia);
    console.log('   All file types found:', allVideoFileTypes);

    // Transform posts for video feed
    const videoPosts = posts.map(post => {
      const videoMedia = post.media.find(m => m.fileType === 'video');
      return {
        id: post._id,
        title: post.content ? post.content.substring(0, 100) + (post.content.length > 100 ? '...' : '') : 'Video Post',
        description: post.content || 'No description available',
        creator: `${post.userInfo.firstName} ${post.userInfo.lastName}`,
        avatar: post.userInfo.profilePicture || '',
        verified: false, // You can add verification logic here
        likes: post.likes.length,
        comments: post.comments.length,
        views: `${Math.floor(Math.random() * 50)}K`, // You can implement actual view tracking
        duration: "0:00", // You can store actual duration in media object
        category: "General", // You can add category field to posts
        thumbnail: videoMedia ? videoMedia.url : '',
        videoUrl: videoMedia ? videoMedia.url : '',
        createdAt: post.createdAt,
        location: post.location || '',
        userId: post.userId._id
      };
    });

    const totalVideos = await Post.countDocuments({
      'media.fileType': 'video',
      privacy: { $in: ['public'] }
    });

    res.json({
      success: true,
      data: videoPosts,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: totalVideos,
        pages: Math.ceil(totalVideos / parseInt(limit))
      }
    });

  } catch (error) {
    console.error('❌ Error fetching video posts:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching video posts',
      error: error.message
    });
  }
});

// Get single post
router.get('/:postId', auth, async (req, res) => {
  try {
    const { postId } = req.params;

    // TODO: Implement when Post model is created
    // const post = await Post.findById(postId)
    //   .populate('userId', 'firstName lastName profilePicture');

    // For now, return mock data
    const post = {
      _id: postId,
      content: 'Sample post content',
      media: [],
      createdAt: new Date()
    };

    res.json({
      success: true,
      data: post
    });

  } catch (error) {
    console.error('❌ Error fetching post:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching post',
      error: error.message
    });
  }
});

// Delete post
router.delete('/:postId', auth, async (req, res) => {
  try {
    const { postId } = req.params;

    // TODO: Implement when Post model is created
    // const post = await Post.findById(postId);
    // 
    // if (!post) {
    //   return res.status(404).json({
    //     success: false,
    //     message: 'Post not found'
    //   });
    // }
    //
    // // Check if user owns the post
    // if (post.userId.toString() !== req.user._id.toString()) {
    //   return res.status(403).json({
    //     success: false,
    //     message: 'Not authorized to delete this post'
    //   });
    // }
    //
    // await Post.findByIdAndDelete(postId);

    res.json({
      success: true,
      message: 'Post deleted successfully'
    });

  } catch (error) {
    console.error('❌ Error deleting post:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting post',
      error: error.message
    });
  }
});

// Like/Unlike post
router.post('/:postId/like', auth, async (req, res) => {
  try {
    const { postId } = req.params;
    const userId = req.user._id;

    // TODO: Implement when Post model is created
    // const post = await Post.findById(postId);
    // 
    // if (!post) {
    //   return res.status(404).json({
    //     success: false,
    //     message: 'Post not found'
    //   });
    // }
    //
    // const likeIndex = post.likes.indexOf(userId);
    // if (likeIndex > -1) {
    //   // Unlike
    //   post.likes.splice(likeIndex, 1);
    // } else {
    //   // Like
    //   post.likes.push(userId);
    // }
    //
    // await post.save();

    res.json({
      success: true,
      message: 'Like toggled successfully'
    });

  } catch (error) {
    console.error('❌ Error toggling like:', error);
    res.status(500).json({
      success: false,
      message: 'Error toggling like',
      error: error.message
    });
  }
});

// Add comment
router.post('/:postId/comments', auth, async (req, res) => {
  try {
    const { postId } = req.params;
    const { comment } = req.body;
    const userId = req.user._id;

    // Validate comment
    if (!comment || comment.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Comment content is required'
      });
    }

    // Get user information for the comment
    const user = await User.findById(userId).select('firstName lastName profilePicture');
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Find and update the post
    const post = await Post.findById(postId);
    if (!post) {
      return res.status(404).json({
        success: false,
        message: 'Post not found'
      });
    }

    // Create comment object
    const newComment = {
      userId: userId,
      userInfo: {
        firstName: user.firstName,
        lastName: user.lastName,
        profilePicture: user.profilePicture || ''
      },
      comment: comment.trim(),
      commentedAt: new Date()
    };

    // Add comment to post
    post.comments.unshift(newComment); // Add to beginning for newest first
    await post.save();

    console.log('✅ Comment added successfully to post:', postId);

    res.json({
      success: true,
      message: 'Comment added successfully',
      data: {
        comment: newComment,
        totalComments: post.comments.length
      }
    });

  } catch (error) {
    console.error('❌ Error adding comment:', error);
    res.status(500).json({
      success: false,
      message: 'Error adding comment',
      error: error.message
    });
  }
});

// Get comments for a post
router.get('/:postId/comments', async (req, res) => {
  try {
    const { postId } = req.params;
    const { page = 1, limit = 20 } = req.query;
    
    console.log('📖 Fetching comments for post:', postId, 'page:', page, 'limit:', limit);

    const post = await Post.findById(postId)
      .select('comments')
      .populate({
        path: 'comments.userId',
        select: 'firstName lastName profilePicture'
      });
      
    if (!post) {
      console.log('❌ Post not found:', postId);
      return res.status(404).json({
        success: false,
        message: 'Post not found'
      });
    }

    console.log('📋 Post found with', post.comments.length, 'comments');
    console.log('📋 Sample comment:', post.comments[0]);

    // Calculate pagination
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + parseInt(limit);
    const paginatedComments = post.comments.slice(startIndex, endIndex);
    
    console.log('📤 Sending', paginatedComments.length, 'comments');

    res.json({
      success: true,
      data: {
        comments: paginatedComments,
        totalComments: post.comments.length,
        page: parseInt(page),
        limit: parseInt(limit),
        hasMore: endIndex < post.comments.length
      }
    });

  } catch (error) {
    console.error('❌ Error fetching comments:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching comments',
      error: error.message
    });
  }
});

module.exports = router;
