function createHttpError(status, message, details = {}) {
  const error = new Error(message);
  error.status = status;
  error.details = details;
  return error;
}

module.exports = {
  createHttpError
};
