export const getMediaUrl = (path) => {
  if (!path) return null;
  if (path.startsWith("http")) return path;
  if (path.startsWith("data:")) return path; // base64
  if (path.startsWith("blob:")) return path; // object urls
  
  // Ensure we use the backend URL from env
  const baseUrl = import.meta.env.VITE_URL || "http://localhost:5001";
  
  // If path already starts with /api/uploads or /uploads, it's a relative path from our server
  if (path.startsWith("/uploads")) {
    return `${baseUrl}${path}`;
  }
  
  return path;
};
