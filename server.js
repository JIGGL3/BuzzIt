require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const multer = require('multer');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static('public'));
app.use('/uploads', express.static(path.join(__dirname, 'public/uploads')));

mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/buzzit', {
    useNewUrlParser: true,
    useUnifiedTopology: true
})
.then(() => console.log('Connected to MongoDB'))
.catch(err => console.error('MongoDB connection error:', err));

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, 'public/uploads'),
    filename: (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname))
});
const upload = multer({ storage });

const userSchema = new mongoose.Schema({
    name: { type: String, required: true },
    username: { type: String, required: false, unique: true, sparse: true, lowercase: true, trim: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    avatar: { type: String },
    bio: { type: String, default: '' },
    followers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    following: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    blocked: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    isPrivate: { type: Boolean, default: false },
    searchable: { type: Boolean, default: true },
    createdAt: { type: Date, default: Date.now }
});
const User = mongoose.model('User', userSchema);

const postSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    content: String,
    media: String,
    likes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    comments: [{
        user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        content: String,
        createdAt: { type: Date, default: Date.now }
    }],
    createdAt: { type: Date, default: Date.now }
});
const Post = mongoose.model('Post', postSchema);
// ── Message Schemas ───────────────────────────────────
const conversationSchema = new mongoose.Schema({
    participants: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }],
    lastMessage: {
        content: String,
        sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        createdAt: { type: Date }
    },
    updatedAt: { type: Date, default: Date.now }
});
const Conversation = mongoose.model('Conversation', conversationSchema);

const messageSchema = new mongoose.Schema({
    conversation: { type: mongoose.Schema.Types.ObjectId, ref: 'Conversation', required: true },
    sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    content: { type: String, required: true },
    createdAt: { type: Date, default: Date.now }
});
const Message = mongoose.model('Message', messageSchema);



const auth = async (req, res, next) => {
    try {
        const token = req.header('Authorization').replace('Bearer ', '');
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
        const user = await User.findById(decoded.userId);
        if (!user) throw new Error();
        // Auto-fix legacy users missing fields
        let needsSave = false;
        if (!user.username) { user.username = await generateUsername(user.name); needsSave = true; }
        if (!user.followers) { user.followers = []; needsSave = true; }
        if (!user.following) { user.following = []; needsSave = true; }
        if (needsSave) await user.save();
        req.user = user;
        next();
    } catch {
        res.status(401).json({ error: 'Please authenticate' });
    }
};

async function generateUsername(name) {
    const base = name.toLowerCase().replace(/[^a-z0-9]/g, '').substring(0, 15) || 'user';
    let username = base;
    let counter = 1;
    while (await User.findOne({ username })) {
        username = `${base}${counter}`;
        counter++;
    }
    return username;
}

// USERNAME AVAILABILITY CHECK
app.get('/api/check-username', async (req, res) => {
    try {
        const username = (req.query.username || '').toLowerCase().trim();
        if (!username || username.length < 3) return res.json({ available: false });
        if (!/^[a-z0-9_]+$/.test(username)) return res.json({ available: false });
        const existing = await User.findOne({ username });
        res.json({ available: !existing });
    } catch { res.status(500).json({ available: false }); }
});

// AUTH
app.post('/api/signup', async (req, res) => {
    try {
        const { name, email, password, username } = req.body;
        if (await User.findOne({ email })) {
            return res.status(400).json({ error: 'Email already registered' });
        }
        let finalUsername = username ? username.toLowerCase().trim() : await generateUsername(name);
        if (await User.findOne({ username: finalUsername })) {
            finalUsername = await generateUsername(finalUsername);
        }
        const hashedPassword = await bcrypt.hash(password, 10);
        const user = new User({ name, email, password: hashedPassword, username: finalUsername });
        await user.save();
        res.status(201).json({ message: 'User created successfully', username: finalUsername });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Error creating user' });
    }
});

app.post('/api/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = await User.findOne({ email });
        if (!user || !(await bcrypt.compare(password, user.password))) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        // Auto-fix old users missing username/followers/following
        if (!user.username) { user.username = await generateUsername(user.name); await user.save(); }
        if (!user.followers || !user.following) { user.followers = user.followers || []; user.following = user.following || []; await user.save(); }

        const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET || 'your-secret-key', { expiresIn: '7d' });
        res.json({ token });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Error logging in' });
    }
});

// CURRENT USER
app.get('/api/me', auth, (req, res) => {
    res.json({
        _id: req.user._id,
        name: req.user.name,
        username: req.user.username,
        email: req.user.email,
        avatar: req.user.avatar,
        bio: req.user.bio,
        followersCount: req.user.followers.length,
        followingCount: req.user.following.length,
        isPrivate: req.user.isPrivate,
        searchable: req.user.searchable
    });
});

// UPDATE PROFILE (name, bio, username, isPrivate, searchable)
app.patch('/api/me/update', auth, async (req, res) => {
    try {
        const { name, bio, username, isPrivate, searchable } = req.body;
        const user = await User.findById(req.user._id);
        if (name) user.name = name.trim();
        if (bio !== undefined) user.bio = bio.trim();
        if (username && username !== user.username) {
            const taken = await User.findOne({ username: username.toLowerCase() });
            if (taken) return res.status(400).json({ error: 'Username already taken' });
            user.username = username.toLowerCase();
        }
        if (isPrivate !== undefined) user.isPrivate = isPrivate;
        if (searchable !== undefined) user.searchable = searchable;
        await user.save();
        res.json({ message: 'Profile updated' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Error updating profile' });
    }
});

// CHANGE PASSWORD
app.patch('/api/me/change-password', auth, async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;
        const user = await User.findById(req.user._id);
        const valid = await bcrypt.compare(currentPassword, user.password);
        if (!valid) return res.status(400).json({ error: 'Current password is incorrect' });
        user.password = await bcrypt.hash(newPassword, 10);
        await user.save();
        res.json({ message: 'Password updated' });
    } catch (err) { console.error(err); res.status(500).json({ error: 'Error changing password' }); }
});

// GET BLOCKED USERS
app.get('/api/me/blocked', auth, async (req, res) => {
    try {
        const user = await User.findById(req.user._id).populate('blocked', 'name username avatar');
        res.json(user.blocked || []);
    } catch (err) { res.status(500).json({ error: 'Error fetching blocked users' }); }
});

// BLOCK / UNBLOCK USER
app.post('/api/users/:userId/block', auth, async (req, res) => {
    try {
        const targetId = req.params.userId;
        if (targetId === req.user._id.toString()) return res.status(400).json({ error: 'Cannot block yourself' });
        const me = await User.findById(req.user._id);
        if (!me.blocked) me.blocked = [];
        const isBlocked = me.blocked.map(id => id.toString()).includes(targetId);
        if (isBlocked) {
            me.blocked = me.blocked.filter(id => id.toString() !== targetId);
        } else {
            me.blocked.push(targetId);
            // Also unfollow each other
            me.following = me.following.filter(id => id.toString() !== targetId);
            const target = await User.findById(targetId);
            if (target) {
                target.followers = target.followers.filter(id => id.toString() !== req.user._id.toString());
                await target.save();
            }
        }
        await me.save();
        res.json({ isBlocked: !isBlocked });
    } catch (err) { console.error(err); res.status(500).json({ error: 'Error blocking user' }); }
});

// DELETE ACCOUNT
app.delete('/api/me/delete', auth, async (req, res) => {
    try {
        const { password } = req.body;
        const user = await User.findById(req.user._id);
        const valid = await bcrypt.compare(password, user.password);
        if (!valid) return res.status(400).json({ error: 'Incorrect password' });
        await Post.deleteMany({ user: req.user._id });
        await User.findByIdAndDelete(req.user._id);
        res.json({ message: 'Account deleted' });
    } catch (err) { console.error(err); res.status(500).json({ error: 'Error deleting account' }); }
});

// USER SEARCH
app.get('/api/users/search', auth, async (req, res) => {
    try {
        const q = req.query.q || req.query.name || '';
        if (!q.trim()) return res.json([]);
        const users = await User.find({
            $or: [
                { username: { $regex: new RegExp(q.trim(), 'i') } },
                { name: { $regex: new RegExp(q.trim(), 'i') } }
            ],
            _id: { $ne: req.user._id }
        }).select('name username avatar followers').limit(20);

        const result = users.map(u => ({
            _id: u._id,
            name: u.name,
            username: u.username,
            avatar: u.avatar,
            followersCount: u.followers.length,
            isFollowing: u.followers.map(id => id.toString()).includes(req.user._id.toString())
        }));
        res.json(result);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Error searching users' });
    }
});

// SUGGESTED USERS
app.get('/api/users/suggestions/list', auth, async (req, res) => {
    try {
        const me = await User.findById(req.user._id);
        const excludeIds = [...me.following.map(id => id.toString()), req.user._id.toString()];
        const users = await User.find({ _id: { $nin: excludeIds } })
            .select('name username avatar followers').limit(5);
        res.json(users.map(u => ({
            _id: u._id,
            name: u.name,
            username: u.username,
            avatar: u.avatar,
            followersCount: u.followers.length,
            isFollowing: false
        })));
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Error fetching suggestions' });
    }
});

// PUBLIC USER PROFILE
app.get('/api/users/:username', auth, async (req, res) => {
    try {
        const user = await User.findOne({ username: req.params.username }).select('-password -email');
        if (!user) return res.status(404).json({ error: 'User not found' });
        const posts = await Post.find({ user: user._id })
            .populate('user', 'name username avatar')
            .sort({ createdAt: -1 });
        const isFollowing = user.followers.map(id => id.toString()).includes(req.user._id.toString());
        res.json({
            _id: user._id,
            name: user.name,
            username: user.username,
            avatar: user.avatar,
            bio: user.bio,
            followersCount: user.followers.length,
            followingCount: user.following.length,
            isFollowing,
            posts
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Error fetching user profile' });
    }
});

// FOLLOW / UNFOLLOW
app.post('/api/users/:userId/follow', auth, async (req, res) => {
    try {
        const targetId = req.params.userId;
        if (targetId === req.user._id.toString()) {
            return res.status(400).json({ error: 'Cannot follow yourself' });
        }
        const target = await User.findById(targetId);
        if (!target) return res.status(404).json({ error: 'User not found' });
        const me = await User.findById(req.user._id);
        const isFollowing = me.following.map(id => id.toString()).includes(targetId);
        if (isFollowing) {
            me.following = me.following.filter(id => id.toString() !== targetId);
            target.followers = target.followers.filter(id => id.toString() !== req.user._id.toString());
        } else {
            me.following.push(targetId);
            target.followers.push(req.user._id);
        }
        await me.save();
        await target.save();
        res.json({ isFollowing: !isFollowing, followersCount: target.followers.length });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Error following/unfollowing user' });
    }
});

// POSTS
app.post('/api/posts', auth, upload.single('media'), async (req, res) => {
    try {
        const content = req.body.content || '';
        const media = req.file ? `/uploads/${req.file.filename}` : '';
        if (!content && !media) return res.status(400).json({ error: 'Either content or media is required' });
        const post = new Post({ user: req.user._id, content, media });
        await post.save();
        const populated = await Post.findById(post._id).populate('user', 'name username avatar');
        res.status(201).json(populated);
    } catch {
        res.status(500).json({ error: 'Error creating post' });
    }
});

app.post('/api/upload', auth, upload.single('media'), (req, res) => {
    try { res.json({ url: `/uploads/${req.file.filename}` }); }
    catch { res.status(500).json({ error: 'Error uploading file' }); }
});

app.post('/api/upload-avatar', auth, upload.single('avatar'), async (req, res) => {
    try {
        const user = await User.findById(req.user._id);
        user.avatar = `/uploads/${req.file.filename}`;
        await user.save();
        res.json({ message: 'Avatar uploaded successfully', avatar: user.avatar });
    } catch { res.status(500).json({ error: 'Failed to upload avatar' }); }
});

app.get('/api/posts', auth, async (req, res) => {
    try {
        const posts = await Post.find()
            .populate('user', 'name username avatar')
            .populate('comments.user', 'name username avatar')
            .sort({ createdAt: -1 });
        res.json(posts);
    } catch { res.status(500).json({ error: 'Error fetching posts' }); }
});

app.post('/api/posts/:id/like', auth, async (req, res) => {
    try {
        const post = await Post.findById(req.params.id);
        if (!post) return res.status(404).json({ error: 'Post not found' });
        const index = post.likes.indexOf(req.user._id);
        index === -1 ? post.likes.push(req.user._id) : post.likes.splice(index, 1);
        await post.save();
        const updated = await Post.findById(post._id).populate('user', 'name username avatar');
        res.json(updated);
    } catch { res.status(500).json({ error: 'Error liking post' }); }
});

app.post('/api/posts/:id/comment', auth, async (req, res) => {
    try {
        const post = await Post.findById(req.params.id);
        if (!post) return res.status(404).json({ error: 'Post not found' });
        post.comments.push({ user: req.user._id, content: req.body.content });
        await post.save();
        const updated = await Post.findById(req.params.id)
            .populate('user', 'name username avatar')
            .populate('comments.user', 'name username avatar');
        res.json(updated);
    } catch { res.status(500).json({ error: 'Error adding comment' }); }
});

app.get('/api/posts/:id', auth, async (req, res) => {
    try {
        const post = await Post.findById(req.params.id)
            .populate('user', 'name username avatar')
            .populate('comments.user', 'name username avatar');
        if (!post) return res.status(404).json({ error: 'Post not found' });
        res.json(post);
    } catch { res.status(500).json({ error: 'Error fetching post' }); }
});

app.delete('/api/posts/:id', auth, async (req, res) => {
    try {
        const post = await Post.findById(req.params.id);
        if (!post || post.user.toString() !== req.user._id.toString()) {
            return res.status(403).json({ error: 'Not authorized' });
        }
        await post.deleteOne();
        res.json({ message: 'Post deleted successfully' });
    } catch { res.status(500).json({ error: 'Error deleting post' }); }
});

app.get('/api/posts/media', auth, async (req, res) => {
    try {
        const mediaPosts = await Post.find({ media: { $ne: '' } })
            .populate('user', 'name username avatar')
            .sort({ createdAt: -1 });
        res.json(mediaPosts);
    } catch { res.status(500).json({ error: 'Error fetching media posts' }); }
});


// ── MESSAGES ROUTES ───────────────────────────────────

// Get all conversations for current user
app.get('/api/conversations', auth, async (req, res) => {
    try {
        const convs = await Conversation.find({
            participants: req.user._id
        })
        .populate('participants', 'name username avatar')
        .sort({ updatedAt: -1 });
        res.json(convs);
    } catch (err) { console.error(err); res.status(500).json({ error: 'Error fetching conversations' }); }
});

// Create or get existing conversation
app.post('/api/conversations', auth, async (req, res) => {
    try {
        const { participantId } = req.body;
        if (!participantId) return res.status(400).json({ error: 'participantId required' });
        if (participantId === req.user._id.toString()) return res.status(400).json({ error: 'Cannot message yourself' });

        // Check if conversation already exists
        let conv = await Conversation.findOne({
            participants: { $all: [req.user._id, participantId] }
        }).populate('participants', 'name username avatar');

        if (!conv) {
            conv = new Conversation({
                participants: [req.user._id, participantId]
            });
            await conv.save();
            conv = await Conversation.findById(conv._id).populate('participants', 'name username avatar');
        }

        res.json(conv);
    } catch (err) { console.error(err); res.status(500).json({ error: 'Error creating conversation' }); }
});

// Get messages in a conversation
app.get('/api/conversations/:convId/messages', auth, async (req, res) => {
    try {
        const conv = await Conversation.findById(req.params.convId);
        if (!conv) return res.status(404).json({ error: 'Conversation not found' });
        if (!conv.participants.map(p => p.toString()).includes(req.user._id.toString())) {
            return res.status(403).json({ error: 'Not authorized' });
        }

        const messages = await Message.find({ conversation: req.params.convId })
            .populate('sender', 'name username avatar')
            .sort({ createdAt: 1 });
        res.json(messages);
    } catch (err) { console.error(err); res.status(500).json({ error: 'Error fetching messages' }); }
});

// Send a message
app.post('/api/conversations/:convId/messages', auth, async (req, res) => {
    try {
        const { content } = req.body;
        if (!content || !content.trim()) return res.status(400).json({ error: 'Message content required' });

        const conv = await Conversation.findById(req.params.convId);
        if (!conv) return res.status(404).json({ error: 'Conversation not found' });
        if (!conv.participants.map(p => p.toString()).includes(req.user._id.toString())) {
            return res.status(403).json({ error: 'Not authorized' });
        }

        const message = new Message({
            conversation: req.params.convId,
            sender: req.user._id,
            content: content.trim()
        });
        await message.save();

        // Update conversation lastMessage
        conv.lastMessage = {
            content: content.trim(),
            sender: req.user._id,
            createdAt: new Date()
        };
        conv.updatedAt = new Date();
        await conv.save();

        const populated = await Message.findById(message._id).populate('sender', 'name username avatar');
        res.status(201).json(populated);
    } catch (err) { console.error(err); res.status(500).json({ error: 'Error sending message' }); }
});

// PAGE ROUTES
app.get('/post/:id', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.get('/user/:username', (req, res) => res.sendFile(path.join(__dirname, 'public', 'user-profile.html')));
app.get('/messages', (req, res) => res.sendFile(path.join(__dirname, 'public', 'messages.html')));
app.get('/explore', (req, res) => res.sendFile(path.join(__dirname, 'public', 'explore.html')));
app.use('/styles', express.static(path.join(__dirname, 'styles')));
app.use('/js', express.static(path.join(__dirname, 'js')));
app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

// Startup migration: assign usernames to legacy users
async function migrateLegacyUsers() {
    try {
        const legacy = await User.find({ $or: [{ username: null }, { username: { $exists: false } }] });
        for (const user of legacy) {
            user.username = await generateUsername(user.name);
            user.followers = user.followers || [];
            user.following = user.following || [];
            await user.save();
            console.log(`Migrated user: ${user.name} -> @${user.username}`);
        }
        if (legacy.length) console.log(`Done: migrated ${legacy.length} users`);
    } catch (err) { console.error('Migration error:', err); }
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, async () => {
    console.log(`Server running on port ${PORT}`);
    await migrateLegacyUsers();
});