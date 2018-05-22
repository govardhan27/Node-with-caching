const mongoose = require('mongoose');
const requireLogin = require('../middlewares/requireLogin');
const cleanCache = require('../middlewares/cleanCache')
const Blog = mongoose.model('Blog');

module.exports = app => {
  //Get the blog with specified ID
  app.get('/api/blogs/:id', requireLogin, async (req, res) => {
    const blog = await Blog.findOne({
      _user: req.user.id,
      _id: req.params.id
    });

    res.send(blog);
  });

  //Get all blogs that belong to the current user  
  app.get('/api/blogs', requireLogin, async (req, res) => {
    const blogs = await Blog.find({
      _user: req.user.id
    }).cache({
      key: req.user.id
    });
    res.send(blogs);
  });

  //Create a new blog
  app.post('/api/blogs', requireLogin, cleanCache, async (req, res) => {
    const {
      title,
      content
    } = req.body;

    const blog = new Blog({
      title,
      content,
      _user: req.user.id
    });

    try {
      await blog.save();
      res.send(blog);
    } catch (err) {
      res.send(400, err);
    }
  });
};