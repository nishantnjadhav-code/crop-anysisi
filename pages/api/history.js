import fs from "fs";
import path from "path";

const historyFile = path.join(
  process.cwd(),
  "data",
  "history.json"
);

export default function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({
      error: "Method not allowed",
    });
  }

  try {
    if (!fs.existsSync(historyFile)) {
      return res.status(200).json({
        history: [],
        count: 0,
      });
    }

    const data = fs.readFileSync(
      historyFile,
      "utf8"
    );

    const history = data.trim()
      ? JSON.parse(data)
      : [];

    return res.status(200).json({
      history: Array.isArray(history)
        ? history
        : [],
      count: Array.isArray(history)
        ? history.length
        : 0,
    });
  } catch (error) {
    console.error(
      "History read error:",
      error
    );

    return res.status(500).json({
      error: "Failed to load history.",
      history: [],
      count: 0,
    });
  }
}