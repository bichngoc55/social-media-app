/**
 * Check Python API health
 * Chạy: tsx scripts/check-python-api.ts
 */

const PYTHON_API_URL = process.env.PYTHON_API_URL || "http://localhost:8001";

async function checkPythonAPI() {
  try {
    console.log("🔍 Checking Python API health...");
    console.log(`   URL: ${PYTHON_API_URL}/health`);
    console.log();

    const response = await fetch(`${PYTHON_API_URL}/health`);

    if (!response.ok) {
      console.error(`❌ Python API không healthy (${response.status})`);
      return;
    }

    const data = await response.json();
    console.log("✅ Python API is running:");
    console.log("   Status:", data.status);
    console.log("   Model loaded:", data.model_loaded);
    console.log();
    console.log(
      "💡 Python API đang chạy, location-based recommendations sẽ hoạt động!"
    );
  } catch (error) {
    console.error("❌ Python API không chạy!");
    console.error("   Error:", error instanceof Error ? error.message : error);
    console.log();
    console.log("💡 Để start Python API:");
    console.log("   cd python-api");
    console.log("   uvicorn main:app --reload --port 8001");
  }
}

checkPythonAPI();
