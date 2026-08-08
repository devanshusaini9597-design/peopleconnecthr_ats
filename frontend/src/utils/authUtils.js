// Utility function to handle logout — clears all SaaS auth data
export const handleLogout = (navigate) => {
  // Clear all authentication data from localStorage
  localStorage.removeItem('token');
  localStorage.removeItem('isLoggedIn');
  localStorage.removeItem('userEmail');
  localStorage.removeItem('userName');
  localStorage.removeItem('userData');
  localStorage.removeItem('userRole');
  localStorage.removeItem('orgData');
  localStorage.removeItem('orgName');
  localStorage.removeItem('orgId');
  
  // Redirect to login page
  navigate('/login');
};
