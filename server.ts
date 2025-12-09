import "dotenv/config";
import app from "./app.ts";

const PORT = parseInt(process.env.PORT || "5050", 10);

const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});

server.on('error', (err) => {
  console.error('Server error:', err);
  process.exit(1);
});