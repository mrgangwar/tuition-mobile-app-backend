export const getStudentPhoto = (photoPath) => {
  const BASE_URL = 'https://tuition-mobile-app-backend.onrender.com'; // Aapka production URL
  
  if (!photoPath) {
    // Agar photo nahi hai toh ek default "Avatar" dikhao
    return 'https://ui-avatars.com/api/?name=User&background=6C5CE7&color=fff';
  }

  // Agar path ke aage slash nahi hai toh lagao, aur BASE_URL ke saath jodo
  const cleanPath = photoPath.startsWith('/') ? photoPath : `/${photoPath}`;
  return `${BASE_URL}${cleanPath}`;
};