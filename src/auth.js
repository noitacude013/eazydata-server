function authMiddleware(token) {
  return (req, res, next) => {
    const header = req.headers.authorization || '';
    const provided = header.startsWith('Bearer ') ? header.slice(7) : '';
    if (provided && provided === token) return next();
    res.status(401).json({ error: 'unauthorized' });
  };
}
module.exports = { authMiddleware };
