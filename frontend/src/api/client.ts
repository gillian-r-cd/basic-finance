const API_BASE_URL = 'http://localhost:8001';

export async function checkHealth() {
  try {
    const response = await fetch(`${API_BASE_URL}/api/health`);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error("Health check failed:", error);
    throw error;
  }
}

