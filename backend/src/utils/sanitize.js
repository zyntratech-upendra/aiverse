/**
 * Utility to pick allowed fields from an object, preventing mass assignment vulnerabilities.
 * @param {Object} obj - The object to pick from (e.g., req.body)
 * @param {Array<string>} allowedFields - Array of allowed keys
 * @returns {Object} A new object with only the allowed fields
 */
function pick(obj, allowedFields) {
  if (!obj || typeof obj !== 'object') return {};
  const result = {};
  for (const key of allowedFields) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      result[key] = obj[key];
    }
  }
  return result;
}

module.exports = {
  pick,
};
