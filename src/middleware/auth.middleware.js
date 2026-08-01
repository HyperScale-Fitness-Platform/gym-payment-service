function attachUserFromHeaders(req, res, next) {
  req.user = {
    id: req.headers["user-id"],
    email: req.headers["user-email"],
    role: req.headers["user-role"],
  };

  next();
}

module.exports = { attachUserFromHeaders };